import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const PLANS = [
  { id:'basic', name:'Básico', price:299, color:'#6B7280', features:['Perfil en mapa Lumi ✦','Actualizar carnets','Recibir citas','2 promociones activas','Estadísticas de perfil'] },
  { id:'pro',   name:'Pro ⭐', price:599, color:'#6B21A8', features:['Todo lo del Básico','Agenda y calendario','Historial de pacientes','Gestión de servicios','Inventario básico','Chat con clientes','Reportes semanales'], recommended:true },
  { id:'plus',  name:'Plus 💎', price:999, color:'#C026D3', features:['Todo lo del Pro','Finanzas completas','Inventario avanzado','Asistente IA','Reportes mensuales','Soporte prioritario'] },
]

export default function OnboardingVet({ session, onComplete }) {
  const [step, setStep]     = useState(1)
  const [plan, setPlan]     = useState('pro')
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({
    name:'', address:'', city:'', phone:'', whatsapp:'', email: session?.user?.email || '',
  })

  const handleSave = async () => {
    if (!form.name || !form.city) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('vet_clinics').insert({
        owner_id: session.user.id,
        name:     form.name,
        address:  form.address,
        city:     form.city,
        phone:    form.phone,
        whatsapp: form.whatsapp,
        email:    form.email,
        plan,
        is_active: true,
      }).select().single()

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
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)', margin:0 }}>Paso {step} de 2 — {step === 1 ? 'Elige tu plan' : 'Datos de tu clínica'}</p>
            </div>
          </div>
        </div>

        <div style={{ padding:'28px 32px' }}>
          {step === 1 ? (
            <>
              <p style={{ fontSize:16, fontWeight:700, color:'#1A0A2E', marginBottom:20 }}>Elige el plan que mejor se adapta a tu clínica</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
                {PLANS.map(p => (
                  <div key={p.id} onClick={() => setPlan(p.id)} style={{ border:`2px solid ${plan === p.id ? p.color : '#E5E7EB'}`, borderRadius:16, padding:18, cursor:'pointer', position:'relative', background: plan === p.id ? `${p.color}10` : 'white', transition:'all 0.15s' }}>
                    {p.recommended && <span style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:p.color, color:'white', fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:20 }}>Recomendado</span>}
                    <p style={{ fontSize:15, fontWeight:800, color:p.color, margin:'0 0 4px' }}>{p.name}</p>
                    <p style={{ fontSize:22, fontWeight:900, color:'#1A0A2E', margin:'0 0 12px' }}>${p.price}<span style={{ fontSize:12, fontWeight:500, color:'#6B7280' }}>/mes</span></p>
                    <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
                      {p.features.map(f => (
                        <li key={f} style={{ fontSize:11, color:'#374151', display:'flex', gap:5, alignItems:'flex-start' }}>
                          <i className="ti ti-check" style={{ color:'#22C55E', fontSize:12, marginTop:1, flexShrink:0 }} />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={() => setStep(2)} style={{ width:'100%', justifyContent:'center', padding:'13px' }}>
                Continuar con Plan {PLANS.find(p=>p.id===plan)?.name} →
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize:16, fontWeight:700, color:'#1A0A2E', marginBottom:20 }}>Datos de tu clínica</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
                {[
                  { key:'name',     label:'Nombre de la clínica *', placeholder:'Clínica Veterinaria...', col:'1/-1' },
                  { key:'address',  label:'Dirección',               placeholder:'Av. Principal 123' },
                  { key:'city',     label:'Ciudad *',                 placeholder:'Cancún' },
                  { key:'phone',    label:'Teléfono',                 placeholder:'+52 998...' },
                  { key:'whatsapp', label:'WhatsApp',                 placeholder:'+52 998...' },
                  { key:'email',    label:'Email de contacto',        placeholder:'clinica@email.com' },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: f.col || 'auto' }}>
                    <label className="label">{f.label}</label>
                    <input className="input" value={form[f.key]} onChange={e => setForm(v => ({...v, [f.key]: e.target.value}))} placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex:1, justifyContent:'center' }}>← Volver</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.city} style={{ flex:2, justifyContent:'center', padding:'13px' }}>
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
