export interface Restaurant {
  id: string
  name: string
  owner_id: string
  logo_url?: string
  address?: string
  card_surcharge_pct?: number   // 默认刷卡附加费 % default card surcharge
  ph_surcharge_pct?: number     // 公共假日附加费 % public holiday surcharge
  ph_active?: boolean           // 是否启用公共假日 is PH currently active
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

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'split' | null
export type OrderType = 'dine_in' | 'takeaway' | 'delivery'

export interface Order {
  id: string
  restaurant_id: string
  table_id?: string
  table_number: string
  order_type?: OrderType       // 堂食/外带/外卖
  customer_name?: string       // 外带/外卖客户姓名
  customer_phone?: string      // 客户电话
  status: 'pending' | 'confirmed' | 'ready' | 'paid'
  total: number
  surcharge?: number
  surcharge_reason?: string
  grand_total?: number
  payment_method?: PaymentMethod
  cash_received?: number
  change_given?: number
  notes?: string
  paid_at?: string
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
