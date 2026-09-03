import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { movementsApi } from '../api/endpoints'
import { MOVEMENT_TYPES } from '../types'

export default function MovementsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [movementType, setMovementType] = useState('')
  const [assetTag, setAssetTag] = useState('')

  const params = {
    page: page + 1,
    page_size: pageSize,
    movement_type: movementType || undefined,
    asset_tag: assetTag || undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['movements', params],
    queryFn: () => movementsApi.list(params),
    placeholderData: (prev) => prev,
  })

  const columns: GridColDef[] = [
    {
      field: 'timestamp',
      headerName: 'When',
      width: 180,
      valueFormatter: (v: any) => (v ? new Date(v).toLocaleString() : ''),
    },
    { field: 'asset_tag', headerName: 'Asset Tag', width: 140 },
    { field: 'movement_type', headerName: 'Type', width: 130 },
    { field: 'from_zone_name', headerName: 'From Zone', width: 150 },
    { field: 'to_zone_name', headerName: 'To Zone', width: 150 },
    { field: 'from_status', headerName: 'From Status', width: 140 },
    { field: 'to_status', headerName: 'To Status', width: 140 },
    { field: 'performed_by_name', headerName: 'By', width: 160 },
    { field: 'reference_number', headerName: 'Ref #', width: 130 },
  ]

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Movements</Typography>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Asset Tag"
              value={assetTag}
              onChange={(e) => {
                setAssetTag(e.target.value)
                setPage(0)
              }}
            />
            <TextField
              size="small"
              select
              label="Movement Type"
              value={movementType}
              onChange={(e) => {
                setMovementType(e.target.value)
                setPage(0)
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All</MenuItem>
              {MOVEMENT_TYPES.map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ height: 640, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid
          rows={data?.items || []}
          columns={columns}
          loading={isLoading}
          rowCount={data?.total || 0}
          paginationMode="server"
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(m) => {
            setPage(m.page)
            setPageSize(m.pageSize)
          }}
          onRowClick={(p) => navigate(`/assets/${p.row.asset_id}`)}
          disableRowSelectionOnClick
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Box>
    </Stack>
  )
}
