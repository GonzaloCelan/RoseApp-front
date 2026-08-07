import {
  BarChart3, Boxes, BriefcaseBusiness, ChevronDown, CircleUserRound,
  Download, Home, LockKeyhole, Menu, Package, Settings, ShoppingBag, Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const navItems = [
  { label: 'Inicio', icon: Home },
  { label: 'Ventas', icon: BriefcaseBusiness },
  { label: 'Productos', icon: ShoppingBag, active: true, available: true },
  { label: 'Clientes', icon: Users },
  { label: 'Stock', icon: Boxes },
  { label: 'Reportes', icon: BarChart3 },
  { label: 'Configuración', icon: Settings },
]

export function AppLayout({ children, title, subtitle, headerAction, onProductsClick, pageKey }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)

  useEffect(() => {
    const compactForNotebook = () => {
      if (window.innerWidth <= 1366 && window.innerWidth > 900) setCollapsed(true)
    }
    compactForNotebook()
  }, [])

  useEffect(() => {
    const offerInstallation = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const confirmInstallation = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', offerInstallation)
    window.addEventListener('appinstalled', confirmInstallation)
    return () => {
      window.removeEventListener('beforeinstallprompt', offerInstallation)
      window.removeEventListener('appinstalled', confirmInstallation)
    }
  }, [])

  const installApplication = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const toggleSidebar = () => {
    if (window.innerWidth <= 900) setMenuOpen((open) => !open)
    else setCollapsed((value) => !value)
  }

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <strong><span className="brand__full">ROSE</span><span className="brand__short">R</span></strong>
        </div>
        <nav aria-label="Navegación principal">
          {navItems.map(({ label, icon: Icon, active, available }) => (
            <button className={`nav-item ${active ? 'nav-item--active' : ''} ${!available ? 'nav-item--locked' : ''}`} key={label} type="button" title={!available ? `${label} — Próximamente` : collapsed ? label : undefined} onClick={available ? onProductsClick : undefined} disabled={!available}>
              <span className="nav-item__icon"><Icon size={20} strokeWidth={1.7} /></span><span className="nav-item__label">{label}</span>{!available && <LockKeyhole className="nav-item__lock" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="profile-card">
            <div className="avatar"><CircleUserRound /></div>
            <div className="profile-copy"><strong>Rocío Pesce</strong><span>Administradora</span></div>
            <ChevronDown className="profile-chevron" size={17} />
          </div>
        </div>
      </aside>

      {menuOpen ? <button className="backdrop" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" /> : null}

      <div className="main-column">
        <header className="topbar">
          <button className="menu-button" onClick={toggleSidebar} aria-label={collapsed ? 'Expandir menú' : 'Ocultar menú'} title={collapsed ? 'Expandir menú' : 'Ocultar menú'}><Menu /></button>
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {(headerAction || (installPrompt && !installed)) ? (
            <div className="topbar__actions">
              {installPrompt && !installed ? <button className="pwa-install-button" type="button" onClick={installApplication}><Download /> <span>Instalar app</span></button> : null}
              {headerAction ? <div className="topbar__action">{headerAction}</div> : null}
            </div>
          ) : null}
        </header>
        <main><div className="page-transition-surface" key={pageKey}>{children}</div></main>
      </div>
    </div>
  )
}
