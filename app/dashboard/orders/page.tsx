'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { Order, Restaurant } from '@/lib/types'

const STATUS_FLOW = ['pending', 'confirmed', 'ready', 'paid'] as const

export default function OrdersPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: rest } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).single()
      if (!rest) { router.push('/auth/login'); return }
      setRestaurant(rest)

      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('restaurant_id', rest.id)
        .neq('status', 'paid')
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!restaurant) return
    const channel = supabase.channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        async () => {
          const { data: refreshed } = await supabase
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('restaurant_id', restaurant.id)
            .neq('status', 'paid')
            .order('created_at', { ascending: false })
          setOrders(refreshed || [])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurant])

  async function advanceStatus(order: Order) {
    const idx = STATUS_FLOW.indexOf(order.status)
    if (idx >= STATUS_FLOW.length - 1) return
    const next = STATUS_FLOW[idx + 1]
    await supabase.from('orders').update({ status: next }).eq('id', order.id)
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: next } : o))
    if (next === 'paid') setOrders(prev => prev.filter(o => o.id !== order.id))
    toast.success(`Order marked as ${next}`)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-orange-500">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">← Back</Link>
        <h1 className="text-xl font-bold text-orange-600">Live Orders</h1>
        <span className="ml-2 bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
          {orders.filter(o => o.status === 'pending').length} new
        </span>
      </nav>

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            No active orders. Waiting for customers...
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className={`bg-white rounded-2xl border p-5 shadow-sm ${order.status === 'pending' ? 'border-orange-300 shadow-orange-100' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-gray-800 text-lg">Table {order.table_number}</span>
                  <span className="ml-3 text-gray-400 text-sm">{new Date(order.created_at).toLocaleTimeString()}</span>
                </div>
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {order.status}
                </span>
              </div>

              <div className="space-y-1 mb-4">
                {order.items?.map(item => (
                  <div key={item.id} className="flex justify-between text-sm text-gray-600">
                    <span>{item.quantity}x {item.name}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <span className="font-bold text-gray-800">Total: ${order.total.toFixed(2)}</span>
                {order.status !== 'paid' && (
                  <button onClick={() => advanceStatus(order)}
                    className="bg-orange-500 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
                    {order.status === 'pending' ? '✓ Confirm' :
                     order.status === 'confirmed' ? '✓ Ready' :
                     '✓ Mark Paid'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
