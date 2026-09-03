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
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { customersApi, reportsApi } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { hasRole, useAuth } from '../contexts/AuthContext'

interface CustomerForm {
  customer_code: string
  name: string
  contact_name: string
  email: string
  phone: string
  address: string
}

const EMPTY: CustomerForm = {
  customer_code: '',
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
}

export default function CustomersPage() {
  const [q, setQ] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CustomerForm>({ ...EMPTY })
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canManage = hasRole(user, 'INTAKE', 'PROCESSING', 'SALES')

  const { data, isLoading } = useQuery({ queryKey: ['customers', q], queryFn: () => customersApi.list(q || undefined) })

  const createMutation = useMutation({
    mutationFn: () => customersApi.create({
      customer_code: form.customer_code,
      name: form.name,
      contact_name: form.contact_name || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
    }),
    onSuccess: () => {
      enqueueSnackbar('Customer created', { variant: 'success' })
      setDialogOpen(false)
      setForm({ ...EMPTY })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
  })

  const columns: GridColDef[] = [
    { field: 'customer_code', headerName: 'Code', width: 130 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
    { field: 'contact_name', headerName: 'Contact', width: 180 },
    { field: 'email', headerName: 'Email', width: 220 },
    { field: 'phone', headerName: 'Phone', width: 150 },
    {
      field: 'actions',
      headerName: 'Reports',
      width: 220,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={(e) => { e.stopPropagation(); reportsApi.customerCsv(p.row.id) }}>CSV</Button>
          <Button size="small" onClick={(e) => { e.stopPropagation(); reportsApi.customerPdf(p.row.id) }}>PDF</Button>
        </Stack>
      ),
    },
  ]

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">Customers</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Add Customer
          </Button>
        )}
      </Stack>

      <Card>
        <CardContent>
          <TextField
            size="small"
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, code, or contact"
            sx={{ width: 320 }}
          />
        </CardContent>
      </Card>

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid
          rows={data || []}
          columns={columns}
          loading={isLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Customer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Customer Code" required value={form.customer_code} onChange={(e) => setForm({ ...form, customer_code: e.target.value })} />
            <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Contact Name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.customer_code || !form.name || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
