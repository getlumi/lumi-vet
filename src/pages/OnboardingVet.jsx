import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const PLANS = [
  { id:'basic', name:'Básico', price:299, color:'#6B7280', features:['Perfil en mapa Lumi ✦','Actualizar carnets','Recibir citas','2 promociones activas','Estadísticas de perfil'] },
  { id:'pro',   name:'Pro ⭐', price:599, color:'#6B21A8', features:['Todo lo del Básico','Agenda y calendario','Historial de pacientes','Gestión de servicios','Inventario básico','Chat con clientes','Reportes semanales'], recommended:true },
  { id:'plus',  name:'Plus 💎', price:999, color:'#C026D3', features:['Todo lo del Pro','Finanzas completas','Inventario avanzado','Asistente IA','Reportes mensuales','Soporte prioritario'] },
]

// Geocodifica dirección usando Nominatim (OpenStreetMap) — gratis, sin API key
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
  const [step, setStep]         = useState(1)
  const [plan, setPlan]         = useState('pro')
  const [saving, setSaving]     = useState(false)
  const [geoStatus, setGeoStatus] = useState(null) // 'loading' | 'ok' | 'error'
  const [form, setForm]         = useState({
    name:'', address:'', city:'', state:'', phone:'', whatsapp:'',
    email: session?.user?.email || '',
  })

  const handleSave = async () => {
    if (!form.name || !form.city) return
    setSaving(true)
    setGeoStatus('loading')

    // Geocodificar dirección → lat/lng
    const { lat, lng } = await geocode(form.address, form.city, form.state)
    setGeoStatus(lat ? 'ok' : 'error')

    try {
      const { data, error } = await supabase.from('vet_clinics').insert({
        owner_id:  session.user.id,
        name:      form.name,
        address:   form.address,
        city:      form.city,
        state:     form.state   || null,
        phone:     form.phone   || null,
        whatsapp:  form.whatsapp|| null,
        email:     form.email   || null,
        plan,
        is_active: true,
        latitude:  lat,
        longitude: lng,
      }).select().single()

      if (error) throw error
      if (data) onComplete(data)
    } catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1A0A2E,#3B0764)', padding:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:24, width:'100%', maxWidth:680, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#6B21A8,#C026D3)', padding:'24px 32px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-paw" style={{ fontSize:22, color:'white' }} />
            </div>
            <div>
              <p style={{ fontSize:18, fontWeight:800, color:'white', margin:0 }}>Bienvenido a Lumi Vet</p>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)', margin:0 }}>
                Paso {step} de 2 — {step === 1 ? 'Elige tu plan' : 'Datos de tu clínica'}
              </p>
            </div>
          </div>
          {/* Barra de progreso */}
          <div style={{ marginTop:16, height:4, background:'rgba(255,255,255,0.2)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width: step === 1 ? '50%' : '100%', background:'white', borderRadius:2, transition:'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ padding:'28px 32px' }}>

          {/* ── PASO 1: Plan ── */}
          {step === 1 && (
            <>
              <p style={{ fontSize:16, fontWeight:700, color:'#1A0A2E', marginBottom:20 }}>
                Elige el plan que mejor se adapta a tu clínica
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
                {PLANS.map(p => (
                  <div key={p.id} onClick={() => setPlan(p.id)}
                    style={{ border:`2px solid ${plan===p.id?p.color:'#E5E7EB'}`, borderRadius:16, padding:18, cursor:'pointer', position:'relative', background:plan===p.id?`${p.color}10`:'white', transition:'all 0.15s' }}>
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
                Tu ubicación aparecerá en el mapa de Lumi App para que los dueños te encuentren fácilmente.
              </p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
                {/* Nombre — ancho completo */}
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Nombre de la clínica *</label>
                  <input className="input" value={form.name}
                    onChange={e => setForm(v=>({...v,name:e.target.value}))}
                    placeholder="Clínica Veterinaria Ejemplo..."
                    style={{ borderColor: form.name ? undefined : '#FCA5A5' }} />
                </div>

                {/* Dirección — ancho completo */}
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Dirección completa</label>
                  <input className="input" value={form.address}
                    onChange={e => setForm(v=>({...v,address:e.target.value}))}
                    placeholder="Av. Principal 123, Col. Centro" />
                  <p style={{ fontSize:11, color:'#6B7280', margin:'4px 0 0' }}>
                    📍 Usamos tu dirección para mostrarte en el mapa de Lumi App
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
              </div>

              {/* Status geocodificación */}
              {geoStatus === 'loading' && (
                <div style={{ background:'#EDE9FE', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#6B21A8', display:'flex', alignItems:'center', gap:8 }}>
                  <i className="ti ti-map-pin" style={{ fontSize:14 }} />
                  Buscando tu ubicación en el mapa...
                </div>
              )}
              {geoStatus === 'error' && (
                <div style={{ background:'#FEF3C7', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#92400E' }}>
                  <i className="ti ti-alert-triangle" style={{ marginRight:6 }} />
                  No pudimos ubicarte automáticamente. Puedes actualizar tu ubicación después desde Ajustes.
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex:1, justifyContent:'center' }}>
                  ← Volver
                </button>
                <button className="btn btn-primary" onClick={handleSave}
                  disabled={saving || !form.name || !form.city}
                  style={{ flex:2, justifyContent:'center', padding:'13px', opacity: (!form.name||!form.city) ? 0.5 : 1 }}>
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
