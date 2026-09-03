import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { assetsApi, warehousesApi } from '../api/endpoints'
import { StatusChip, ConditionChip } from '../components/StatusChip'
import { CONDITION_OPTIONS, MOVEMENT_TYPES, STATUS_OPTIONS } from '../types'
import { apiErrorMessage } from '../api/client'
import { hasRole, useAuth } from '../contexts/AuthContext'

export default function AssetDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const assetId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()
  const { user } = useAuth()

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => assetsApi.get(assetId),
    enabled: Number.isFinite(assetId),
  })
  const { data: movements } = useQuery({
    queryKey: ['asset-movements', assetId],
    queryFn: () => assetsApi.movements(assetId),
    enabled: Number.isFinite(assetId),
  })
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: warehousesApi.list })

  const [moveOpen, setMoveOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [conditionOpen, setConditionOpen] = useState(false)

  if (isLoading || !asset) return <Typography>Loading…</Typography>

  const canEdit = hasRole(user, 'INTAKE', 'PROCESSING')

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Stack>
          <Typography variant="overline" color="text.secondary">{asset.device_type}</Typography>
          <Typography variant="h4">{asset.asset_tag}</Typography>
          <Typography color="text.secondary">
            {asset.manufacturer} {asset.model} — serial <b>{asset.serial_number || '—'}</b>
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          {canEdit && <Button variant="contained" onClick={() => setMoveOpen(true)}>Move Asset</Button>}
          {hasRole(user, 'PROCESSING', 'SALES', 'INTAKE') && (
            <Button variant="outlined" onClick={() => setStatusOpen(true)}>Change Status</Button>
          )}
          {hasRole(user, 'PROCESSING') && (
            <Button variant="outlined" onClick={() => setConditionOpen(true)}>Change Condition</Button>
          )}
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6">Overview</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Info label="Customer" value={asset.customer_name || '—'} />
                <Info label="Lot" value={asset.lot_number || '—'} />
                <Info label="Barcode" value={asset.barcode || '—'} />
                <Info label="Received" value={asset.received_date || '—'} />
                <Info label="Processed" value={asset.processed_date || '—'} />
                <Info label="Disposition" value={asset.disposition_date || '—'} />
                <Info label="Warehouse" value={asset.warehouse_name || '—'} />
                <Info label="Zone" value={asset.zone_name || '—'} />
                <Info label="Resale Value" value={asset.resale_value != null ? `$${asset.resale_value}` : '—'} />
              </Grid>
              {asset.notes && (
                <Paper variant="outlined" sx={{ mt: 2, p: 2, whiteSpace: 'pre-wrap' }}>
                  <Typography variant="caption" color="text.secondary">Notes</Typography>
                  <Typography>{asset.notes}</Typography>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6">Current</Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 90 }}>Status</Typography>
                  <StatusChip status={asset.status} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 90 }}>Condition</Typography>
                  <ConditionChip condition={asset.condition} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ width: 90 }}>Location</Typography>
                  <Chip variant="outlined" label={`${asset.warehouse_name || 'N/A'} · ${asset.zone_name || 'N/A'}`} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6">Lifecycle</Typography>
          <Box sx={{ overflowX: 'auto', mt: 2 }}>
            <Stepper alternativeLabel activeStep={-1}>
              {['COLLECTED', 'RECEIVED', 'PROCESSING', 'TESTING', 'READY_FOR_RESALE', 'SOLD'].map((s) => (
                <Step key={s} completed={movements?.some((m) => m.to_status === s)}>
                  <StepLabel>{s}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Movement History</Typography>
          <Stack spacing={1} sx={{ mt: 2 }}>
            {(movements || []).map((m) => (
              <Paper key={m.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={m.movement_type} size="small" color="primary" variant="outlined" />
                    <Typography variant="body2">
                      {m.from_zone_name || m.from_warehouse_name || 'External'} →{' '}
                      {m.to_zone_name || m.to_warehouse_name || 'External'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {m.from_status && m.to_status && m.from_status !== m.to_status && (
                      <>
                        <StatusChip status={m.from_status} />
                        <span>→</span>
                      </>
                    )}
                    {m.to_status && <StatusChip status={m.to_status} />}
                    <Typography variant="caption" color="text.secondary">
                      {new Date(m.timestamp).toLocaleString()}
                    </Typography>
                  </Stack>
                </Stack>
                {(m.notes || m.performed_by_name || m.reference_number) && (
                  <Typography variant="caption" color="text.secondary">
                    {m.performed_by_name && <>By <b>{m.performed_by_name}</b>. </>}
                    {m.reference_number && <>Ref {m.reference_number}. </>}
                    {m.notes}
                  </Typography>
                )}
              </Paper>
            ))}
            {(!movements || movements.length === 0) && <Alert severity="info">No movements yet.</Alert>}
          </Stack>
        </CardContent>
      </Card>

      <MoveDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        assetId={asset.id}
        warehouses={warehouses || []}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['asset', assetId] })
          qc.invalidateQueries({ queryKey: ['asset-movements', assetId] })
          setMoveOpen(false)
          enqueueSnackbar('Asset moved', { variant: 'success' })
        }}
      />
      <StatusDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatus={asset.status}
        onSubmit={async (newStatus, notes, force) => {
          try {
            await assetsApi.changeStatus(asset.id, { new_status: newStatus, notes, force })
            qc.invalidateQueries({ queryKey: ['asset', assetId] })
            qc.invalidateQueries({ queryKey: ['asset-movements', assetId] })
            enqueueSnackbar('Status updated', { variant: 'success' })
            setStatusOpen(false)
          } catch (e) {
            enqueueSnackbar(apiErrorMessage(e), { variant: 'error' })
          }
        }}
      />
      <ConditionDialog
        open={conditionOpen}
        currentCondition={asset.condition}
        onClose={() => setConditionOpen(false)}
        onSubmit={async (newCondition, notes) => {
          try {
            await assetsApi.changeCondition(asset.id, { new_condition: newCondition, notes })
            qc.invalidateQueries({ queryKey: ['asset', assetId] })
            enqueueSnackbar('Condition updated', { variant: 'success' })
            setConditionOpen(false)
          } catch (e) {
            enqueueSnackbar(apiErrorMessage(e), { variant: 'error' })
          }
        }}
      />
    </Stack>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </Typography>
      <Typography>{value}</Typography>
      <Divider sx={{ mt: 1 }} />
    </Grid>
  )
}

