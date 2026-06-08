import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const PLANS = [
  { id:'basic', name:'Básico', price:299, color:'#6B7280', features:['Perfil en mapa Lumi ✦','Actualizar carnets','Recibir citas','2 promociones activas','Estadísticas de perfil'] },
  { id:'pro',   name:'Pro ⭐', price:599, color:'#6B21A8', features:['Todo lo del Básico','Agenda y calendario','Historial de pacientes','Gestión de servicios','Inventario básico','Chat con clientes','Reportes semanales'], recommended:true },
  { id:'plus',  name:'Plus 💎', price:999, color:'#C026D3', features:['Todo lo del Pro','Finanzas completas','Inventario avanzado','Asistente IA','Reportes mensuales','Soporte prioritario'] },
]

const DAYS = [
  { id:'mon', label:'Lun' },
  { id:'tue', label:'Mar' },
  { id:'wed', label:'Mié' },
  { id:'thu', label:'Jue' },
  { id:'fri', label:'Vie' },
  { id:'sat', label:'Sáb' },
  { id:'sun', label:'Dom' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0')
  return { value: `${h}:00`, label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM` }
})

const defaultSchedule = () =>
  DAYS.reduce((acc, d) => ({
    ...acc,
    [d.id]: { open: ['mon','tue','wed','thu','fri'].includes(d.id), from: '09:00', to: '18:00' }
  }), {})

const geocode = async (address, city, state) => {
  try {
    const query = [address, city, state, 'Mexico'].filter(Boolean).join(', ')
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
    const res  = await fetch(url, { headers: { 'Accept-Language': 'es', 'User-Agent': 'LumiVet/1.0' } })
    const data = await res.json()
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch (e) { console.error('Geocode error:', e) }
  return { lat: null, lng: null }
}

export default function OnboardingVet({ session, onComplete }) {
  const [step, setStep]           = useState(1)
  const [plan, setPlan]           = useState('pro')
  const [saving, setSaving]       = useState(false)
  const [geoStatus, setGeoStatus] = useState(null)
  const [schedule, setSchedule]   = useState(defaultSchedule())
  const [form, setForm]           = useState({
    name:'', address:'', city:'', state:'', phone:'', whatsapp:'',
    email: session?.user?.email || '', description:'',
  })

  const toggleDay = (dayId) =>
    setSchedule(s => ({ ...s, [dayId]: { ...s[dayId], open: !s[dayId].open } }))

  const setHour = (dayId, field, value) =>
    setSchedule(s => ({ ...s, [dayId]: { ...s[dayId], [field]: value } }))

  const applyToAll = (fromDay) => {
    const ref = schedule[fromDay]
    setSchedule(s => DAYS.reduce((acc, d) => ({
      ...acc,
      [d.id]: s[d.id].open ? { ...s[d.id], from: ref.from, to: ref.to } : s[d.id]
    }), { ...s }))
  }

  const handleSave = async () => {
    if (!form.name || !form.city) return
    setSaving(true)
    setGeoStatus('loading')

    const { lat, lng } = await geocode(form.address, form.city, form.state)
    setGeoStatus(lat ? 'ok' : 'error')

    // Convertir horarios a formato guardable
    const scheduleForDB = DAYS.reduce((acc, d) => {
      if (schedule[d.id].open) {
        acc[d.id] = { from: schedule[d.id].from, to: schedule[d.id].to }
      }
      return acc
    }, {})

    try {
      const { data, error } = await supabase.from('vet_clinics').insert({
        owner_id:    session.user.id,
        name:        form.name,
        address:     form.address,
        city:        form.city,
        state:       form.state    || null,
        phone:       form.phone    || null,
        whatsapp:    form.whatsapp || null,
        email:       form.email    || null,
        plan,
        is_active:   true,
        description: form.description || null,
        latitude:    lat,
        longitude:   lng,
        schedule:    scheduleForDB,
      }).select().single()

      if (error) throw error
      if (data) onComplete(data)
    } catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  const inp = {
    width:'100%', padding:'10px 12px', border:'1px solid #E5E7EB',
    borderRadius:10, fontSize:13, fontFamily:'inherit', outline:'none',
    color:'#374151', boxSizing:'border-box', background:'white',
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1A0A2E,#3B0764)', padding:'20px 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:24, width:'100%', maxWidth:680, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#6B21A8,#C026D3)', padding:'24px 28px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className="ti ti-paw" style={{ fontSize:22, color:'white' }} />
            </div>
            <div>
              <p style={{ fontSize:18, fontWeight:800, color:'white', margin:0 }}>Bienvenido a Lumi Vet</p>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)', margin:0 }}>
                Paso {step} de 3 — {step === 1 ? 'Elige tu plan' : step === 2 ? 'Datos de tu clínica' : 'Horarios de atención'}
              </p>
            </div>
          </div>
          <div style={{ marginTop:16, height:4, background:'rgba(255,255,255,0.2)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(step/3)*100}%`, background:'white', borderRadius:2, transition:'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* ── PASO 1: Plan ── */}
          {step === 1 && (
            <>
              <p style={{ fontSize:16, fontWeight:700, color:'#1A0A2E', marginBottom:20 }}>
                Elige el plan que mejor se adapta a tu clínica
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
                {PLANS.map(p => (
                  <div key={p.id} onClick={() => setPlan(p.id)}
                    style={{ border:`2px solid ${plan===p.id?p.color:'#E5E7EB'}`, borderRadius:16, padding:16, cursor:'pointer', position:'relative', background:plan===p.id?`${p.color}10`:'white', transition:'all 0.15s' }}>
                    {p.recommended && (
                      <span style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:p.color, color:'white', fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:20, whiteSpace:'nowrap' }}>
                        Recomendado
                      </span>
                    )}
                    <p style={{ fontSize:15, fontWeight:800, color:p.color, margin:'0 0 4px' }}>{p.name}</p>
                    <p style={{ fontSize:22, fontWeight:900, color:'#1A0A2E', margin:'0 0 12px' }}>
                      ${p.price}<span style={{ fontSize:12, fontWeight:500, color:'#6B7280' }}>/mes</span>
                    </p>
                    <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:6, padding:0, margin:0 }}>
                      {p.features.map(f => (
                        <li key={f} style={{ fontSize:11, color:'#374151', display:'flex', gap:5, alignItems:'flex-start' }}>
                          <i className="ti ti-check" style={{ color:'#22C55E', fontSize:12, marginTop:1, flexShrink:0 }} />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={() => setStep(2)}
                style={{ width:'100%', justifyContent:'center', padding:'13px' }}>
                Continuar con Plan {PLANS.find(p=>p.id===plan)?.name} →
              </button>
            </>
          )}

          {/* ── PASO 2: Datos ── */}
          {step === 2 && (
            <>
              <p style={{ fontSize:16, fontWeight:700, color:'#1A0A2E', marginBottom:6 }}>Datos de tu clínica</p>
              <p style={{ fontSize:12, color:'#6B7280', margin:'0 0 20px' }}>
                Tu ubicación aparecerá en el mapa de Lumi App para que los dueños te encuentren.
              </p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Nombre de la clínica *</label>
                  <input className="input" value={form.name}
                    onChange={e => setForm(v=>({...v,name:e.target.value}))}
                    placeholder="Clínica Veterinaria Ejemplo..."
                    style={{ borderColor: form.name ? undefined : '#FCA5A5' }} />
                </div>

                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Dirección completa *</label>
                  <input className="input" value={form.address}
                    onChange={e => setForm(v=>({...v,address:e.target.value}))}
                    placeholder="Av. Principal 123, Col. Centro"
                    style={{ borderColor: !form.address.trim() ? '#FCA5A5' : undefined }} />
                  <p style={{ fontSize:11, color:'#6B7280', margin:'4px 0 0' }}>
                    📍 Necesaria para aparecer en el directorio de Lumi App
                  </p>
                </div>

                <div>
                  <label className="label">Ciudad *</label>
                  <input className="input" value={form.city}
                    onChange={e => setForm(v=>({...v,city:e.target.value}))}
                    placeholder="Cancún"
                    style={{ borderColor: form.city ? undefined : '#FCA5A5' }} />
                </div>

                <div>
                  <label className="label">Estado</label>
                  <input className="input" value={form.state}
                    onChange={e => setForm(v=>({...v,state:e.target.value}))}
                    placeholder="Quintana Roo" />
                </div>

                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" type="tel" value={form.phone}
                    onChange={e => setForm(v=>({...v,phone:e.target.value}))}
                    placeholder="+52 998 123 4567" />
                </div>

                <div>
                  <label className="label">WhatsApp</label>
                  <input className="input" type="tel" value={form.whatsapp}
                    onChange={e => setForm(v=>({...v,whatsapp:e.target.value}))}
                    placeholder="+52 998 123 4567" />
                </div>

                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Email de contacto</label>
                  <input className="input" type="email" value={form.email}
                    onChange={e => setForm(v=>({...v,email:e.target.value}))}
                    placeholder="clinica@email.com" />
                </div>

                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Descripción de tu clínica</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(v=>({...v,description:e.target.value}))}
                    placeholder="Somos una clínica especializada en perros y gatos, con más de 10 años de experiencia..."
                    rows={3}
                    style={{ ...inp, resize:'vertical', lineHeight:1.5 }}
                  />
                  <p style={{ fontSize:11, color:'#6B7280', margin:'4px 0 0' }}>
                    Aparecerá en el directorio de Lumi App
                  </p>
                </div>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex:1, justifyContent:'center' }}>
                  ← Volver
                </button>
                <button className="btn btn-primary" onClick={() => setStep(3)}
                  disabled={!form.name || !form.city || !form.address}
                  style={{ flex:2, justifyContent:'center', padding:'13px', opacity:(!form.name||!form.city||!form.address)?0.5:1 }}>
                  Continuar → Horarios
                </button>
              </div>
            </>
          )}

          {/* ── PASO 3: Horarios ── */}
          {step === 3 && (
            <>
              <p style={{ fontSize:16, fontWeight:700, color:'#1A0A2E', marginBottom:4 }}>
                Horarios de atención
              </p>
              <p style={{ fontSize:12, color:'#6B7280', margin:'0 0 20px' }}>
                Tus clientes podrán ver cuándo estás disponible desde Lumi App.
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                {DAYS.map((d, idx) => (
                  <div key={d.id} style={{
                    display:'flex', alignItems:'center', gap:10,
                    background: schedule[d.id].open ? '#F5F3FF' : '#F9FAFB',
                    borderRadius:12, padding:'10px 14px',
                    border:`1px solid ${schedule[d.id].open ? '#DDD6FE' : '#E5E7EB'}`,
                    transition:'all 0.15s',
                  }}>
                    {/* Toggle día */}
                    <div onClick={() => toggleDay(d.id)}
                      style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', flexShrink:0, width:56 }}>
                      <div style={{
                        width:36, height:20, borderRadius:10, position:'relative', transition:'background 0.2s',
                        background: schedule[d.id].open ? '#7C3AED' : '#D1D5DB',
                      }}>
                        <div style={{
                          position:'absolute', top:2, left: schedule[d.id].open ? 18 : 2,
                          width:16, height:16, borderRadius:8, background:'white', transition:'left 0.2s',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color: schedule[d.id].open ? '#6B21A8' : '#9CA3AF', width:24 }}>
                        {d.label}
                      </span>
                    </div>

                    {/* Horarios */}
                    {schedule[d.id].open ? (
                      <>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
                          <select value={schedule[d.id].from} onChange={e => setHour(d.id,'from',e.target.value)}
                            style={{ ...inp, padding:'6px 8px', fontSize:12, cursor:'pointer', flex:1 }}>
                            {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                          </select>
                          <span style={{ fontSize:12, color:'#6B7280', flexShrink:0 }}>a</span>
                          <select value={schedule[d.id].to} onChange={e => setHour(d.id,'to',e.target.value)}
                            style={{ ...inp, padding:'6px 8px', fontSize:12, cursor:'pointer', flex:1 }}>
                            {HOURS.filter(h => h.value > schedule[d.id].from).map(h => (
                              <option key={h.value} value={h.value}>{h.label}</option>
                            ))}
                          </select>
                        </div>
                        {/* Botón copiar a todos */}
                        {idx === 0 && (
                          <button onClick={() => applyToAll(d.id)}
                            title="Aplicar a todos los días abiertos"
                            style={{ background:'none', border:'1px solid #DDD6FE', borderRadius:8, padding:'4px 8px', fontSize:10, color:'#7C3AED', cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                            Aplicar a todos
                          </button>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize:12, color:'#9CA3AF', fontStyle:'italic' }}>Cerrado</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Tip */}
              <div style={{ background:'#EDE9FE', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:12, color:'#5B21B6', display:'flex', alignItems:'flex-start', gap:8 }}>
                <i className="ti ti-bulb" style={{ fontSize:15, flexShrink:0, marginTop:1 }} />
                <span>Puedes modificar tus horarios en cualquier momento desde <strong>Ajustes</strong> en tu panel.</span>
              </div>

              {/* Status geocodificación */}
              {geoStatus === 'loading' && (
                <div style={{ background:'#EDE9FE', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#6B21A8', display:'flex', alignItems:'center', gap:8 }}>
                  <i className="ti ti-map-pin" style={{ fontSize:14 }} />
                  Guardando y buscando tu ubicación en el mapa...
                </div>
              )}
              {geoStatus === 'error' && (
                <div style={{ background:'#FEF3C7', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#92400E' }}>
                  <i className="ti ti-alert-triangle" style={{ marginRight:6 }} />
                  No pudimos ubicarte automáticamente. Puedes actualizar desde Ajustes.
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex:1, justifyContent:'center' }}>
                  ← Volver
                </button>
                <button className="btn btn-primary" onClick={handleSave}
                  disabled={saving}
                  style={{ flex:2, justifyContent:'center', padding:'13px' }}>
                  {saving ? 'Creando tu perfil...' : 'Entrar al panel ✓'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
