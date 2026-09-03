import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './layouts/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import AssetsPage from './pages/AssetsPage'
import AssetDetailsPage from './pages/AssetDetailsPage'
import AssetCreatePage from './pages/AssetCreatePage'
import AssetScanPage from './pages/AssetScanPage'
import BulkImportPage from './pages/BulkImportPage'
import InventoryPage from './pages/InventoryPage'
import MovementsPage from './pages/MovementsPage'
import CustomersPage from './pages/CustomersPage'
import LotsPage from './pages/LotsPage'
import WarehousesPage from './pages/WarehousesPage'
import ReportsPage from './pages/ReportsPage'
import AuditLogsPage from './pages/AuditLogsPage'
import UsersPage from './pages/UsersPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/new" element={<AssetCreatePage />} />
          <Route path="/assets/scan" element={<AssetScanPage />} />
          <Route path="/assets/import" element={<BulkImportPage />} />
          <Route path="/assets/:id" element={<AssetDetailsPage />} />

          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/movements" element={<MovementsPage />} />

          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/lots" element={<LotsPage />} />
          <Route path="/warehouses" element={<WarehousesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['COMPLIANCE']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/audit" element={<AuditLogsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={[]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
