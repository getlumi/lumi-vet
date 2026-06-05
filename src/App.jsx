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
import Plans from './pages/Plans'
import SupportVet from './pages/SupportVet'

// ─── DEFINICIÓN OFICIAL DE PLANES ────────────────────────────────────────────
export const PLANS_DEF = {
  basic: {
    id: 'basic', label: 'Básico', emoji: '', price: 299,
    color: '#6B7280', description: 'Forma parte de Lumi',
    features: [
      'Perfil verificado en mapa Lumi ✦',
      'Aparecer en búsquedas cercanas',
      'Agenda — solo pacientes Lumi',
      'Registro de visita walk-in Lumi',
      'Historial clínico de pacientes Lumi',
      'Historial visible en Lumi App',
      'Actualizar carnet con código',
      'Certificado de salud oficial + PDF',
      'Recibir solicitudes de cita',
      '2 anuncios/semana en Lumi App',
    ],
    notIncluded: [
      'Pacientes regulares (sin Lumi)',
      'Inventario de productos',
      'Servicios configurables',
      'Finanzas y cortes',
      'Reportes',
    ],
  },
  basic_bot: {
    id: 'basic_bot', label: 'Básico + Bot', emoji: '🤖', price: 699,
    color: '#0EA5E9', description: 'Automatiza tu agenda con IA',
    setupFee: 1500,
    features: [
      'Todo lo del plan Básico',
      'Chatbot WhatsApp con IA personalizado',
      'Agenda sincronizada con el bot',
      'El bot agenda, confirma y recuerda citas',
      'Métricas de funcionamiento del bot',
      '4 anuncios/semana en Lumi App',
    ],
    notIncluded: [
      'Pacientes regulares (sin Lumi)',
      'Inventario de productos',
      'Finanzas y cortes',
    ],
  },
  pro: {
    id: 'pro', label: 'Pro', emoji: '⭐', price: 599,
    color: '#6B21A8', description: 'Gestiona tu clínica completa',
    recommended: true,
    features: [
      'Todo lo del plan Básico',
      'Pacientes regulares (sin cuenta Lumi)',
      'Historial clínico SOAP completo',
      'Agenda completa con servicios y precios',
      'Servicios configurables con extras',
      'Inventario con control de stock',
      'Venta rápida desde Dashboard',
      'Chat con clientes en tiempo real',
      'Reportes semanales',
      '4 anuncios/semana + otras secciones Lumi App',
    ],
    notIncluded: [
      'Finanzas avanzadas y cortes',
      'Chatbot WhatsApp IA',
    ],
  },
  plus: {
    id: 'plus', label: 'Plus', emoji: '💎', price: 999,
    color: '#C026D3', description: 'El sistema más completo',
    features: [
      'Todo lo del plan Pro',
      'Panel Admin Global',
      'Finanzas — ingresos, cortes diarios y anuales',
      'Inventario avanzado con alertas de reorden',
      'Reportes mensuales y anuales',
      'Métricas avanzadas de operación',
      '8 anuncios/semana + secciones premium',
      'Presencia máxima en Lumi App',
      'Soporte prioritario Lumi',
    ],
    notIncluded: ['Chatbot WhatsApp IA (disponible como add-on)'],
  },
  plus_bot: {
    id: 'plus_bot', label: 'Plus + Bot', emoji: '💎🤖', price: 1499,
    color: '#C026D3', description: 'El más completo con IA',
    setupFee: 1500,
    features: [
      'Todo lo del plan Plus',
      'Chatbot WhatsApp con IA personalizado',
      'Agenda sincronizada con el bot',
      'El bot agenda, confirma y recuerda citas',
      'Métricas avanzadas del bot',
    ],
    notIncluded: [],
  },
}

// ─── NAV POR PLAN ─────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',    icon: 'ti-layout-dashboard', label: 'Dashboard',  plans: ['basic','basic_bot','pro','plus','plus_bot'] },
  { id: 'appointments', icon: 'ti-calendar',          label: 'Agenda',     plans: ['basic','basic_bot','pro','plus','plus_bot'] },
  { id: 'patients',     icon: 'ti-paw',               label: 'Pacientes',  plans: ['basic','basic_bot','pro','plus','plus_bot'] },
  { id: 'services',     icon: 'ti-stethoscope',       label: 'Servicios',  plans: ['pro','plus','plus_bot'] },
  { id: 'inventory',    icon: 'ti-package',            label: 'Inventario', plans: ['pro','plus','plus_bot'] },
  { id: 'settings',     icon: 'ti-settings',           label: 'Ajustes',    plans: ['basic','basic_bot','pro','plus','plus_bot'] },
]

// ─── PERMISOS POR PLAN ────────────────────────────────────────────────────────
export const planCan = (plan) => ({
  seeRegularPatients: ['pro','plus','plus_bot'].includes(plan),
  seeInventory:       ['pro','plus','plus_bot'].includes(plan),
  seeServices:        ['pro','plus','plus_bot'].includes(plan),
  seeFinances:        ['plus','plus_bot'].includes(plan),
  seeAdminGlobal:     ['plus','plus_bot'].includes(plan),
  seeChat:            ['pro','plus','plus_bot'].includes(plan),
  hasBot:             ['basic_bot','plus_bot'].includes(plan),
})

