'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { MenuItem, Restaurant, Category } from '@/lib/types'

export default function MenuPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [showCatForm, setShowCatForm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: rest } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).single()
      if (!rest) { router.push('/auth/login'); return }
      setRestaurant(rest)
      const { data: cats } = await supabase.from('categories').select('*').eq('restaurant_id', rest.id).order('sort_order')
      setCategories(cats || [])
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
    setName(''); setDescription(''); setPrice(''); setCategoryId('')
    setImageFile(null); setImagePreview(null); setEditingId(null)
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
      const { error: uploadError } = await supabase.storage.from('menu-images').upload(path, imageFile, {
        contentType: imageFile.type || 'image/jpeg',
        upsert: true,
      })
      if (uploadError) { toast.error('图片上传失败 Image upload failed'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    if (editingId) {
      const update: Partial<MenuItem> = {
        name, description,
        price: parseFloat(price),
        category_id: categoryId || undefined,
      }
      if (image_url) update.image_url = image_url
      const { error } = await supabase.from('menu_items').update(update).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      setItems(items.map(i => i.id === editingId ? { ...i, ...update } : i))
      toast.success('已更新 Updated')
    } else {
      const { data, error } = await supabase.from('menu_items').insert({
        restaurant_id: restaurant.id,
        name, description,
        price: parseFloat(price),
        image_url,
        category_id: categoryId || undefined,
        available: true,
        sort_order: items.length,
      }).select().single()
      if (error) { toast.error(error.message); setSaving(false); return }
      setItems([...items, data])
      toast.success('已添加 Added')
    }
    resetForm()
    setSaving(false)
  }

  async function addCategory() {
    if (!newCatName.trim() || !restaurant) return
    const { data, error } = await supabase.from('categories').insert({
      restaurant_id: restaurant.id,
      name: newCatName.trim(),
      sort_order: categories.length,
    }).select().single()
    if (error) { toast.error(error.message); return }
    setCategories([...categories, data])
    setNewCatName('')
    setShowCatForm(false)
    toast.success('分类已添加 Category added')
  }

  async function deleteCategory(id: string) {
    if (!confirm('删除此分类？该分类下的菜品不会被删除。\nDelete this category? Items in it won\'t be deleted.')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(categories.filter(c => c.id !== id))
    // unassign items
    setItems(items.map(i => i.category_id === id ? { ...i, category_id: undefined } : i))
    toast.success('分类已删除 Category deleted')
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    setItems(items.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  async function deleteItem(id: string) {
    if (!confirm('删除此菜品？\nDelete this item?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
    toast.success('已删除 Deleted')
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id)
    setName(item.name)
    setDescription(item.description || '')
    setPrice(item.price.toString())
    setCategoryId(item.category_id || '')
    setImagePreview(item.image_url || null)
    setShowForm(true)
  }

  // Group items by category
  const grouped: { cat: Category | null; items: MenuItem[] }[] = []
  const assigned = new Set<string>()
  categories.forEach(cat => {
    const catItems = items.filter(i => i.category_id === cat.id)
    grouped.push({ cat, items: catItems })
    catItems.forEach(i => assigned.add(i.id))
  })
  const uncategorized = items.filter(i => !assigned.has(i.id))
  if (uncategorized.length > 0) grouped.push({ cat: null, items: uncategorized })

  if (loading) return <div className="min-h-screen flex items-center justify-center text-orange-500">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">← 返回 Back</Link>
        <h1 className="text-xl font-bold text-orange-600">菜单管理 Menu</h1>
      </nav>

      <div className="max-w-3xl mx-auto p-6">

        {/* Categories */}
        <div className="bg-white rounded-2xl border p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">分类管理 Categories</h2>
            <button onClick={() => setShowCatForm(!showCatForm)}
              className="text-sm text-orange-500 hover:text-orange-700 font-medium">
              + 添加分类 Add
            </button>
          </div>
          {showCatForm && (
            <div className="flex gap-2 mb-3">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                placeholder="分类名称 Category name"
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <button onClick={addCategory} className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600">
                保存 Save
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 && <span className="text-sm text-gray-400">暂无分类，添加后可以给菜品分组 No categories yet</span>}
            {categories.map(cat => (
              <span key={cat.id} className="bg-orange-50 text-orange-700 text-sm px-3 py-1 rounded-full flex items-center gap-2">
                {cat.name}
                <button onClick={() => deleteCategory(cat.id)} className="text-orange-300 hover:text-red-500 text-xs">✕</button>
              </span>
            ))}
          </div>
        </div>

        {/* Add item button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">{items.length} 道菜 items</h2>
          <button onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-orange-500 text-white px-5 py-2 rounded-xl font-medium hover:bg-orange-600 transition">
            + 添加菜品 Add Item
          </button>
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div className="bg-white rounded-2xl border p-6 mb-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">{editingId ? '编辑菜品 Edit Item' : '新增菜品 New Item'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">菜品名称 Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述 Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">价格 Price (AUD) *</label>
                <input value={price} onChange={e => setPrice(e.target.value)} required type="number" step="0.01" min="0"
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分类 Category</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">-- 无分类 Uncategorized --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">图片 Photo</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100" />
                {imagePreview && <img src={imagePreview} alt="preview" className="mt-2 h-32 w-32 object-cover rounded-xl border" />}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-orange-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-orange-600 transition disabled:opacity-50">
                  {saving ? '保存中...' : '保存 Save'}
                </button>
                <button type="button" onClick={resetForm}
                  className="border px-6 py-2 rounded-xl text-gray-600 hover:bg-gray-50 transition">
                  取消 Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Menu items grouped by category */}
        {grouped.map(({ cat, items: catItems }) => (
          <div key={cat?.id ?? 'uncategorized'} className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
              {cat ? cat.name : '其他 Other'}
            </h3>
            <div className="space-y-3">
              {catItems.map(item => (
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
                      {item.available ? '供应中' : '已下架'}
                    </button>
                    <button onClick={() => startEdit(item)} className="text-blue-400 hover:text-blue-600 text-sm font-medium">编辑</button>
                    <button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-600 text-sm font-medium">删除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {items.length === 0 && !showForm && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            暂无菜品，点击"添加菜品"开始 No items yet. Click "Add Item" to start.
          </div>
        )}
      </div>
    </main>
  )
}
