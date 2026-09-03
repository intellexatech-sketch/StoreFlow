import axios, { AxiosError, AxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
})

const TOKEN_KEY = 'itad_token'

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<any>) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      setToken(null)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(err: unknown): string {
  const e = err as AxiosError<any>
  const detail = e?.response?.data?.error?.message
  return detail || e?.message || 'Unexpected error'
}

export async function download(url: string, filename: string, config?: AxiosRequestConfig) {
  const res = await api.get(url, { ...config, responseType: 'blob' })
  const blob = new Blob([res.data])
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}
