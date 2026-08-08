import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight, Boxes, CheckCircle2, ChevronDown, CircleDollarSign, FilePenLine,
  ImageIcon, Info, PackageSearch, Pencil, Plus, Power, PowerOff, RefreshCw,
  RotateCcw, Search, X,
} from 'lucide-react'
import { ApiError } from '../../api/httpClient'
import { productApi } from '../../features/products/api/productApi'
import { toProductUpdateRequest } from '../../features/products/model/productMapper'
import './products.css'

const initialFilters = { search: '', category: '', status: '' }
const initialPage = { page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true, empty: true }
const initialSummary = { totalActiveProducts: 0, totalInactiveProducts: 0, totalStockUnits: 0, totalCostValue: 0, totalSaleValue: 0, estimatedProfit: 0, outOfStockProducts: 0, lowStockProducts: 0, highStockProducts: 0 }
const editPreviewExitDuration = 360
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const categoryLabels = {
  T_SHIRT: 'Remeras', TOP: 'Musculosas / Tops', SHIRT_BLOUSE: 'Camisas / Blusas',
  BODYSUIT: 'Bodies', SWEATER: 'Sweaters / Suéteres', HOODIE: 'Buzos',
  CARDIGAN: 'Cardigans', JACKET: 'Camperas', COAT: 'Tapados / Abrigos',
  VEST: 'Chalecos', JEANS: 'Jeans', PANTS: 'Pantalones', LEGGINGS: 'Calzas',
  JOGGER: 'Joggers', SHORTS: 'Shorts', SKIRT: 'Polleras', DRESS: 'Vestidos',
  JUMPSUIT: 'Monos / Enteritos', SET: 'Conjuntos', TAILORING: 'Sastrería',
  SPORTSWEAR: 'Ropa deportiva', ACCESSORY: 'Accesorios', FOOTWEAR: 'Calzado', OTHER: 'Otro',
}

const colorValues = { Rosa: '#f25a9d', Negro: '#252329', Blanco: '#f5f5f5', Beige: '#d8c09f', Gris: '#90909a', Marrón: '#82543b', Rojo: '#dc3e49', Bordó: '#7d2338', Naranja: '#ed813d', Amarillo: '#efc942', Verde: '#47a868', Celeste: '#72b9df', Azul: '#3468c0', Violeta: '#8d55bc', Dorado: '#c8a447', Plateado: '#b5b7bd' }

function categoryName(product) {
  return product.categoryName || categoryLabels[product.category] || product.category || '—'
}

function ProductThumbnail({ src, name }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return (
    <span className="product-thumbnail">
      {src && !failed
        ? <img src={src} alt="" onError={() => setFailed(true)} />
        : <ImageIcon aria-label={`Sin imagen para ${name}`} />}
    </span>
  )
}

function ActionButtons({ product, onOpenEditMenu, onToggleStatus, updating, menuOpen }) {
  return (
    <div className="table-actions">
      <button className={menuOpen ? 'edit-action edit-action--open' : 'edit-action'} type="button" aria-label={`Opciones para editar ${product.name}`} aria-haspopup="dialog" aria-expanded={menuOpen} title="Opciones de edición" onClick={({ currentTarget }) => onOpenEditMenu(product, currentTarget)}><Pencil /></button>
      <button className={`status-action ${product.active ? 'status-action--deactivate' : 'status-action--activate'}`} type="button" aria-label={`${product.active ? 'Desactivar' : 'Activar'} ${product.name}`} title={product.active ? 'Desactivar producto' : 'Activar producto'} onClick={() => onToggleStatus(product)} disabled={updating}>
        {updating ? <RefreshCw className="status-action__spinner" /> : product.active ? <PowerOff /> : <Power />}
      </button>
    </div>
  )
}

const editOptions = [
  { mode: 'stock', label: 'Actualizar stock', description: 'Talles, colores y cantidades', icon: Boxes },
  { mode: 'prices', label: 'Cambiar precios', description: 'Costo, venta y ganancia', icon: CircleDollarSign },
  { mode: 'full', label: 'Editar producto completo', description: 'Toda la información del producto', icon: FilePenLine },
]

