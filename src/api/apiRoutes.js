export const apiRoutes = Object.freeze({
  products: {
    root: '/product',
    categories: '/product/categories',
    byCategory: (category) => `/product/category/${encodeURIComponent(category)}`,
    byStatus: '/product/status',
    search: '/product/search',
    summary: '/product/summary',
    byId: (productId) => `/product/${productId}`,
    variantStock: (productId, variantId) => `/product/${productId}/variants/${variantId}/stock`,
    activate: (productId) => `/product/${productId}/activate`,
    deactivate: (productId) => `/product/${productId}/deactivate`,
  },
})
