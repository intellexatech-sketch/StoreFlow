import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { warehousesApi } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { hasRole, useAuth } from '../contexts/AuthContext'

export default function WarehousesPage() {
  const { user } = useAuth()
  const canManage = hasRole(user)
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()

  const [whDialogOpen, setWhDialogOpen] = useState(false)
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false)
  const [selectedWh, setSelectedWh] = useState<number | ''>('')

  const [whForm, setWhForm] = useState({ code: '', name: '', address: '', description: '' })
  const [zoneForm, setZoneForm] = useState({ warehouse_id: '' as number | '', code: '', name: '', description: '' })

  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: warehousesApi.list })
  const { data: allZones } = useQuery({ queryKey: ['allZones'], queryFn: warehousesApi.allZones })

  const createWh = useMutation({
    mutationFn: () => warehousesApi.create(whForm),
    onSuccess: () => {
      enqueueSnackbar('Warehouse created', { variant: 'success' })
      setWhDialogOpen(false)
      setWhForm({ code: '', name: '', address: '', description: '' })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
  })

  const createZone = useMutation({
    mutationFn: () => warehousesApi.createZone({
      warehouse_id: Number(zoneForm.warehouse_id),
      code: zoneForm.code,
      name: zoneForm.name,
      description: zoneForm.description || undefined,
    }),
    onSuccess: () => {
      enqueueSnackbar('Zone created', { variant: 'success' })
      setZoneDialogOpen(false)
      setZoneForm({ warehouse_id: '', code: '', name: '', description: '' })
      queryClient.invalidateQueries({ queryKey: ['allZones'] })
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
  })

  const zonesForWh = (whId: number) => (allZones || []).filter((z) => z.warehouse_id === whId)

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">Warehouses & Zones</Typography>
        {canManage && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setZoneDialogOpen(true)}>Add Zone</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWhDialogOpen(true)}>Add Warehouse</Button>
          </Stack>
        )}
      </Stack>

      <Grid container spacing={2}>
        {(warehouses || []).map((wh) => (
          <Grid item xs={12} md={6} key={wh.id}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <WarehouseIcon color="primary" />
                  <Typography variant="h6">{wh.name}</Typography>
                  <Chip size="small" label={wh.code} />
                </Stack>
                {wh.address && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {wh.address}
                  </Typography>
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Zones ({zonesForWh(wh.id).length})</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  {zonesForWh(wh.id).map((z) => (
                    <Paper key={z.id} variant="outlined" sx={{ px: 1.5, py: 0.75 }}>
                      <Typography variant="caption" color="text.secondary">{z.code}</Typography>
                      <Typography variant="body2">{z.name}</Typography>
                    </Paper>
                  ))}
                  {zonesForWh(wh.id).length === 0 && (
                    <Typography variant="body2" color="text.secondary">No zones defined</Typography>
                  )}
                </Stack>
                {canManage && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      size="small"
                      onClick={() => {
                        setZoneForm({ ...zoneForm, warehouse_id: wh.id })
                        setSelectedWh(wh.id)
                        setZoneDialogOpen(true)
                      }}
                    >
                      Add zone to {wh.code}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={whDialogOpen} onClose={() => setWhDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Warehouse</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Code" required value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value })} />
            <TextField label="Name" required value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} />
            <TextField label="Address" value={whForm.address} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} />
            <TextField label="Description" value={whForm.description} onChange={(e) => setWhForm({ ...whForm, description: e.target.value })} multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWhDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!whForm.code || !whForm.name || createWh.isPending} onClick={() => createWh.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={zoneDialogOpen} onClose={() => setZoneDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Zone</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select required label="Warehouse" value={zoneForm.warehouse_id} onChange={(e) => setZoneForm({ ...zoneForm, warehouse_id: Number(e.target.value) })}>
              {(warehouses || []).map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
            </TextField>
            <TextField label="Code" required value={zoneForm.code} onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })} />
            <TextField label="Name" required value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} />
            <TextField label="Description" value={zoneForm.description} onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })} multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setZoneDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!zoneForm.warehouse_id || !zoneForm.code || !zoneForm.name || createZone.isPending} onClick={() => createZone.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
