import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const PLANS = [
  { id:'basic', name:'Básico', price:299, color:'#6B7280' },
  { id:'pro',   name:'Pro ⭐', price:599, color:'#6B21A8' },
  { id:'plus',  name:'Plus 💎', price:999, color:'#C026D3' },
]

export default function Settings({ clinic, session, onUpdate }) {
  const [form, setForm]   = useState({ name:clinic.name||'', address:clinic.address||'', city:clinic.city||'', phone:clinic.phone||'', whatsapp:clinic.whatsapp||'', email:clinic.email||'', description:clinic.description||'' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const save = async () => {
    setSaving(true)
    const { data } = await supabase.from('vet_clinics').update(form).eq('id', clinic.id).select().single()
    if (data) { onUpdate(data); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth:720 }}>
      <p style={{ fontSize:20, fontWeight:800, margin:'0 0 24px' }}>Ajustes de la clínica</p>

      <div className="card" style={{ marginBottom:20 }}>
        <p style={{ fontSize:15, fontWeight:800, margin:'0 0 16px' }}>Información general</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {[
            { key:'name',        label:'Nombre de la clínica *', col:'1/-1' },
            { key:'description', label:'Descripción',             col:'1/-1', textarea:true },
            { key:'address',     label:'Dirección' },
            { key:'city',        label:'Ciudad' },
            { key:'phone',       label:'Teléfono' },
            { key:'whatsapp',    label:'WhatsApp' },
            { key:'email',       label:'Email de contacto' },
          ].map(f => (
            <div key={f.key} style={{ gridColumn: f.col||'auto' }}>
              <label className="label">{f.label}</label>
              {f.textarea
                ? <textarea className="input" rows={2} value={form[f.key]} onChange={e => setForm(v=>({...v,[f.key]:e.target.value}))} style={{ resize:'vertical' }} />
                : <input className="input" value={form[f.key]} onChange={e => setForm(v=>({...v,[f.key]:e.target.value}))} />
              }
            </div>
          ))}
        </div>
        <div style={{ marginTop:16, display:'flex', gap:10, alignItems:'center' }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          {saved && <span className="badge badge-green">✓ Guardado</span>}
        </div>
      </div>

      {/* Plan actual */}
      <div className="card">
        <p style={{ fontSize:15, fontWeight:800, margin:'0 0 16px' }}>Plan actual</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {PLANS.map(p => (
            <div key={p.id} style={{ padding:16, borderRadius:14, border:`2px solid ${clinic.plan === p.id ? p.color : 'var(--border)'}`, background: clinic.plan === p.id ? `${p.color}12` : 'white' }}>
              <p style={{ fontSize:14, fontWeight:800, color:p.color, margin:'0 0 4px' }}>{p.name}</p>
              <p style={{ fontSize:20, fontWeight:900, margin:'0 0 8px' }}>${p.price}<span style={{ fontSize:11, fontWeight:500, color:'var(--text-muted)' }}>/mes</span></p>
              {clinic.plan === p.id
                ? <span className="badge badge-green">Plan activo</span>
                : <button className="btn btn-secondary btn-sm" onClick={() => alert('Contacta a Lumi para cambiar tu plan: hola@getlumi.mx')}>Cambiar</button>
              }
            </div>
          ))}
        </div>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:12 }}>Para cambiar de plan escríbenos a <strong>hola@getlumi.mx</strong></p>
      </div>
    </div>
  )
}
