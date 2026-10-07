import axios from 'axios'

/**
 * Real-network client. Mock mode never touches this — it only comes into play
 * when VITE_USE_MOCK=false, so a backend can be dropped in by setting
 * VITE_API_BASE_URL and keeping every call site identical.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const token = import.meta.env.VITE_API_TOKEN
if (token) http.defaults.headers.common.Authorization = `Bearer ${token}`

http.interceptors.request.use((config) => {
  // Auth stub: swap for real session storage when the backend lands.
  const sessionToken = localStorage.getItem('npc_token')
  if (sessionToken) config.headers.Authorization = `Bearer ${sessionToken}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.message ||
      (error.code === 'ECONNABORTED' ? 'Request timed out' : 'Network error, check your connection')
    return Promise.reject(Object.assign(error, { friendlyMessage: message }))
  },
)
