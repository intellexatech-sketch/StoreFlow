import { useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { assetsApi, warehousesApi } from '../api/endpoints'
import { STATUS_OPTIONS, MOVEMENT_TYPES } from '../types'
import { apiErrorMessage } from '../api/client'
import { useSnackbar } from 'notistack'

interface Props {
  open: boolean
  assetIds: number[]
  onClose: () => void
  onDone: (result: { successful: number[]; failed: any[] }) => void
}

export default function BulkMoveDialog({ open, assetIds, onClose, onDone }: Props) {
  const { enqueueSnackbar } = useSnackbar()
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: warehousesApi.list, enabled: open })
  const [warehouseId, setWarehouseId] = useState<string>('')
  const [zoneId, setZoneId] = useState<string>('')
  const [movementType, setMovementType] = useState('TRANSFER')
  const [newStatus, setNewStatus] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const zonesQuery = useQuery({
    queryKey: ['zones', warehouseId],
    queryFn: () => warehousesApi.zones(Number(warehouseId)),
    enabled: !!warehouseId,
  })

  const zones = zonesQuery.data

  const submit = async () => {
    setSaving(true)
    try {
      const result = await assetsApi.bulkMove({
        asset_ids: assetIds,
        to_warehouse_id: warehouseId ? Number(warehouseId) : undefined,
        to_zone_id: zoneId ? Number(zoneId) : undefined,
        movement_type: movementType,
        reference_number: reference || undefined,
        notes: notes || undefined,
        new_status: newStatus || undefined,
      })
      onDone(result)
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Bulk Move {assetIds.length} assets</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Destination Warehouse" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setZoneId('') }}>
            <MenuItem value="">—</MenuItem>
            {warehouses?.map((w) => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Destination Zone"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            disabled={!warehouseId}
          >
            <MenuItem value="">—</MenuItem>
            {zones?.map((z) => (
              <MenuItem key={z.id} value={z.id}>{z.name}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Movement Type" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
            {MOVEMENT_TYPES.map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>
          <TextField select label="New Status (optional)" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <MenuItem value="">Keep current</MenuItem>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          <TextField label="Reference #" value={reference} onChange={(e) => setReference(e.target.value)} />
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || (!warehouseId && !zoneId)} onClick={submit}>
          Move
        </Button>
      </DialogActions>
    </Dialog>
  )
}
