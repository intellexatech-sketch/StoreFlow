import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { importApi } from '../api/endpoints'
import { ImportSummary } from '../types'
import { apiErrorMessage } from '../api/client'
import { useSnackbar } from 'notistack'

const EXAMPLE = `asset_tag,serial_number,barcode,customer_code,device_type,condition,status,warehouse_code,zone_code,manufacturer,model,lot_number
LAP-100001,SN-100001,BC-100001,CUST001,Laptop,Good,RECEIVED,WH001,RECEIVING,Dell,Latitude 5420,LOT-2026-001-01
LAP-100002,SN-100002,BC-100002,CUST002,Laptop,Fair,RECEIVED,WH001,RECEIVING,HP,EliteBook 840,`

export default function BulkImportPage() {
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const { enqueueSnackbar } = useSnackbar()

  const doImport = async () => {
    if (!file) return
    setBusy(true)
    try {
      const res = await importApi.assets(file)
      setSummary(res)
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e), { variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const downloadErrorsCsv = () => {
    if (!summary || summary.errors.length === 0) return
    const rows = ['row,error', ...summary.errors.map((e) => `${e.row},"${e.error.replace(/"/g, '""')}"`)]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import_errors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Bulk Import Assets</Typography>
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a CSV file. Required columns: <b>asset_tag</b>, <b>customer_code</b>, <b>device_type</b>. Optional:
            serial_number, barcode, condition, status, warehouse_code, zone_code, manufacturer, model, lot_number.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
              Choose CSV
              <input hidden type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </Button>
            {file && (
              <Typography variant="body2" color="text.secondary">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </Typography>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="contained" disabled={!file || busy} onClick={doImport}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </Stack>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2">Example CSV</Typography>
          <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{EXAMPLE}</pre>
          </Paper>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardContent>
            <Typography variant="h6">Import Summary</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Chip label={`Total: ${summary.total_rows}`} />
              <Chip color="success" label={`Successful: ${summary.successful}`} />
              <Chip color="warning" label={`Duplicate: ${summary.duplicate}`} />
              <Chip color="error" label={`Failed: ${summary.failed}`} />
            </Stack>
            {summary.errors.length > 0 && (
              <>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {summary.errors.length} row(s) had errors.
                  <Button size="small" onClick={downloadErrorsCsv} sx={{ ml: 2 }}>
                    Download error CSV
                  </Button>
                </Alert>
                <Paper variant="outlined" sx={{ mt: 2, p: 2, maxHeight: 300, overflow: 'auto' }}>
                  {summary.errors.slice(0, 100).map((e, i) => (
                    <Typography key={i} variant="body2">Row {e.row}: {e.error}</Typography>
                  ))}
                </Paper>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}
