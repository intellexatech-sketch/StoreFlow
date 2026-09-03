import { useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { dashboardApi } from '../api/endpoints'

function statCard(label: string, value: number | string, color: string) {
  return (
    <Card>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ color, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function InventoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })

  const zoneBreakdown = useMemo(() => (data?.by_zone || []).slice(0, 20), [data])
  const statusBreakdown = useMemo(() => data?.by_status || [], [data])

  if (isLoading || !data) {
    return <Typography>Loading inventory…</Typography>
  }

  const totals = data.totals || {}

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Inventory Overview</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>{statCard('Total Assets', totals.total_assets ?? 0, '#1e40af')}</Grid>
        <Grid item xs={12} sm={6} md={3}>{statCard('In Warehouse', totals.in_warehouse ?? 0, '#059669')}</Grid>
        <Grid item xs={12} sm={6} md={3}>{statCard('Ready for Resale', totals.ready_for_resale ?? 0, '#0ea5e9')}</Grid>
        <Grid item xs={12} sm={6} md={3}>{statCard('Ready for Recycling', totals.ready_for_recycling ?? 0, '#f59e0b')}</Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Assets by Zone</Typography>
          <Box sx={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Assets" fill="#1e40af" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Status Breakdown</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">% of total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statusBreakdown.map((row) => {
                  const total = statusBreakdown.reduce((s, r) => s + r.value, 0)
                  const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : '0.0'
                  return (
                    <TableRow key={row.key}>
                      <TableCell>{row.key}</TableCell>
                      <TableCell align="right">{row.value}</TableCell>
                      <TableCell align="right">{pct}%</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  )
}
