const DEFAULT_API_URL = '/api/v1'

export const env = Object.freeze({
  apiUrl: (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, ''),
})
