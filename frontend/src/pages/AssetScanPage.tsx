import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { assetsApi, warehousesApi } from '../api/endpoints'
import { StatusChip, ConditionChip } from '../components/StatusChip'
import { MOVEMENT_TYPES, STATUS_OPTIONS } from '../types'
import { apiErrorMessage } from '../api/client'
import { hasRole, useAuth } from '../contexts/AuthContext'

export default function AssetScanPage() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [barcode, setBarcode] = useState('')
  const [scanResult, setScanResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useAuth()

  const canMove = hasRole(user, 'INTAKE', 'PROCESSING')

  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: warehousesApi.list })
  const [warehouseId, setWarehouseId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [movementType, setMovementType] = useState('TRANSFER')

  const zonesQuery = useQuery({
    queryKey: ['zones', warehouseId],
    queryFn: () => warehousesApi.zones(Number(warehouseId)),
    enabled: !!warehouseId,
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submitScan = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!barcode.trim()) return
    try {
      const res = await assetsApi.scan(barcode.trim())
      setScanResult(res)
    } catch (e) {
      setError(apiErrorMessage(e))
      setScanResult(null)
    } finally {
      setBarcode('')
      inputRef.current?.focus()
    }
  }

  const performMove = async () => {
    if (!scanResult?.asset) return
    try {
      await assetsApi.move(scanResult.asset.id, {
        to_warehouse_id: warehouseId ? Number(warehouseId) : undefined,
        to_zone_id: zoneId ? Number(zoneId) : undefined,
        movement_type: movementType,
        new_status: newStatus || undefined,
      })
      enqueueSnackbar('Asset moved', { variant: 'success' })
      const res = await assetsApi.scan(scanResult.asset.barcode || scanResult.asset.asset_tag)
      setScanResult(res)
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' })
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Scan Asset</Typography>

      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Focus this field and use a USB barcode scanner (or type the barcode / serial / asset tag) then press Enter.
          </Typography>
          <Box component="form" onSubmit={submitScan}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                inputRef={inputRef}
                fullWidth
                autoFocus
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode…"
                InputProps={{ sx: { fontSize: 22, fontFamily: 'monospace' } }}
              />
              <Button type="submit" variant="contained" size="large">
                Scan
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {scanResult?.asset && (
        <>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={7}>
                  <Typography variant="overline" color="text.secondary">{scanResult.asset.device_type}</Typography>
                  <Typography variant="h5">{scanResult.asset.asset_tag}</Typography>
                  <Typography color="text.secondary">
                    {scanResult.asset.manufacturer} {scanResult.asset.model}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Serial: <b>{scanResult.asset.serial_number || '—'}</b> · Barcode: <b>{scanResult.asset.barcode || '—'}</b>
                  </Typography>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Stack spacing={1} alignItems="flex-start">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ width: 70, color: 'text.secondary' }}>Status</Typography>
                      <StatusChip status={scanResult.asset.status} />
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ width: 70, color: 'text.secondary' }}>Condition</Typography>
                      <ConditionChip condition={scanResult.asset.condition} />
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ width: 70, color: 'text.secondary' }}>Location</Typography>
                      <Typography>{scanResult.asset.warehouse_name} · {scanResult.asset.zone_name}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ width: 70, color: 'text.secondary' }}>Customer</Typography>
                      <Typography>{scanResult.asset.customer_name || '—'}</Typography>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Recent movements</Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {(scanResult.recent_movements || []).map((m: any) => (
                  <Paper key={m.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="body2">
                        {m.movement_type} · {m.from_zone || '—'} → {m.to_zone || '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(m.timestamp).toLocaleString()}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
                {(scanResult.recent_movements || []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">No prior movements.</Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          {canMove && (
            <Card>
              <CardContent>
                <Typography variant="h6">Quick Move</Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Warehouse" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setZoneId('') }}>
                      <MenuItem value="">—</MenuItem>
                      {(warehouses || []).map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} disabled={!warehouseId}>
                      <MenuItem value="">—</MenuItem>
                      {(zonesQuery.data || []).map((z) => <MenuItem key={z.id} value={z.id}>{z.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Movement Type" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                      {MOVEMENT_TYPES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="New Status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      <MenuItem value="">Keep current</MenuItem>
                      {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button variant="contained" disabled={!warehouseId && !zoneId} onClick={performMove}>Move</Button>
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Stack>
  )
}
