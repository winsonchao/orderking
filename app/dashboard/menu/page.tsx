'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { MenuItem, Restaurant } from '@/lib/types'

export default function MenuPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: rest } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).single()
      if (!rest) { router.push('/auth/login'); return }
      setRestaurant(rest)
      const { data } = await supabase.from('menu_items').select('*').eq('restaurant_id', rest.id).order('sort_order')
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function resetForm() {
    setName(''); setDescription(''); setPrice(''); setImageFile(null); setImagePreview(null); setEditingId(null)
    setShowForm(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    setSaving(true)

    let image_url = undefined

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${restaurant.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('menu-images').upload(path, imageFile)
      if (uploadError) { toast.error('Image upload failed'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    if (editingId) {
      const update: Partial<MenuItem> = { name, description, price: parseFloat(price) }
      if (image_url) update.image_url = image_url
      const { error } = await supabase.from('menu_items').update(update).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      setItems(items.map(i => i.id === editingId ? { ...i, ...update } : i))
      toast.success('Item updated')
    } else {
      const { data, error } = await supabase.from('menu_items').insert({
        restaurant_id: restaurant.id,
        name, description,
        price: parseFloat(price),
        image_url,
        available: true,
        sort_order: items.length,
      }).select().single()
      if (error) { toast.error(error.message); setSaving(false); return }
      setItems([...items, data])
      toast.success('Item added')
    }

    resetForm()
    setSaving(false)
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    setItems(items.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
    toast.success('Deleted')
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id)
    setName(item.name)
    setDescription(item.description || '')
    setPrice(item.price.toString())
    setImagePreview(item.image_url || null)
    setShowForm(true)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-orange-500">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">← Back</Link>
        <h1 className="text-xl font-bold text-orange-600">Menu Management</h1>
      </nav>

      <div className="max-w-3xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">{items.length} items</h2>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-orange-500 text-white px-5 py-2 rounded-xl font-medium hover:bg-orange-600 transition"
          >
            + Add Item
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border p-6 mb-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">{editingId ? 'Edit Item' : 'New Menu Item'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dish Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (AUD) *</label>
                <input value={price} onChange={e => setPrice(e.target.value)} required type="number" step="0.01" min="0"
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100" />
                {imagePreview && (
                  <img src={imagePreview} alt="preview" className="mt-2 h-32 w-32 object-cover rounded-xl border" />
                )}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-orange-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-orange-600 transition disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={resetForm}
                  className="border px-6 py-2 rounded-xl text-gray-600 hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${!item.available ? 'opacity-50' : ''}`}>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="h-16 w-16 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="h-16 w-16 bg-orange-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">🍽️</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800">{item.name}</div>
                {item.description && <div className="text-sm text-gray-400 truncate">{item.description}</div>}
                <div className="font-bold text-orange-600">${item.price.toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleAvailable(item)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition ${item.available ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'}`}>
                  {item.available ? 'Available' : 'Hidden'}
                </button>
                <button onClick={() => startEdit(item)} className="text-blue-400 hover:text-blue-600 text-sm font-medium">Edit</button>
                <button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-600 text-sm font-medium">Del</button>
              </div>
            </div>
          ))}
          {items.length === 0 && !showForm && (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
              No items yet. Click &quot;Add Item&quot; to start building your menu.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
