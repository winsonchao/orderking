export interface Restaurant {
  id: string
  name: string
  owner_id: string
  logo_url?: string
  address?: string
  created_at: string
}

export interface Category {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id?: string
  name: string
  description?: string
  price: number
  image_url?: string
  available: boolean
  sort_order: number
}

export interface Table {
  id: string
  restaurant_id: string
  table_number: string
}

export interface Order {
  id: string
  restaurant_id: string
  table_id: string
  table_number: string
  status: 'pending' | 'confirmed' | 'ready' | 'paid'
  total: number
  created_at: string
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  price: number
  quantity: number
}
