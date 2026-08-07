function todayAsApiDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toProductRequest(form, { entryDate = todayAsApiDate() } = {}) {
  return {
    name: form.name.trim(),
    brand: form.brand.trim(),
    category: form.category,
    costPrice: Number(form.costPrice),
    salePrice: Number(form.salePrice),
    entryDate,
    notes: form.notes?.trim() || null,
    variants: (form.variants || []).map(({ color, size, stock }) => ({
      color,
      size,
      stock: Number(stock),
    })),
  }
}

export function toProductUpdateRequest(form, { entryDate = form.entryDate || todayAsApiDate() } = {}) {
  return {
    name: form.name.trim(),
    brand: form.brand.trim(),
    category: form.category,
    costPrice: Number(form.costPrice),
    salePrice: Number(form.salePrice),
    entryDate,
    notes: form.notes?.trim() || null,
  }
}
