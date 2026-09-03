import { Box, Button, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h1" color="primary">404</Typography>
        <Typography variant="h5">Page not found</Typography>
        <Typography color="text.secondary">The page you're looking for doesn't exist.</Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
      </Stack>
    </Box>
  )
}
