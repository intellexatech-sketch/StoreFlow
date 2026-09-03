import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth, hasRole } from '../contexts/AuthContext'

export default function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (roles && !hasRole(user, ...roles)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
