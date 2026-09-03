import { createTheme } from '@mui/material'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1e40af', dark: '#1e3a8a', light: '#3b82f6' },
    secondary: { main: '#0ea5e9' },
    background: { default: '#f4f6fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#475569' },
    success: { main: '#059669' },
    warning: { main: '#d97706' },
    error: { main: '#dc2626' },
    info: { main: '#0284c7' },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.15rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.05)',
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
})
