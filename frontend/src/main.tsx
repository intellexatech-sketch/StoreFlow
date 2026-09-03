import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { SnackbarProvider } from 'notistack'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'

import App from './App'
import { theme } from './theme'
import { AuthProvider } from './contexts/AuthContext'
import { RealtimeProvider } from './contexts/RealtimeContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Data is considered fresh for 15s. When the WS fallback polls every
      // 20s, this lets React Query dedupe reads and only re-fetch changed
      // views. Refetching on focus is enabled so a user returning to the tab
      // always gets current data even without realtime.
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <RealtimeProvider>
                <App />
              </RealtimeProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
