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
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { usersApi } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'

interface UserForm {
  name: string
  email: string
  password: string
  role_name: string
  is_active: boolean
}

const EMPTY: UserForm = { name: '', email: '', password: '', role_name: 'INTAKE', is_active: true }

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<UserForm>({ ...EMPTY })

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: usersApi.roles })

  const createMutation = useMutation({
    mutationFn: () => usersApi.create({
      name: form.name,
      email: form.email,
      password: form.password,
      role_name: form.role_name,
      is_active: form.is_active,
    }),
    onSuccess: () => {
      enqueueSnackbar('User created', { variant: 'success' })
      closeDialog()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: any) => usersApi.update(editing!.id, payload),
    onSuccess: () => {
      enqueueSnackbar('User updated', { variant: 'success' })
      closeDialog()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY })
    setDialogOpen(true)
  }

  const openEdit = (row: any) => {
    setEditing(row)
    setForm({
      name: row.name,
      email: row.email,
      password: '',
      role_name: row.role,
      is_active: row.is_active,
    })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditing(null)
    setForm({ ...EMPTY })
  }

  const submit = () => {
    if (editing) {
      const payload: any = {
        name: form.name,
        email: form.email,
        role_name: form.role_name,
        is_active: form.is_active,
      }
      if (form.password) payload.password = form.password
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate()
    }
  }

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
    { field: 'email', headerName: 'Email', width: 240 },
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
      renderCell: (p) => <Chip size="small" label={p.value} color={p.value === 'ADMIN' ? 'primary' : 'default'} />,
    },
    {
      field: 'is_active',
      headerName: 'Active',
      width: 100,
      renderCell: (p) => (p.value ? <Chip size="small" color="success" label="Active" /> : <Chip size="small" label="Inactive" />),
    },
    {
      field: 'last_login',
      headerName: 'Last Login',
      width: 180,
      valueFormatter: (v: any) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      renderCell: (p) => <Button size="small" onClick={() => openEdit(p.row)}>Edit</Button>,
    },
  ]

  const busy = createMutation.isPending || updateMutation.isPending

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">Users</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add User</Button>
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Only ADMIN users can manage user accounts and role assignments.
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid
          rows={users || []}
          columns={columns}
          loading={isLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? `Edit ${editing.name}` : 'New User'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField
              label={editing ? 'New Password (leave blank to keep current)' : 'Password'}
              type="password"
              required={!editing}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <TextField select label="Role" required value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value })}>
              {(roles || []).map((r: any) => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
            </TextField>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <Typography>{form.is_active ? 'Active' : 'Inactive'}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.name || !form.email || (!editing && !form.password) || busy}
            onClick={submit}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
