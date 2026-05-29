import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PLAN_PRICES = { basic: 299, pro: 599, plus: 999 }
const PLAN_COLORS = { basic: '#6B7280', pro: '#6B21A8', plus: '#C026D3' }

export default function Admin() {
  const [stats, setStats]     = useState(null)
  const [clinics, setClinics] = useState([])
  const [users, setUsers]     = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('overview')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [clinicsRes, profilesRes, petsRes, recordsRes, reviewsRes, transRes] = await Promise.all([
      supabase.from('vet_clinics').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('pets').select('*', { count:'exact', head:true }),
      supabase.from('vet_records').select('*', { count:'exact', head:true }),
      supabase.from('vet_reviews').select('*, vet_clinics(name)').order('created_at', { ascending: false }),
      supabase.from('vet_transactions').select('amount, type, date').eq('type', 'income'),
    ])

    setClinics(clinicsRes.data || [])
    setUsers(profilesRes.data || [])
    setReviews(reviewsRes.data || [])

    const totalRevenue = (transRes.data || []).reduce((s, t) => s + (t.amount || 0), 0)
    const mrr = (clinicsRes.data || []).reduce((s, c) => s + (PLAN_PRICES[c.plan] || 0), 0)

    setStats({
      clinics:      clinicsRes.data?.length || 0,
      users:        profilesRes.data?.length || 0,
      pets:         petsRes.count || 0,
      visits:       recordsRes.count || 0,
      reviews:      reviewsRes.data?.length || 0,
      mrr,
      totalRevenue,
      avgRating:    reviewsRes.data?.length
        ? (reviewsRes.data.reduce((s, r) => s + r.rating, 0) / reviewsRes.data.length).toFixed(1)
        : 0,
    })
    setLoading(false)
  }

  const formatMoney = (n) => (n||0).toLocaleString('es-MX', { style:'currency', currency:'MXN', minimumFractionDigits:0 })
  const formatDate  = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' }) : '—'

  const clinicsByPlan = clinics.reduce((acc, c) => {
    acc[c.plan] = (acc[c.plan] || 0) + 1
    return acc
  }, {})

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12 }}>
      <i className="ti ti-shield" style={{ fontSize:36, color:'var(--purple)', opacity:0.5 }} />
      <p style={{ color:'var(--text-muted)', fontSize:14 }}>Cargando panel admin...</p>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ background:'linear-gradient(135deg,#6B21A8,#C026D3)', borderRadius:8, padding:'4px 10px', fontSize:11, fontWeight:700, color:'white', letterSpacing:'1px' }}>ADMIN</span>
          </div>
          <p style={{ fontSize:24, fontWeight:700, color:'var(--purple-dark)', margin:0, letterSpacing:'-0.3px' }}>Panel Global Lumi</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll}>
          <i className="ti ti-refresh" /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {[
          { id:'overview', label:'Resumen', icon:'ti-layout-dashboard' },
          { id:'clinics',  label:'Clínicas', icon:'ti-building-hospital' },
          { id:'users',    label:'Usuarios', icon:'ti-users' },
          { id:'reviews',  label:'Calificaciones', icon:'ti-star' },
        ].map(t => (
          <button key={t.id} className={`btn ${tab===t.id?'btn-primary':'btn-secondary'} btn-sm`} onClick={() => setTab(t.id)}>
            <i className={`ti ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Métricas principales */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {[
              { label:'Clínicas', value: stats.clinics, icon:'ti-building-hospital', color:'#7C3AED', bg:'#EDE9FE' },
              { label:'Usuarios Lumi', value: stats.users, icon:'ti-users', color:'#0EA5E9', bg:'#E0F2FE' },
              { label:'Mascotas', value: stats.pets, icon:'ti-paw', color:'#EC4899', bg:'#FCE7F3' },
              { label:'Visitas', value: stats.visits, icon:'ti-stethoscope', color:'#16A34A', bg:'#DCFCE7' },
            ].map(m => (
              <div key={m.label} className="stat-card">
                <div className="stat-icon" style={{ background: m.bg }}>
                  <i className={`ti ${m.icon}`} style={{ color: m.color, fontSize:20 }} />
                </div>
                <div>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:'0 0 2px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{m.label}</p>
                  <p style={{ fontSize:22, fontWeight:800, color: m.color, margin:0 }}>{m.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
            {[
              { label:'MRR (suscripciones)', value: formatMoney(stats.mrr), icon:'ti-cash', color:'#16A34A', bg:'#DCFCE7', sub:'Ingreso mensual recurrente' },
              { label:'Ingresos clínicas', value: formatMoney(stats.totalRevenue), icon:'ti-trending-up', color:'#7C3AED', bg:'#EDE9FE', sub:'Total transacciones registradas' },
              { label:'Calificación promedio', value: `${stats.avgRating} ★`, icon:'ti-star', color:'#F59E0B', bg:'#FEF3C7', sub:`${stats.reviews} reseñas totales` },
            ].map(m => (
              <div key={m.label} className="card" style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background: m.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={`ti ${m.icon}`} style={{ color: m.color, fontSize:20 }} />
                </div>
                <div>
                  <p style={{ fontSize:10, color:'var(--text-muted)', margin:'0 0 2px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{m.label}</p>
                  <p style={{ fontSize:20, fontWeight:800, color: m.color, margin:'0 0 2px' }}>{m.value}</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{m.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Distribución por plan */}
          <div className="card">
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.6px', margin:'0 0 16px' }}>Clínicas por plan</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              {['basic','pro','plus'].map(plan => (
                <div key={plan} style={{ padding:16, borderRadius:12, border:`2px solid ${PLAN_COLORS[plan]}30`, background:`${PLAN_COLORS[plan]}08`, textAlign:'center' }}>
                  <p style={{ fontSize:22, fontWeight:900, color: PLAN_COLORS[plan], margin:'0 0 4px' }}>{clinicsByPlan[plan] || 0}</p>
                  <p style={{ fontSize:12, fontWeight:700, color: PLAN_COLORS[plan], margin:'0 0 2px', textTransform:'capitalize' }}>{plan}</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{formatMoney(PLAN_PRICES[plan])}/mes</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CLÍNICAS */}
      {tab === 'clinics' && (
        <div className="card">
          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.6px', margin:'0 0 16px' }}>
            {clinics.length} clínicas registradas
          </p>
          <table className="table">
            <thead>
              <tr><th>Clínica</th><th>Ciudad</th><th>Plan</th><th>Contacto</th><th>Registrada</th><th>Logo</th></tr>
            </thead>
            <tbody>
              {clinics.map(c => (
                <tr key={c.id}>
                  <td>
                    <p style={{ fontWeight:700, margin:'0 0 2px' }}>{c.name}</p>
                    <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{c.description?.slice(0,40) || '—'}</p>
                  </td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{c.city || '—'}</td>
                  <td>
                    <span className="badge" style={{ background:`${PLAN_COLORS[c.plan]}18`, color: PLAN_COLORS[c.plan], textTransform:'capitalize', fontWeight:700 }}>
                      {c.plan || 'basic'}
                    </span>
                  </td>
                  <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                    <p style={{ margin:0 }}>{c.phone || '—'}</p>
                    <p style={{ margin:0, fontSize:11 }}>{c.email || '—'}</p>
                  </td>
                  <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(c.created_at)}</td>
                  <td>
                    {c.logo_url
                      ? <img src={c.logo_url} style={{ width:32, height:32, borderRadius:8, objectFit:'contain', background:'var(--bg)', padding:3 }} />
                      : <span style={{ fontSize:11, color:'var(--text-muted)' }}>Sin logo</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* USUARIOS */}
      {tab === 'users' && (
        <div className="card">
          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.6px', margin:'0 0 16px' }}>
            {users.length} usuarios registrados
          </p>
          <table className="table">
            <thead>
              <tr><th>Usuario</th><th>Ciudad</th><th>Email</th><th>Registrado</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'var(--purple-light)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <i className="ti ti-user" style={{ fontSize:16, color:'var(--purple)' }} />
                        }
                      </div>
                      <p style={{ fontWeight:700, margin:0 }}>{u.name || '—'}</p>
                    </div>
                  </td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{u.city || '—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-muted)' }}>{u.email || '—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CALIFICACIONES */}
      {tab === 'reviews' && (
        <div className="card">
          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.6px', margin:'0 0 16px' }}>
            {reviews.length} calificaciones · Promedio global: {stats.avgRating} ★
          </p>
          <table className="table">
            <thead>
              <tr><th>Clínica</th><th>Calificación</th><th>Comentario</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {reviews.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight:700 }}>{r.vet_clinics?.name || '—'}</td>
                  <td>
                    <div style={{ display:'flex', gap:2 }}>
                      {[1,2,3,4,5].map(s => (
                        <span key={s} style={{ fontSize:14, color: s <= r.rating ? '#F59E0B' : '#E5E7EB' }}>★</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{r.comment || '—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
