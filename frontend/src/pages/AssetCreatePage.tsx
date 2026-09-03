import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { assetsApi, customersApi, lotsApi, warehousesApi } from '../api/endpoints'
import { CONDITION_OPTIONS, DEVICE_TYPES, STATUS_OPTIONS } from '../types'
import { apiErrorMessage } from '../api/client'

const INITIAL = {
  asset_tag: '',
  serial_number: '',
  barcode: '',
  customer_id: '' as string | number,
  lot_id: '' as string | number,
  manufacturer: '',
  model: '',
  device_type: 'Laptop',
  condition: 'Good',
  status: 'RECEIVED',
  warehouse_id: '' as string | number,
  zone_id: '' as string | number,
  notes: '',
}

export default function AssetCreatePage() {
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const [form, setForm] = useState({ ...INITIAL })

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list() })
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: warehousesApi.list })
  const { data: lots } = useQuery({ queryKey: ['lots'], queryFn: lotsApi.list })
  const zonesQuery = useQuery({
    queryKey: ['zones', form.warehouse_id],
    queryFn: () => warehousesApi.zones(Number(form.warehouse_id)),
    enabled: !!form.warehouse_id,
  })

  const mutation = useMutation({
    mutationFn: () =>
      assetsApi.create({
        ...form,
        customer_id: Number(form.customer_id),
        lot_id: form.lot_id ? Number(form.lot_id) : undefined,
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
        zone_id: form.zone_id ? Number(form.zone_id) : undefined,
        serial_number: form.serial_number || undefined,
        barcode: form.barcode || undefined,
      }),
    onSuccess: (asset) => {
      enqueueSnackbar(`Asset ${asset.asset_tag} created`, { variant: 'success' })
      navigate(`/assets/${asset.id}`)
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
  })

  const filteredLots = (lots || []).filter((l) => !form.customer_id || l.customer_id === Number(form.customer_id))

  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value })

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Add Asset</Typography>
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth required label="Asset Tag" value={form.asset_tag} onChange={set('asset_tag')} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth label="Serial Number" value={form.serial_number} onChange={set('serial_number')} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth label="Barcode" value={form.barcode} onChange={set('barcode')} />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField select required fullWidth label="Customer" value={form.customer_id} onChange={set('customer_id')}>
                {(customers || []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField select fullWidth label="Lot" value={form.lot_id} onChange={set('lot_id')}>
                <MenuItem value="">—</MenuItem>
                {filteredLots.map((l) => <MenuItem key={l.id} value={l.id}>{l.lot_number}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField select fullWidth required label="Device Type" value={form.device_type} onChange={set('device_type')}>
                {DEVICE_TYPES.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth label="Manufacturer" value={form.manufacturer} onChange={set('manufacturer')} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth label="Model" value={form.model} onChange={set('model')} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField select required fullWidth label="Condition" value={form.condition} onChange={set('condition')}>
                {CONDITION_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField select required fullWidth label="Status" value={form.status} onChange={set('status')}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField select fullWidth label="Warehouse" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value, zone_id: '' })}>
                <MenuItem value="">—</MenuItem>
                {(warehouses || []).map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField select fullWidth label="Zone" value={form.zone_id} onChange={set('zone_id')} disabled={!form.warehouse_id}>
                <MenuItem value="">—</MenuItem>
                {(zonesQuery.data || []).map((z) => <MenuItem key={z.id} value={z.id}>{z.name}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField fullWidth label="Notes" value={form.notes} onChange={set('notes')} multiline minRows={3} />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="contained" disabled={!form.asset_tag || !form.customer_id || mutation.isPending} onClick={() => mutation.mutate()}>
              Save Asset
            </Button>
            <Button variant="text" onClick={() => navigate('/assets')}>Cancel</Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