export default function App() {
  const [session, setSession]       = useState(null)
  const [clinic, setClinic]         = useState(null)
  const [page, setPage]             = useState('dashboard')
  const [pageParams, setPageParams] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [unreadSupport, setUnreadSupport] = useState(0)

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

  // Badge de mensajes no leídos del soporte
  useEffect(() => {
    if (!clinic) return
    fetchUnreadSupport()
    const channel = supabase
      .channel(`support_badge_${clinic.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'vet_support_messages',
        filter: `clinic_id=eq.${clinic.id}`,
      }, payload => {
        if (payload.new.sender === 'admin' && page !== 'soporte') {
          setUnreadSupport(prev => prev + 1)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [clinic, page])

  const fetchUnreadSupport = async () => {
    if (!clinic) return
    const { count } = await supabase
      .from('vet_support_messages')
      .select('*', { count:'exact', head:true })
      .eq('clinic_id', clinic.id)
      .eq('sender', 'admin')
      .eq('read', false)
    setUnreadSupport(count || 0)
  }

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
    if (p === 'soporte') setUnreadSupport(0)
  }

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <img src="https://yjtjougyjmlyztfwtcdd.supabase.co/storage/v1/object/public/avatars/lumi-logo.png"
        style={{ width:48, opacity:0.7 }} onError={e => e.target.style.display='none'} />
      <div style={{ fontSize:14, color:'#6B7280' }}>Cargando Lumi Vet...</div>
    </div>
  )

  if (!session) return <AuthPage onAuth={() => {}} />
  if (!clinic)  return <OnboardingVet session={session} onComplete={c => setClinic(c)} />

  const plan    = clinic.plan || 'basic'
  const can     = planCan(plan)
  const planDef = PLANS_DEF[plan] || PLANS_DEF.basic
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
            plan={plan}
            can={can}
            openNew={pageParams === 'new'}
            onNavigateAppointment={(form) => navigate('appointments', { appointmentForm: form })}
          />
        )
      case 'services':
        return can.seeServices
          ? <Services clinic={clinic} session={session} />
          : <UpgradePrompt section="Servicios" plan={plan} onPlans={() => navigate('plans')} />
      case 'inventory':
        return can.seeInventory
          ? <Inventory clinic={clinic} session={session} />
          : <UpgradePrompt section="Inventario" plan={plan} onPlans={() => navigate('plans')} />
      case 'chat':
        return can.seeChat
          ? <ChatVet clinic={clinic} session={session} />
          : <UpgradePrompt section="Chat con clientes" plan={plan} onPlans={() => navigate('plans')} />
      case 'settings':
        return <Settings clinic={clinic} session={session} onUpdate={setClinic} onPlans={() => navigate('plans')} />
      case 'admin':
        return <AdminGlobal clinic={clinic} session={session} />
      case 'plans':
        return <Plans currentPlan={plan} clinic={clinic} onNavigate={navigate} />
      case 'soporte':
        return <SupportVet clinic={clinic} />
      default:
        return <Dashboard clinic={clinic} session={session} onNavigate={navigate} />
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
                {planDef.label} {planDef.emoji}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px', background:'rgba(255,255,255,0.05)', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)' }}>
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

        {/* Nav principal */}
        <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto' }}>
          {allowedNav.map(item => (
            <button key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id)}>
              <i className={`ti ${item.icon}`} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Admin Global — solo is_admin */}
        {Boolean(clinic?.is_admin) && (
          <div style={{ padding:'0 8px 4px' }}>
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

        {/* Soporte — siempre visible con badge */}
        <div style={{ padding:'0 8px 4px' }}>
          <button
            className={`nav-item ${page === 'soporte' ? 'active' : ''}`}
            onClick={() => navigate('soporte')}
            style={{ position:'relative' }}
          >
            <i className="ti ti-message-circle" />
            Soporte Lumi
            {unreadSupport > 0 && (
              <span style={{
                position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                background:'#DC2626', color:'white', borderRadius:'50%',
                width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:800,
              }}>
                {unreadSupport > 9 ? '9+' : unreadSupport}
              </span>
            )}
          </button>
        </div>

        {/* Ver planes */}
        <div style={{ padding:'0 8px 4px' }}>
          <button
            className={`nav-item ${page === 'plans' ? 'active' : ''}`}
            onClick={() => navigate('plans')}
            style={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}
          >
            <i className="ti ti-rocket" />
            Ver planes
          </button>
        </div>

        {/* Cerrar sesión */}
        <div style={{ padding:'8px 8px 12px', borderTop:'1px solid var(--border)' }}>
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

// ─── UPGRADE PROMPT ───────────────────────────────────────────────────────────
function UpgradePrompt({ section, plan, onPlans }) {
  const nextPlan = ['basic','basic_bot'].includes(plan) ? 'Pro ⭐ ($599/mes)' : 'Plus 💎 ($999/mes)'
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div style={{ textAlign:'center', maxWidth:400, padding:32 }}>
        <div style={{ width:64, height:64, borderRadius:18, background:'linear-gradient(135deg,#6B21A8,#C026D3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <i className="ti ti-lock" style={{ fontSize:28, color:'white' }} />
        </div>
        <p style={{ fontSize:20, fontWeight:800, color:'var(--purple-dark)', margin:'0 0 10px' }}>
          {section} no está incluido
        </p>
        <p style={{ fontSize:14, color:'var(--text-secondary)', margin:'0 0 24px', lineHeight:1.6 }}>
          Esta función está disponible en el plan <strong>{nextPlan}</strong>. Actualiza para acceder a {section.toLowerCase()} y más herramientas para tu clínica.
        </p>
        <button onClick={onPlans}
          style={{ background:'linear-gradient(135deg,#6B21A8,#C026D3)', border:'none', borderRadius:14, padding:'14px 28px', color:'white', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 20px rgba(107,33,168,0.35)' }}>
          <i className="ti ti-rocket" style={{ marginRight:8 }} />
          Ver planes y actualizar
        </button>
      </div>
    </div>
  )
}
