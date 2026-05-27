import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard({ clinic, session, onNavigate }) {
  const [stats, setStats]     = useState({ appointments:0, patients:0, pendingAppts:0 })
  const [today, setToday]     = useState([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel]     = useState(null)
  const [panelData, setPanelData] = useState([])
  const [panelLoading, setPanelLoading] = useState(false)

  useEffect(() => { fetchAll() }, [clinic])

  const fetchAll = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0,10)
      const [apptRes, lumiRes, regularRes, todayRes, pendingRes] = await Promise.all([
        supabase.from('vet_appointments').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
        supabase.from('vet_patients').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
        supabase.from('vet_regular_patients').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id),
        supabase.from('vet_appointments').select('*, pets(name,photo_url)').eq('clinic_id', clinic.id).eq('date', todayStr).order('time'),
        supabase.from('vet_appointments').select('*', { count:'exact', head:true }).eq('clinic_id', clinic.id).eq('status','pending'),
      ])
      setStats({
        appointments: apptRes.count || 0,
        patients:     (lumiRes.count || 0) + (regularRes.count || 0),
        pendingAppts: pendingRes.count || 0,
      })
      setToday(todayRes.data || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openPanel = async (type) => {
    setPanel(type)
    setPanelLoading(true)
    let query = supabase
      .from('vet_appointments')
      .select('*, pets(name,photo_url)')
      .eq('clinic_id', clinic.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    if (type === 'pending') query = query.eq('status', 'pending')
    const { data } = await query
    setPanelData(data || [])
    setPanelLoading(false)
  }

  const todayStr = new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })
  const plan = clinic.plan || 'basic'

  const statusLabel = (s) => s==='confirmed'?'Confirmada':s==='completed'?'Completada':'Pendiente'
  const statusClass = (s) => s==='confirmed'?'badge-green':s==='completed'?'badge-purple':'badge-amber'
  const isToday = (d) => d === new Date().toISOString().slice(0,10)
  const formatDate = (d) => {
    if (isToday(d)) return 'Hoy'
    return new Date(d+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'})
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:'0 0 4px' }}>Buenos días 👋</p>
        <p style={{ fontSize:14, color:'var(--text-secondary)', margin:0, textTransform:'capitalize' }}>{todayStr}</p>
      </div>

      <div className="grid-4" style={{ marginBottom:24 }}>
        {[
          { icon:'ti-calendar-check', label:'Citas hoy',   value: today.length,        color:'#EDE9FE', iconColor:'#6B21A8', action: () => onNavigate('appointments') },
          { icon:'ti-clock',          label:'Pendientes',  value: stats.pendingAppts,  color:'#FEF3C7', iconColor:'#D97706', action: () => openPanel('pending') },
          { icon:'ti-paw',            label:'Pacientes',   value: stats.patients,      color:'#DCFCE7', iconColor:'#16A34A', action: () => onNavigate('patients') },
          { icon:'ti-calendar',       label:'Total citas', value: stats.appointments,  color:'#FCE7F3', iconColor:'#DB2777', action: () => openPanel('all') },
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
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <p style={{ fontSize:15, fontWeight:800, margin:0 }}>Citas de hoy</p>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('appointments')}><i className="ti ti-plus" /> Ver agenda</button>
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
                    {appt.pets?.photo_url ? <img src={appt.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:10 }} /> : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:16 }} />}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:13, fontWeight:700, margin:'0 0 2px' }}>{appt.pets?.name || appt.pet_name || 'Mascota'}</p>
                    <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>{appt.time?.slice(0,5)} · {appt.notes || 'Consulta'}</p>
                  </div>
                  <span className={`badge ${statusClass(appt.status)}`}>{statusLabel(appt.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p style={{ fontSize:15, fontWeight:800, margin:'0 0 16px' }}>Accesos rápidos</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { icon:'ti-calendar-plus', label:'Nueva cita',     color:'#EDE9FE', iconColor:'#6B21A8', action:'appointments' },
              { icon:'ti-paw',           label:'Nuevo paciente', color:'#DCFCE7', iconColor:'#16A34A', action:'patients', plan:'pro' },
              { icon:'ti-package',       label:'Inventario',     color:'#FEF3C7', iconColor:'#D97706', action:'inventory', plan:'pro' },
              { icon:'ti-chart-bar',     label:'Finanzas',       color:'#FCE7F3', iconColor:'#DB2777', action:'finance',   plan:'plus' },
            ].filter(a => !a.plan || plan===a.plan || (a.plan==='pro' && plan==='plus')).map(a => (
              <button key={a.label} onClick={() => onNavigate(a.action, a.label==='Nuevo paciente'?'new':null)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 12px', borderRadius:12, border:'1px solid var(--border)', background:a.color, cursor:'pointer', transition:'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                <i className={`ti ${a.icon}`} style={{ fontSize:22, color:a.iconColor }} />
                <span style={{ fontSize:12, fontWeight:700, color:'#374151', textAlign:'center' }}>{a.label}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop:16, padding:'12px', background:'linear-gradient(135deg,#6B21A8,#C026D3)', borderRadius:12 }}>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.8)', margin:'0 0 4px', fontWeight:600 }}>
              Plan {plan==='basic'?'Básico':plan==='pro'?'Pro ⭐':'Plus 💎'} activo
            </p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.6)', margin:0 }}>
              {plan==='basic'?'¿Necesitas más funciones? Actualiza a Pro':plan==='pro'?'Considera Plus para finanzas y IA':'Tienes acceso a todas las funciones'}
            </p>
          </div>
        </div>
      </div>

      {/* Panel lateral citas */}
      {panel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', justifyContent:'flex-end' }}
          onClick={e => e.target===e.currentTarget && setPanel(null)}>
          <div style={{ width:420, background:'white', height:'100%', overflowY:'auto', padding:24, boxShadow:'-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p style={{ fontSize:17, fontWeight:800, margin:0 }}>{panel==='pending'?'⏳ Citas pendientes':'📅 Todas las citas'}</p>
              <button className="btn btn-icon" onClick={() => setPanel(null)}><i className="ti ti-x" /></button>
            </div>
            {panelLoading ? <p style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>Cargando...</p>
            : panelData.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                <i className="ti ti-calendar" style={{ fontSize:36, display:'block', marginBottom:8 }} />
                <p>Sin citas {panel==='pending'?'pendientes':'registradas'}</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {panelData.map(appt => (
                  <div key={appt.id} style={{ padding:'12px 14px', borderRadius:12, border:'1px solid var(--border)', background: isToday(appt.date)?'#EDE9FE':'white', borderLeft: isToday(appt.date)?'3px solid #6B21A8':'3px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {appt.pets?.photo_url ? <img src={appt.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} /> : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:14 }} />}
                        </div>
                        <div>
                          <p style={{ fontSize:14, fontWeight:700, margin:0 }}>{appt.pets?.name || appt.pet_name || 'Mascota'}</p>
                          {appt.owner_name && <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Dueño: {appt.owner_name}</p>}
                        </div>
                      </div>
                      <span className={`badge ${statusClass(appt.status)}`}>{statusLabel(appt.status)}</span>
                    </div>
                    <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--text-secondary)' }}>
                      <span><i className="ti ti-calendar" style={{ marginRight:4 }} />{formatDate(appt.date)}</span>
                      <span><i className="ti ti-clock" style={{ marginRight:4 }} />{appt.time?.slice(0,5)}</span>
                      {appt.notes && <span>· {appt.notes}</span>}
                    </div>
                    {appt.price && <p style={{ fontSize:12, fontWeight:700, color:'var(--purple)', margin:'6px 0 0' }}>${appt.price}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