function MoveDialog({
  open,
  onClose,
  assetId,
  warehouses,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  assetId: number
  warehouses: any[]
  onSuccess: () => void
}) {
  const [warehouseId, setWarehouseId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [movementType, setMovementType] = useState('TRANSFER')
  const [notes, setNotes] = useState('')
  const [reference, setReference] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const { enqueueSnackbar } = useSnackbar()

  const zonesQuery = useQuery({
    queryKey: ['zones', warehouseId],
    queryFn: () => warehousesApi.zones(Number(warehouseId)),
    enabled: !!warehouseId,
  })

  const move = useMutation({
    mutationFn: () =>
      assetsApi.move(assetId, {
        to_warehouse_id: warehouseId ? Number(warehouseId) : undefined,
        to_zone_id: zoneId ? Number(zoneId) : undefined,
        movement_type: movementType,
        reference_number: reference || undefined,
        notes: notes || undefined,
        new_status: newStatus || undefined,
      }),
    onSuccess,
    onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Move Asset</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Destination Warehouse" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setZoneId('') }}>
            <MenuItem value="">—</MenuItem>
            {warehouses.map((w) => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Destination Zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} disabled={!warehouseId}>
            <MenuItem value="">—</MenuItem>
            {(zonesQuery.data || []).map((z) => (
              <MenuItem key={z.id} value={z.id}>{z.name}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Movement Type" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
            {MOVEMENT_TYPES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <TextField select label="New Status (optional)" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <MenuItem value="">Keep current</MenuItem>
            {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField label="Reference #" value={reference} onChange={(e) => setReference(e.target.value)} />
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!warehouseId && !zoneId} onClick={() => move.mutate()}>Move</Button>
      </DialogActions>
    </Dialog>
  )
}

function StatusDialog({
  open,
  onClose,
  currentStatus,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  currentStatus: string
  onSubmit: (status: string, notes: string | undefined, force: boolean) => void
}) {
  const [status, setStatus] = useState(currentStatus)
  const [notes, setNotes] = useState('')
  const [force, setForce] = useState(false)
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change Status</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="New status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
          <Stack direction="row" spacing={1} alignItems="center">
            <input id="force" type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <label htmlFor="force"><Typography variant="body2">Force (ADMIN override for invalid transitions)</Typography></label>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit(status, notes || undefined, force)}>Update</Button>
      </DialogActions>
    </Dialog>
  )
}

function ConditionDialog({
  open,
  onClose,
  currentCondition,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  currentCondition: string
  onSubmit: (condition: string, notes: string | undefined) => void
}) {
  const [condition, setCondition] = useState(currentCondition)
  const [notes, setNotes] = useState('')
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change Condition</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="New condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITION_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit(condition, notes || undefined)}>Update</Button>
      </DialogActions>
    </Dialog>
  )
}