function EditQuickMenu({ menu, onClose, onChoose }) {
  return (
    <div className="edit-menu-layer" role="presentation" onMouseDown={({ target, currentTarget }) => { if (target === currentTarget) onClose() }}>
      <section className="edit-quick-menu" style={{ top: menu.top, left: menu.left }} role="dialog" aria-labelledby="edit-quick-menu-title">
        <header className="edit-quick-menu__header">
          <ProductThumbnail src={menu.product.imageUrl} name={menu.product.name} />
          <span><small id="edit-quick-menu-title">¿Qué querés editar?</small><strong>{menu.product.name}</strong></span>
          <button type="button" onClick={onClose} aria-label="Cerrar opciones de edición"><X /></button>
        </header>
        <div className="edit-quick-menu__options">
          {editOptions.map(({ mode, label, description, icon: Icon }) => (
            <button className={`edit-option edit-option--${mode}`} type="button" key={mode} onClick={() => onChoose(mode, menu.product)}>
              <span><Icon /></span>
              <span><strong>{label}</strong><small>{description}</small></span>
              <ArrowRight />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function editVariantKey(variant, index) {
  return String(variant.id ?? variant.sku ?? `${variant.color}-${variant.size}-${index}`)
}

function EditPreviewPanel({ preview, onClose, onOpenFullEditor, onSaveStock, onSavePrices }) {
  const { mode, product, closing = false } = preview
  const variants = variantsFor(product)
  const title = mode === 'stock' ? 'Actualizar stock' : mode === 'prices' ? 'Cambiar precios' : 'Editar producto completo'
  const eyebrow = mode === 'full' ? 'Edición completa' : 'Edición rápida'
  const Icon = mode === 'stock' ? Boxes : mode === 'prices' ? CircleDollarSign : FilePenLine
  const [stockValues, setStockValues] = useState(() => Object.fromEntries(variants.map((variant, index) => [editVariantKey(variant, index), String(variant.stock)])))
  const [stockSaving, setStockSaving] = useState(false)
  const [stockError, setStockError] = useState('')
  const [priceValues, setPriceValues] = useState(() => ({
    costPrice: String(product.costPrice ?? ''),
    salePrice: String(product.salePrice ?? ''),
  }))
  const [priceSaving, setPriceSaving] = useState(false)
  const [priceError, setPriceError] = useState('')
  const priceCost = Number(priceValues.costPrice)
  const priceSale = Number(priceValues.salePrice)
  const pricesInvalid = priceValues.costPrice === '' || priceValues.salePrice === ''
    || !Number.isFinite(priceCost) || !Number.isFinite(priceSale)
    || priceCost <= 0 || priceSale <= 0
  const pricesChanged = priceCost !== Number(product.costPrice) || priceSale !== Number(product.salePrice)
  const priceProfit = priceSale - priceCost
  const pricePercentage = priceCost > 0 ? (priceProfit / priceCost) * 100 : 0
  const isSaving = stockSaving || priceSaving
  const stockHasInvalidValue = variants.some((variant, index) => {
    const value = stockValues[editVariantKey(variant, index)]
    return value === '' || !Number.isInteger(Number(value)) || Number(value) < 0
  })
  const stockChanges = variants.flatMap((variant, index) => {
    const stock = Number(stockValues[editVariantKey(variant, index)])
    return variant.id != null && stock !== Number(variant.stock) ? [{ variantId: variant.id, stock }] : []
  })

  const saveStock = async () => {
    if (!stockChanges.length || stockHasInvalidValue || stockSaving) return
    setStockSaving(true)
    setStockError('')
    try {
      await onSaveStock(product, stockChanges)
      onClose()
    } catch (requestError) {
      setStockError(requestError instanceof ApiError
        ? [requestError.message, ...requestError.details].filter(Boolean).join(' · ')
        : 'No se pudo actualizar el stock. Intentá nuevamente.')
    } finally {
      setStockSaving(false)
    }
  }

  const savePrices = async () => {
    if (!pricesChanged || pricesInvalid || priceSaving) return
    setPriceSaving(true)
    setPriceError('')
    try {
      await onSavePrices(product, { costPrice: priceCost, salePrice: priceSale })
      onClose()
    } catch (requestError) {
      setPriceError(requestError instanceof ApiError
        ? [requestError.message, ...requestError.details].filter(Boolean).join(' · ')
        : 'No se pudieron actualizar los precios. Intentá nuevamente.')
    } finally {
      setPriceSaving(false)
    }
  }

  return (
    <div className={`edit-preview-backdrop ${closing ? 'edit-preview-backdrop--closing' : ''}`} role="presentation" onMouseDown={({ target, currentTarget }) => { if (target === currentTarget && !isSaving) onClose() }}>
      <aside className={`edit-preview-panel edit-preview-panel--${mode}`} role="dialog" aria-modal="true" aria-labelledby="edit-preview-title">
        <header className="edit-preview-panel__header">
          <span className="edit-preview-panel__icon"><Icon /></span>
          <div><small>{eyebrow}</small><h2 id="edit-preview-title">{title}</h2><p>{product.name} · {product.code}</p></div>
          <button type="button" onClick={() => onClose()} disabled={isSaving} aria-label="Cerrar vista previa"><X /></button>
        </header>

        <div className={`edit-preview-panel__notice ${mode !== 'full' ? 'edit-preview-panel__notice--connected' : ''}`}>
          <Info />
          <span>
            <strong>{mode !== 'full' ? 'Conectado al catálogo' : 'Acceso al editor'}</strong>{' '}
            {mode === 'stock'
              ? 'Al guardar, se reemplazará el stock actual de las variantes modificadas.'
              : mode === 'prices'
                ? 'Al guardar, se actualizarán los precios y se conservarán los demás datos actuales.'
                : 'Abrí el formulario para modificar los datos generales del producto.'}
          </span>
        </div>

        <div className="edit-preview-panel__body">
          {mode === 'stock' ? (
            <>
              <div className="edit-preview-copy"><h3>Stock por variante</h3><p>Modificá únicamente las cantidades del producto seleccionado.</p></div>
              <div className="edit-stock-list">
                {variants.map((variant, index) => (
                  <label className="edit-stock-row" key={editVariantKey(variant, index)}>
                    <span className="edit-stock-row__size">{variant.size}</span>
                    <span className="edit-stock-row__color"><i style={{ background: colorValues[variant.color] || '#d4ccd5' }} />{variant.color}<small>{variant.sku || `Variante ${index + 1}`}</small></span>
                    <span className="edit-stock-row__input"><small>Unidades</small><input type="number" min="0" step="1" value={stockValues[editVariantKey(variant, index)] ?? ''} disabled={stockSaving || variant.id == null} onChange={({ target }) => setStockValues((current) => ({ ...current, [editVariantKey(variant, index)]: target.value }))} /></span>
                  </label>
                ))}
              </div>
              <div className="edit-stock-total"><span>{stockChanges.length ? `${stockChanges.length} ${stockChanges.length === 1 ? 'variante modificada' : 'variantes modificadas'}` : 'Stock actual total'}</span><strong>{variants.reduce((total, variant, index) => total + Number(stockValues[editVariantKey(variant, index)] || 0), 0).toLocaleString('es-AR')} unidades</strong></div>
              {stockError ? <div className="edit-stock-error" role="alert"><X />{stockError}</div> : null}
            </>
          ) : null}

          {mode === 'prices' ? (
            <>
              <div className="edit-preview-copy"><h3>Precios del producto</h3><p>Un acceso rápido para el cambio más frecuente del catálogo.</p></div>
              <div className="edit-price-grid">
                <label><span>Precio de costo</span><div><b>$</b><input type="number" min="0.01" step="0.01" value={priceValues.costPrice} disabled={priceSaving} onChange={({ target }) => setPriceValues((current) => ({ ...current, costPrice: target.value }))} /></div><small>Valor pagado por unidad.</small></label>
                <label><span>Precio de venta</span><div><b>$</b><input type="number" min="0.01" step="0.01" value={priceValues.salePrice} disabled={priceSaving} onChange={({ target }) => setPriceValues((current) => ({ ...current, salePrice: target.value }))} /></div><small>Precio publicado para la venta.</small></label>
              </div>
              <div className="edit-profit-preview"><span><CircleDollarSign /><small>Ganancia estimada</small></span><strong>{ars.format(Number.isFinite(priceProfit) ? priceProfit : 0)}</strong><em>{Number.isFinite(pricePercentage) ? pricePercentage.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '0'}%</em></div>
              {priceError ? <div className="edit-stock-error" role="alert"><X />{priceError}</div> : null}
            </>
          ) : null}

          {mode === 'full' ? (
            <>
              <div className="edit-preview-copy"><h3>Información general</h3><p>La edición completa mantiene el formulario que ya conocés.</p></div>
              <div className="edit-full-grid">
                <label><span>Nombre del producto</span><input defaultValue={product.name || ''} /></label>
                <label><span>Marca</span><input defaultValue={product.brand || ''} /></label>
                <label><span>Categoría</span><input defaultValue={categoryName(product)} /></label>
                <label><span>Notas</span><textarea defaultValue={product.notes || ''} placeholder="Sin notas" /></label>
              </div>
              <div className="edit-full-summary"><span><Boxes />{variants.length} {variants.length === 1 ? 'variante' : 'variantes'}</span><span><CircleDollarSign />{ars.format(product.salePrice || 0)}</span></div>
            </>
          ) : null}
        </div>

        <footer className="edit-preview-panel__footer">
          <span><Info /> {mode === 'stock' ? 'Se actualizarán únicamente las variantes modificadas' : mode === 'prices' ? 'Los demás datos conservarán su valor actual' : 'Variantes e imagen se administran por separado'}</span>
          <div>
            <button className="edit-preview-secondary" type="button" onClick={() => onClose()} disabled={isSaving}>{mode === 'full' ? 'Cerrar' : 'Cancelar'}</button>
            {mode === 'full' ? <button className="edit-preview-primary" type="button" onClick={() => onOpenFullEditor(product)}>Abrir editor completo <ArrowRight /></button> : null}
            {mode === 'stock' ? <button className="edit-preview-primary" type="button" onClick={saveStock} disabled={!stockChanges.length || stockHasInvalidValue || stockSaving}>{stockSaving ? <><RefreshCw className="status-action__spinner" /> Guardando...</> : `Guardar stock${stockChanges.length ? ` (${stockChanges.length})` : ''}`}</button> : null}
            {mode === 'prices' ? <button className="edit-preview-primary" type="button" onClick={savePrices} disabled={!pricesChanged || pricesInvalid || priceSaving}>{priceSaving ? <><RefreshCw className="status-action__spinner" /> Guardando...</> : 'Guardar precios'}</button> : null}
          </div>
        </footer>
      </aside>
    </div>
  )
}

function variantsFor(product) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      color: variant.color || '—',
      size: variant.size || variant.talle || '—',
      stock: Number(variant.stock ?? 0),
      active: variant.active !== false,
    }))
  }

  return product.size ? [{ color: product.color || '—', size: product.size, stock: Number(product.stock ?? 0), active: true }] : []
}

