'use client'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import type { MenuItem, Restaurant } from '@/lib/types'

interface CartItem extends MenuItem {
  quantity: number
}

export default function MenuPage({ params }: { params: Promise<{ restaurantId: string; tableNumber: string }> }) {
  const rawParams = use(params)
  const restaurantId = decodeURIComponent(rawParams.restaurantId)
  const tableNumber = decodeURIComponent(rawParams.tableNumber)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCart, setShowCart] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const [adCountdown, setAdCountdown] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: rest } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single()
      const { data: menuItems } = await supabase.from('menu_items').select('*')
        .eq('restaurant_id', restaurantId).eq('available', true).order('sort_order')
      setRestaurant(rest)
      setItems(menuItems || [])
      setLoading(false)
    }
    load()
  }, [restaurantId])

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { ...item, quantity: 1 }]
    })
    toast.success(`Added ${item.name}`)
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  async function placeOrder() {
    if (cart.length === 0) return
    // show 5-second ad before placing order
    setAdCountdown(5)
    const interval = setInterval(() => {
      setAdCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(interval); return null }
        return prev - 1
      })
    }, 1000)
    await new Promise(resolve => setTimeout(resolve, 5000))

    setSubmitting(true)
    const { data: tableData } = await supabase.from('tables')
      .select('id').eq('restaurant_id', restaurantId).eq('table_number', tableNumber).maybeSingle()

    const orderId = crypto.randomUUID()
    const { error } = await supabase.from('orders').insert({
      id: orderId,
      restaurant_id: restaurantId,
      table_id: tableData?.id,
      table_number: tableNumber,
      status: 'pending',
      total: cartTotal,
    })

    if (error) { toast.error('Failed to place order: ' + error.message); setSubmitting(false); return }

    const { error: itemsError } = await supabase.from('order_items').insert(
      cart.map(item => ({
        order_id: orderId,
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }))
    )

    if (itemsError) { toast.error('Failed to add items: ' + itemsError.message); setSubmitting(false); return }

    setOrdered(true)
    setCart([])
    setShowCart(false)
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-orange-500 text-lg">Loading menu...</div>
    </div>
  )

  if (!restaurant) return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-gray-500">Menu not found.</div>
    </div>
  )

  if (ordered) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 p-8 text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Order placed!</h2>
      <p className="text-gray-500 mb-6">Your order has been sent to the kitchen. We'll bring it to Table {tableNumber}.</p>
      <button onClick={() => setOrdered(false)} className="bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition">
        Order More
      </button>
    </div>
  )

  // Ad overlay
  if (adCountdown !== null) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-8 text-center">
      <div className="text-sm text-gray-400 mb-6">Advertisement</div>
      <div className="bg-white rounded-2xl p-8 text-gray-800 max-w-sm w-full mb-6">
        <div className="text-4xl mb-3">👑</div>
        <h3 className="text-xl font-bold text-orange-600 mb-2">OrderKing</h3>
        <p className="text-gray-500">Free QR ordering for your restaurant. Sign up at orderking.uk</p>
      </div>
      <div className="text-gray-400 text-sm">Placing your order in {adCountdown}s...</div>
    </div>
  )

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-orange-500 text-white p-5">
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        <p className="text-orange-100 text-sm">Table {tableNumber}</p>
      </div>

      {/* Menu items */}
      <div className="max-w-lg mx-auto p-4 space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border flex items-center gap-4 p-4 shadow-sm">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="h-20 w-20 object-cover rounded-xl flex-shrink-0" />
            ) : (
              <div className="h-20 w-20 bg-orange-50 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">🍽️</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-800">{item.name}</div>
              {item.description && <div className="text-sm text-gray-400 mt-0.5">{item.description}</div>}
              <div className="font-bold text-orange-600 mt-1">${item.price.toFixed(2)}</div>
            </div>
            <button onClick={() => addToCart(item)}
              className="bg-orange-500 text-white w-9 h-9 rounded-full text-xl font-bold hover:bg-orange-600 transition flex-shrink-0 flex items-center justify-center">
              +
            </button>
          </div>
        ))}
      </div>

      {/* Cart button */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto">
          <button onClick={() => setShowCart(true)}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-orange-600 transition flex items-center justify-between px-6">
            <span className="bg-white text-orange-500 rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm">{cartCount}</span>
            <span>View Cart</span>
            <span>${cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Your Order</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="space-y-3 mb-6">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-gray-700">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-full border text-gray-600 flex items-center justify-center hover:bg-gray-50">−</button>
                    <span className="font-semibold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600">+</button>
                    <span className="text-gray-500 w-16 text-right">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 mb-4 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-orange-600">${cartTotal.toFixed(2)}</span>
            </div>
            <button onClick={placeOrder} disabled={submitting}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-600 transition disabled:opacity-50">
              {submitting ? 'Placing order...' : 'Place Order'}
            </button>
            <p className="text-center text-gray-400 text-xs mt-2">A short ad will play before your order is placed</p>
          </div>
        </div>
      )}
    </main>
  )
}
