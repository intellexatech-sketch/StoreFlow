import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../api/endpoints'

const ENTITY_TYPES = ['Asset', 'User', 'Customer', 'Warehouse', 'Zone', 'Lot', 'Movement']
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'CONDITION_CHANGE', 'MOVE', 'LOGIN', 'LOGOUT']

export default function AuditLogsPage() {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [selected, setSelected] = useState<any | null>(null)

  const params = {
    page: page + 1,
    page_size: pageSize,
    entity_type: entityType || undefined,
    action: action || undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(params),
    placeholderData: (prev) => prev,
  })

  const columns: GridColDef[] = [
    {
      field: 'timestamp',
      headerName: 'When',
      width: 180,
      valueFormatter: (v: any) => (v ? new Date(v).toLocaleString() : ''),
    },
    { field: 'user_name', headerName: 'User', width: 180 },
    { field: 'entity_type', headerName: 'Entity', width: 130 },
    { field: 'entity_id', headerName: 'Entity ID', width: 130 },
    { field: 'action', headerName: 'Action', width: 160 },
    { field: 'ip_address', headerName: 'IP', width: 140 },
  ]

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Audit Log</Typography>
      <Typography variant="body2" color="text.secondary">
        Compliance audit trail. Click any row to see full detail of the change.
      </Typography>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              size="small"
              label="Entity Type"
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setPage(0) }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All</MenuItem>
              {ENTITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Action"
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(0) }}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">All</MenuItem>
              {ACTIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
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
          onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize) }}
          onRowClick={(p) => setSelected(p.row)}
          disableRowSelectionOnClick
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Box>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>Audit Entry #{selected?.id}</DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={2}>
              <Typography variant="body2">
                <b>{selected.action}</b> on {selected.entity_type} #{selected.entity_id}
                {' — '}{new Date(selected.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                By {selected.user_name || 'system'} from {selected.ip_address || '—'}
              </Typography>
              {selected.old_values && (
                <>
                  <Typography variant="subtitle2">Old values</Typography>
                  <Box component="pre" sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 12 }}>
                    {JSON.stringify(selected.old_values, null, 2)}
                  </Box>
                </>
              )}
              {selected.new_values && (
                <>
                  <Typography variant="subtitle2">New values</Typography>
                  <Box component="pre" sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 12 }}>
                    {JSON.stringify(selected.new_values, null, 2)}
                  </Box>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  )
}
