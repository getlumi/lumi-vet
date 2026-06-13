import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
  const [ranking, setRanking] = useState({ avg: 0, count: 0 })
  const [showReviews, setShowReviews] = useState(false)
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => { fetchRanking() }, [clinic.id])

  const fetchRanking = async () => {
    const { data } = await supabase.from('vet_reviews').select('rating').eq('clinic_id', clinic.id)
    if (data && data.length > 0) {
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length
      setRanking({ avg: avg.toFixed(1), count: data.length })
    } else {
      setRanking({ avg: 0, count: 0 })
    }
  }

  const openReviews = async () => {
    setShowReviews(true)
    setReviewsLoading(true)
    const { data, error } = await supabase
      .from('vet_reviews')
      .select('*, pets(name)')
      .eq('clinic_id', clinic.id)
      .order('created_at', { ascending: false })
    if (error) console.error('[BasicHome] reviews error:', error.message)
    setReviews(data || [])
    setReviewsLoading(false)
  }

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
        <div style={{ marginBottom: 20, position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
          {clinic.logo_url && (
            <img
              src={clinic.logo_url}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)',
                height: 64, width: 'auto', objectFit: 'contain',
                opacity: 0.35, pointerEvents: 'none', userSelect: 'none',
                filter: 'grayscale(15%)',
              }}
            />
          )}
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

        <button onClick={openReviews} style={{
          width: '100%', marginTop: 12, padding: '12px 14px', borderRadius: 12,
          border: '1px solid var(--border)', background: 'white', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ti ti-message-2" style={{ fontSize: 18, color: 'var(--purple)' }} aria-hidden="true" />
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Comentarios ({ranking.count})</p>
          </div>
          {ranking.count > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>{ranking.avg}</span>
              <i className="ti ti-star-filled" style={{ fontSize: 14, color: '#F59E0B' }} aria-hidden="true" />
            </div>
          ) : (
            <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--text-muted)' }} aria-hidden="true" />
          )}
        </button>

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

      {showReviews && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowReviews(false) }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, maxHeight: '80vh', background: 'white', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Comentarios</p>
                {ranking.count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#D97706' }}>{ranking.avg}</span>
                    <i className="ti ti-star-filled" style={{ fontSize: 13, color: '#F59E0B' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {ranking.count} {ranking.count === 1 ? 'calificación' : 'calificaciones'}</span>
                  </div>
                )}
              </div>
              <button onClick={() => setShowReviews(false)} className="btn btn-secondary btn-sm">Cerrar</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviewsLoading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Cargando...</p>
              ) : reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  <i className="ti ti-message-2" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                  <p style={{ fontSize: 13 }}>Sin comentarios todavía</p>
                </div>
              ) : (
                reviews.map(r => (
                  <div key={r.id} style={{ padding: 12, background: 'var(--bg)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1,2,3,4,5].map(s => (
                          <i key={s} className={`ti ${s <= r.rating ? 'ti-star-filled' : 'ti-star'}`} style={{ fontSize: 13, color: s <= r.rating ? '#F59E0B' : 'var(--border)' }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {r.pets?.name && <p style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 700, margin: '0 0 2px' }}>{r.pets.name}</p>}
                    {r.comment && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{r.comment}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
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
