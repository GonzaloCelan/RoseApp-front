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
  BODYSUIT: 'Bodies', SWEATER: 'Sweaters / Su√©teres', HOODIE: 'Buzos',
  CARDIGAN: 'Cardigans', JACKET: 'Camperas', COAT: 'Tapados / Abrigos',
  VEST: 'Chalecos', JEANS: 'Jeans', PANTS: 'Pantalones', LEGGINGS: 'Calzas',
  JOGGER: 'Joggers', SHORTS: 'Shorts', SKIRT: 'Polleras', DRESS: 'Vestidos',
  JUMPSUIT: 'Monos / Enteritos', SET: 'Conjuntos', TAILORING: 'Sastrer√≠a',
  SPORTSWEAR: 'Ropa deportiva', ACCESSORY: 'Accesorios', FOOTWEAR: 'Calzado', OTHER: 'Otro',
}

const colorValues = { Rosa: '#f25a9d', Negro: '#252329', Blanco: '#f5f5f5', Beige: '#d8c09f', Gris: '#90909a', Marr√≥n: '#82543b', Rojo: '#dc3e49', Bord√≥: '#7d2338', Naranja: '#ed813d', Amarillo: '#efc942', Verde: '#47a868', Celeste: '#72b9df', Azul: '#3468c0', Violeta: '#8d55bc', Dorado: '#c8a447', Plateado: '#b5b7bd' }

function categoryName(product) {
  return product.categoryName || categoryLabels[product.category] || product.category || '‚Äî'
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
      <button className={menuOpen ? 'edit-action edit-action--open' : 'edit-action'} type="button" aria-label={`Opciones para editar ${product.name}`} aria-haspopup="dialog" aria-expanded={menuOpen} title="Opciones de edici√≥n" onClick={({ currentTarget }) => onOpenEditMenu(product, currentTarget)}><Pencil /></button>
      <button className={`status-action ${product.active ? 'status-action--deactivate' : 'status-action--activate'}`} type="button" aria-label={`${product.active ? 'Desactivar' : 'Activar'} ${product.name}`} title={product.active ? 'Desactivar producto' : 'Activar producto'} onClick={() => onToggleStatus(product)} disabled={updating}>
        {updating ? <RefreshCw className="status-action__spinner" /> : product.active ? <PowerOff /> : <Power />}
      </button>
    </div>
  )
}

const editOptions = [
  { mode: 'stock', label: 'Actualizar stock', description: 'Talles, colores y cantidades', icon: Boxes },
  { mode: 'prices', label: 'Cambiar precios', description: 'Costo, venta y ganancia', icon: CircleDollarSign },
  { mode: 'full', label: 'Editar producto completo', description: 'Toda la informaci√≥n del producto', icon: FilePenLine },
]

