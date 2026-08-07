import { env } from '../config/env'

export class ApiError extends Error {
  constructor(message, { status = 0, details = [], data = null, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.data = data
  }
}

async function readResponse(response) {
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json()
  return response.text()
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, headers = {}, signal } = options
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  let response

  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      signal,
      cache: method === 'GET' ? 'no-store' : 'default',
      headers: {
        ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
  } catch (cause) {
    throw new ApiError('No se pudo conectar con el servidor. Verificá que el backend esté encendido.', { cause })
  }

  const data = await readResponse(response)
  if (!response.ok) {
    throw new ApiError(data?.message || `La solicitud falló con estado ${response.status}.`, {
      status: response.status,
      details: Array.isArray(data?.details) ? data.details : [],
      data,
    })
  }

  return data
}
