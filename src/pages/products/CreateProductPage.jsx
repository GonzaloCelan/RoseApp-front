import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Boxes, CircleDollarSign, FileText, Info,
  CheckCircle2, CircleAlert, ImagePlus, Package, Palette, Plus, Ruler, Save, Tag, Trash2, Upload, X,
} from 'lucide-react'
import { ApiError } from '../../api/httpClient'
import { productApi } from '../../features/products/api/productApi'
import { toProductRequest, toProductUpdateRequest } from '../../features/products/model/productMapper'
import './create-product.css'

const initialProduct = {
  name: '', category: '', brand: '',
  costPrice: '', salePrice: '', status: '', notes: '',
}

let nextVariantId = 0
const createVariant = (color = '', size = '', stock = '') => ({ id: `variant-${++nextVariantId}`, color, size, stock })

function productToVariants(product) {
  if (Array.isArray(product?.variants) && product.variants.length) {
    return product.variants.map((variant) => createVariant(variant.color || product?.color || '', variant.size || '', variant.stock ?? ''))
  }
  return [createVariant(product?.color || '', product?.size || '', product?.stock ?? '')]
}

function productToFormValues(product) {
  return {
    name: product?.name || '',
    category: product?.category || '',
    brand: product?.brand || '',
    costPrice: product?.costPrice ?? '',
    salePrice: product?.salePrice ?? '',
    status: product?.active === false ? 'Inactivo' : 'Activo',
    notes: product?.notes || '',
  }
}

const fallbackCategories = [
  { name: 'T_SHIRT', displayName: 'Remeras' },
  { name: 'TOP', displayName: 'Musculosas / Tops' },
  { name: 'SHIRT_BLOUSE', displayName: 'Camisas / Blusas' },
  { name: 'BODYSUIT', displayName: 'Bodies' },
  { name: 'SWEATER', displayName: 'Sweaters / Suéteres' },
  { name: 'HOODIE', displayName: 'Buzos' },
  { name: 'CARDIGAN', displayName: 'Cardigans' },
  { name: 'JACKET', displayName: 'Camperas' },
  { name: 'COAT', displayName: 'Tapados / Abrigos' },
  { name: 'VEST', displayName: 'Chalecos' },
  { name: 'JEANS', displayName: 'Jeans' },
  { name: 'PANTS', displayName: 'Pantalones' },
  { name: 'LEGGINGS', displayName: 'Calzas' },
  { name: 'JOGGER', displayName: 'Joggers' },
  { name: 'SHORTS', displayName: 'Shorts' },
  { name: 'SKIRT', displayName: 'Polleras' },
  { name: 'DRESS', displayName: 'Vestidos' },
  { name: 'JUMPSUIT', displayName: 'Monos / Enteritos' },
  { name: 'SET', displayName: 'Conjuntos' },
  { name: 'TAILORING', displayName: 'Sastrería' },
  { name: 'SPORTSWEAR', displayName: 'Ropa deportiva' },
  { name: 'ACCESSORY', displayName: 'Accesorios' },
  { name: 'FOOTWEAR', displayName: 'Calzado' },
  { name: 'OTHER', displayName: 'Otro' },
]

const availableColors = [
  'Rosa', 'Negro', 'Blanco', 'Beige', 'Gris', 'Marrón', 'Rojo', 'Bordó',
  'Naranja', 'Amarillo', 'Verde', 'Celeste', 'Azul', 'Violeta', 'Dorado',
  'Plateado', 'Multicolor',
]

const availableSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único', '35', '36', '37', '38', '39', '40', '41', '42']

const colorValues = {
  Rosa: '#f25a9d', Negro: '#252329', Blanco: '#f7f7f7', Beige: '#d8c09f',
  Gris: '#90909a', Marrón: '#82543b', Rojo: '#dc3e49', Bordó: '#7d2338',
  Naranja: '#ed813d', Amarillo: '#efc942', Verde: '#47a868', Celeste: '#72b9df',
  Azul: '#3468c0', Violeta: '#8d55bc', Dorado: '#c8a447', Plateado: '#b5b7bd',
  Multicolor: 'linear-gradient(135deg, #f35c94, #e5c746, #48aa74, #4b79d1)',
}

const money = (value) => value === '' || value === null || value === undefined
  ? '—'
  : `$ ${Number(value).toLocaleString('es-AR')}`

