import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import AddBoxIcon from '@mui/icons-material/AddBox'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import ListAltIcon from '@mui/icons-material/ListAlt'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import PeopleIcon from '@mui/icons-material/People'
import LayersIcon from '@mui/icons-material/Layers'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import BarChartIcon from '@mui/icons-material/BarChart'
import HistoryIcon from '@mui/icons-material/History'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import LogoutIcon from '@mui/icons-material/Logout'
import CircleIcon from '@mui/icons-material/Circle'
import { useAuth, hasRole } from '../contexts/AuthContext'
import { useRealtime, useRealtimeEvent } from '../contexts/RealtimeContext'
import { useSnackbar } from 'notistack'

const DRAWER_WIDTH = 260

interface NavItem {
  label: string
  path?: string
  icon: JSX.Element
  roles?: string[]
  children?: NavItem[]
}

const NAV: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  {
    label: 'Assets',
    icon: <Inventory2Icon />,
    children: [
      { label: 'All Assets', path: '/assets', icon: <ListAltIcon /> },
      { label: 'Add Asset', path: '/assets/new', icon: <AddBoxIcon />, roles: ['INTAKE'] },
      { label: 'Scan Asset', path: '/assets/scan', icon: <QrCodeScannerIcon /> },
      { label: 'Bulk Import', path: '/assets/import', icon: <UploadFileIcon />, roles: ['INTAKE'] },
    ],
  },
  {
    label: 'Inventory',
    icon: <Inventory2Icon />,
    children: [
      { label: 'Inventory Overview', path: '/inventory', icon: <ListAltIcon /> },
      { label: 'Movements', path: '/movements', icon: <SwapHorizIcon /> },
    ],
  },
  { label: 'Customers', path: '/customers', icon: <PeopleIcon /> },
  { label: 'Lots', path: '/lots', icon: <LayersIcon /> },
  { label: 'Warehouses', path: '/warehouses', icon: <WarehouseIcon /> },
  { label: 'Reports', path: '/reports', icon: <BarChartIcon /> },
  {
    label: 'Audit Logs',
    path: '/audit',
    icon: <HistoryIcon />,
    roles: ['COMPLIANCE'],
  },
  { label: 'Users', path: '/users', icon: <AdminPanelSettingsIcon />, roles: [] /* admin only */ },
]

export default function DashboardLayout() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const { enqueueSnackbar } = useSnackbar()
  const { status: rtStatus, connected: rtConnected } = useRealtime()

  useRealtimeEvent(({ event, payload }) => {
    // Cache invalidation is handled by the RealtimeProvider; only surface UX
    // hints here so a page that isn't listening still gets a toast.
    if (event === 'ASSET_MOVED') {
      enqueueSnackbar(`Asset ${payload?.asset_tag ?? payload?.asset_id ?? ''} moved`, { variant: 'info' })
    } else if (event === 'STATUS_CHANGED') {
      enqueueSnackbar(`Status changed: ${payload?.from} → ${payload?.to}`, { variant: 'info' })
    }
  })

  const rtColor =
    rtStatus === 'open' ? '#22c55e'
    : rtStatus === 'connecting' ? '#f59e0b'
    : rtStatus === 'unsupported' ? '#64748b'
    : '#ef4444'
  const rtLabel =
    rtStatus === 'open' ? 'Realtime connected'
    : rtStatus === 'connecting' ? 'Connecting…'
    : rtStatus === 'unsupported' ? 'Polling (WS unsupported)'
    : 'Reconnecting — polling'

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f172a', color: '#e2e8f0' }}>
      <Toolbar sx={{ px: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar variant="rounded" sx={{ bgcolor: '#1e40af', width: 40, height: 40 }}>
            <Typography variant="h6" sx={{ color: '#fff' }}>IT</Typography>
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 700, color: '#fff' }}>ITAD Platform</Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>Reverse Logistics</Typography>
          </Box>
        </Stack>
      </Toolbar>
      <Divider sx={{ borderColor: '#1e293b' }} />
      <List sx={{ px: 1.25, py: 2, flex: 1, overflowY: 'auto' }}>
        {NAV.map((item) => {
          if (item.label === 'Users' && !hasRole(user, 'ADMIN' as any)) {
            // ADMIN-only; hasRole always returns true for ADMIN and false otherwise here (empty roles list)
            if (user?.role !== 'ADMIN') return null
          }
          if (item.roles && item.roles.length > 0 && !hasRole(user, ...item.roles)) return null

          if (item.children) {
            const visibleChildren = item.children.filter((c) => !c.roles || hasRole(user, ...c.roles))
            if (visibleChildren.length === 0) return null
            return (
              <Box key={item.label} sx={{ mb: 1 }}>
                <Typography
                  variant="overline"
                  sx={{ px: 2, color: '#64748b', letterSpacing: 1, fontSize: 11 }}
                >
                  {item.label}
                </Typography>
                {visibleChildren.map((c) => (
                  <NavLinkButton
                    key={c.path}
                    item={c}
                    active={location.pathname === c.path}
                    onClick={() => {
                      navigate(c.path!)
                      if (!isDesktop) setMobileOpen(false)
                    }}
                  />
                ))}
              </Box>
            )
          }

          return (
            <NavLinkButton
              key={item.label}
              item={item}
              active={location.pathname === item.path}
              onClick={() => {
                navigate(item.path!)
                if (!isDesktop) setMobileOpen(false)
              }}
            />
          )
        })}
      </List>
      <Divider sx={{ borderColor: '#1e293b' }} />
      <Box sx={{ p: 2 }}>
        <Tooltip title={rtConnected ? 'Server pushes live updates via WebSocket' : 'WebSocket unavailable — polling every 20s'}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CircleIcon sx={{ color: rtColor, fontSize: 12 }} />
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              {rtLabel}
            </Typography>
          </Stack>
        </Tooltip>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        color="inherit"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {NAV.flatMap((n) => n.children ?? [n]).find((n) => n.path === location.pathname)?.label || 'ITAD'}
          </Typography>
          <Tooltip title={`${user?.name || ''} (${user?.role})`}>
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <Avatar sx={{ bgcolor: '#1e40af', width: 36, height: 36 }}>
                {user?.name?.[0] || 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu open={!!menuAnchor} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>
              <Stack>
                <Typography variant="body2">{user?.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email} — {user?.role}
                </Typography>
              </Stack>
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={async () => {
                setMenuAnchor(null)
                await logout()
                navigate('/login')
              }}
            >
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: 0 } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}

function NavLinkButton({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  return (
    <ListItemButton
      onClick={onClick}
      selected={active}
      sx={{
        borderRadius: 2,
        my: 0.25,
        color: active ? '#fff' : '#cbd5e1',
        '&.Mui-selected': { bgcolor: '#1e293b', color: '#fff' },
        '&:hover': { bgcolor: '#1e293b' },
      }}
    >
      <ListItemIcon sx={{ color: active ? '#38bdf8' : '#94a3b8', minWidth: 36 }}>{item.icon}</ListItemIcon>
      <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
    </ListItemButton>
  )
}
