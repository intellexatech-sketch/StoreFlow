import { api, download } from './client'
import {
  Asset,
  AuditLog,
  Customer,
  DashboardData,
  ImportSummary,
  Lot,
  Movement,
  Page,
  Warehouse,
  Zone,
} from '../types'

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    return res.data as { access_token: string; expires_in: number }
  },
  me: async () => (await api.get('/auth/me')).data,
  logout: async () => (await api.post('/auth/logout')).data,
}

export const dashboardApi = {
  get: async (): Promise<DashboardData> => (await api.get('/dashboard')).data,
}

export const assetsApi = {
  list: async (params: Record<string, any>): Promise<Page<Asset>> =>
    (await api.get('/assets', { params })).data,
  get: async (id: number): Promise<Asset> => (await api.get(`/assets/${id}`)).data,
  create: async (payload: Partial<Asset>): Promise<Asset> => (await api.post('/assets', payload)).data,
  update: async (id: number, payload: Partial<Asset>): Promise<Asset> =>
    (await api.put(`/assets/${id}`, payload)).data,
  scan: async (barcode: string): Promise<{ asset: Asset; recent_movements: any[] }> =>
    (await api.post('/assets/scan', { barcode })).data,
  move: async (id: number, payload: any): Promise<Movement> =>
    (await api.post(`/assets/${id}/move`, payload)).data,
  bulkMove: async (payload: any): Promise<{ successful: number[]; failed: any[] }> =>
    (await api.post('/assets/bulk-move', payload)).data,
  changeStatus: async (id: number, payload: { new_status: string; notes?: string; force?: boolean }) =>
    (await api.post(`/assets/${id}/status`, payload)).data as Promise<Asset>,
  changeCondition: async (id: number, payload: { new_condition: string; notes?: string }) =>
    (await api.post(`/assets/${id}/condition`, payload)).data as Promise<Asset>,
  movements: async (id: number, limit = 100): Promise<Movement[]> =>
    (await api.get(`/assets/${id}/movements`, { params: { limit } })).data,
}

export const customersApi = {
  list: async (q?: string): Promise<Customer[]> => (await api.get('/customers', { params: { q } })).data,
  create: async (payload: Partial<Customer>) => (await api.post('/customers', payload)).data as Promise<Customer>,
  update: async (id: number, payload: Partial<Customer>) =>
    (await api.put(`/customers/${id}`, payload)).data as Promise<Customer>,
}

export const warehousesApi = {
  list: async (): Promise<Warehouse[]> => (await api.get('/warehouses')).data,
  create: async (payload: Partial<Warehouse>) =>
    (await api.post('/warehouses', payload)).data as Promise<Warehouse>,
  zones: async (id: number): Promise<Zone[]> => (await api.get(`/warehouses/${id}/zones`)).data,
  allZones: async (): Promise<Zone[]> => (await api.get('/warehouses/zones/all')).data,
  createZone: async (payload: Partial<Zone>) =>
    (await api.post('/warehouses/zones', payload)).data as Promise<Zone>,
}

export const lotsApi = {
  list: async (): Promise<Lot[]> => (await api.get('/lots')).data,
  create: async (payload: Partial<Lot>) => (await api.post('/lots', payload)).data as Promise<Lot>,
  get: async (id: number): Promise<Lot> => (await api.get(`/lots/${id}`)).data,
}

export const movementsApi = {
  list: async (params: Record<string, any>): Promise<Page<Movement>> =>
    (await api.get('/movements', { params })).data,
}

export const auditApi = {
  list: async (params: Record<string, any>): Promise<Page<AuditLog>> =>
    (await api.get('/audit-logs', { params })).data,
}

export const usersApi = {
  list: async () => (await api.get('/users')).data,
  create: async (payload: any) => (await api.post('/users', payload)).data,
  update: async (id: number, payload: any) => (await api.put(`/users/${id}`, payload)).data,
  roles: async () => (await api.get('/users/roles/list')).data,
}

export const importApi = {
  assets: async (file: File): Promise<ImportSummary> => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post('/import/assets', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}

export const reportsApi = {
  inventoryCsv: (params: any = {}) =>
    download(`/reports/inventory`, 'inventory_report.csv', { params: { format: 'csv', ...params } }),
  inventoryPdf: (params: any = {}) =>
    download(`/reports/inventory`, 'inventory_report.pdf', { params: { format: 'pdf', ...params } }),
  customerCsv: (customer_id: number) =>
    download(`/reports/customer`, `customer_${customer_id}.csv`, { params: { customer_id, format: 'csv' } }),
  customerPdf: (customer_id: number) =>
    download(`/reports/customer`, `customer_${customer_id}.pdf`, { params: { customer_id, format: 'pdf' } }),
  lotCsv: (lot_id: number) => download('/reports/lot', `lot_${lot_id}.csv`, { params: { lot_id, format: 'csv' } }),
  lotPdf: (lot_id: number) => download('/reports/lot', `lot_${lot_id}.pdf`, { params: { lot_id, format: 'pdf' } }),
  movementCsv: (params: any = {}) =>
    download('/reports/movement', 'movement_report.csv', { params: { format: 'csv', ...params } }),
  movementPdf: (params: any = {}) =>
    download('/reports/movement', 'movement_report.pdf', { params: { format: 'pdf', ...params } }),
  recyclingCsv: () => download('/reports/recycling', 'recycling.csv', { params: { format: 'csv' } }),
  recyclingPdf: () => download('/reports/recycling', 'recycling.pdf', { params: { format: 'pdf' } }),
  dispositionCsv: () => download('/reports/disposition', 'disposition.csv', { params: { format: 'csv' } }),
  dispositionPdf: () => download('/reports/disposition', 'disposition.pdf', { params: { format: 'pdf' } }),
  auditCsv: (params: any = {}) =>
    download('/reports/audit', 'audit.csv', { params: { format: 'csv', ...params } }),
  auditPdf: (params: any = {}) =>
    download('/reports/audit', 'audit.pdf', { params: { format: 'pdf', ...params } }),
}
