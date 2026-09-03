import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { customersApi, lotsApi, reportsApi } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { hasRole, useAuth } from '../contexts/AuthContext'

const LOT_STATUSES = ['OPEN', 'PROCESSING', 'COMPLETED', 'CLOSED']

export default function LotsPage() {
  const { user } = useAuth()
  const canCreate = hasRole(user, 'INTAKE', 'PROCESSING')
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    lot_number: '',
    customer_id: '' as number | '',
    description: '',
    received_date: '',
    status: 'OPEN',
  })

  const { data: lots, isLoading } = useQuery({ queryKey: ['lots'], queryFn: lotsApi.list })
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list() })

  const createMutation = useMutation({
    mutationFn: () => lotsApi.create({
      lot_number: form.lot_number,
      customer_id: Number(form.customer_id),
      description: form.description || undefined,
      received_date: form.received_date || undefined,
      status: form.status,
    }),
    onSuccess: () => {
      enqueueSnackbar('Lot created', { variant: 'success' })
      setDialogOpen(false)
      setForm({ lot_number: '', customer_id: '', description: '', received_date: '', status: 'OPEN' })
      queryClient.invalidateQueries({ queryKey: ['lots'] })
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
  })

  const columns: GridColDef[] = [
    { field: 'lot_number', headerName: 'Lot #', width: 180 },
    { field: 'customer_name', headerName: 'Customer', flex: 1, minWidth: 200 },
    { field: 'status', headerName: 'Status', width: 130 },
    { field: 'asset_count', headerName: 'Assets', width: 100, type: 'number' },
    {
      field: 'received_date',
      headerName: 'Received',
      width: 130,
      valueFormatter: (v: any) => (v ? new Date(v).toLocaleDateString() : ''),
    },
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
    {
      field: 'actions',
      headerName: 'Reports',
      width: 200,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={(e) => { e.stopPropagation(); reportsApi.lotCsv(p.row.id) }}>CSV</Button>
          <Button size="small" onClick={(e) => { e.stopPropagation(); reportsApi.lotPdf(p.row.id) }}>PDF</Button>
        </Stack>
      ),
    },
  ]

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">Lots</Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Add Lot
          </Button>
        )}
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Lots group assets received together from the same customer for batch processing.
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid
          rows={lots || []}
          columns={columns}
          loading={isLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Lot</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Lot Number" required value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} />
            <TextField select required label="Customer" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: Number(e.target.value) })}>
              {(customers || []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField
              type="date"
              label="Received Date"
              InputLabelProps={{ shrink: true }}
              value={form.received_date}
              onChange={(e) => setForm({ ...form, received_date: e.target.value })}
            />
            <TextField select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {LOT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.lot_number || !form.customer_id || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
