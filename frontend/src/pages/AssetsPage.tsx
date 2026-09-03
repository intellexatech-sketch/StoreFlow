import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { assetsApi, customersApi, warehousesApi } from '../api/endpoints'
import { CONDITION_OPTIONS, DEVICE_TYPES, STATUS_OPTIONS } from '../types'
import { StatusChip, ConditionChip } from '../components/StatusChip'
import BulkMoveDialog from '../components/BulkMoveDialog'
import { hasRole, useAuth } from '../contexts/AuthContext'

export default function AssetsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState<string>('')
  const [status, setStatus] = useState('')
  const [condition, setCondition] = useState('')
  const [warehouseId, setWarehouseId] = useState<string>('')
  const [deviceType, setDeviceType] = useState('')
  const [selection, setSelection] = useState<GridRowSelectionModel>([])
  const [bulkOpen, setBulkOpen] = useState(false)

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list() })
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: warehousesApi.list })

  const params = useMemo(
    () => ({
      page: page + 1,
      page_size: pageSize,
      search: search || undefined,
      customer_id: customerId || undefined,
      status: status || undefined,
      condition: condition || undefined,
      warehouse_id: warehouseId || undefined,
      device_type: deviceType || undefined,
    }),
    [page, pageSize, search, customerId, status, condition, warehouseId, deviceType],
  )

  const { data, isFetching } = useQuery({
    queryKey: ['assets', params],
    queryFn: () => assetsApi.list(params),
    placeholderData: (p) => p,
  })

  const canMove = hasRole(user, 'INTAKE', 'PROCESSING')

  const columns: GridColDef[] = [
    { field: 'asset_tag', headerName: 'Asset Tag', width: 140, renderCell: (p) => <b>{p.value}</b> },
    { field: 'serial_number', headerName: 'Serial', width: 160 },
    { field: 'customer_name', headerName: 'Customer', width: 170 },
    { field: 'device_type', headerName: 'Device', width: 110 },
    { field: 'manufacturer', headerName: 'Manufacturer', width: 130 },
    { field: 'model', headerName: 'Model', width: 160 },
    {
      field: 'condition',
      headerName: 'Condition',
      width: 120,
      renderCell: (p) => <ConditionChip condition={p.value} />,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 170,
      renderCell: (p) => <StatusChip status={p.value} />,
    },
    { field: 'warehouse_name', headerName: 'Warehouse', width: 150 },
    { field: 'zone_name', headerName: 'Zone', width: 130 },
    { field: 'lot_number', headerName: 'Lot', width: 150 },
    {
      field: 'updated_at',
      headerName: 'Updated',
      width: 170,
      valueFormatter: (v) => (v ? new Date(v as string).toLocaleString() : ''),
    },
  ]

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Typography variant="h4">All Assets</Typography>
        <Stack direction="row" spacing={1}>
          {hasRole(user, 'INTAKE') && (
            <Button variant="contained" onClick={() => navigate('/assets/new')}>
              Add Asset
            </Button>
          )}
          <Button variant="outlined" onClick={() => navigate('/assets/scan')}>
            Scan
          </Button>
          {hasRole(user, 'INTAKE') && (
            <Button variant="outlined" onClick={() => navigate('/assets/import')}>
              Import CSV
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              label="Search (tag / serial / barcode)"
              value={search}
              onChange={(e) => {
                setPage(0)
                setSearch(e.target.value)
              }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField select fullWidth label="Customer" value={customerId} onChange={(e) => { setPage(0); setCustomerId(e.target.value) }}>
              <MenuItem value="">All</MenuItem>
              {customers?.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField select fullWidth label="Status" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value) }}>
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField select fullWidth label="Condition" value={condition} onChange={(e) => { setPage(0); setCondition(e.target.value) }}>
              <MenuItem value="">All</MenuItem>
              {CONDITION_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField select fullWidth label="Warehouse" value={warehouseId} onChange={(e) => { setPage(0); setWarehouseId(e.target.value) }}>
              <MenuItem value="">All</MenuItem>
              {warehouses?.map((w) => (
                <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4} md={1}>
            <TextField select fullWidth label="Device" value={deviceType} onChange={(e) => { setPage(0); setDeviceType(e.target.value) }}>
              <MenuItem value="">All</MenuItem>
              {DEVICE_TYPES.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        {selection.length > 0 && canMove && (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
            <Chip color="primary" label={`${selection.length} selected`} />
            <Button variant="contained" onClick={() => setBulkOpen(true)}>Bulk Move</Button>
          </Stack>
        )}
      </Paper>

      <Card>
        <Box sx={{ height: 620 }}>
          <DataGrid
            rows={data?.items || []}
            columns={columns}
            checkboxSelection={canMove}
            onRowSelectionModelChange={setSelection}
            rowSelectionModel={selection}
            loading={isFetching}
            paginationMode="server"
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(m) => {
              setPage(m.page)
              setPageSize(m.pageSize)
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            rowCount={data?.total ?? 0}
            onRowClick={(p) => navigate(`/assets/${p.id}`)}
            sx={{ border: 0, cursor: 'pointer' }}
            disableRowSelectionOnClick
          />
        </Box>
      </Card>

      <BulkMoveDialog
        open={bulkOpen}
        assetIds={selection.map(Number)}
        onClose={() => setBulkOpen(false)}
        onDone={(result) => {
          enqueueSnackbar(
            `Bulk move: ${result.successful.length} succeeded, ${result.failed.length} failed`,
            { variant: result.failed.length ? 'warning' : 'success' },
          )
          setBulkOpen(false)
          setSelection([])
          qc.invalidateQueries({ queryKey: ['assets'] })
        }}
      />
    </Stack>
  )
}