function SizePills({ variants, limit = 3 }) {
  const sizes = Object.values(variants.reduce((grouped, variant) => {
    const current = grouped[variant.size] || { size: variant.size, stock: 0 }
    current.stock += Number(variant.stock || 0)
    grouped[variant.size] = current
    return grouped
  }, {}))
  const visibleVariants = sizes.slice(0, limit)
  const remaining = sizes.length - visibleVariants.length

  return (
    <span className="size-pills">
      {visibleVariants.map(({ size, stock }) => (
        <span className={`size-pill ${stock === 0 ? 'size-pill--empty' : stock <= 3 ? 'size-pill--low' : ''}`} key={size} title={`Talle ${size}`} aria-label={`Talle ${size}`}>{size === 'Único' ? 'U' : size}</span>
      ))}
      {remaining > 0 && <span className="size-pill size-pill--more">+{remaining}</span>}
    </span>
  )
}

function ProductColors({ variants }) {
  const colors = [...new Set(variants.map(({ color }) => color).filter(Boolean))]
  if (!colors.length) return '—'

  return <span className="product-colors">{colors.slice(0, 2).map((color) => <span key={color}><i style={{ background: colorValues[color] || '#d4ccd5' }} />{color}</span>)}{colors.length > 2 && <small>+{colors.length - 2}</small>}</span>
}

