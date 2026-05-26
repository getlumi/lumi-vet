import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard({ clinic, session, onNavigate }) {
  const [stats, setStats]   = useState({ appointments:0, patients:0, todayIncome:0, pendingAppts:0 })
  const [today, setToday]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [clinic])

  const fetchAll = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0,10)
      const [apptRes, patRes, todayRes, pendingRes] = await Promise.all([
        supabase.from('vet_appointments').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
        supabase.from('vet_patients').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
        supabase.from('vet_appointments').select('*, pets(name,photo_url)').eq('clinic_id', clinic.id).eq('date', todayStr).order('time'),
        supabase.from('vet_appointments').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id).eq('status','pending'),
      ])
      setStats({ appointments: apptRes.count||0, patients: patRes.count||0, pendingAppts: pendingRes.count||0 })
      setToday(todayRes.data || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const todayStr = new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })

  const plan = clinic.plan || 'basic'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:'0 0 4px' }}>
          Buenos días 👋
        </p>
        <p style={{ fontSize:14, color:'var(--text-secondary)', margin:0, textTransform:'capitalize' }}>{todayStr}</p>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom:24 }}>
        {[
          { icon:'ti-calendar-check', label:'Citas hoy', value: today.length, color:'#EDE9FE', iconColor:'#6B21A8', action: () => onNavigate('appointments') },
          { icon:'ti-clock',          label:'Pendientes', value: stats.pendingAppts, color:'#FEF3C7', iconColor:'#D97706', action: () => onNavigate('appointments') },
          { icon:'ti-paw',            label:'Pacientes', value: stats.patients, color:'#DCFCE7', iconColor:'#16A34A', action: () => onNavigate('patients') },
          { icon:'ti-calendar',       label:'Total citas', value: stats.appointments, color:'#FCE7F3', iconColor:'#DB2777', action: () => onNavigate('appointments') },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor:'pointer' }} onClick={s.action}>
            <div className="stat-icon" style={{ background:s.color }}>
              <i className={`ti ${s.icon}`} style={{ color:s.iconColor }} />
            </div>
            <div>
              <p style={{ fontSize:24, fontWeight:900, color:'var(--text-primary)', margin:'0 0 2px' }}>{s.value}</p>
              <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0, fontWeight:600 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Citas de hoy */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <p style={{ fontSize:15, fontWeight:800, margin:0 }}>Citas de hoy</p>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('appointments')}>
              <i className="ti ti-plus" />Ver agenda
            </button>
          </div>
          {today.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)' }}>
              <i className="ti ti-calendar" style={{ fontSize:32, display:'block', marginBottom:8 }} />
              <p style={{ fontSize:13 }}>Sin citas para hoy</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {today.map(appt => (
                <div key={appt.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg)', borderRadius:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {appt.pets?.photo_url
                      ? <img src={appt.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:10 }} />
                      : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:16 }} />
                    }
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:13, fontWeight:700, margin:'0 0 2px' }}>{appt.pets?.name || 'Mascota'}</p>
                    <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>{appt.time?.slice(0,5)} · {appt.notes || 'Consulta'}</p>
                  </div>
                  <span className={`badge ${appt.status === 'confirmed' ? 'badge-green' : appt.status === 'completed' ? 'badge-purple' : 'badge-amber'}`}>
                    {appt.status === 'confirmed' ? 'Confirmada' : appt.status === 'completed' ? 'Completada' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accesos rápidos */}
        <div className="card">
          <p style={{ fontSize:15, fontWeight:800, margin:'0 0 16px' }}>Accesos rápidos</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { icon:'ti-calendar-plus', label:'Nueva cita', color:'#EDE9FE', iconColor:'#6B21A8', action:'appointments' },
              { icon:'ti-paw',           label:'Nuevo paciente', color:'#DCFCE7', iconColor:'#16A34A', action:'patients', plan:'pro' },
              { icon:'ti-package',       label:'Inventario', color:'#FEF3C7', iconColor:'#D97706', action:'inventory', plan:'pro' },
              { icon:'ti-chart-bar',     label:'Finanzas', color:'#FCE7F3', iconColor:'#DB2777', action:'finance', plan:'plus' },
            ].filter(a => !a.plan || plan === a.plan || (a.plan === 'pro' && plan === 'plus')).map(a => (
              <button key={a.label} onClick={() => onNavigate(a.action)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 12px', borderRadius:12, border:'1px solid var(--border)', background:a.color, cursor:'pointer', transition:'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
              >
                <i className={`ti ${a.icon}`} style={{ fontSize:22, color:a.iconColor }} />
                <span style={{ fontSize:12, fontWeight:700, color:'#374151', textAlign:'center' }}>{a.label}</span>
              </button>
            ))}
          </div>

          {/* Plan info */}
          <div style={{ marginTop:16, padding:'12px', background:'linear-gradient(135deg,#6B21A8,#C026D3)', borderRadius:12 }}>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.8)', margin:'0 0 4px', fontWeight:600 }}>
              Plan {plan === 'basic' ? 'Básico' : plan === 'pro' ? 'Pro ⭐' : 'Plus 💎'} activo
            </p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.6)', margin:0 }}>
              {plan === 'basic' ? '¿Necesitas más funciones? Actualiza a Pro' : plan === 'pro' ? 'Considera Plus para finanzas y IA' : 'Tienes acceso a todas las funciones'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
