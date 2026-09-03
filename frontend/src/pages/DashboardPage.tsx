import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dashboardApi } from '../api/endpoints'
import { StatusChip } from '../components/StatusChip'

const COLORS = ['#1e40af', '#0ea5e9', '#059669', '#f59e0b', '#dc2626', '#8b5cf6', '#0284c7', '#14b8a6']

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ mt: 1 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })

  if (isLoading || !data) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Skeleton variant="rounded" height={110} />
          </Grid>
        ))}
      </Grid>
    )
  }

  const t = data.totals

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Operations Dashboard</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Total Assets" value={t.total_assets} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Received Today" value={t.received_today} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="In Processing" value={t.in_processing} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="On Hold" value={t.on_hold} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Ready for Resale" value={t.ready_for_resale} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Ready for Recycling" value={t.ready_for_recycling} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Sold" value={t.sold} /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard label="Recycled" value={t.recycled} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6">Assets by Status</Typography>
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer>
                  <BarChart data={data.by_status}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1e40af" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6">Assets by Condition</Typography>
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.by_condition} dataKey="value" nameKey="key" outerRadius={100} label>
                      {data.by_condition.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">Top Customers</Typography>
              <Box sx={{ height: 260, mt: 2 }}>
                <ResponsiveContainer>
                  <BarChart data={data.by_customer} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="key" type="category" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">Warehouse Zone Load</Typography>
              <Box sx={{ height: 260, mt: 2 }}>
                <ResponsiveContainer>
                  <BarChart data={data.by_zone}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={80} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6">Recent Movements</Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                {data.recent_movements.length === 0 && (
                  <Typography color="text.secondary">No movements yet.</Typography>
                )}
                {data.recent_movements.map((m: any) => (
                  <Paper key={m.id} sx={{ p: 1.5, border: '1px solid #e2e8f0' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={m.movement_type} color="primary" variant="outlined" />
                        <Typography sx={{ fontFamily: 'monospace' }}>{m.asset_tag}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {m.from_zone || '—'} → {m.to_zone || '—'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <StatusChip status={m.to_status} />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(m.timestamp).toLocaleString()}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6">Recently Added Assets</Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                {data.recent_assets.map((a: any) => (
                  <Paper key={a.id} sx={{ p: 1.5, border: '1px solid #e2e8f0' }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Stack>
                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.asset_tag}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {a.manufacturer} {a.model} — {a.device_type}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{a.customer}</Typography>
                      </Stack>
                      <StatusChip status={a.status} />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}