function EditQuickMenu({ menu, onClose, onChoose }) {
  return (
    <div className="edit-menu-layer" role="presentation" onMouseDown={({ target, currentTarget }) => { if (target === currentTarget) onClose() }}>
      <section className="edit-quick-menu" style={{ top: menu.top, left: menu.left }} role="dialog" aria-labelledby="edit-quick-menu-title">
        <header className="edit-quick-menu__header">
          <ProductThumbnail src={menu.product.imageUrl} name={menu.product.name} />
          <span><small id="edit-quick-menu-title">¬øQu√© quer√©s editar?</small><strong>{menu.product.name}</strong></span>
          <button type="button" onClick={onClose} aria-label="Cerrar opciones de edici√≥n"><X /></button>
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
  const eyebrow = mode === 'full' ? 'Edici√≥n completa' : 'Edici√≥n r√°pida'
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
        ? [requestError.message, ...requestError.details].filter(Boolean).join(' ¬∑ ')
        : 'No se pudo actualizar el stock. Intent√° nuevamente.')
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
        ? [requestError.message, ...requestError.details].filter(Boolean).join(' ¬∑ ')
        : 'No se pudieron actualizar los precios. Intent√° nuevamente.')
    } finally {
      setPriceSaving(false)
    }
  }

  return (
    <div className={`edit-preview-backdrop ${closing ? 'edit-preview-backdrop--closing' : ''}`} role="presentation" onMouseDown={({ target, currentTarget }) => { if (target === currentTarget && !isSaving) onClose() }}>
      <aside className={`edit-preview-panel edit-preview-panel--${mode}`} role="dialog" aria-modal="true" aria-labelledby="edit-preview-title">
        <header className="edit-preview-panel__header">
          <span className="edit-preview-panel__icon"><Icon /></span>
          <div><small>{eyebrow}</small><h2 id="edit-preview-title">{title}</h2><p>{product.name} ¬∑ {product.code}</p></div>
          <button type="button" onClick={() => onClose()} disabled={isSaving} aria-label="Cerrar vista previa"><X /></button>
        </header>

        <div className={`edit-preview-panel__notice ${mode !== 'full' ? 'edit-preview-panel__notice--connected' : ''}`}>
          <Info />
          <span>
            <strong>{mode !== 'full' ? 'Conectado al cat√°logo' : 'Acceso al editor'}</strong>{' '}
            {mode === 'stock'
              ? 'Al guardar, se reemplazar√° el stock actual de las variantes modificadas.'
              : mode === 'prices'
                ? 'Al guardar, se actualizar√°n los precios y se conservar√°n los dem√°s datos actuales.'
                : 'Abr√≠ el formulario para modificar los datos generales del producto.'}
          </span>
        </div>

        <div className="edit-preview-panel__body">
          {mode === 'stock' ? (
            <>
              <div className="edit-preview-copy"><h3>Stock por variante</h3><p>Modific√° √∫nicamente las cantidades del producto seleccionado.</p></div>
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
              <div className="edit-preview-copy"><h3>Precios del producto</h3><p>Un acceso r√°pido para el cambio m√°s frecuente del cat√°logo.</p></div>
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
              <div className="edit-preview-copy"><h3>Informaci√≥n general</h3><p>La edici√≥n completa mantiene el formulario que ya conoc√©s.</p></div>
              <div className="edit-full-grid">
                <label><span>Nombre del producto</span><input defaultValue={product.name || ''} /></label>
                <label><span>Marca</span><input defaultValue={product.brand || ''} /></label>
                <label><span>Categor√≠a</span><input defaultValue={categoryName(product)} /></label>
                <label><span>Notas</span><textarea defaultValue={product.notes || ''} placeholder="Sin notas" /></label>
              </div>
              <div className="edit-full-summary"><span><Boxes />{variants.length} {variants.length === 1 ? 'variante' : 'variantes'}</span><span><CircleDollarSign />{ars.format(product.salePrice || 0)}</span></div>
            </>
          ) : null}
        </div>

        <footer className="edit-preview-panel__footer">
          <span><Info /> {mode === 'stock' ? 'Se actualizar√°n √∫nicamente las variantes modificadas' : mode === 'prices' ? 'Los dem√°s datos conservar√°n su valor actual' : 'Variantes e imagen se administran por separado'}</span>
          <div>
            <button className="edit-preview-secondary" type="button" onClick={() => onClose()} disabled={isSaving}>{mode === 'full' ? 'Cerrar' : 'Cancelar'}</button>
            {mode === 'full' ? <button className="edit-preview-primary" type="button" onClick={() => onOpenFullEditor(product)}>Abrir editor completo <ArrowRight /></button> : null}
            {mode === 'stock' ? <button className="edit-preview-primary" type="button" onClick={saveStock} disabled={!stockChanges.length || stockHasInvalidValue || stockSaving}>{stockSaving ? <><RefreshCw className="status-action__spinner" /> Guardando...</> : `Guardar stock${stockChanges.length ? ` (${stockChanges.length})` : ''}`}</button> : null}
            {mode === 'prices' ? <button className="edit-preview-primary" type="button" onClick={savePrices} disabled={!pricesChanged || pricesInvalid || priceSaving}>{priceSaving ? <><RefreshCw className="status-action__spinner" /> Guardando...</> : 'Guardar precios'}</button> : null}
 „^<∂âûÀk∫wµÁq—Ãπ±ïπù—°ÙÅŸÖ…•Öπ—ïÃÅÕîÅÖç—’Ö±•ÈÖ…Ω∏ÅçΩ……ïç—Öµïπ—îπÄ∞ÅÏÅëï—Ö•±ÃÅÙ§(ÄÄÄÅÙ((ÄÄÄÅÕï—M—Ö—’Õ9Ω—•çî°Ï(ÄÄÄÄÄÅ—Â¡îËÄùÕ’ççïÕÃú∞(ÄÄÄÄÄÅµïÕÕÖùîËÅÅM—Ωç¨ÅëîÄëÌ¡…Ωë’ç–ππÖµïÙÅÖç—’Ö±•ÈÖëºÅçΩ……ïç—Öµïπ—îÅï∏ÄëÌç°ÖπùïÃπ±ïπù—°ÙÄëÌç°ÖπùïÃπ±ïπù—†ÄÙÙÙÄƒÄ¸ÄùŸÖ…•Öπ—îúÄËÄùŸÖ…•Öπ—ïÃùÙπÄ∞(ÄÄÄÅÙ§(ÄÅÙ((ÄÅçΩπÕ–ÅÕÖŸïA…Ωë’ç—A…•çïÃÄÙÅÖÕÂπåÄ°¡…Ωë’ç–∞ÅÏÅçΩÕ—A…•çî∞ÅÕÖ±ïA…•çîÅÙ§ÄÙ¯ÅÏ(ÄÄÄÅÖ›Ö•–Å¡…Ωë’ç—¡§π’¡ëÖ—î°¡…Ωë’ç–π•ê∞Å—ΩA…Ωë’ç—U¡ëÖ—ïIï≈’ïÕ–°Ï(ÄÄÄÄÄÄ∏∏π¡…Ωë’ç–∞(ÄÄÄÄÄÅçΩÕ—A…•çî∞(ÄÄÄÄÄÅÕÖ±ïA…•çî∞(ÄÄÄÅÙ§§((ÄÄÄÅÖ›Ö•–Å±ΩÖëA…Ωë’ç—Ã†§(ÄÄÄÅÕï—M’µµÖ…ÂIïŸ•Õ•Ω∏†°…ïŸ•Õ•Ω∏§ÄÙ¯Å…ïŸ•Õ•Ω∏Ä¨Äƒ§(ÄÄÄÅÕï—M—Ö—’Õ9Ω—•çî°Ï(ÄÄÄÄÄÅ—Â¡îËÄùÕ’ççïÕÃú∞(ÄÄÄÄÄÅµïÕÕÖùîËÅÅA…ïç•ΩÃÅëîÄëÌ¡…Ωë’ç–ππÖµïÙÅÖç—’Ö±•ÈÖëΩÃÅçΩ……ïç—Öµïπ—îπÄ∞(ÄÄÄÅÙ§(ÄÅÙ((ÄÅçΩπÕ–Å’¡ëÖ—ï•±—ï»ÄÙÄ°ÏÅ—Ö…ùï–ËÅÏÅπÖµî∞ÅŸÖ±’îÅÙÅÙ§ÄÙ¯ÅÏ(ÄÄÄÅÕï—•±—ï…Ã†°ç’……ïπ–§ÄÙ¯ÅÏ(ÄÄÄÄÄÅ•òÄ°πÖµîÄÙÙÙÄùÕïÖ…ç†úÄòòÅŸÖ±’î§Å…ï—’…∏ÅÏÄ∏∏π•π•—•Ö±•±—ï…Ã∞ÅÕïÖ…ç†ËÅŸÖ±’îÅÙ(ÄÄÄÄÄÅ•òÄ°πÖµîÄÙÙÙÄùçÖ—ïùΩ…‰úÄòòÅŸÖ±’î§Å…ï—’…∏ÅÏÄ∏∏π•π•—•Ö±•±—ï…Ã∞ÅçÖ—ïùΩ…‰ËÅŸÖ±’îÅÙ(ÄÄÄÄÄÅ•òÄ°πÖµîÄÙÙÙÄùÕ—Ö—’ÃúÄòòÅŸÖ±’î§Å…ï—’…∏ÅÏÄ∏∏π•π•—•Ö±•±—ï…Ã∞ÅÕ—Ö—’ÃËÅŸÖ±’îÅÙ(ÄÄÄÄÄÅ…ï—’…∏ÅÏÄ∏∏πç’……ïπ–∞ÅmπÖµïtËÅŸÖ±’îÅÙ(ÄÄÄÅÙ§(ÄÄÄÅ•òÄ°lùÕïÖ…ç†ú∞ÄùçÖ—ïùΩ…‰ú∞ÄùÕ—Ö—’Ãùtπ•πç±’ëïÃ°πÖµî§§ÅÕï—AÖùî†¿§(ÄÅÙ((ÄÅçΩπÕ–Åô•±—ï…ïëA…Ωë’ç—ÃÄÙÅ’Õï5ïµº††§ÄÙ¯ÅÏ(ÄÄÄÅ…ï—’…∏Å¡…Ωë’ç—Ãπô•±—ï»†°¡…Ωë’ç–§ÄÙ¯Ä†(ÄÄÄÄÄÄ†Öô•±—ï…ÃπçÖ—ïùΩ…‰ÅÒÅ¡…Ωë’ç–πçÖ—ïùΩ…‰ÄÙÙÙÅô•±—ï…ÃπçÖ—ïùΩ…‰§(ÄÄÄÄÄÄòòÄ°ô•±—ï…ÃπÕ—Ö—’ÃÄÙÙÙÄùÖ±∞úÅÒÅM—…•πú°¡…Ωë’ç–πÖç—•Ÿî§ÄÙÙÙÄ°ô•±—ï…ÃπÕ—Ö—’ÃÅÒÄù—…’îú§§(ÄÄÄÄ§§πÕΩ…–†°ô•…Õ–∞ÅÕïçΩπê§ÄÙ¯Å9’µâï»°ÕïçΩπêπ—Ω—Ö±M—Ωç¨ÅÒÄ¿§Ä¥Å9’µâï»°ô•…Õ–π—Ω—Ö±M—Ωç¨ÅÒÄ¿§§(ÄÅÙ∞Åmô•±—ï…ÃπçÖ—ïùΩ…‰∞Åô•±—ï…ÃπÕ—Ö—’Ã∞Å¡…Ωë’ç—Õt§((ÄÅçΩπÕ–Å¡…Ωë’ç—M’µµÖ…‰ÄÙÅÕ’µµÖ…‰ÅÒÅ•π•—•Ö±M’µµÖ…‰(ÄÅçΩπÕ–ÅπΩ…µÖ±M—Ωç≠A…Ωë’ç—ÃÄÙÅ5Ö—†πµÖ‡†¿∞Å9’µâï»°¡…Ωë’ç—M’µµÖ…‰π—Ω—Ö±ç—•ŸïA…Ωë’ç—Ã§Ä¥Å9’µâï»°¡…Ωë’ç—M’µµÖ…‰πΩ’—=ôM—Ωç≠A…Ωë’ç—Ã§Ä¥Å9’µâï»°¡…Ωë’ç—M’µµÖ…‰π±Ω›M—Ωç≠A…Ωë’ç—Ã§Ä¥Å9’µâï»°¡…Ωë’ç—M’µµÖ…‰π°•ù°M—Ωç≠A…Ωë’ç—Ã§§((ÄÅçΩπÕ–ÅÕ—Ωç≠Mïùµïπ—ÃÄÙÅl(ÄÄÄÅÏÅ≠ï‰ËÄùïµ¡—‰ú∞Å±Öâï∞ËÄùM•∏ÅÕ—Ωç¨ú∞ÅŸÖ±’îËÅ¡…Ωë’ç—M’µµÖ…‰πΩ’—=ôM—Ωç≠A…Ωë’ç—ÃÅÙ∞(ÄÄÄÅÏÅ≠ï‰ËÄù±Ω‹ú∞Å±Öâï∞ËÄù	Ö©ºú∞ÅŸÖ±’îËÅ¡…Ωë’ç—M’µµÖ…‰π±Ω›M—Ωç≠A…Ωë’ç—ÃÅÙ∞(ÄÄÄÅÏÅ≠ï‰ËÄùπΩ…µÖ∞ú∞Å±Öâï∞ËÄù9Ω…µÖ∞ú∞ÅŸÖ±’îËÅπΩ…µÖ±M—Ωç≠A…Ωë’ç—ÃÅÙ∞(ÄÄÄÅÏÅ≠ï‰ËÄù°•ù†ú∞Å±Öâï∞ËÄù±—ºú∞ÅŸÖ±’îËÅ¡…Ωë’ç—M’µµÖ…‰π°•ù°M—Ωç≠A…Ωë’ç—ÃÅÙ∞(ÄÅt(ÄÅçΩπÕ–ÅÕ—Ωç≠•Õ—…•â’—•ΩπQΩ—Ö∞ÄÙÅÕ—Ωç≠Mïùµïπ—Ãπ…ïë’çî†°—Ω—Ö∞∞ÅÕïùµïπ–§ÄÙ¯Å—Ω—Ö∞Ä¨Å9’µâï»°Õïùµïπ–πŸÖ±’î§∞Ä¿§((ÄÅçΩπÕ–Å°ÖÕ•±—ï…ÃÄÙÅ=â©ïç–πŸÖ±’ïÃ°ô•±—ï…Ã§πÕΩµî°	ΩΩ±ïÖ∏§(ÄÅçΩπÕ–Åç±ïÖ…•±—ï…ÃÄÙÄ†§ÄÙ¯ÅÏ(ÄÄÄÅÕï—•±—ï…Ã°•π•—•Ö±•±—ï…Ã§(ÄÄÄÅÕï—AÖùî†¿§(ÄÅÙ(ÄÅçΩπÕ–Åô•…Õ—%—ï¥ÄÙÅ¡Öùï%πôºπ—Ω—Ö±±ïµïπ—ÃÄ¸Å¡Öùï%πôºπ¡ÖùîÄ®Å¡Öùï%πôºπÕ•ÈîÄ¨ÄƒÄËÄ¿(ÄÅçΩπÕ–Å±ÖÕ—%—ï¥ÄÙÅ5Ö—†πµ•∏†°¡Öùï%πôºπ¡ÖùîÄ¨Äƒ§Ä®Å¡Öùï%πôºπÕ•Èî∞Å¡Öùï%πôºπ—Ω—Ö±±ïµïπ—Ã§(ÄÅçΩπÕ–Å¡…Ωë’ç—Õ]•—°YÖ…•Öπ—ÃÄÙÅ’Õï5ïµº††§ÄÙ¯Åô•±—ï…ïëA…Ωë’ç—ÃπµÖ¿†°¡…Ωë’ç–§ÄÙ¯ÅÏ(ÄÄÄÅçΩπÕ–ÅŸÖ…•Öπ—ÃÄÙÅŸÖ…•Öπ—ÕΩ»°¡…Ωë’ç–§(ÄÄÄÅ…ï—’…∏ÅÏ(ÄÄÄÄÄÄ∏∏π¡…Ωë’ç–∞(ÄÄÄÄÄÅŸÖ…•Öπ—Ã∞(ÄÄÄÄÄÅ—Ω—Ö±M—Ωç¨ËÅ9’µâï»°¡…Ωë’ç–π—Ω—Ö±M—Ωç¨Ä¸¸ÅŸÖ…•Öπ—Ãπ…ïë’çî†°—Ω—Ö∞∞ÅŸÖ…•Öπ–§ÄÙ¯Å—Ω—Ö∞Ä¨ÅŸÖ…•Öπ–πÕ—Ωç¨∞Ä¿§§∞(ÄÄÄÅÙ(ÄÅÙ§∞Åmô•±—ï…ïëA…Ωë’ç—Õt§((ÄÅ…ï—’…∏Ä†(ÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç—Ãµ¡Öùîà¯(ÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç—ÃµµΩâ•±îµ°ïÖë•πúà¯(ÄÄÄÄÄÄÄÄÒë•ÿ¯Ò†»˘A…Ωë’ç—ΩÃΩ†»¯Ò¿˘ïÕ—•ΩªÑÅ—‘ÅçÖ”Ö±ΩùºÅëîÅ¡…Ωë’ç—ΩÃΩ¿¯Ωë•ÿ¯(ÄÄÄÄÄÄÄÄÒâ’——Ω∏Å—Â¡îÙââ’——Ω∏àÅΩπ±•ç¨ıÌΩπ9ï›A…Ωë’ç—Ù¯ÒA±’ÃÄº¯Å9’ïŸºΩâ’——Ω∏¯(ÄÄÄÄÄÄΩë•ÿ¯((ÄÄÄÄÄÄÒÕïç—•Ω∏Åç±ÖÕÕ9ÖµîıÌÅ•πŸïπ—Ω…‰µΩŸï…Ÿ•ï‹ÄëÌÕ’µµÖ…Â1ΩÖë•πúÄ¸Äù•πŸïπ—Ω…‰µΩŸï…Ÿ•ï‹¥µ±ΩÖë•πúúÄËÄúùÙÄëÌÕ’µµÖ…Â……Ω»Ä¸Äù•πŸïπ—Ω…‰µΩŸï…Ÿ•ï‹¥µï……Ω»úÄËÄúùıÅÙÅÖ…•Ñµ±Öâï∞ÙâIïÕ’µï∏Åëï∞Å•πŸïπ—Ö…•ºà¯(ÄÄÄÄÄÄÄÄÒ°ïÖëï»Åç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µΩŸï…Ÿ•ï›}}°ïÖëï»à¯(ÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µΩŸï…Ÿ•ï›}}ïÂïâ…Ω‹à˘%πŸïπ—Ö…•ºΩÕ¡Ö∏¯(ÄÄÄÄÄÄÄÄÄÄÄÅÌÕ’µµÖ…Â……Ω»Ä¸ÄÒÕ—…Ωπú˘IïÕ’µï∏ÅπºÅë•Õ¡Ωπ•â±îΩÕ—…Ωπú¯ÄËÅÕ’µµÖ…Â1ΩÖë•πúÄ¸ÄÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µΩŸï…Ÿ•ï›}}Õ≠ï±ï—Ω∏Å•πŸïπ—Ω…‰µΩŸï…Ÿ•ï›}}Õ≠ï±ï—Ω∏¥µ—•—±îàÄº¯ÄËÄÒÕ—…Ωπú˘Ì9’µâï»°¡…Ωë’ç—M’µµÖ…‰π—Ω—Ö±ç—•ŸïA…Ωë’ç—Ã§π—Ω1ΩçÖ±ïM—…•πú†ùïÃµHú•ÙÅÖç—•ŸΩÃÉ
‹ÅÌ9’µâï»°¡…Ωë’ç—M’µµÖ…‰π—Ω—Ö±%πÖç—•ŸïA…Ωë’ç—Ã§π—Ω1ΩçÖ±ïM—…•πú†ùïÃµHú•ÙÅ•πÖç—•ŸΩÃÉ
‹ÅÌ9’µâï»°¡…Ωë’ç—M’µµÖ…‰π—Ω—Ö±M—Ωç≠Uπ•—Ã§π—Ω1ΩçÖ±ïM—…•πú†ùïÃµHú•ÙÅ’π•ëÖëïÃÅï∏Å•πŸïπ—Ö…•ºΩÕ—…Ωπú˘Ù(ÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄΩ°ïÖëï»¯((ÄÄÄÄÄÄÄÅÌÕ’µµÖ…Â……Ω»Ä¸Ä†(ÄÄÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µΩŸï…Ÿ•ï›}}ï……Ω»µçΩ¡‰à˘ÌÕ’µµÖ…Â……Ω…ÙΩ¿¯(ÄÄÄÄÄÄÄÄ§ÄËÅÕ’µµÖ…Â1ΩÖë•πúÄ¸Ä†(ÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µΩŸï…Ÿ•ï›}}±ΩÖë•πúµ…Ω‹à¯ÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µΩŸï…Ÿ•ï›}}Õ≠ï±ï—Ω∏àÄº¯ÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µΩŸï…Ÿ•ï›}}Õ≠ï±ï—Ω∏àÄº¯Ωë•ÿ¯(ÄÄÄÄÄÄÄÄ§ÄËÄ†(ÄÄÄÄÄÄÄÄÄÄ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÕ—Ωç¨µ°ïÖ±—†à¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÕ—Ωç¨µ°ïÖ±—°}}±Öâï±Ãà¯ÒÕ¡Ö∏˘Õ—ÖëºÅùïπï…Ö∞Åëï∞ÅÕ—Ωç¨ÄÒÕµÖ±∞˘âÖ©ºÉä&êÄÃÉ
‹ÅÖ±—ºÉä&îÄƒ¿ΩÕµÖ±∞¯ΩÕ¡Ö∏¯Òë•ÿ˘ÌÕ—Ωç≠Mïùµïπ—ÃπµÖ¿†°Õïùµïπ–§ÄÙ¯ÄÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîıÌÅÕ—Ωç¨µ±ïùïπêÅÕ—Ωç¨µ±ïùïπê¥¥ëÌÕïùµïπ–π≠ïÂıÅÙÅ≠ï‰ıÌÕïùµïπ–π≠ïÂÙ¯Ò§Äº˘ÌÕïùµïπ–π±Öâï±ÙÄÒÕ—…Ωπú˘ÌÕïùµïπ–πŸÖ±’ïÙΩÕ—…Ωπú¯ΩÕ¡Ö∏¯•ÙΩë•ÿ¯Ωë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÕ—Ωç¨µ°ïÖ±—°}}âÖ»àÅÖ…•Ñµ±Öâï∞Ùâ•Õ—…•â’çßÕ∏Åëï∞ÅÕ—Ωç¨à¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌÕ—Ωç≠•Õ—…•â’—•ΩπQΩ—Ö∞Ä¸ÅÕ—Ωç≠Mïùµïπ—Ãπô•±—ï»†°ÏÅŸÖ±’îÅÙ§ÄÙ¯ÅŸÖ±’îÄ¯Ä¿§πµÖ¿†°Õïùµïπ–§ÄÙ¯ÄÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîıÌÅÕ—Ωç¨µÕïùµïπ–ÅÕ—Ωç¨µÕïùµïπ–¥¥ëÌÕïùµïπ–π≠ïÂıÅÙÅ≠ï‰ıÌÕïùµïπ–π≠ïÂÙÅÕ—Â±îıÌÏÅ›•ë—†ËÅÄëÏ°Õïùµïπ–πŸÖ±’îÄºÅÕ—Ωç≠•Õ—…•â’—•ΩπQΩ—Ö∞§Ä®Äƒ¿¡ÙïÄÅıÙÄº¯§ÄËÄÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîÙâÕ—Ωç¨µÕïùµïπ–ÅÕ—Ωç¨µÕïùµïπ–¥µïµ¡—‰µÕ—Ö—îàÄº˘Ù(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µô•πÖπçîàÅÖ…•Ñµ±Öâï∞ÙâYÖ±Ω…ïÃÅùïπï…Ö±ïÃÅëï∞Å•πŸïπ—Ö…•ºà¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒÕ¡Ö∏¯ÒÕµÖ±∞˘YÖ±Ω»ÅÑÅçΩÕ—ºΩÕµÖ±∞¯ÒÕ—…Ωπú˘ÌÖ…ÃπôΩ…µÖ–°¡…Ωë’ç—M’µµÖ…‰π—Ω—Ö±ΩÕ—YÖ±’î•ÙΩÕ—…Ωπú¯ΩÕ¡Ö∏¯Òà˚äHΩà¯ÒÕ¡Ö∏¯ÒÕµÖ±∞˘Yïπ—ÑÅ¡…ΩÂïç—ÖëÑΩÕµÖ±∞¯ÒÕ—…Ωπú˘ÌÖ…ÃπôΩ…µÖ–°¡…Ωë’ç—M’µµÖ…‰π—Ω—Ö±MÖ±ïYÖ±’î•ÙΩÕ—…Ωπú¯ΩÕ¡Ö∏¯Ò§Äº¯ÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîÙâ•πŸïπ—Ω…‰µô•πÖπçï}}¡…Ωô•–à¯ÒÕµÖ±∞˘ÖπÖπç•ÑÅïÕ—•µÖëÑΩÕµÖ±∞¯ÒÕ—…ΩπúÅÖ…•Ñµ±Öâï∞ıÌÖ…ÃπôΩ…µÖ–°¡…Ωë’ç—M’µµÖ…‰πïÕ—•µÖ—ïëA…Ωô•–•Ù¯Òπ•µÖ—ïë5Ωπï‰ÅŸÖ±’îıÌ¡…Ωë’ç—M’µµÖ…‰πïÕ—•µÖ—ïëA…Ωô•—ÙÄº¯ΩÕ—…Ωπú¯ΩÕ¡Ö∏¯Òï¥˘IïÕ’µï∏Åùïπï…Ö∞Ωï¥¯(ÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄº¯(ÄÄÄÄÄÄÄÄ•Ù(ÄÄÄÄÄÄΩÕïç—•Ω∏¯((ÄÄÄÄÄÄÒÕïç—•Ω∏Åç±ÖÕÕ9ÖµîÙâçÖ—Ö±ΩúµçÖ…êà¯(ÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâçÖ—Ö±Ωúµ—ΩΩ±âÖ»à¯(ÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙâçÖ—Ö±ΩúµÕïÖ…ç†à¯ÒMïÖ…ç†Äº¯Ò•π¡’–ÅπÖµîÙâÕïÖ…ç†àÅŸÖ±’îıÌô•±—ï…ÃπÕïÖ…ç°ÙÅΩπ°ÖπùîıÌ’¡ëÖ—ï•±—ï…ÙÅ¡±Öçï°Ω±ëï»Ùâ	’ÕçÖ»Å¡Ω»ÅπΩµâ…î∞ÅèÕë•ùº∞ÅµÖ…çÑ∞ÅM-T∞ÅçΩ±Ω»ÅºÅ—Ö±±î∏∏∏àÄº¯Ω±Öâï∞¯(ÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâçÖ—Ö±Ωúµô•±—ï…Ãà¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒÕï±ïç–ÅπÖµîÙâçÖ—ïùΩ…‰àÅŸÖ±’îıÌô•±—ï…ÃπçÖ—ïùΩ…ÂÙÅΩπ°ÖπùîıÌ’¡ëÖ—ï•±—ï…ÙÅÖ…•Ñµ±Öâï∞Ùâ•±—…Ö»Å¡…Ωë’ç—ΩÃÅ¡Ω»ÅçÖ—ïùΩÀµÑà¯ÒΩ¡—•Ω∏ÅŸÖ±’îÙàà˘Ö—ïùΩÀµÑΩΩ¡—•Ω∏˘Ì=â©ïç–πïπ—…•ïÃ°çÖ—ïùΩ…Â1Öâï±Ã§πµÖ¿†°mŸÖ±’î∞Å±Öâï±t§ÄÙ¯ÄÒΩ¡—•Ω∏Å≠ï‰ıÌŸÖ±’ïÙÅŸÖ±’îıÌŸÖ±’ïÙ˘Ì±Öâï±ÙΩΩ¡—•Ω∏¯•ÙΩÕï±ïç–¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒÕï±ïç–ÅπÖµîÙâÕ—Ö—’ÃàÅŸÖ±’îıÌô•±—ï…ÃπÕ—Ö—’ÕÙÅΩπ°ÖπùîıÌ’¡ëÖ—ï•±—ï…ÙÅÖ…•Ñµ±Öâï∞Ùâ•±—…Ö»Å¡…Ωë’ç—ΩÃÅ¡Ω»ÅïÕ—Öëºà¯ÒΩ¡—•Ω∏ÅŸÖ±’îÙàà˘Õ—ÖëºËÅÖç—•ŸΩÃΩΩ¡—•Ω∏¯ÒΩ¡—•Ω∏ÅŸÖ±’îÙâôÖ±Õîà˘Õ—ÖëºËÅ•πÖç—•ŸΩÃΩΩ¡—•Ω∏¯ÒΩ¡—•Ω∏ÅŸÖ±’îÙâÖ±∞à˘Õ—ÖëºËÅ—ΩëΩÃΩΩ¡—•Ω∏¯ΩÕï±ïç–¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏Åç±ÖÕÕ9ÖµîÙâç±ïÖ»µô•±—ï…ÃàÅ—Â¡îÙââ’——Ω∏àÅΩπ±•ç¨ıÌç±ïÖ…•±—ï…ÕÙÅë•ÕÖâ±ïêıÏÖ°ÖÕ•±—ï…ÕÙ¯ÒIΩ—Ö—ïç‹Äº¯Å1•µ¡•Ö»Åô•±—…ΩÃΩâ’——Ω∏¯(ÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄΩë•ÿ¯((ÄÄÄÄÄÄÄÅÌ±ΩÖë•πúÄ¸Ä†(ÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâçÖ—Ö±Ωúµ±ΩÖë•πúà¯ÒIïô…ïÕ°‹Äº¯ÒÕ¡Ö∏˘Ö…ùÖπëºÅ¡…Ωë’ç—ΩÃ∏∏∏ΩÕ¡Ö∏¯Ωë•ÿ¯(ÄÄÄÄÄÄÄÄ§ÄËÅï……Ω»Ä¸Ä†(ÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâïµ¡—‰µ¡…Ωë’ç—ÃÅïµ¡—‰µ¡…Ωë’ç—Ã¥µï……Ω»à¯ÒAÖç≠ÖùïMïÖ…ç†Äº¯Ò†Ã˘9ºÅ¡’ë•µΩÃÅçÖ…ùÖ»Å±ΩÃÅ¡…Ωë’ç—ΩÃΩ†Ã¯Ò¿˘Ìï……Ω…ÙΩ¿¯Òâ’——Ω∏Å—Â¡îÙââ’——Ω∏àÅΩπ±•ç¨ıÏ†§ÄÙ¯Å±ΩÖëA…Ωë’ç—Ã†•Ù˘Iï•π—ïπ—Ö»Ωâ’——Ω∏¯Ωë•ÿ¯(ÄÄÄÄÄÄÄÄ§ÄËÅ¡…Ωë’ç—Õ]•—°YÖ…•Öπ—Ãπ±ïπù—†Ä¸Ä†(ÄÄÄÄÄÄÄÄÄÄ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç—Ãµ—Öâ±îµ›…Ö¿à¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—Öâ±îÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç—Ãµ—Öâ±îà¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—°ïÖê¯Ò—»¯Ò—†˘Õë•ùºΩ—†¯Ò—†˘A…Ωë’ç—ºΩ—†¯Ò—†˘Ö—ïùΩÀµÑΩ—†¯Ò—†˘5Ö…çÑΩ—†¯Ò—†˘Ω±Ω»Ω—†¯Ò—†˘QÖ±±ïÃΩ—†¯Ò—†˘M—Ωç¨Å—Ω—Ö∞Ω—†¯Ò—†˘A…ïç•ºΩ—†¯Ò—†˘Õ—ÖëºΩ—†¯Ò—†˘çç•ΩπïÃΩ—†¯Ω—»¯Ω—°ïÖê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—âΩë‰˘Ì¡…Ωë’ç—Õ]•—°YÖ…•Öπ—ÃπµÖ¿†°¡…Ωë’ç–∞Å…Ω›%πëï‡§ÄÙ¯ÅÏ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅçΩπÕ–Åï·¡ÖπëïêÄÙÅï·¡ÖπëïëA…Ωë’ç—%êÄÙÙÙÅ¡…Ωë’ç–π•ê(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ…ï—’…∏Ä†(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ…Öùµïπ–Å≠ï‰ıÌ¡…Ωë’ç–π•ëÙ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—»(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîıÌï·¡ÖπëïêÄ¸Äù¡…Ωë’ç–µ…Ω‹Å¡…Ωë’ç–µ…Ω‹¥µï·¡ÖπëïêúÄËÄù¡…Ωë’ç–µ…Ω‹ùÙ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÕ—Â±îıÌÏÅÖπ•µÖ—•Ωπï±Ö‰ËÅÄëÌ5Ö—†πµ•∏°…Ω›%πëï‡∞Ä‡§Ä®ÄÃ—ıµÕÄÅıÙ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—êÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µçΩëîà˘Ì¡…Ωë’ç–πçΩëïÙΩ—ê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—êÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µπÖµîà¯Òë•ÿÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µ•ëïπ—•—‰à¯ÒA…Ωë’ç—Q°’µâπÖ•∞ÅÕ…åıÌ¡…Ωë’ç–π•µÖùïU…±ÙÅπÖµîıÌ¡…Ωë’ç–ππÖµïÙÄº¯ÒÕ¡Ö∏˘Ì¡…Ωë’ç–ππÖµïÙΩÕ¡Ö∏¯Ωë•ÿ¯Ω—ê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—ê˘ÌçÖ—ïùΩ…Â9Öµî°¡…Ωë’ç–•ÙΩ—ê¯Ò—ê˘Ì¡…Ωë’ç–πâ…ÖπêÅÒÄüäPùÙΩ—ê¯Ò—ê¯ÒA…Ωë’ç—Ω±Ω…ÃÅŸÖ…•Öπ—ÃıÌ¡…Ωë’ç–πŸÖ…•Öπ—ÕÙÄº¯Ω—ê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—ê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏Åç±ÖÕÕ9ÖµîÙâÕ•ÈïÃµ—…•ùùï»àÅ—Â¡îÙââ’——Ω∏àÅΩπ±•ç¨ıÏ†§ÄÙ¯ÅÕï—·¡ÖπëïëA…Ωë’ç—%ê°ï·¡ÖπëïêÄ¸Åπ’±∞ÄËÅ¡…Ωë’ç–π•ê•ÙÅÖ…•Ñµï·¡ÖπëïêıÌï·¡ÖπëïëÙÅÖ…•Ñµ±Öâï∞ıÌÄëÌï·¡ÖπëïêÄ¸Äù=ç’±—Ö»úÄËÄùYï»ùÙÅÕ—Ωç¨Å¡Ω»Å—Ö±±îÅëîÄëÌ¡…Ωë’ç–ππÖµïıÅÙ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒM•ÈïA•±±ÃÅŸÖ…•Öπ—ÃıÌ¡…Ωë’ç–πŸÖ…•Öπ—ÕÙÄº¯Ò°ïŸ…ΩπΩ›∏Äº¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩâ’——Ω∏¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ—ê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—êÅç±ÖÕÕ9ÖµîıÌ¡…Ωë’ç–π—Ω—Ö±M—Ωç¨ÄÙÄ‘Ä¸ÄùÕ—Ωç¨µ±Ω‹ÅÕ—Ωç¨µ—Ω—Ö∞úÄËÄùÕ—Ωç¨µ—Ω—Ö∞ùÙ¯ÒÕ—…Ωπú˘Ì¡…Ωë’ç–π—Ω—Ö±M—Ωç≠ÙΩÕ—…Ωπú¯ÒÕµÖ±∞¯Å’π•ëÖëïÃΩÕµÖ±∞¯Ω—ê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—êÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µ¡…•çîà˘ÌÖ…ÃπôΩ…µÖ–°¡…Ωë’ç–πÕÖ±ïA…•çîÅÒÄ¿•ÙΩ—ê¯Ò—ê¯ÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîıÌÅÕ—Ö—’ÃµâÖëùîÄëÌ¡…Ωë’ç–πÖç—•ŸîÄ¸ÄùÕ—Ö—’ÃµâÖëùî¥µÖç—•ŸîúÄËÄùÕ—Ö—’ÃµâÖëùî¥µ•πÖç—•ŸîùıÅÙ˘Ì¡…Ωë’ç–πÖç—•ŸîÄ¸Äùç—•ŸºúÄËÄù%πÖç—•ŸºùÙΩÕ¡Ö∏¯Ω—ê¯Ò—ê¯Òç—•Ωπ	’——ΩπÃÅ¡…Ωë’ç–ıÌ¡…Ωë’ç—ÙÅΩπ=¡ïπë•—5ïπ‘ıÌΩ¡ïπë•—5ïπ’ÙÅΩπQΩùù±ïM—Ö—’ÃıÌÕï—M—Ö—’ÕΩπô•…µÖ—•ΩπÙÅ’¡ëÖ—•πúıÌÕ—Ö—’ÕU¡ëÖ—•πù%êÄÙÙÙÅ¡…Ωë’ç–π•ëÙÅµïπ’=¡ï∏ıÌïë•—5ïπ‘¸π¡…Ωë’ç–π•êÄÙÙÙÅ¡…Ωë’ç–π•ëÙÄº¯Ω—ê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ—»¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—»Åç±ÖÕÕ9ÖµîıÌÅŸÖ…•Öπ–µëï—Ö•∞µ…Ω‹ÄëÌï·¡ÖπëïêÄ¸ÄùŸÖ…•Öπ–µëï—Ö•∞µ…Ω‹¥µΩ¡ï∏úÄËÄúùıÅÙÅÖ…•Ñµ°•ëëï∏ıÏÖï·¡ÖπëïëÙ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ—êÅçΩ±M¡Ö∏Ùàƒ¿à¯Òë•ÿÅç±ÖÕÕ9ÖµîÙâŸÖ…•Öπ–µëï—Ö•∞µçΩ±±Ö¡Õîà¯Òë•ÿ¯ÒYÖ…•Öπ—	…ïÖ≠ëΩ›∏ÅŸÖ…•Öπ—ÃıÌ¡…Ωë’ç–πŸÖ…•Öπ—ÕÙÄº¯Ωë•ÿ¯Ωë•ÿ¯Ω—ê¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ—»¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ…Öùµïπ–¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ§(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÙ•ÙΩ—âΩë‰¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ—Öâ±î¯(ÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯((ÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µçÖ…ëÃà˘Ì¡…Ωë’ç—Õ]•—°YÖ…•Öπ—ÃπµÖ¿†°¡…Ωë’ç–§ÄÙ¯ÄÒÖ…—•ç±îÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µµΩâ•±îµçÖ…êàÅ≠ï‰ıÌ¡…Ωë’ç–π•ëÙ¯Òë•ÿÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µµΩâ•±îµçÖ…ë}}—Ω¿à¯Òë•ÿÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µ•ëïπ—•—‰à¯ÒA…Ωë’ç—Q°’µâπÖ•∞ÅÕ…åıÌ¡…Ωë’ç–π•µÖùïU…±ÙÅπÖµîıÌ¡…Ωë’ç–ππÖµïÙÄº¯Òë•ÿ¯ÒÕ¡Ö∏˘Ì¡…Ωë’ç–πçΩëïÙΩÕ¡Ö∏¯Ò†Ã˘Ì¡…Ωë’ç–ππÖµïÙΩ†Ã¯Ωë•ÿ¯Ωë•ÿ¯ÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîıÌÅÕ—Ö—’ÃµâÖëùîÄëÌ¡…Ωë’ç–πÖç—•ŸîÄ¸ÄùÕ—Ö—’ÃµâÖëùî¥µÖç—•ŸîúÄËÄùÕ—Ö—’ÃµâÖëùî¥µ•πÖç—•ŸîùıÅÙ˘Ì¡…Ωë’ç–πÖç—•ŸîÄ¸Äùç—•ŸºúÄËÄù%πÖç—•ŸºùÙΩÕ¡Ö∏¯Ωë•ÿ¯Òë•ÿÅç±ÖÕÕ9ÖµîÙâ¡…Ωë’ç–µµΩâ•±îµçÖ…ë}}ëÖ—Ñà¯ÒÕ¡Ö∏¯ÒÕµÖ±∞˘Ö—ïùΩÀµÑΩÕµÖ±∞˘ÌçÖ—ïùΩ…Â9Öµî°¡…Ωë’ç–•ÙΩÕ¡Ö∏¯ÒÕ¡Ö∏¯ÒÕµÖ±∞˘QÖ±±ïÃΩÕµÖ±∞¯ÒM•ÈïA•±±ÃÅŸÖ…•Öπ—ÃıÌ¡…Ωë’ç–πŸÖ…•Öπ—ÕÙÅ±•µ•–ıÏ—ÙÄº¯ΩÕ¡Ö∏¯ÒÕ¡Ö∏¯ÒÕµÖ±∞˘M—Ωç¨Å—Ω—Ö∞ΩÕµÖ±∞˘Ì¡…Ωë’ç–π—Ω—Ö±M—Ωç≠ÙÅ’π•ëÖëïÃΩÕ¡Ö∏¯ÒÕ¡Ö∏¯ÒÕµÖ±∞˘A…ïç•ºΩÕµÖ±∞˘ÌÖ…ÃπôΩ…µÖ–°¡…Ωë’ç–πÕÖ±ïA…•çîÅÒÄ¿•ÙΩÕ¡Ö∏¯Ωë•ÿ¯ÒYÖ…•Öπ—	…ïÖ≠ëΩ›∏ÅŸÖ…•Öπ—ÃıÌ¡…Ωë’ç–πŸÖ…•Öπ—ÕÙÄº¯Òç—•Ωπ	’——ΩπÃÅ¡…Ωë’ç–ıÌ¡…Ωë’ç—ÙÅΩπ=¡ïπë•—5ïπ‘ıÌΩ¡ïπë•—5ïπ’ÙÅΩπQΩùù±ïM—Ö—’ÃıÌÕï—M—Ö—’ÕΩπô•…µÖ—•ΩπÙÅ’¡ëÖ—•πúıÌÕ—Ö—’ÕU¡ëÖ—•πù%êÄÙÙÙÅ¡…Ωë’ç–π•ëÙÅµïπ’=¡ï∏ıÌïë•—5ïπ‘¸π¡…Ωë’ç–π•êÄÙÙÙÅ¡…Ωë’ç–π•ëÙÄº¯ΩÖ…—•ç±î¯•ÙΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄº¯(ÄÄÄÄÄÄÄÄ§ÄËÄ†(ÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâïµ¡—‰µ¡…Ωë’ç—Ãà¯ÒAÖç≠ÖùïMïÖ…ç†Äº¯Ò†Ã˘9ºÅïπçΩπ—…ÖµΩÃÅ¡…Ωë’ç—ΩÃΩ†Ã¯Ò¿˘A…ΩãÑÅçÖµâ•ÖπëºÅºÅ±•µ¡•ÖπëºÅ±ΩÃÅô•±—…ΩÃ∏Ω¿¯Òâ’——Ω∏Å—Â¡îÙââ’——Ω∏àÅΩπ±•ç¨ıÌç±ïÖ…•±—ï…ÕÙ˘1•µ¡•Ö»Åô•±—…ΩÃΩâ’——Ω∏¯Ωë•ÿ¯(ÄÄÄÄÄÄÄÄ•Ù((ÄÄÄÄÄÄÄÄÒôΩΩ—ï»Åç±ÖÕÕ9ÖµîÙâçÖ—Ö±ΩúµôΩΩ—ï»à¯(ÄÄÄÄÄÄÄÄÄÄÒÕ¡Ö∏˘5ΩÕ—…ÖπëºÅÌô•…Õ—%—ïµÙÅÑÅÌ±ÖÕ—%—ïµÙÅëîÅÌ¡Öùï%πôºπ—Ω—Ö±±ïµïπ—ÕÙÅ¡…Ωë’ç—ΩÃΩÕ¡Ö∏¯(ÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ¡Öù•πÖ—•Ω∏àÅÖ…•Ñµ±Öâï∞ÙâCÖù•πÖÃÅëîÅ¡…Ωë’ç—ΩÃà¯(ÄÄÄÄÄÄÄÄÄÄÄÅÌ……Ö‰πô…Ω¥°ÏÅ±ïπù—†ËÅ¡Öùï%πôºπ—Ω—Ö±AÖùïÃÅÙ∞Ä°|∞Å¡Öùï%πëï‡§ÄÙ¯Ä†(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙââ’——Ω∏à(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîıÌÅ¡Öù•πÖ—•Ω∏µëΩ–ÄëÌ¡Öùï%πëï‡ÄÙÙÙÅ¡Öùï%πôºπ¡ÖùîÄ¸Äù¡Öù•πÖ—•Ω∏µëΩ–¥µÖç—•ŸîúÄËÄúùıÅÙ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ≠ï‰ıÌ¡Öùï%πëï·Ù(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅΩπ±•ç¨ıÏ†§ÄÙ¯ÅÕï—AÖùî°¡Öùï%πëï‡•Ù(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅë•ÕÖâ±ïêıÌ±ΩÖë•πùÙ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÖ…•Ñµ±Öâï∞ıÌÅ%»ÅÑÅ±ÑÅ√Öù•πÑÄëÌ¡Öùï%πëï‡Ä¨Ä≈ıÅÙ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÖ…•Ñµç’……ïπ–ıÌ¡Öùï%πëï‡ÄÙÙÙÅ¡Öùï%πôºπ¡ÖùîÄ¸Äù¡ÖùîúÄËÅ’πëïô•πïëÙ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—•—±îıÌÅCÖù•πÑÄëÌ¡Öùï%πëï‡Ä¨Ä≈ıÅÙ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯(ÄÄÄÄÄÄÄÄÄÄÄÄ§•Ù(ÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄÒÕï±ïç–ÅÖ…•Ñµ±Öâï∞ÙâA…Ωë’ç—ΩÃÅ¡Ω»Å√Öù•πÑàÅŸÖ±’îıÌ¡ÖùïM•ÈïÙÅΩπ°ÖπùîıÏ°ÏÅ—Ö…ùï–ÅÙ§ÄÙ¯ÅÏÅÕï—AÖùïM•Èî°9’µâï»°—Ö…ùï–πŸÖ±’î§§ÏÅÕï—AÖùî†¿§ÅıÙ¯ÒΩ¡—•Ω∏ÅŸÖ±’îÙàƒ¿à¯ƒ¿Å¡Ω»Å√Öù•πÑΩΩ¡—•Ω∏¯ÒΩ¡—•Ω∏ÅŸÖ±’îÙà»‘à¯»‘Å¡Ω»Å√Öù•πÑΩΩ¡—•Ω∏¯ÒΩ¡—•Ω∏ÅŸÖ±’îÙà‘¿à¯‘¿Å¡Ω»Å√Öù•πÑΩΩ¡—•Ω∏¯ΩÕï±ïç–¯(ÄÄÄÄÄÄÄÄΩôΩΩ—ï»¯(ÄÄÄÄÄÄΩÕïç—•Ω∏¯((ÄÄÄÄÄÅÌïë•—5ïπ‘Ä¸Åç…ïÖ—ïAΩ…—Ö∞†Òë•—E’•ç≠5ïπ‘Åµïπ‘ıÌïë•—5ïπ’ÙÅΩπ±ΩÕîıÏ†§ÄÙ¯ÅÕï—ë•—5ïπ‘°π’±∞•ÙÅΩπ°ΩΩÕîıÌΩ¡ïπë•—A…ïŸ•ï›ÙÄº¯∞ÅëΩç’µïπ–πâΩë‰§ÄËÅπ’±±Ù((ÄÄÄÄÄÅÌïë•—A…ïŸ•ï‹Ä¸Åç…ïÖ—ïAΩ…—Ö∞†Òë•—A…ïŸ•ï›AÖπï∞Å¡…ïŸ•ï‹ıÌïë•—A…ïŸ•ï›ÙÅΩπ±ΩÕîıÌç±ΩÕïë•—A…ïŸ•ï›ÙÅΩπ=¡ïπ’±±ë•—Ω»ıÌΩ¡ïπ’±±ë•—Ω…ÙÅΩπMÖŸïM—Ωç¨ıÌÕÖŸïYÖ…•Öπ—M—Ωç≠ÙÅΩπMÖŸïA…•çïÃıÌÕÖŸïA…Ωë’ç—A…•çïÕÙÄº¯∞ÅëΩç’µïπ–πâΩë‰§ÄËÅπ’±±Ù((ÄÄÄÄÄÅÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏Ä¸Åç…ïÖ—ïAΩ…—Ö∞††(ÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÕ—Ö—’ÃµçΩπô•…µÖ—•Ω∏µâÖç≠ë…Ω¿àÅ…Ω±îÙâ¡…ïÕïπ—Ö—•Ω∏àÅΩπ5Ω’ÕïΩ›∏ıÏ°ÏÅ—Ö…ùï–∞Åç’……ïπ—QÖ…ùï–ÅÙ§ÄÙ¯ÅÏÅ•òÄ°—Ö…ùï–ÄÙÙÙÅç’……ïπ—QÖ…ùï–ÄòòÅÕ—Ö—’ÕU¡ëÖ—•πù%êÄÙÙÙÅπ’±∞§ÅÕï—M—Ö—’ÕΩπô•…µÖ—•Ω∏°π’±∞§ÅıÙ¯(ÄÄÄÄÄÄÄÄÄÄÒÕïç—•Ω∏Åç±ÖÕÕ9ÖµîıÌÅÕ—Ö—’ÃµçΩπô•…µÖ—•Ω∏ÄëÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏πÖç—•ŸîÄ¸ÄùÕ—Ö—’ÃµçΩπô•…µÖ—•Ω∏¥µëïÖç—•ŸÖ—îúÄËÄùÕ—Ö—’ÃµçΩπô•…µÖ—•Ω∏¥µÖç—•ŸÖ—îùıÅÙÅ…Ω±îÙâë•Ö±ΩúàÅÖ…•ÑµµΩëÖ∞Ùâ—…’îàÅÖ…•Ñµ±Öâï±±ïëâ‰ÙâÕ—Ö—’ÃµçΩπô•…µÖ—•Ω∏µ—•—±îà¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏Åç±ÖÕÕ9ÖµîÙâÕ—Ö—’ÃµçΩπô•…µÖ—•Ωπ}}ç±ΩÕîàÅ—Â¡îÙââ’——Ω∏àÅΩπ±•ç¨ıÏ†§ÄÙ¯ÅÕï—M—Ö—’ÕΩπô•…µÖ—•Ω∏°π’±∞•ÙÅë•ÕÖâ±ïêıÌÕ—Ö—’ÕU¡ëÖ—•πù%êÄÑÙÙÅπ’±±ÙÅÖ…•Ñµ±Öâï∞Ùâï……Ö»ÅçΩπô•…µÖçßÕ∏à¯Ò`Äº¯Ωâ’——Ω∏¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒÕ¡Ö∏Åç±ÖÕÕ9ÖµîÙâÕ—Ö—’ÃµçΩπô•…µÖ—•Ωπ}}•çΩ∏à˘ÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏πÖç—•ŸîÄ¸ÄÒAΩ›ï…=ôòÄº¯ÄËÄÒAΩ›ï»Äº˘ÙΩÕ¡Ö∏¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒ†»Å•êÙâÕ—Ö—’ÃµçΩπô•…µÖ—•Ω∏µ—•—±îà˚
˝ÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏πÖç—•ŸîÄ¸ÄùïÕÖç—•ŸÖ»úÄËÄùç—•ŸÖ»ùÙÅ¡…Ωë’ç—º¸Ω†»¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒ¿˘Õ”ÖÃÅ¡Ω»ÅÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏πÖç—•ŸîÄ¸ÄùëïÕÖç—•ŸÖ»úÄËÄùÖç—•ŸÖ»ùÙÄÒÕ—…Ωπú˘ÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏ππÖµïÙΩÕ—…Ωπú¯∏Ω¿¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒÕµÖ±∞˘ÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏πÖç—•ŸîÄ¸Äù∞Å¡…Ωë’ç—ºÅëï©ÖÀÑÅëîÅïÕ—Ö»Åë•Õ¡Ωπ•â±î∞Å¡ï…ºÅçΩπÕï…ŸÖÀÑÅ—ΩëΩÃÅÕ’ÃÅëÖ—ΩÃÅ‰ÅÕ‘ÅÕ—Ωç¨∏úÄËÄù∞Å¡…Ωë’ç—ºÅŸΩ±ŸïÀÑÅÑÅïÕ—Ö»Åë•Õ¡Ωπ•â±îÅï∏Åï∞ÅÕ•Õ—ïµÑ∏ùÙΩÕµÖ±∞¯(ÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÕ—Ö—’ÃµçΩπô•…µÖ—•Ωπ}}Öç—•ΩπÃà¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏Å—Â¡îÙââ’——Ω∏àÅç±ÖÕÕ9ÖµîÙâÕ—Ö—’ÃµçΩπô•…µÖ—•Ωπ}}çÖπçï∞àÅΩπ±•ç¨ıÏ†§ÄÙ¯ÅÕï—M—Ö—’ÕΩπô•…µÖ—•Ω∏°π’±∞•ÙÅë•ÕÖâ±ïêıÌÕ—Ö—’ÕU¡ëÖ—•πù%êÄÑÙÙÅπ’±±Ù˘Öπçï±Ö»Ωâ’——Ω∏¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏Å—Â¡îÙââ’——Ω∏àÅç±ÖÕÕ9ÖµîÙâÕ—Ö—’ÃµçΩπô•…µÖ—•Ωπ}}çΩπô•…¥àÅΩπ±•ç¨ıÌçΩπô•…µM—Ö—’Õ°ÖπùïÙÅë•ÕÖâ±ïêıÌÕ—Ö—’ÕU¡ëÖ—•πù%êÄÑÙÙÅπ’±±Ù˘ÌÕ—Ö—’ÕU¡ëÖ—•πù%êÄÑÙÙÅπ’±∞Ä¸Ä¯ÒIïô…ïÕ°‹Äº¯ÅA…ΩçïÕÖπëº∏∏∏º¯ÄËÄ˘ÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏πÖç—•ŸîÄ¸ÄÒAΩ›ï…=ôòÄº¯ÄËÄÒAΩ›ï»Äº˘ıÌÕ—Ö—’ÕΩπô•…µÖ—•Ω∏πÖç—•ŸîÄ¸ÄùO¥∞ÅëïÕÖç—•ŸÖ»úÄËÄùO¥∞ÅÖç—•ŸÖ»ùÙº˘ÙΩâ’——Ω∏¯(ÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄΩÕïç—•Ω∏¯(ÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄ§∞ÅëΩç’µïπ–πâΩë‰§ÄËÅπ’±±Ù((ÄÄÄÄÄÅÌÕ—Ö—’Õ9Ω—•çîÄ¸ÄÒë•ÿÅç±ÖÕÕ9ÖµîıÌÅçÖ—Ö±Ωúµ—ΩÖÕ–ÅçÖ—Ö±Ωúµ—ΩÖÕ–¥¥ëÌÕ—Ö—’Õ9Ω—•çîπ—Â¡ïıÅÙÅ…Ω±îÙâÕ—Ö—’Ãà¯ÒÕ¡Ö∏˘ÌÕ—Ö—’Õ9Ω—•çîπ—Â¡îÄÙÙÙÄùÕ’ççïÕÃúÄ¸ÄÒ°ïç≠•…ç±î»Äº¯ÄËÄÒ`Äº˘ÙΩÕ¡Ö∏¯Ò¿˘ÌÕ—Ö—’Õ9Ω—•çîπµïÕÕÖùïÙΩ¿¯Òâ’——Ω∏Å—Â¡îÙââ’——Ω∏àÅΩπ±•ç¨ıÏ†§ÄÙ¯ÅÕï—M—Ö—’Õ9Ω—•çî°π’±∞•ÙÅÖ…•Ñµ±Öâï∞Ùâï……Ö»ÅÖŸ•Õºà¯Ò`Äº¯Ωâ’——Ω∏¯Ωë•ÿ¯ÄËÅπ’±±Ù(ÄÄÄÄΩë•ÿ¯(ÄÄ§)Ù(