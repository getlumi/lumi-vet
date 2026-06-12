import React, { useState } from 'react'
import VisitRegister from './VisitRegister'
import VisitCarnet from './VisitCarnet'
import VisitCertificate from './VisitCertificate'
import BasicPatients from './BasicPatients'
import Settings from './Settings'
import SupportVet from './SupportVet'

const getGreeting = () => {
  const hour = parseInt(
    new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Cancun', hour: 'numeric', hour12: false }).format(new Date())
  )
  if (hour >= 6 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const getTodayStr = () =>
  new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Cancun' })

const ACTIONS = [
  { id: 'visit',       icon: 'ti-clipboard-plus',   label: 'Registrar visita',      sub: 'Código Lumi del paciente', primary: true },
  { id: 'carnet',      icon: 'ti-vaccine',          label: 'Actualizar carnet',     sub: null },
  { id: 'certificate', icon: 'ti-file-certificate', label: 'Certificado de salud',  sub: null },
  { id: 'patients',    icon: 'ti-paw',              label: 'Pacientes',             sub: null },
]

const NAV_ITEMS = [
  { id: 'home',     icon: 'ti-home',           label: 'Inicio' },
  { id: 'soporte',  icon: 'ti-message-circle', label: 'Soporte' },
  { id: 'settings', icon: 'ti-settings',       label: 'Ajustes' },
]

export default function BasicHome({ clinic, session, onUpdate, onPlans }) {
  const [view, setView] = useState('home')

  const navigate = (v) => setView(v)

  const renderScreen = () => {
    switch (view) {
      case 'visit':       return <VisitRegister clinic={clinic} onNavigate={navigate} />
      case 'carnet':      return <VisitCarnet clinic={clinic} onNavigate={navigate} />
      case 'certificate': return <VisitCertificate clinic={clinic} onNavigate={navigate} />
      case 'patients':    return <BasicPatients clinic={clinic} onNavigate={navigate} />
      case 'settings':    return <Settings clinic={clinic} session={session} onUpdate={onUpdate} onPlans={onPlans} />
      case 'soporte':     return <SupportVet clinic={clinic} />
      default:            return null
    }
  }

  if (view !== 'home') {
    return (
      <div className="basic-shell">
        {renderScreen()}
        <BottomNav active={view} onNavigate={navigate} />
      </div>
    )
  }

  return (
    <div className="basic-shell">
      <div className="basic-content">
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.3px', margin: '0 0 4px', textTransform: 'capitalize' }}>
            {getTodayStr()}
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--purple-dark)', margin: 0, letterSpacing: '-0.3px' }}>
            {getGreeting()}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{clinic.name}</p>
        </div>

        <div className="basic-action-grid">
          {ACTIONS.map(a => (
            <button key={a.id} className={`basic-action-card ${a.primary ? 'primary' : ''}`} onClick={() => navigate(a.id)}>
              <i className={`ti ${a.icon}`} aria-hidden="true" />
              <p className="basic-action-label">{a.label}</p>
              {a.sub && <p className="basic-action-sub">{a.sub}</p>}
            </button>
          ))}
        </div>

        <div style={{ background: '#DCFCE7', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <i className="ti ti-star" style={{ fontSize: 18, color: '#16A34A' }} aria-hidden="true" />
          <p style={{ fontSize: 12, color: '#15803D', margin: 0 }}>Cada visita registrada suma puntos Lumi al dueño de la mascota</p>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: 'var(--gradient)', borderRadius: 12 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: '0 0 4px', fontWeight: 600 }}>Plan Básico activo</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: 0 }}>$299/mes · Registro de visitas, carnet y certificados</p>
        </div>
      </div>

      <BottomNav active="home" onNavigate={navigate} />
    </div>
  )
}

function BottomNav({ active, onNavigate }) {
  return (
    <nav className="basic-nav">
      {NAV_ITEMS.map(item => (
        <button key={item.id} className={`basic-nav-item ${active === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
          <i className={`ti ${item.icon}`} aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
