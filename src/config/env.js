const DEFAULT_API_URL = import.meta.env.DEV
  ? '/api/v1'
  : 'https://roseapp-backend-production.up.railway.app/api/v1'

export const env = Object.freeze({
  apiUrl: (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, ''),
})
