import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { useQuery } from '@tanstack/react-query'
import { customersApi, lotsApi, reportsApi } from '../api/endpoints'
import { STATUS_OPTIONS } from '../types'

function ReportCard(props: {
  title: string
  description: string
  onCsv: () => void
  onPdf: () => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6">{props.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          {props.description}
        </Typography>
        {props.children}
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} disabled={props.disabled} onClick={props.onCsv}>
            CSV
          </Button>
          <Button size="small" variant="contained" startIcon={<PictureAsPdfIcon />} disabled={props.disabled} onClick={props.onPdf}>
            PDF
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default function ReportsPage() {
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list() })
  const { data: lots } = useQuery({ queryKey: ['lots'], queryFn: lotsApi.list })

  const [inventoryStatus, setInventoryStatus] = useState('')
  const [customerId, setCustomerId] = useState<number | ''>('')
  const [lotId, setLotId] = useState<number | ''>('')
  const [moveFrom, setMoveFrom] = useState('')
  const [moveTo, setMoveTo] = useState('')
  const [auditFrom, setAuditFrom] = useState('')
  const [auditTo, setAuditTo] = useState('')

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Reports</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <ReportCard
            title="Inventory Report"
            description="Complete list of assets, optionally filtered by status."
            onCsv={() => reportsApi.inventoryCsv({ status: inventoryStatus || undefined })}
            onPdf={() => reportsApi.inventoryPdf({ status: inventoryStatus || undefined })}
          >
            <TextField
              select
              size="small"
              fullWidth
              label="Filter by status"
              value={inventoryStatus}
              onChange={(e) => setInventoryStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </ReportCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <ReportCard
            title="Customer Report"
            description="Assets grouped by customer with status breakdown."
            disabled={!customerId}
            onCsv={() => customerId && reportsApi.customerCsv(Number(customerId))}
            onPdf={() => customerId && reportsApi.customerPdf(Number(customerId))}
          >
            <TextField
              select
              size="small"
              fullWidth
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(Number(e.target.value))}
            >
              {(customers || []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </ReportCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <ReportCard
            title="Lot Report"
            description="Contents of a specific lot including status summary."
            disabled={!lotId}
            onCsv={() => lotId && reportsApi.lotCsv(Number(lotId))}
            onPdf={() => lotId && reportsApi.lotPdf(Number(lotId))}
          >
            <TextField
              select
              size="small"
              fullWidth
              label="Lot"
              value={lotId}
              onChange={(e) => setLotId(Number(e.target.value))}
            >
              {(lots || []).map((l) => <MenuItem key={l.id} value={l.id}>{l.lot_number}</MenuItem>)}
            </TextField>
          </ReportCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <ReportCard
            title="Movement History"
            description="Full movement log for an optional date range."
            onCsv={() => reportsApi.movementCsv({ start: moveFrom || undefined, end: moveTo || undefined })}
            onPdf={() => reportsApi.movementPdf({ start: moveFrom || undefined, end: moveTo || undefined })}
          >
            <Stack direction="row" spacing={1}>
              <TextField
                type="date"
                size="small"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={moveFrom}
                onChange={(e) => setMoveFrom(e.target.value)}
              />
              <TextField
                type="date"
                size="small"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
              />
            </Stack>
          </ReportCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <ReportCard
            title="Recycling Certificate"
            description="Certificate-style list of assets sent for recycling."
            onCsv={() => reportsApi.recyclingCsv()}
            onPdf={() => reportsApi.recyclingPdf()}
          />
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <ReportCard
            title="Disposition Report"
            description="Certificate of destruction / final disposition for all disposed assets."
            onCsv={() => reportsApi.dispositionCsv()}
            onPdf={() => reportsApi.dispositionPdf()}
          />
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <ReportCard
            title="Audit Trail"
            description="Compliance audit log export, optionally filtered by date."
            onCsv={() => reportsApi.auditCsv({ start: auditFrom || undefined, end: auditTo || undefined })}
            onPdf={() => reportsApi.auditPdf({ start: auditFrom || undefined, end: auditTo || undefined })}
          >
            <Stack direction="row" spacing={1}>
              <TextField
                type="date"
                size="small"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={auditFrom}
                onChange={(e) => setAuditFrom(e.target.value)}
              />
              <TextField
                type="date"
                size="small"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={auditTo}
                onChange={(e) => setAuditTo(e.target.value)}
              />
            </Stack>
          </ReportCard>
        </Grid>
      </Grid>
    </Stack>
  )
}