function Field({ label, required, hint, children }) {
  return <label className="field"><span>{label} {required && <b>*</b>}</span>{children}{hint && <small>{hint}</small>}</label>
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="form-section">
      <div className="form-section__heading">
        <span className="section-icon"><Icon size={21} /></span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      {children}
    </section>
  )
}

function PreviewRow({ icon: Icon, label, children, strong }) {
  return <div className={`preview-row ${strong ? 'preview-row--strong' : ''}`}><Icon size={19} /><span>{label}</span><div>{children}</div></div>
}

export function CreateProductPage({ mode = 'create', currentProduct, onBack, onProductCreated, onProductUpdated, onProductStatusChanged }) {
  const isEditing = mode === 'edit'
  const [product, setProduct] = useState(() => isEditing ? productToFormValues(currentProduct) : initialProduct)
  const [variants, setVariants] = useState(() => isEditing ? productToVariants(currentProduct) : [createVariant()])
  const [previewImage, setPreviewImage] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [categories, setCategories] = useState(fallbackCategories)
  const [submitState, setSubmitState] = useState({ status: 'idle', message: '' })
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)
  const returnTimer = useRef(null)
  const update = ({ target: { name, value } }) => setProduct((current) => ({ ...current, [name]: value }))
  const previewProduct = product
  const completedVariants = variants.filter(({ color, size, stock }) => color && size && stock !== '')
  const totalStock = completedVariants.reduce((total, variant) => total + Number(variant.stock || 0), 0)
  const displayedImage = previewImage || (isEditing ? currentProduct?.imageUrl : null)
  const costPrice = Number(previewProduct.costPrice)
  const salePrice = Number(previewProduct.salePrice)
  const profitPercentage = costPrice > 0
    ? ((salePrice - costPrice) / costPrice) * 100
    : 0
  const profitAmount = salePrice - costPrice
  const hasPrices = costPrice > 0 && previewProduct.salePrice !== ''
  const formattedProfit = hasPrices
    ? `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(profitPercentage)} %`
    : '—'
  const formattedProfitAmount = hasPrices
    ? new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
    }).format(profitAmount)
    : '—'

  const updateVariant = (variantId, field, value) => {
    setVariants((current) => current.map((variant) => variant.id === variantId ? { ...variant, [field]: value } : variant))
  }

  const addVariant = () => setVariants((current) => [...current, createVariant()])

  const removeVariant = (variantId) => {
    setVariants((current) => current.length === 1
      ? [createVariant()]
      : current.filter((variant) => variant.id !== variantId))
  }

  useEffect(() => {
    let secondFrame
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setPreviewReady(true))
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
    }
  }, [])

  useEffect(() => () => clearTimeout(returnTimer.current), [])

  useEffect(() => {
    if (!submitState.message) return undefined
    const timeout = setTimeout(() => {
      setSubmitState((current) => ({ ...current, message: '' }))
    }, 2600)
    return () => clearTimeout(timeout)
  }, [submitState.message])

  useEffect(() => {
    const controller = new AbortController()

    productApi.getCategories({ signal: controller.signal })
      .then((data) => {
        if (Array.isArray(data) && data.length) setCategories(data)
      })
      .catch((error) => {
        if (error?.cause?.name !== 'AbortError') {
          console.info('Se usan categorías locales hasta que el backend esté disponible.')
        }
      })

    return () => controller.abort()
  }, [])

  const updateImage = ({ target: { files } }) => {
    const file = files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setSubmitState({ status: 'error', message: 'La imagen debe ser JPG, PNG o WEBP y pesar menos de 5 MB.' })
      setFileInputKey((current) => current + 1)
      return
    }
    if (previewImage?.startsWith('blob:')) URL.revokeObjectURL(previewImage)
    setImageFile(file)
    setPreviewImage(URL.createObjectURL(file))
    setSubmitState({ status: 'idle', message: '' })
  }

  const resetForm = () => {
    if (previewImage?.startsWith('blob:')) URL.revokeObjectURL(previewImage)
    setProduct(initialProduct)
    setVariants([createVariant()])
    setPreviewImage(null)
    setImageFile(null)
    setFileInputKey((current) => current + 1)
  }

  const updateStatus = async ({ target: { value } }) => {
    if (!isEditing) {
      setProduct((current) => ({ ...current, status: value }))
      return
    }

    if (value === previewProduct.status || statusUpdating) return

    setStatusUpdating(true)
    setSubmitState({ status: 'idle', message: '' })

    try {
      if (value === 'Activo') await productApi.activate(currentProduct.id)
      else await productApi.deactivate(currentProduct.id)

      const active = value === 'Activo'
      setProduct((current) => ({ ...current, status: value }))
      onProductStatusChanged?.({ ...currentProduct, active })
      setSubmitState({
        status: 'success',
        title: active ? 'Producto activado' : 'Producto desactivado',
        message: `${currentProduct.name} quedó ${active ? 'activo' : 'inactivo'} correctamente.`,
      })
    } catch (error) {
      const message = error instanceof ApiError
        ? [error.message, ...error.details].filter(Boolean).join(' · ')
        : 'Ocurrió un error inesperado al cambiar el estado del producto.'
      setSubmitState({ status: 'error', message })
    } finally {
      setStatusUpdating(false)
    }
  }

  const save = async (event) => {
    event.preventDefault()

    const combinations = completedVariants.map(({ color, size }) => `${color}|${size}`)
    if (!isEditing && (completedVariants.length !== variants.length || new Set(combinations).size !== combinations.length)) {
      setSubmitState({ status: 'error', message: 'Completá el color, talle y stock de cada variante sin repetir combinaciones.' })
      return
    }

    const productWithVariants = {
      ...product,
      variants: completedVariants.map(({ color, size, stock }) => ({ color, size, stock: Number(stock) })),
    }

    if (isEditing) {
      setSubmitState({ status: 'loading', message: '' })

      try {
        const updatedProduct = await productApi.update(currentProduct.id, toProductUpdateRequest(product, {
          entryDate: currentProduct.entryDate,
        }))
        setProduct(productToFormValues(updatedProduct))
        setVariants(productToVariants(updatedProduct))
        onProductUpdated?.(updatedProduct)
        setSubmitState({
          status: 'success',
          title: 'Cambios guardados',
          message: `${updatedProduct.name} se actualizó correctamente.`,
        })
        returnTimer.current = setTimeout(onBack, 2000)
      } catch (error) {
        const message = error instanceof ApiError
          ? [error.message, ...error.details].filter(Boolean).join(' · ')
          : 'Ocurrió un error inesperado al actualizar el producto.'
        setSubmitState({ status: 'error', message })
      }
      return
    }

    setSubmitState({ status: 'loading', message: '' })

    try {
      const createdProduct = await productApi.create(toProductRequest(productWithVariants), { image: imageFile })
      setSubmitState({
        status: 'success',
        message: `Producto ${createdProduct.code || createdProduct.name} guardado correctamente.`,
      })
      onProductCreated?.(createdProduct)
      resetForm()
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    } catch (error) {
      const message = error instanceof ApiError
        ? [error.message, ...error.details].filter(Boolean).join(' · ')
        : 'Ocurrió un error inesperado al guardar el producto.'
      setSubmitState({ status: 'error', message })
    }
  }

  const selectedCategory = categories.find(({ name }) => name === previewProduct.category)
  const previewColors = [...new Set(completedVariants.map(({ color }) => color))]
  const previewSizeStock = Object.values(completedVariants.reduce((grouped, { size, stock }) => {
    const current = grouped[size] || { size, stock: 0 }
    current.stock += Number(stock || 0)
    grouped[size] = current
    return grouped
  }, {}))

  return (
    <form className="product-page" onSubmit={save}>
      <div className="content-column">
        <div className="content-tools">
          <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={19} /> Volver</button>
          <span className="auto-code"><Info size={17} /> {isEditing ? `${currentProduct?.code || 'El código'} no se modifica` : 'El código se genera automáticamente'}</span>
        </div>

        <div className="product-form-card">
          {isEditing ? (
            <div className="edit-guidance"><Info size={17} /><span>Modificá solamente lo necesario. Los campos que no toques conservarán su valor; las variantes y la imagen se administran por separado.</span></div>
          ) : null}
          <Section icon={FileText} title="Información básica" description={isEditing ? 'Revisá y modificá la información básica del producto.' : 'Ingresa el nombre y las características principales del producto.'}>
            <Field label="Nombre del producto" required hint="Este será el nombre visible en tu catálogo.">
              <input name="name" value={product.name} onChange={update} placeholder="Ej. Blusa Ana" required />
            </Field>
            <Field label="Notas" hint="Información adicional para uso interno. Es opcional.">
              <textarea name="notes" rows="3" value={product.notes} onChange={update} placeholder="Ej. Tela delicada, nueva colección, proveedor habitual..." />
            </Field>
          </Section>

          <Section icon={Tag} title="Características del producto" description="Definí la categoría y la marca general del producto.">
            <div className="fields-grid fields-grid--two">
              <Field label="Categoría" required><select name="category" value={product.category} onChange={update} required><option value="">Seleccionar categoría</option>{categories.map(({ name, displayName }) => <option key={name} value={name}>{displayName}</option>)}</select></Field>
              <Field label="Marca" required><select name="brand" value={product.brand} onChange={update} required><option value="">Seleccionar marca</option><option value="ROSE">ROSE</option><option value="Otra">Otra</option></select></Field>
            </div>
          </Section>

          <Section icon={CircleDollarSign} title="Precios" description="Define el costo, el precio de venta y visualiza la ganancia estimada.">
            <div className="fields-grid fields-grid--three">
              <Field label="Precio de costo" required hint="Costo unitario del producto."><div className="money-input"><span>$</span><input name="costPrice" type="number" min="0" step="0.01" value={product.costPrice} onChange={update} placeholder="0" required /></div></Field>
              <Field label="Precio de venta" required hint="Precio al que lo venderás."><div className="money-input"><span>$</span><input name="salePrice" type="number" min="0" step="0.01" value={product.salePrice} onChange={update} placeholder="0" required /></div></Field>
              <Field label="Ganancia estimada" hint="Se calcula automáticamente sobre el costo.">
                <div className={`profit-field ${profitPercentage < 0 ? 'profit-field--negative' : ''}`}>
                  <div className="profit-field__value">
                    <strong>{formattedProfit}</strong>
                    <span>Equivale a {formattedProfitAmount}</span>
                  </div>
                  <small>Automático</small>
                </div>
              </Field>
            </div>
          </Section>

          <Section icon={Boxes} title="Variantes y stock" description={isEditing ? 'Se muestran como referencia. Para cambiar cantidades usá la edición rápida de stock.' : 'Agregá cada combinación de color y talle con su stock disponible.'}>
            <div className={`variants-editor ${isEditing ? 'variants-editor--readonly' : ''}`}>
              <div className="variants-editor__head"><span>Color <b>*</b></span><span>Talle <b>*</b></span><span>Stock disponible <b>*</b></span><span /></div>
              <div className="variants-editor__rows">
                {variants.map((variant, index) => (
                  <div className="variant-row" key={variant.id}>
                    <select value={variant.color} onChange={({ target }) => updateVariant(variant.id, 'color', target.value)} aria-label={`Color de la variante ${index + 1}`} required disabled={isEditing}>
                      <option value="">Seleccionar color</option>
                      {availableColors.map((color) => <option key={color} value={color}>{color}</option>)}
                    </select>
                    <select value={variant.size} onChange={({ target }) => updateVariant(variant.id, 'size', target.value)} aria-label={`Talle ${index + 1}`} required disabled={isEditing}>
                      <option value="">Seleccionar talle</option>
                      {availableSizes.map((size) => <option key={size} disabled={variants.some((current) => current.id !== variant.id && current.color === variant.color && current.size === size)}>{size}</option>)}
                    </select>
                    <input type="number" min="0" value={variant.stock} onChange={({ target }) => updateVariant(variant.id, 'stock', target.value)} aria-label={`Stock del talle ${variant.size || index + 1}`} placeholder="0" required disabled={isEditing} />
                    <button className="variant-remove" type="button" onClick={() => removeVariant(variant.id)} disabled={isEditing || variants.length === 1} aria-label={`Eliminar talle ${variant.size || index + 1}`} title="Eliminar talle"><Trash2 /></button>
                  </div>
                ))}
              </div>
              <div className="variants-editor__footer">
                <button className="add-variant" type="button" onClick={addVariant} disabled={isEditing || variants.length >= availableSizes.length * availableColors.length}><Plus /> Agregar otra variante</button>
                <div className="variants-total"><span>{completedVariants.length} {completedVariants.length === 1 ? 'variante' : 'variantes'}</span><strong>{totalStock.toLocaleString('es-AR')} unidades en total</strong></div>
              </div>
            </div>
          </Section>

          <Section icon={Save} title="Estado del producto" description={isEditing ? 'Este cambio se aplica inmediatamente al producto.' : 'Activa o desactiva la disponibilidad del producto en tu catálogo.'}>
            <div className="radio-group" aria-busy={statusUpdating}>
              {['Activo', 'Inactivo'].map((status) => <label key={status}><input type="radio" name="status" value={status} checked={previewProduct.status === status} onChange={updateStatus} disabled={statusUpdating} /><span />{status}</label>)}
            </div>
            {isEditing ? <small className="status-hint">{statusUpdating ? 'Actualizando estado...' : 'Al cambiar esta opción se realizará la activación o baja lógica automáticamente.'}</small> : null}
          </Section>
        </div>

        <div className="form-actions">
          <button type="button" className="button button--neutral" onClick={() => { if (isEditing) onBack(); else { resetForm(); setSubmitState({ status: 'idle', message: '' }) } }}>Cancelar</button>
          <button type="submit" className="button button--primary" disabled={submitState.status === 'loading' || (isEditing && submitState.status === 'success')}>{submitState.status === 'loading' ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar producto'}</button>
        </div>
      </div>

      <aside className={`preview-card ${previewReady ? 'preview-card--animated' : ''}`}>
        <h2>Vista previa</h2>
        <label className={`photo-uploader ${isEditing ? 'photo-uploader--readonly' : ''}`} htmlFor={isEditing ? undefined : 'product-photo'}>
          {displayedImage ? (
            <>
              <img src={displayedImage} alt="Vista previa del producto" />
              <span className="photo-uploader__action"><Upload size={17} /> {isEditing ? 'La imagen se conserva' : 'Cambiar foto'}</span>
              <span className="photo-uploader__hint"><ImagePlus size={15} /> JPG o PNG · Máx. 5 MB</span>
            </>
          ) : (
            <span className="photo-uploader__empty">
              <span><ImagePlus size={27} /></span>
              <strong>{isEditing ? 'Sin imagen cargada' : 'Cargar imagen'}</strong>
              <small>{isEditing ? 'La imagen no se modifica en este editor' : 'JPG, PNG o WEBP · Máx. 5 MB'}</small>
            </span>
          )}
        </label>
        <input key={fileInputKey} className="visually-hidden" id="product-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={updateImage} disabled={isEditing} />
        <h3>{previewProduct.name || '—'}</h3>
        <PreviewRow icon={Tag} label="Categoría">{selectedCategory?.displayName || currentProduct?.categoryName || '—'}</PreviewRow>
        <PreviewRow icon={Package} label="Marca">{previewProduct.brand || '—'}</PreviewRow>
        <PreviewRow icon={Palette} label="Colores">{previewColors.length ? <span className="preview-color-swatches">{previewColors.map((color) => <span className="preview-color-swatch" style={{ background: colorValues[color] || '#d4ccd5' }} data-tooltip={color} aria-label={`Color ${color}`} tabIndex="0" key={color} />)}</span> : '—'}</PreviewRow>
        <PreviewRow icon={Ruler} label="Talles">{previewSizeStock.length ? <span className="preview-size-list">{previewSizeStock.map(({ size, stock }) => <span className="preview-size-chip" data-tooltip={`${stock.toLocaleString('es-AR')} ${stock === 1 ? 'unidad' : 'unidades'} en talle ${size}`} aria-label={`Talle ${size}: ${stock.toLocaleString('es-AR')} ${stock === 1 ? 'unidad' : 'unidades'}`} tabIndex="0" key={size}>{size === 'Único' ? 'U' : size}</span>)}</span> : '—'}</PreviewRow>
        <div className="preview-divider" />
        <PreviewRow icon={Boxes} label="Stock total">{completedVariants.length ? <em>{totalStock.toLocaleString('es-AR')} unidades</em> : '—'}</PreviewRow>
        <PreviewRow icon={CircleDollarSign} label="Precio de costo">{money(previewProduct.costPrice)}</PreviewRow>
        <PreviewRow icon={CircleDollarSign} label="Precio de venta" strong>{money(previewProduct.salePrice)}</PreviewRow>
      </aside>

      {submitState.message ? (
        <div className={`api-toast api-toast--${submitState.status}`} role="status">
          <span className="api-toast__icon">{submitState.status === 'success' ? <CheckCircle2 /> : submitState.status === 'info' ? <Info /> : <CircleAlert />}</span>
          <div className="api-toast__copy">
            <strong>{submitState.title || (submitState.status === 'success' ? 'Producto guardado' : submitState.status === 'info' ? 'Edición preparada' : 'No se pudo completar')}</strong>
            <p>{submitState.message}</p>
          </div>
          <button type="button" onClick={() => setSubmitState((current) => ({ ...current, message: '' }))} aria-label="Cerrar notificación"><X /></button>
          <span className="api-toast__timer" />
        </div>
      ) : null}

    </form>
  )
}
