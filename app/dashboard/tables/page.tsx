'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import type { Table, Restaurant } from '@/lib/types'

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
        QRCode.toCanvas(canvas, url, { width: 160, margin: 2 })
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
    link.href = canvas.toDataURL()
    link.click()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-orange-500">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">← Back</Link>
        <h1 className="text-xl font-bold text-orange-600">Tables & QR Codes</h1>
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {tables.map(table => (
            <div key={table.id} className="bg-white rounded-2xl border p-4 flex flex-col items-center gap-3">
              <div className="font-semibold text-gray-700">Table {table.table_number}</div>
              <canvas ref={el => { canvasRefs.current[table.id] = el }} className="rounded-lg" />
              <div className="flex gap-2 w-full">
                <button onClick={() => downloadQR(table)}
                  className="flex-1 bg-orange-500 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition">
                  Download
                </button>
                <button onClick={() => deleteTable(table.id)}
                  className="text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg text-sm border hover:border-red-300 transition">
                  Del
                </button>
              </div>
            </div>
          ))}
          {tables.length === 0 && (
            <div className="col-span-3 bg-white rounded-xl border p-8 text-center text-gray-400">
              No tables yet. Add your first table above.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