function VariantBreakdown({ variants }) {
  return (
    <div className="variant-breakdown">
      <span className="variant-breakdown__title">Stock por variante</span>
      <div className="variant-breakdown__items">
        {variants.map(({ id, sku, color, size, stock }) => (
          <span className={`variant-stock ${stock === 0 ? 'variant-stock--empty' : stock <= 3 ? 'variant-stock--low' : ''}`} key={id || sku || `${color}-${size}`}>
            <b>{size}</b><span><i style={{ background: colorValues[color] || '#d4ccd5' }} />{color} · {stock} {stock === 1 ? 'unidad' : 'unidades'}</span>
          </span>
        ))}
      </div>
      <small>{variants.length} {variants.length === 1 ? 'combinación' : 'combinaciones'}</small>
    </div>
  )
}

function AnimatedMoney({ value }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const target = Number(value) || 0
    const duration = 1050
    const startedAt = performance.now()
    let animationFrame

    const countUp = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 4)
      setDisplayValue(target * easedProgress)
      if (progress < 1) animationFrame = requestAnimationFrame(countUp)
    }

    animationFrame = requestAnimationFrame(countUp)
    return () => cancelAnimationFrame(animationFrame)
  }, [value])

  return ars.format(displayValue)
}

export function ProductsPage({ onNewProduct, onEditProduct, onInitialLoadComplete }) {
  const [products, setProducts] = useState([])
  const [pageInfo, setPageInfo] = useState(initialPage)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedProductId, setExpandedProductId] = useState(null)
  const [editMenu, setEditMenu] = useState(null)
  const [editPreview, setEditPreview] = useState(null)
  const editPreviewCloseTimer = useRef(null)
  const [statusConfirmation, setStatusConfirmation] = useState(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState(null)
  const [statusNotice, setStatusNotice] = useState(null)
  const [summaryRevision, setSummaryRevision] = useState(0)
  const selectedCategory = filters.category
  const selectedStatus = filters.status
  const effectiveSearch = filters.search.trim() ? debouncedSearch : ''

  const closeEditPreview = useCallback((afterClose) => {
    if (editPreviewCloseTimer.current) return

    const onClosed = typeof afterClose === 'function' ? afterClose : null
    setEditPreview((current) => current ? { ...current, closing: true } : current)

    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : editPreviewExitDuration

    editPreviewCloseTimer.current = window.setTimeout(() => {
      setEditPreview(null)
      editPreviewCloseTimer.current = null
      onClosed?.()
    }, delay)
  }, [])

  useEffect(() => () => {
    if (editPreviewCloseTimer.current) window.clearTimeout(editPreviewCloseTimer.current)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(filters.search.trim()), 350)
    return () => clearTimeout(timeout)
  }, [filters.search])

  const loadProducts = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      let data
      if (selectedCategory) {
        data = await productApi.getByCategory(selectedCategory, { page, size: pageSize, signal })
      } else if (selectedStatus === 'false') {
        data = await productApi.getByStatus(false, { page, size: pageSize, signal })
      } else if (selectedStatus === 'all') {
        data = await productApi.getByStatus(null, { page, size: pageSize, signal })
      } else if (effectiveSearch) {
        data = await productApi.search(effectiveSearch, { page, size: pageSize, signal })
      } else {
        data = await productApi.getAll({ page, size: pageSize, signal })
      }
      const content = Array.isArray(data) ? data : data?.content
      setProducts(Array.isArray(content) ? content : [])
      setPageInfo(Array.isArray(data) ? {
        ...initialPage, size: data.length, totalElements: data.length,
        totalPages: data.length ? 1 : 0, empty: !data.length,
      } : {
        page: data?.page ?? page,
        size: data?.size ?? pageSize,
        totalElements: data?.totalElements ?? 0,
        totalPages: data?.totalPages ?? 0,
        first: data?.first ?? page === 0,
        last: data?.last ?? true,
        empty: data?.empty ?? !content?.length,
      })
    } catch (requestError) {
      if (requestError?.cause?.name === 'AbortError') return
      setProducts([])
      setError(requestError instanceof ApiError ? requestError.message : 'No se pudieron cargar los productos.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [page, pageSize, selectedCategory, selectedStatus, effectiveSearch])

  useEffect(() => {
    const controller = new AbortController()
    loadProducts(controller.signal)
    return () => controller.abort()
  }, [loadProducts])

  useEffect(() => {
    const controller = new AbortController()
    setSummaryLoading(true)
    setSummaryError('')

    productApi.getSummary({ lowStockLimit: 3, highStockLimit: 10, signal: controller.signal })
      .then(setSummary)
      .catch((requestError) => {
        if (requestError?.cause?.name === 'AbortError') return
        setSummary(null)
        setSummaryError(requestError instanceof ApiError ? requestError.message : 'No se pudo cargar el resumen del inventario.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setSummaryLoading(false)
      })

    return () => controller.abort()
  }, [summaryRevision])

  useEffect(() => {
    if (!loading && !summaryLoading) onInitialLoadComplete?.()
  }, [loading, onInitialLoadComplete, summaryLoading])

  useEffect(() => {
    if (!statusNotice) return undefined
    const timeout = setTimeout(() => setStatusNotice(null), 2400)
    return () => clearTimeout(timeout)
  }, [statusNotice])

  useEffect(() => {
    if (!editMenu) return undefined
    const closeEditMenu = ({ key } = {}) => {
      if (!key || key === 'Escape') setEditMenu(null)
    }
    window.addEventListener('keydown', closeEditMenu)
    window.addEventListener('resize', closeEditMenu)
    window.addEventListener('scroll', closeEditMenu, true)
    return () => {
      window.removeEventListener('keydown', closeEditMenu)
      window.removeEventListener('resize', closeEditMenu)
      window.removeEventListener('scroll', closeEditMenu, true)
    }
  }, [editMenu])

  useEffect(() => {
    if (!editPreview) return undefined
    const closeOnEscape = ({ key }) => {
      if (key === 'Escape') closeEditPreview()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [editPreview, closeEditPreview])

  useEffect(() => {
    if (!statusConfirmation) return undefined
    const closeOnEscape = ({ key }) => {
      if (key === 'Escape' && statusUpdatingId === null) setStatusConfirmation(null)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [statusConfirmation, statusUpdatingId])

  const confirmStatusChange = async () => {
    if (!statusConfirmation || statusUpdatingId !== null) return
    const productToChange = statusConfirmation
    const willActivate = !productToChange.active
    setStatusUpdatingId(productToChange.id)

    try {
      if (willActivate) await productApi.activate(productToChange.id)
      else await productApi.deactivate(productToChange.id)

      setProducts((current) => current.map((product) => product.id === productToChange.id ? { ...product, active: willActivate } : product))
      setStatusNotice({ type: 'success', message: `${productToChange.name} quedó ${willActivate ? 'activado' : 'desactivado'} correctamente.` })
      setStatusConfirmation(null)
      setSummaryRevision((revision) => revision + 1)
    } catch (requestError) {
      const message = requestError instanceof ApiError
        ? [requestError.message, ...requestError.details].filter(Boolean).join(' · ')
        : `No se pudo ${willActivate ? 'activar' : 'desactivar'} el producto.`
      setStatusNotice({ type: 'error', message })
      setStatusConfirmation(null)
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const openEditMenu = (product, trigger) => {
    const rect = trigger.getBoundingClientRect()
    const menuWidth = 316
    const menuHeight = 252
    const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth))
    const top = rect.bottom + menuHeight + 10 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(12, rect.top - menuHeight - 8)
    setEditMenu((current) => current?.product.id === product.id ? null : { product, top, left })
  }

  const openEditPreview = (mode, product) => {
    if (editPreviewCloseTimer.current) {
      window.clearTimeout(editPreviewCloseTimer.current)
      editPreviewCloseTimer.current = null
    }
    setEditMenu(null)
    setEditPreview({ mode, product })
  }

  const openFullEditor = (product) => {
    closeEditPreview(() => onEditProduct(product))
  }

  const saveVariantStock = async (product, changes) => {
    const results = await Promise.allSettled(changes.map(({ variantId, stock }) => productApi.setVariantStock(product.id, variantId, stock)))
    const failures = results.filter(({ status }) => status === 'rejected')

    await loadProducts()
    setSummaryRevision((revision) => revision + 1)

    if (failures.length) {
      const details = failures.flatMap(({ reason }) => reason instanceof ApiError
        ? [reason.message, ...reason.details].filter(Boolean)
        : ['Una variante no pudo actualizarse.'])
      throw new ApiError(`${results.length - failures.length} de ${results.length} variantes se actualizaron correctamente.`, { details })
    }

    setStatusNotice({
      type: 'success',
      message: `Stock de ${product.name} actualizado correctamente en ${changes.length} ${changes.length === 1 ? 'variante' : 'variantes'}.`,
    })
  }

  const saveProductPrices = async (product, { costPrice, salePrice }) => {
    await productApi.update(product.id, toProductUpdateRequest({
      ...product,
      costPrice,
      salePrice,
    }))

    await loadProducts()
    setSummaryRevision((revision) => revision + 1)
    setStatusNotice({
      type: 'success',
      message: `Precios de ${product.name} actualizados correctamente.`,
    })
  }

  const updateFilter = ({ target: { name, value } }) => {
    setFilters((current) => {
      if (name === 'search' && value) return { ...initialFilters, search: value }
      if (name === 'category' && value) return { ...initialFilters, category: value }
      if (name === 'status' && value) return { ...initialFilters, status: value }
      return { ...current, [name]: value }
    })
    if (['search', 'category', 'status'].includes(name)) setPage(0)
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => (
      (!filters.category || product.category === filters.category)
      && (filters.status === 'all' || String(product.active) === (filters.status || 'true'))
    )).sort((first, second) => Number(second.totalStock || 0) - Number(first.totalStock || 0))
  }, [filters.category, filters.status, products])

  const productSummary = summary || initialSummary
  const normalStockProducts = Math.max(0, Number(productSummary.totalActiveProducts) - Number(productSummary.outOfStockProducts) - Number(productSummary.lowStockProducts) - Number(productSummary.highStockProducts))

  const stockSegments = [
    { key: 'empty', label: 'Sin stock', value: productSummary.outOfStockProducts },
    { key: 'low', label: 'Bajo', value: productSummary.lowStockProducts },
    { key: 'normal', label: 'Normal', value: normalStockProducts },
    { key: 'high', label: 'Alto', value: productSummary.highStockProducts },
  ]
  const stockDistributionTotal = stockSegments.reduce((total, segment) => total + Number(segment.value), 0)

  const hasFilters = Object.values(filters).some(Boolean)
  const clearFilters = () => {
    setFilters(initialFilters)
    setPage(0)
  }
  const firstItem = pageInfo.totalElements ? pageInfo.page * pageInfo.size + 1 : 0
  const lastItem = Math.min((pageInfo.page + 1) * pageInfo.size, pageInfo.totalElements)
  const productsWithVariants = useMemo(() => filteredProducts.map((product) => {
    const variants = variantsFor(product)
    return {
      ...product,
      variants,
      totalStock: Number(product.totalStock ?? variants.reduce((total, variant) => total + variant.stock, 0)),
    }
  }), [filteredProducts])

  return (
    <div className="products-page">
      <div className="products-mobile-heading">
        <div><h2>Productos</h2><p>Gestioná tu catálogo de productos</p></div>
        <button type="button" onClick={onNewProduct}><Plus /> Nuevo</button>
      </div>

      <section className={`inventory-overview ${summaryLoading ? 'inventory-overview--loading' : ''} ${summaryError ? 'inventory-overview--error' : ''}`} aria-label="Resumen del inventario">
        <header className="inventory-overview__header">
          <div>
            <span className="inventory-overview__eyebrow">Inventario</span>
            {summaryError ? <strong>Resumen no disponible</strong> : summaryLoading ? <span className="inventory-overview__skeleton inventory-overview__skeleton--title" /> : <strong>{Number(productSummary.totalActiveProducts).toLocaleString('es-AR')} activos · {Number(productSummary.totalInactiveProducts).toLocaleString('es-AR')} inactivos · {Number(productSummary.totalStockUnits).toLocaleString('es-AR')} unidades en inventario</strong>}
          </div>
        </header>

        {summaryError ? (
          <p className="inventory-overview__error-copy">{summaryError}</p>
        ) : summaryLoading ? (
          <div className="inventory-overview__loading-row"><span className="inventory-overview__skeleton" /><span className="inventory-overview__skeleton" /></div>
        ) : (
          <>
            <div className="stock-health">
              <div className="stock-health__labels"><span>Estado general del stock <small>bajo ≤ 3 · alto ≥ 10</small></span><div>{stockSegments.map((segment) => <span className={`stock-legend stock-legend--${segment.key}`} key={segment.key}><i />{segment.label} <strong>{segment.value}</strong></span>)}</div></div>
              <div className="stock-health__bar" aria-label="Distribución del stock">
                {stockDistributionTotal ? stockSegments.filter(({ value }) => value > 0).map((segment) => <span className={`stock-segment stock-segment--${segment.key}`} key={segment.key} style={{ width: `${(segment.value / stockDistributionTotal) * 100}%` }} />) : <span className="stock-segment stock-segment--empty-state" />}
              </div>
            </div>
            <div className="inventory-finance" aria-label="Valores generales del inventario">
              <span><small>Valor a costo</small><strong>{ars.format(productSummary.totalCostValue)}</strong></span><b>→</b><span><small>Venta proyectada</small><strong>{ars.format(productSummary.totalSaleValue)}</strong></span><i /><span className="inventory-finance__profit"><small>Ganancia estimada</small><strong aria-label={ars.format(productSummary.estimatedProfit)}><AnimatedMoney value={productSummary.estimatedProfit} /></strong></span><em>Resumen general</em>
            </div>
          </>
        )}
      </section>

      <section className="catalog-card">
        <div className="catalog-toolbar">
          <label className="catalog-search"><Search /><input name="search" value={filters.search} onChange={updateFilter} placeholder="Buscar por nombre, código, marca, SKU, color o talle..." /></label>
          <div className="catalog-filters">
            <select name="category" value={filters.category} onChange={updateFilter} aria-label="Filtrar productos por categoría"><option value="">Categoría</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select name="status" value={filters.status} onChange={updateFilter} aria-label="Filtrar productos por estado"><option value="">Estado: activos</option><option value="false">Estado: inactivos</option><option value="all">Estado: todos</option></select>
            <button className="clear-filters" type="button" onClick={clearFilters} disabled={!hasFilters}><RotateCcw /> Limpiar filtros</button>
          </div>
        </div>

        {loading ? (
          <div className="catalog-loading"><RefreshCw /><span>Cargando productos...</span></div>
        ) : error ? (
          <div className="empty-products empty-products--error"><PackageSearch /><h3>No pudimos cargar los productos</h3><p>{error}</p><button type="button" onClick={() => loadProducts()}>Reintentar</button></div>
        ) : productsWithVariants.length ? (
          <>
            <div className="products-table-wrap">
              <table className="products-table">
                <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Marca</th><th>Color</th><th>Talles</th><th>Stock total</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>{productsWithVariants.map((product, rowIndex) => {
                  const expanded = expandedProductId === product.id
                  return (
                    <Fragment key={product.id}>
                      <tr
                        className={expanded ? 'product-row product-row--expanded' : 'product-row'}
                        style={{ animationDelay: `${Math.min(rowIndex, 8) * 34}ms` }}
                      >
                        <td className="product-code">{product.code}</td>
                        <td className="product-name"><div className="product-identity"><ProductThumbnail src={product.imageUrl} name={product.name} /><span>{product.name}</span></div></td>
                        <td>{categoryName(product)}</td><td>{product.brand || '—'}</td><td><ProductColors variants={product.variants} /></td>
                        <td>
                          <button className="sizes-trigger" type="button" onClick={() => setExpandedProductId(expanded ? null : product.id)} aria-expanded={expanded} aria-label={`${expanded ? 'Ocultar' : 'Ver'} stock por talle de ${product.name}`}>
                            <SizePills variants={product.variants} /><ChevronDown />
                          </button>
                        </td>
                        <td className={product.totalStock <= 5 ? 'stock-low stock-total' : 'stock-total'}><strong>{product.totalStock}</strong><small> unidades</small></td>
                        <td className="product-price">{ars.format(product.salePrice || 0)}</td><td><span className={`status-badge ${product.active ? 'status-badge--active' : 'status-badge--inactive'}`}>{product.active ? 'Activo' : 'Inactivo'}</span></td><td><ActionButtons product={product} onOpenEditMenu={openEditMenu} onToggleStatus={setStatusConfirmation} updating={statusUpdatingId === product.id} menuOpen={editMenu?.product.id === product.id} /></td>
                      </tr>
                      <tr className={`variant-detail-row ${expanded ? 'variant-detail-row--open' : ''}`} aria-hidden={!expanded}>
                        <td colSpan="10"><div className="variant-detail-collapse"><div><VariantBreakdown variants={product.variants} /></div></div></td>
                      </tr>
                    </Fragment>
                  )
                })}</tbody>
              </table>
            </div>

            <div className="product-cards">{productsWithVariants.map((product) => <article className="product-mobile-card" key={product.id}><div className="product-mobile-card__top"><div className="product-identity"><ProductThumbnail src={product.imageUrl} name={product.name} /><div><span>{product.code}</span><h3>{product.name}</h3></div></div><span className={`status-badge ${product.active ? 'status-badge--active' : 'status-badge--inactive'}`}>{product.active ? 'Activo' : 'Inactivo'}</span></div><div className="product-mobile-card__data"><span><small>Categoría</small>{categoryName(product)}</span><span><small>Talles</small><SizePills variants={product.variants} limit={4} /></span><span><small>Stock total</small>{product.totalStock} unidades</span><span><small>Precio</small>{ars.format(product.salePrice || 0)}</span></div><VariantBreakdown variants={product.variants} /><ActionButtons product={product} onOpenEditMenu={openEditMenu} onToggleStatus={setStatusConfirmation} updating={statusUpdatingId === product.id} menuOpen={editMenu?.product.id === product.id} /></article>)}</div>
          </>
        ) : (
          <div className="empty-products"><PackageSearch /><h3>No encontramos productos</h3><p>Probá cambiando o limpiando los filtros.</p><button type="button" onClick={clearFilters}>Limpiar filtros</button></div>
        )}

        <footer className="catalog-footer">
          <span>Mostrando {firstItem} a {lastItem} de {pageInfo.totalElements} productos</span>
          <div className="pagination" aria-label="Páginas de productos">
            {Array.from({ length: pageInfo.totalPages }, (_, pageIndex) => (
              <button
                type="button"
                className={`pagination-dot ${pageIndex === pageInfo.page ? 'pagination-dot--active' : ''}`}
                key={pageIndex}
                onClick={() => setPage(pageIndex)}
                disabled={loading}
                aria-label={`Ir a la página ${pageIndex + 1}`}
                aria-current={pageIndex === pageInfo.page ? 'page' : undefined}
                title={`Página ${pageIndex + 1}`}
              />
            ))}
          </div>
          <select aria-label="Productos por página" value={pageSize} onChange={({ target }) => { setPageSize(Number(target.value)); setPage(0) }}><option value="10">10 por página</option><option value="25">25 por página</option><option value="50">50 por página</option></select>
        </footer>
      </section>

      {editMenu ? createPortal(<EditQuickMenu menu={editMenu} onClose={() => setEditMenu(null)} onChoose={openEditPreview} />, document.body) : null}

      {editPreview ? createPortal(<EditPreviewPanel preview={editPreview} onClose={closeEditPreview} onOpenFullEditor={openFullEditor} onSaveStock={saveVariantStock} onSavePrices={saveProductPrices} />, document.body) : null}

      {statusConfirmation ? createPortal((
        <div className="status-confirmation-backdrop" role="presentation" onMouseDown={({ target, currentTarget }) => { if (target === currentTarget && statusUpdatingId === null) setStatusConfirmation(null) }}>
          <section className={`status-confirmation ${statusConfirmation.active ? 'status-confirmation--deactivate' : 'status-confirmation--activate'}`} role="dialog" aria-modal="true" aria-labelledby="status-confirmation-title">
            <button className="status-confirmation__close" type="button" onClick={() => setStatusConfirmation(null)} disabled={statusUpdatingId !== null} aria-label="Cerrar confirmación"><X /></button>
            <span className="status-confirmation__icon">{statusConfirmation.active ? <PowerOff /> : <Power />}</span>
            <h2 id="status-confirmation-title">¿{statusConfirmation.active ? 'Desactivar' : 'Activar'} producto?</h2>
            <p>Estás por {statusConfirmation.active ? 'desactivar' : 'activar'} <strong>{statusConfirmation.name}</strong>.</p>
            <small>{statusConfirmation.active ? 'El producto dejará de estar disponible, pero conservará todos sus datos y su stock.' : 'El producto volverá a estar disponible en el sistema.'}</small>
            <div className="status-confirmation__actions">
              <button type="button" className="status-confirmation__cancel" onClick={() => setStatusConfirmation(null)} disabled={statusUpdatingId !== null}>Cancelar</button>
              <button type="button" className="status-confirmation__confirm" onClick={confirmStatusChange} disabled={statusUpdatingId !== null}>{statusUpdatingId !== null ? <><RefreshCw /> Procesando...</> : <>{statusConfirmation.active ? <PowerOff /> : <Power />}{statusConfirmation.active ? 'Sí, desactivar' : 'Sí, activar'}</>}</button>
            </div>
          </section>
        </div>
      ), document.body) : null}

      {statusNotice ? <div className={`catalog-toast catalog-toast--${statusNotice.type}`} role="status"><span>{statusNotice.type === 'success' ? <CheckCircle2 /> : <X />}</span><p>{statusNotice.message}</p><button type="button" onClick={() => setStatusNotice(null)} aria-label="Cerrar aviso"><X /></button></div> : null}
    </div>
  )
}
