import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Plus } from 'lucide-react'
import { AppLayout } from './components/layout/AppLayout'
import { CreateProductPage } from './pages/products/CreateProductPage'
import { ProductsPage } from './pages/products/ProductsPage'

const editProductPath = /^\/products\/[^/]+\/edit$/

function normalizePath(pathname) {
  if (pathname === '/products/new' || editProductPath.test(pathname)) return pathname
  return '/products'
}

function StartupSplash({ leaving }) {
  return (
    <div className={`startup-splash ${leaving ? 'startup-splash--leaving' : ''}`} role="status" aria-live="polite" aria-label="Cargando el sistema">
      <div className="startup-splash__content">
        <span className="startup-spinner" aria-hidden="true" />
        <p>Cargando...</p>
      </div>
    </div>
  )
}

export default function App() {
  const [path, setPath] = useState(() => {
    const initialPath = normalizePath(window.location.pathname)
    if (window.location.pathname !== initialPath) window.history.replaceState({}, '', initialPath)
    return initialPath
  })
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [startupNeedsCatalog] = useState(() => normalizePath(window.location.pathname) === '/products')
  const [catalogReady, setCatalogReady] = useState(false)
  const [minimumStartupElapsed, setMinimumStartupElapsed] = useState(false)
  const [startupFallbackElapsed, setStartupFallbackElapsed] = useState(false)
  const [startupStage, setStartupStage] = useState('visible')
  const [productToEdit, setProductToEdit] = useState(() => {
    try {
      return JSON.parse(window.sessionStorage.getItem('rose:product-to-edit'))
    } catch {
      return null
    }
  })

  useEffect(() => {
    const updatePath = () => {
      const nextPath = normalizePath(window.location.pathname)
      if (window.location.pathname !== nextPath) window.history.replaceState({}, '', nextPath)
      setPath(nextPath)
    }
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  useEffect(() => {
    const minimumTimer = window.setTimeout(() => setMinimumStartupElapsed(true), 900)
    const fallbackTimer = window.setTimeout(() => setStartupFallbackElapsed(true), 8000)
    return () => {
      window.clearTimeout(minimumTimer)
      window.clearTimeout(fallbackTimer)
    }
  }, [])

  useEffect(() => {
    const dataReady = !startupNeedsCatalog || catalogReady || startupFallbackElapsed
    if (!minimumStartupElapsed || !dataReady || startupStage !== 'visible') return undefined

    setStartupStage('leaving')
    const exitDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 480
    const exitTimer = window.setTimeout(() => setStartupStage('hidden'), exitDelay)
    return () => window.clearTimeout(exitTimer)
  }, [catalogReady, minimumStartupElapsed, startupFallbackElapsed, startupNeedsCatalog, startupStage])

  const markCatalogReady = useCallback(() => setCatalogReady(true), [])

  const navigate = (nextPath) => {
    if (nextPath === path) return

    const direction = nextPath === '/products/new' || editProductPath.test(nextPath) ? 'forward' : 'back'
    const changePage = () => {
      window.history.pushState({}, '', nextPath)
      flushSync(() => setPath(nextPath))
      window.scrollTo({ top: 0 })
    }

    if (document.startViewTransition) {
      document.documentElement.dataset.routeDirection = direction
      document.documentElement.dataset.routeTransition = 'active'
      const transition = document.startViewTransition(changePage)
      transition.finished.finally(() => {
        delete document.documentElement.dataset.routeDirection
        delete document.documentElement.dataset.routeTransition
      })
      return
    }

    changePage()
  }

  const creatingProduct = path === '/products/new'
  const editingProduct = editProductPath.test(path)
  const showingForm = creatingProduct || editingProduct

  const openProductEditor = (product) => {
    setProductToEdit(product)
    window.sessionStorage.setItem('rose:product-to-edit', JSON.stringify(product))
    navigate(`/products/${product.id}/edit`)
  }

  const updateEditedProduct = (product) => {
    setProductToEdit(product)
    window.sessionStorage.setItem('rose:product-to-edit', JSON.stringify(product))
    setCatalogRevision((current) => current + 1)
  }

  return (
    <>
    <AppLayout
      title={editingProduct ? 'Editar producto' : creatingProduct ? 'Cargar producto' : 'Productos'}
      subtitle={editingProduct ? 'Modificá solamente la información que necesites' : creatingProduct ? 'Completa la información del nuevo producto' : 'Gestioná tu catálogo de productos'}
      pageKey={editingProduct ? `edit-product-${productToEdit?.id || 'empty'}` : creatingProduct ? 'create-product' : 'products-list'}
      onProductsClick={() => navigate('/products')}
      headerAction={!showingForm ? (
        <button className="header-action" type="button" onClick={() => navigate('/products/new')}>
          <Plus size={16} /> Nuevo producto
        </button>
      ) : null}
    >
      {showingForm
        ? <CreateProductPage mode={editingProduct ? 'edit' : 'create'} currentProduct={editingProduct ? productToEdit : null} onBack={() => navigate('/products')} onProductCreated={() => setCatalogRevision((current) => current + 1)} onProductUpdated={updateEditedProduct} onProductStatusChanged={updateEditedProduct} />
        : <ProductsPage key={catalogRevision} onNewProduct={() => navigate('/products/new')} onEditProduct={openProductEditor} onInitialLoadComplete={markCatalogReady} />}
    </AppLayout>
    {startupStage !== 'hidden' ? <StartupSplash leaving={startupStage === 'leaving'} /> : null}
    </>
  )
}
