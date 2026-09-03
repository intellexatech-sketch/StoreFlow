import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { apiErrorMessage } from '../api/client'

const DEMO_USERS = [
  { email: 'admin@example.com', role: 'ADMIN' },
  { email: 'intake@example.com', role: 'INTAKE' },
  { email: 'processing@example.com', role: 'PROCESSING' },
  { email: 'sales@example.com', role: 'SALES' },
  { email: 'compliance@example.com', role: 'COMPLIANCE' },
]

export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as any
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('Demo123!')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    const from = location.state?.from?.pathname || '/dashboard'
    navigate(from, { replace: true })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 960, overflow: 'hidden' }}>
        <Grid container>
          <Grid
            item
            xs={12}
            md={5}
            sx={{ bgcolor: '#0f172a', color: '#e2e8f0', p: 5, display: 'flex', flexDirection: 'column' }}
          >
            <Typography variant="overline" sx={{ color: '#38bdf8', letterSpacing: 2 }}>
              ITAD PLATFORM
            </Typography>
            <Typography variant="h4" sx={{ color: '#fff', mt: 2 }}>
              IT Asset Disposition, Reverse Logistics & Recycling
            </Typography>
            <Typography sx={{ mt: 2, color: '#94a3b8' }}>
              Track every device from collection through resale, recycling, or disposal — with a full audit trail.
            </Typography>
            <Divider sx={{ my: 4, borderColor: '#1e293b' }} />
            <Typography variant="overline" sx={{ color: '#64748b' }}>Demo users</Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {DEMO_USERS.map((u) => (
                <Box
                  key={u.email}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#1e293b' },
                  }}
                  onClick={() => setEmail(u.email)}
                >
                  <Typography sx={{ fontFamily: 'monospace', color: '#e2e8f0', fontSize: 13 }}>
                    {u.email}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {u.role}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Typography variant="caption" sx={{ mt: 3, color: '#64748b' }}>
              Password (all): <b style={{ color: '#38bdf8' }}>Demo123!</b>
            </Typography>
          </Grid>

          <Grid item xs={12} md={7}>
            <CardContent sx={{ p: 5 }}>
              <Typography variant="h5">Sign in to your workspace</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Enter your credentials to access the ITAD console.
              </Typography>
              <Box component="form" onSubmit={submit} sx={{ mt: 4 }}>
                <Stack spacing={2.5}>
                  <TextField
                    type="email"
                    label="Email"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <TextField
                    type="password"
                    label="Password"
                    fullWidth
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button variant="contained" size="large" type="submit" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Grid>
        </Grid>
      </Card>
    </Box>
  )
}
