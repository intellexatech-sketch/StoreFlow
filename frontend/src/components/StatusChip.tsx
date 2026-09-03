import { Chip } from '@mui/material'

const STATUS_COLORS: Record<string, { color: any; label?: string }> = {
  COLLECTED: { color: 'default' },
  IN_TRANSIT: { color: 'info' },
  RECEIVED: { color: 'primary' },
  PROCESSING: { color: 'secondary' },
  TESTING: { color: 'warning' },
  READY_FOR_RESALE: { color: 'success' },
  SOLD: { color: 'success' },
  READY_FOR_RECYCLING: { color: 'warning' },
  RECYCLED: { color: 'default' },
  DISPOSED: { color: 'default' },
  ON_HOLD: { color: 'error' },
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  if (!status) return <span>—</span>
  const conf = STATUS_COLORS[status] || { color: 'default' }
  return <Chip size="small" label={status.replace(/_/g, ' ')} color={conf.color} variant="filled" />
}

const CONDITION_COLORS: Record<string, any> = {
  New: 'success',
  Excellent: 'success',
  Good: 'primary',
  Fair: 'warning',
  Poor: 'warning',
  Damaged: 'error',
  Scrap: 'default',
}

export function ConditionChip({ condition }: { condition: string | null | undefined }) {
  if (!condition) return <span>—</span>
  return (
    <Chip
      size="small"
      label={condition}
      color={CONDITION_COLORS[condition] || 'default'}
      variant="outlined"
    />
  )
}
