'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import type { MenuItem, Category, Restaurant } from '@/lib/types'

interface Props {
  restaurant: Restaurant
  onClose: () => void
  onCreated: () => void
}

interface CartItem extends MenuItem {
  quantity: number
}

export default function NewTakeawayModal({ restaurant, onClose, onCreated }: Props) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase.from('categories').select('*')
        .eq('restaurant_id', restaurant.id).order('sort_order')
      const { data: menuItems } = await supabase.from('menu_items').select('*')
        .eq('restaurant_id', restaurant.id).eq('available', true).order('sort_order')
      setCategories(cats || [])
      setItems(menuItems || [])
      setLoading(false)
    }
    load()
  }, [restaurant.id])

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  async function submit() {
    if (cart.length === 0) { toast.error('请添加菜品 Add at least one item'); return }
    setSubmitting(true)

    // 自动编号：外带 T01, T02...
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .eq('order_type', 'takeaway')
      .gte('created_at', startOfDay.toISOString())
    const tableNumber = `T${String((count || 0) + 1).padStart(2, '0')}`

    const orderId = crypto.randomUUID()
    const { error } = await supabase.from('orders').insert({
      id: orderId,
      restaurant_id: restaurant.id,
      table_id: null,
      table_number: tableNumber,
      order_type: 'takeaway',
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      status: 'pending',
      total: cartTotal,
      notes: notes.trim() || null,
    })
    if (error) { toast.error(error.message); setSubmitting(false); return }

    const { error: itemsError } = await supabase.from('order_items').insert(
      cart.map(item => ({
        order_id: orderId,
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }))
    )
    if (itemsError) { toast.error(itemsError.message); setSubmitting(false); return }

    toast.success(`外带订单 ${tableNumber} 已创建`)
    setSubmitting(false)
    onCreated()
    onClose()
  }

  // Group by category
  const grouped: { cat: Category | null; items: MenuItem[] }[] = []
  const assigned = new Set<string>()
  categories.forEach(cat => {
    const catItems = items.filter(i => i.category_id === cat.id)
    if (catItems.length > 0) {
      grouped.push({ cat, items: catItems })
      catItems.forEach(i => assigned.add(i.id))
    }
  })
  const uncategorized = items.filter(i => !assigned.has(i.id))
  if (uncategorized.length > 0) grouped.push({ cat: null, items: uncategorized })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">🥡 新建外带订单 New Takeaway</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>

        {/* Customer info */}
        <div className="px-5 pt-4 pb-3 grid grid-cols-2 gap-2">
          <input value={customerName} onChange={e => setCustomerName(e.target.value)}
            placeholder="姓名 Name (可选)"
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
            placeholder="电话 Phone (可选)" inputMode="tel"
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-400 py-8">暂无菜品 No menu items</div>
          ) : (
            grouped.map(({ cat, items: catItems }) => (
              <div key={cat?.id ?? 'uncategorized'} className="mb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b pb-1">
                  {cat ? cat.name : '其他'}
                </h3>
                <div className="space-y-1">
                  {catItems.map(item => {
                    const inCart = cart.find(c => c.id === item.id)
                    return (
                      <div key={item.id} className="flex items-center justify-between py-1.5">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-800">{item.name}</span>
                          <span className="ml-2 text-orange-600 font-semibold">${item.price.toFixed(2)}</span>
                        </div>
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => removeFromCart(item.id)}
                              className="w-7 h-7 rounded-full border text-gray-600 flex items-center justify-center hover:bg-gray-50">−</button>
                            <span className="font-semibold w-5 text-center">{inCart.quantity}</span>
                            <button onClick={() => addToCart(item)}
                              className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600">+</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(item)}
                            className="bg-orange-500 text-white w-7 h-7 rounded-full hover:bg-orange-600">+</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notes */}
        <div className="px-5 pb-2">
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="备注 Notes (例如：不要辣)"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50">
          <div className="flex justify-between mb-3">
            <span className="text-gray-600">{cartCount} 件商品</span>
            <span className="font-bold text-xl text-orange-600">${cartTotal.toFixed(2)}</span>
          </div>
          <button onClick={submit} disabled={cart.length === 0 || submitting}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-orange-600 transition disabled:opacity-50">
            {submitting ? '创建中...' : '✓ 创建订单 Create Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
