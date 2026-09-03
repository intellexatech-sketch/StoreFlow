export type Role = 'ADMIN' | 'INTAKE' | 'PROCESSING' | 'SALES' | 'COMPLIANCE'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
  is_active: boolean
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface Customer {
  id: number
  customer_code: string
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  created_at: string
}

export interface Warehouse {
  id: number
  code: string
  name: string
  address?: string | null
  description?: string | null
}

export interface Zone {
  id: number
  warehouse_id: number
  code: string
  name: string
  description?: string | null
}

export interface Lot {
  id: number
  lot_number: string
  customer_id: number
  customer_name?: string | null
  description?: string | null
  received_date?: string | null
  status: string
  created_at: string
  asset_count?: number
}

export interface Asset {
  id: number
  asset_tag: string
  serial_number?: string | null
  barcode?: string | null
  customer_id: number
  customer_name?: string | null
  lot_id?: number | null
  lot_number?: string | null
  manufacturer?: string | null
  model?: string | null
  device_type: string
  condition: string
  status: string
  warehouse_id?: number | null
  warehouse_name?: string | null
  zone_id?: number | null
  zone_name?: string | null
  received_date?: string | null
  processed_date?: string | null
  disposition_date?: string | null
  resale_value?: number | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface Movement {
  id: number
  asset_id: number
  asset_tag?: string | null
  from_warehouse_name?: string | null
  to_warehouse_name?: string | null
  from_zone_name?: string | null
  to_zone_name?: string | null
  from_status?: string | null
  to_status?: string | null
  movement_type: string
  reference_number?: string | null
  performed_by_name?: string | null
  notes?: string | null
  timestamp: string
}

export interface DashboardData {
  totals: Record<string, number>
  by_status: { key: string; value: number }[]
  by_condition: { key: string; value: number }[]
  by_customer: { key: string; value: number }[]
  by_zone: { key: string; value: number }[]
  recent_movements: any[]
  recent_assets: any[]
}

export interface AuditLog {
  id: number
  user_id?: number | null
  user_name?: string | null
  entity_type: string
  entity_id?: string | null
  action: string
  old_values?: any
  new_values?: any
  ip_address?: string | null
  timestamp: string
}

export interface ImportSummary {
  total_rows: number
  successful: number
  failed: number
  duplicate: number
  errors: { row: number; error: string }[]
}

export const STATUS_OPTIONS = [
  'COLLECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'PROCESSING',
  'TESTING',
  'READY_FOR_RESALE',
  'SOLD',
  'READY_FOR_RECYCLING',
  'RECYCLED',
  'DISPOSED',
  'ON_HOLD',
] as const

export const CONDITION_OPTIONS = ['New', 'Excellent', 'Good', 'Fair', 'Poor', 'Damaged', 'Scrap'] as const

export const DEVICE_TYPES = [
  'Laptop',
  'Desktop',
  'Monitor',
  'Mobile',
  'Tablet',
  'Server',
  'Printer',
  'Network Equipment',
  'Other',
] as const

export const MOVEMENT_TYPES = [
  'RECEIVED',
  'TRANSFER',
  'PROCESSING',
  'SHIPMENT',
  'SALE',
  'RECYCLING',
  'DISPOSAL',
  'OTHER',
] as const
