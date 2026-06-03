import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import Patients from './pages/Patients'
import Inventory from './pages/Inventory'
import AdminGlobal from './pages/AdminGlobal'
import Services from './pages/Services'
import ChatVet from './pages/ChatVet'
import Settings from './pages/Settings'
import OnboardingVet from './pages/OnboardingVet'
import Admin from './pages/Admin'

const NAV = [
  { id: 'dashboard',    icon: 'ti-layout-dashboard', label: 'Dashboard',    plans: ['basic','pro','plus'] },
  { id: 'appointments', icon: 'ti-calendar',          label: 'Agenda',       plans: ['basic','pro','plus'] },
  { id: 'patients',     icon: 'ti-paw',               label: 'Pacientes',    plans: ['pro','plus'] },
  { id: 'services',     icon: 'ti-stethoscope',       label: 'Servicios',    plans: ['pro','plus'] },
  { id: 'inventory',    icon: 'ti-package',            label: 'Inventario',   plans: ['pro','plus'] },
  { id: 'clinic-admin', icon: 'ti-chart-dots',         label: 'Admin Global', plans: ['basic','pro','plus'] },
  { id: 'chat',         icon: 'ti-message-circle',     label: 'Mensajes',     plans: ['pro','plus'] },
  { id: 'settings',     icon: 'ti-settings',           label: 'Ajustes',      plans: ['basic','pro','plus'] },
]

export default function App() {
  const [session, setSession]       = useState(null)
  const [clinic, setClinic]         = useState(null)
  const [page, setPage]             = useState('dashboard')
  const [pageParams, setPageParams] = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchClinic(data.session.user.id)
      else setLoading(false)
    })
    supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) fetchClinic(s.user.id)
      else { setClinic(null); setLoading(false) }
    })
  }, [])

  const fetchClinic = async (userId) => {
    const { data, error } = await supabase
      .from('vet_clinics')
      .select('*, is_admin')
      .eq('owner_id', userId)
      .limit(1)
      .single()
    console.log('[Lumi] clinic data:', data, '| error:', error)
    setClinic(data || null)
    setLoading(false)
  }

  const navigate = (p, params = null) => {
    setPage(p)
    setPageParams(params)
  }

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <img src="https://yjtjougyjmlyztfwtcdd.supabase.co/storage/v1/object/public/avatars/lumi-logo.png" style={{ width:48, opacity:0.7 }} onError={e => e.target.style.display='none'} />
      <div style={{ fontSize:14, color:'#6B7280' }}>Cargando Lumi Vet...</div>
    </div>
  )

  if (!session) return <AuthPage onAuth={() => {}} />
  if (!clinic)  return <OnboardingVet session={session} onComplete={c => setClinic(c)} />

  const plan = clinic.plan || 'basic'
  const allowedNav = NAV.filter(n => n.plans.includes(plan))

  const renderPage = () => {
    switch(page) {
      case 'dashboard':
        return <Dashboard clinic={clinic} session={session} onNavigate={navigate} />
      case 'appointments':
        return <Appointments clinic={clinic} session={session} initialForm={pageParams?.appointmentForm || null} />
      case 'patients':
        return (
          <Patients
            clinic={clinic}
            session={session}
            openNew={pageParams === 'new'}
            onNavigateAppointment={(form) => navigate('appointments', { appointmentForm: form })}
          />
        )
      case 'services':     return <Services     clinic={clinic} session={session} />
      case 'inventory':    return <Inventory    clinic={clinic} session={session} />
      case 'clinic-admin': return <AdminGlobal  clinic={clinic} session={session} />
      case 'chat':         return <ChatVet      clinic={clinic} session={session} />
      case 'settings':     return <Settings     clinic={clinic} session={session} onUpdate={setClinic} />
      case 'admin':        return <Admin        clinic={clinic} session={session} />
      default:             return <Dashboard    clinic={clinic} session={session} onNavigate={navigate} />
    }
  }

  return (
    <div className="vet-shell">
      <aside className="sidebar">
        {/* Logo + nombre clínica */}
        <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid rgba(124,58,237,0.12)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#6B21A8,#C026D3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className="ti ti-paw" style={{ fontSize:16, color:'white' }} />
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:800, color:'rgba(255,255,255,0.9)', margin:0, letterSpacing:'-0.3px' }}>Lumi Vet</p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.35)', margin:0, fontWeight:500 }}>
                {plan === 'basic' ? 'Plan Básico' : plan === 'pro' ? 'Plan Pro ⭐' : 'Plan Plus 💎'}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 10px', background:'rgba(255,255,255,0.05)', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)' }}>
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinic.name} style={{ width:32, height:32, borderRadius:8, objectFit:'contain', background:'white', padding:3 }} />
            ) : (
              <div style={{ width:32, height:32, borderRadius:8, background:'rgba(124,58,237,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className="ti ti-building-hospital" style={{ fontSize:16, color:'rgba(255,255,255,0.7)' }} />
              </div>
            )}
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.9)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{clinic.name}</p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.35)', margin:0 }}>{clinic.city}</p>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto' }}>
          {allowedNav.map(item => (
            <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
              <i className={`ti ${item.icon}`} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Botón Admin Global Lumi — solo si is_admin = true */}
        {Boolean(clinic?.is_admin) && (
          <div style={{ padding:'0 8px 8px' }}>
            <button
              className={`nav-item ${page === 'admin' ? 'active' : ''}`}
              onClick={() => navigate('admin')}
              style={{ color:'#F59E0B', fontWeight:700 }}
            >
              <i className="ti ti-shield-star" />
              Admin Global
            </button>
          </div>
        )}

        <div style={{ padding:'12px 8px', borderTop:'1px solid var(--border)' }}>
          <a href="https://lumi-app-indol.vercel.app" target="_blank" style={{ textDecoration:'none' }}>
            <button className="nav-item" style={{ color:'var(--purple)', fontWeight:700 }}>
              <i className="ti ti-arrow-left" />
              Ir a Lumi App
            </button>
          </a>
          <button className="nav-item" onClick={() => supabase.auth.signOut()} style={{ color:'var(--red)' }}>
            <i className="ti ti-logout" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}
