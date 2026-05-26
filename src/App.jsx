import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import Patients from './pages/Patients'
import Inventory from './pages/Inventory'
import Finance from './pages/Finance'
import Services from './pages/Services'
import ChatVet from './pages/ChatVet'
import Settings from './pages/Settings'
import OnboardingVet from './pages/OnboardingVet'

const NAV = [
  { id: 'dashboard',    icon: 'ti-layout-dashboard', label: 'Dashboard',   plans: ['basic','pro','plus'] },
  { id: 'appointments', icon: 'ti-calendar',          label: 'Agenda',      plans: ['basic','pro','plus'] },
  { id: 'patients',     icon: 'ti-paw',               label: 'Pacientes',   plans: ['pro','plus'] },
  { id: 'services',     icon: 'ti-stethoscope',       label: 'Servicios',   plans: ['pro','plus'] },
  { id: 'inventory',    icon: 'ti-package',            label: 'Inventario',  plans: ['pro','plus'] },
  { id: 'finance',      icon: 'ti-chart-bar',          label: 'Finanzas',    plans: ['plus'] },
  { id: 'chat',         icon: 'ti-message-circle',     label: 'Mensajes',    plans: ['pro','plus'] },
  { id: 'settings',     icon: 'ti-settings',           label: 'Ajustes',     plans: ['basic','pro','plus'] },
]

export default function App() {
  const [session, setSession]     = useState(null)
  const [clinic, setClinic]       = useState(null)
  const [page, setPage]           = useState('dashboard')
  const [pageParams, setPageParams] = useState(null)
  const [loading, setLoading]     = useState(true)

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
    const { data } = await supabase.from('vet_clinics').select('*').eq('owner_id', userId).limit(1).single()
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
      case 'dashboard':    return <Dashboard    clinic={clinic} session={session} onNavigate={navigate} />
      case 'appointments': return <Appointments clinic={clinic} session={session} />
      case 'patients':     return <Patients     clinic={clinic} session={session} openNew={pageParams === 'new'} />
      case 'services':     return <Services     clinic={clinic} session={session} />
      case 'inventory':    return <Inventory    clinic={clinic} session={session} />
      case 'finance':      return <Finance      clinic={clinic} session={session} />
      case 'chat':         return <ChatVet      clinic={clinic} session={session} />
      case 'settings':     return <Settings     clinic={clinic} session={session} onUpdate={setClinic} />
      default:             return <Dashboard    clinic={clinic} session={session} onNavigate={navigate} />
    }
  }

  return (
    <div className="vet-shell">
      <aside className="sidebar">
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#6B21A8,#C026D3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-paw" style={{ fontSize:18, color:'white' }} />
            </div>
            <div>
              <p style={{ fontSize:15, fontWeight:800, color:'var(--purple)', margin:0 }}>Lumi Vet</p>
              <p style={{ fontSize:10, color:'var(--text-muted)', margin:0, fontWeight:600 }}>
                {plan === 'basic' ? 'Plan Básico' : plan === 'pro' ? 'Plan Pro ⭐' : 'Plan Plus 💎'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'#FAFAFA' }}>
          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{clinic.name}</p>
          <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{clinic.city}</p>
        </div>

        <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto' }}>
          {allowedNav.map(item => (
            <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
              <i className={`ti ${item.icon}`} />
              {item.label}
            </button>
          ))}
        </nav>

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
