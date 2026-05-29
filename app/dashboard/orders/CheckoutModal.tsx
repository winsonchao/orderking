'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import type { Order, PaymentMethod, Restaurant } from '@/lib/types'

interface Props {
  orders: Order[]
  restaurant: Restaurant
  onClose: () => void
  onPaid: (paidOrderIds: string[]) => void
}

export default function CheckoutModal({ orders, restaurant, onClose, onPaid }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [cardSurcharge, setCardSurcharge] = useState(restaurant.card_surcharge_pct ?? 1.5)
  const [phActive, setPhActive] = useState(restaurant.ph_active ?? false)
  const [cashReceived, setCashReceived] = useState('')
  const [saving, setSaving] = useState(false)

  const phPct = restaurant.ph_surcharge_pct ?? 10
  const tableNumber = orders[0]?.table_number ?? ''
  const subtotal = orders.reduce((s, o) => s + o.total, 0)
  const allItems = orders.flatMap(o => o.items || [])

  const calc = useMemo(() => {
    let surcharge = 0
    const reasons: string[] = []

    if (phActive) {
      surcharge += subtotal * (phPct / 100)
      reasons.push(`公共假日 PH +${phPct}%`)
    }
    if (method === 'card' && cardSurcharge > 0) {
      const baseForCard = subtotal + (phActive ? subtotal * (phPct / 100) : 0)
      surcharge += baseForCard * (cardSurcharge / 100)
      reasons.push(`刷卡 Card +${cardSurcharge}%`)
    }

    const grandTotal = subtotal + surcharge
    const cash = parseFloat(cashReceived) || 0
    const change = method === 'cash' ? Math.max(0, cash - grandTotal) : 0

    return {
      surcharge,
      surchargeReason: reasons.join(' + '),
      grandTotal,
      change,
      enoughCash: method !== 'cash' || cash >= grandTotal,
    }
  }, [subtotal, method, cardSurcharge, phActive, phPct, cashReceived])

  async function confirmPayment() {
    if (!calc.enoughCash) { toast.error('收到现金不足'); return }
    setSaving(true)

    // 按比例分摊 surcharge 到每张订单 Distribute surcharge proportionally
    const paidAt = new Date().toISOString()
    const updates = orders.map(o => {
      const share = subtotal > 0 ? o.total / subtotal : 0
      const orderSurcharge = parseFloat((calc.surcharge * share).toFixed(2))
      const orderGrandTotal = parseFloat((o.total + orderSurcharge).toFixed(2))
      return {
        id: o.id,
        update: {
          status: 'paid' as const,
          surcharge: orderSurcharge,
          surcharge_reason: calc.surchargeReason || null,
          grand_total: orderGrandTotal,
          payment_method: method,
          cash_received: method === 'cash' ? parseFloat(cashReceived) : null,
          change_given: method === 'cash' ? parseFloat(calc.change.toFixed(2)) : null,
          paid_at: paidAt,
        }
      }
    })

    const errors = await Promise.all(updates.map(u =>
      supabase.from('orders').update(u.update).eq('id', u.id)
    ))
    const failed = errors.find(r => r.error)
    if (failed?.error) { toast.error(failed.error.message); setSaving(false); return }

    toast.success(`已结账 $${calc.grandTotal.toFixed(2)} ✓`)
    onPaid(orders.map(o => o.id))
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">结账 Checkout</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>

        <div className="bg-orange-50 rounded-xl p-3 mb-4 text-sm">
          <div className="font-semibold">第 {tableNumber} 桌 · {orders.length} 张订单</div>
          <div className="text-gray-500 text-xs mt-0.5">{allItems.length} 件商品 · 小计 ${subtotal.toFixed(2)}</div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">支付方式 Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'cash', label: '💵 现金', en: 'Cash' },
              { v: 'card', label: '💳 刷卡', en: 'Card' },
              { v: 'transfer', label: '📱 转账', en: 'Transfer' },
            ] as const).map(opt => (
              <button key={opt.v} onClick={() => setMethod(opt.v)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition ${
                  method === opt.v ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <div>{opt.label}</div>
                <div className="text-xs text-gray-400">{opt.en}</div>
              </button>
            ))}
          </div>
        </div>

        {method === 'card' && (
          <div className="mb-4 bg-blue-50 rounded-xl p-3">
            <label className="text-sm font-medium text-blue-800 flex items-center justify-between">
              <span>刷卡附加费 Card Surcharge</span>
              <span className="font-bold">{cardSurcharge}%</span>
            </label>
            <input type="range" min="0" max="3" step="0.1" value={cardSurcharge}
              onChange={e => setCardSurcharge(parseFloat(e.target.value))} className="w-full mt-2" />
            <div className="text-xs text-blue-600 mt-1">默认 {restaurant.card_surcharge_pct ?? 1.5}%（可在订单页修改）</div>
          </div>
        )}

        <label className="flex items-center justify-between mb-4 bg-yellow-50 rounded-xl p-3 cursor-pointer">
          <div>
            <div className="text-sm font-medium text-yellow-800">公共假日 +{phPct}%</div>
            <div className="text-xs text-yellow-600">本单临时调整 Override for this order</div>
          </div>
          <input type="checkbox" checked={phActive} onChange={e => setPhActive(e.target.checked)} className="w-5 h-5 accent-orange-500" />
        </label>

        <div className="border rounded-xl p-3 mb-4 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600"><span>小计 Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {calc.surcharge > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>附加费 ({calc.surchargeReason})</span><span>+${calc.surcharge.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg text-orange-600">
            <span>实收 Total</span><span>${calc.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {method === 'cash' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">收到现金 Cash Received</label>
            <input type="number" step="0.01" inputMode="decimal" value={cashReceived}
              onChange={e => setCashReceived(e.target.value)}
              placeholder={`例如 ${Math.ceil(calc.grandTotal / 10) * 10}`}
              className="w-full border rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <div className="flex gap-2 mt-2">
              {[Math.ceil(calc.grandTotal), Math.ceil(calc.grandTotal / 10) * 10, Math.ceil(calc.grandTotal / 50) * 50, 100].map(v => (
                <button key={v} onClick={() => setCashReceived(v.toString())}
                  className="flex-1 bg-gray-100 hover:bg-orange-100 text-gray-700 rounded-lg py-1.5 text-sm font-medium transition">${v}</button>
              ))}
            </div>
            {cashReceived && calc.enoughCash && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="text-sm text-green-700">应找零 Change</div>
                <div className="text-2xl font-bold text-green-700">${calc.change.toFixed(2)}</div>
              </div>
            )}
            {cashReceived && !calc.enoughCash && (
              <div className="mt-2 text-sm text-red-600">⚠️ 现金不足 Cash not enough</div>
            )}
          </div>
        )}

        <button onClick={confirmPayment} disabled={saving || !calc.enoughCash}
          className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-600 transition disabled:opacity-50">
          {saving ? '处理中...' : `✓ 确认收款 $${calc.grandTotal.toFixed(2)}`}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">关闭窗口不会影响订单</p>
      </div>
    </div>
  )
}
