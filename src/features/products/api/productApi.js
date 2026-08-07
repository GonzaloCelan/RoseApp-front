import { apiRoutes } from '../../../api/apiRoutes'
import { apiRequest } from '../../../api/httpClient'

export const productApi = {
  getAll({ page = 0, size = 10, signal } = {}) {
    const query = new URLSearchParams({ page: String(page), size: String(size) })
    return apiRequest(`${apiRoutes.products.root}?${query}`, { signal })
  },

  getByCategory(category, { page = 0, size = 10, signal } = {}) {
    const query = new URLSearchParams({ page: String(page), size: String(size) })
    return apiRequest(`${apiRoutes.products.byCategory(category)}?${query}`, { signal })
  },

  getByStatus(active, { page = 0, size = 10, signal } = {}) {
    const query = new URLSearchParams({ page: String(page), size: String(size) })
    if (active !== null && active !== undefined) query.set('active', String(active))
    return apiRequest(`${apiRoutes.products.byStatus}?${query}`, { signal })
  },

  search(queryValue, { page = 0, size = 10, signal } = {}) {
    const query = new URLSearchParams({ query: queryValue, page: String(page), size: String(size) })
    return apiRequest(`${apiRoutes.products.search}?${query}`, { signal })
  },

  getCategories({ signal } = {}) {
    return apiRequest(apiRoutes.products.categories, { signal })
  },

  getSummary({ lowStockLimit = 3, highStockLimit = 10, signal } = {}) {
    const query = new URLSearchParams({
      lowStockLimit: String(lowStockLimit),
      highStockLimit: String(highStockLimit),
    })
    return apiRequest(`${apiRoutes.products.summary}?${query}`, { signal })
  },

  create(product, { image, signal } = {}) {
    const formData = new FormData()
    formData.append('product', new Blob([JSON.stringify(product)], { type: 'application/json' }))
    if (image) formData.append('image', image, image.name)

    return apiRequest(apiRoutes.products.root, {
      method: 'POST',
      body: formData,
      signal,
    })
  },

  update(productId, product, { signal } = {}) {
    return apiRequest(apiRoutes.products.byId(productId), {
      method: 'PUT',
      body: product,
      signal,
    })
  },

  setVariantStock(productId, variantId, stock, { signal } = {}) {
    return apiRequest(apiRoutes.products.variantStock(productId, variantId), {
      method: 'PATCH',
      body: { stock: Number(stock) },
      signal,
    })
  },

  activate(productId, { signal } = {}) {
    return apiRequest(apiRoutes.products.activate(productId), {
      method: 'PATCH',
      signal,
    })
  },

  deactivate(productId, { signal } = {}) {
    return apiRequest(apiRoutes.products.deactivate(productId), {
      method: 'PATCH',
      signal,
    })
  },
}
