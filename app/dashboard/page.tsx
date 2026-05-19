'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Restaurant, Order } from '@/lib/types'

export default function DashboardPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: rest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (!rest) { router.push('/auth/login'); return }
      setRestaurant(rest)

      const { data: recentOrders } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('restaurant_id', rest.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setOrders(recentOrders || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-orange-500">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-orange-600">OrderKing</h1>
        <span className="text-gray-600 font-medium">{restaurant?.name}</span>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          Logout
        </button>
      </nav>

      <div className="max-w-5xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/dashboard/menu" className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition text-center">
            <div className="text-3xl mb-2">🍽️</div>
            <div className="font-semibold text-gray-800">Menu</div>
            <div className="text-sm text-gray-400">Add & manage dishes</div>
          </Link>
          <Link href="/dashboard/tables" className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition text-center">
            <div className="text-3xl mb-2">🪑</div>
            <div className="font-semibold text-gray-800">Tables & QR Codes</div>
            <div className="text-sm text-gray-400">Generate QR codes</div>
          </Link>
          <Link href="/dashboard/orders" className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition text-center">
            <div className="text-3xl mb-2">📋</div>
            <div className="font-semibold text-gray-800">Orders</div>
            <div className="text-sm text-gray-400">Live order feed</div>
          </Link>
        </div>

        <h3 className="text-lg font-semibold text-gray-700 mb-3">Recent Orders</h3>
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 border">
            No orders yet. Share your QR codes to get started!
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-xl p-4 border flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">Table {order.table_number}</span>
                  <span className="ml-3 text-gray-400 text-sm">{new Date(order.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-800">${order.total.toFixed(2)}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'ready' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
