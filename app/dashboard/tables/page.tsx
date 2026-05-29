'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import type { Table, Restaurant } from '@/lib/types'

const CARD_W = 360
const CARD_H = 460
const QR_SIZE = 280

async function renderQRCard(
  canvas: HTMLCanvasElement,
  url: string,
  tableNumber: string,
  restaurantName: string,
) {
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 白底
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // 顶部橙色条
  ctx.fillStyle = '#f97316'
  ctx.fillRect(0, 0, CARD_W, 6)

  // 餐厅名（小）
  ctx.fillStyle = '#9ca3af'
  ctx.textAlign = 'center'
  ctx.font = '600 13px -apple-system, "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(restaurantName, CARD_W / 2, 36)

  // 桌号大字
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 38px -apple-system, "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(`Table ${tableNumber}`, CARD_W / 2, 80)

  // 副标题
  ctx.fillStyle = '#6b7280'
  ctx.font = '500 14px -apple-system, "Helvetica Neue", Arial, sans-serif'
  ctx.fillText('扫码点餐 · Scan to Order', CARD_W / 2, 106)

  // QR
  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, url, { width: QR_SIZE, margin: 1, color: { dark: '#111827', light: '#ffffff' } })
  ctx.drawImage(qrCanvas, (CARD_W - QR_SIZE) / 2, 124)

  // 底部小字
  ctx.fillStyle = '#9ca3af'
  ctx.font = '400 10px -apple-system, "Helvetica Neue", Arial, sans-serif'
  ctx.fillText('Powered by OrderKing · orderking.uk', CARD_W / 2, CARD_H - 18)
}

export default function TablesPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [newTableNumber, setNewTableNumber] = useState('')
  const [adding, setAdding] = useState(false)
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: rest } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).single()
      if (!rest) { router.push('/auth/login'); return }
      setRestaurant(rest)
      const { data } = await supabase.from('tables').select('*').eq('restaurant_id', rest.id).order('table_number')
      setTables(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!restaurant) return
    tables.forEach(table => {
      const canvas = canvasRefs.current[table.id]
      if (canvas) {
        const url = `${window.location.origin}/menu/${restaurant.id}/${table.table_number}`
        renderQRCard(canvas, url, table.table_number, restaurant.name)
      }
    })
  }, [tables, restaurant])

  async function addTable(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant || !newTableNumber.trim()) return
    setAdding(true)
    const { data, error } = await supabase.from('tables').insert({
      restaurant_id: restaurant.id,
      table_number: newTableNumber.trim(),
    }).select().single()
    if (error) { toast.error(error.message); setAdding(false); return }
    setTables([...tables, data])
    setNewTableNumber('')
    toast.success(`Table ${newTableNumber} added`)
    setAdding(false)
  }

  async function deleteTable(id: string) {
    if (!confirm('Delete this table?')) return
    await supabase.from('tables').delete().eq('id', id)
    setTables(tables.filter(t => t.id !== id))
    toast.success('Deleted')
  }

  function downloadQR(table: Table) {
    const canvas = canvasRefs.current[table.id]
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `table-${table.table_number}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function downloadAll() {
    for (const t of tables) {
      downloadQR(t)
      await new Promise(r => setTimeout(r, 300))
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-orange-500">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">← Back</Link>
        <h1 className="text-xl font-bold text-orange-600">Tables & QR Codes</h1>
        {tables.length > 0 && (
          <button onClick={downloadAll}
            className="ml-auto text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 transition">
            ⬇ 下载全部 Download All
          </button>
        )}
      </nav>

      <div className="max-w-3xl mx-auto p-6">
        <form onSubmit={addTable} className="bg-white rounded-2xl border p-5 mb-6 flex gap-3">
          <input
            value={newTableNumber}
            onChange={e => setNewTableNumber(e.target.value)}
            placeholder="Table number, e.g. 1, 2, A1, Outdoor-3"
            required
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button type="submit" disabled={adding}
            className="bg-orange-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-orange-600 transition disabled:opacity-50">
            {adding ? 'Adding...' : '+ Add Table'}
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tables.map(table => (
            <div key={table.id} className="bg-white rounded-2xl border p-4 flex flex-col items-center gap-3">
              <canvas
                ref={el => { canvasRefs.current[table.id] = el }}
                className="rounded-lg border border-gray-100 w-full max-w-[280px] h-auto"
                style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
              />
              <div className="flex gap-2 w-full">
                <button onClick={() => downloadQR(table)}
                  className="flex-1 bg-orange-500 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition">
                  ⬇ 下载 Download
                </button>
                <button onClick={() => deleteTable(table.id)}
                  className="text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg text-sm border hover:border-red-300 transition">
                  Del
                </button>
              </div>
            </div>
          ))}
          {tables.length === 0 && (
            <div className="col-span-2 bg-white rounded-xl border p-8 text-center text-gray-400">
              No tables yet. Add your first table above.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
