import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const PLANS = [
  { id:'basic', name:'Básico',  price:299, color:'#6B7280' },
  { id:'pro',   name:'Pro ⭐',  price:599, color:'#6B21A8' },
  { id:'plus',  name:'Plus 💎', price:999, color:'#C026D3' },
]

export default function Settings({ clinic, session, onUpdate }) {
  const [form, setForm]         = useState({ name:clinic.name||'', address:clinic.address||'', city:clinic.city||'', phone:clinic.phone||'', whatsapp:clinic.whatsapp||'', email:clinic.email||'', description:clinic.description||'' })
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoUrl, setLogoUrl]   = useState(clinic.logo_url || null)

  const save = async () => {
    setSaving(true)
    const { data } = await supabase.from('vet_clinics').update(form).eq('id', clinic.id).select().single()
    if (data) { onUpdate(data); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('El logo debe pesar menos de 2MB'); return }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      alert('Solo se aceptan PNG, JPG, WebP o SVG'); return
    }
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `logos/${clinic.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const newUrl = urlData.publicUrl + '?t=' + Date.now()
      const { data } = await supabase.from('vet_clinics').update({ logo_url: urlData.publicUrl }).eq('id', clinic.id).select().single()
      if (data) { onUpdate(data); setLogoUrl(newUrl) }
    } catch(e) { console.error(e); alert('Error al subir el logo') }
    finally { setUploadingLogo(false) }
  }

  return (
    <div style={{ maxWidth:720, padding:'28px 32px' }}>
      <div style={{ marginBottom:28, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
        <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 6px' }}>Configuración</p>
        <p style={{ fontSize:28, fontWeight:800, color:'var(--text-primary)', margin:0, letterSpacing:'-0.5px' }}>Ajustes de la clínica</p>
      </div>

      {/* Logo */}
      <div className="card" style={{ marginBottom:16 }}>
        <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 16px' }}>Logo de la clínica</p>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          {/* Preview */}
          <div style={{ width:80, height:80, borderRadius:16, border:'2px dashed var(--border)', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ width:'100%', height:'100%', objectFit:'contain', padding:4 }} />
              : <i className="ti ti-building-hospital" style={{ fontSize:28, color:'var(--text-muted)' }} />
            }
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:'0 0 4px' }}>
              {logoUrl ? 'Logo actual' : 'Sin logo'}
            </p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 12px' }}>
              PNG, JPG o SVG · Máximo 2MB · Recomendado 400×400px
            </p>
            <input id="logo-upload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display:'none' }} onChange={handleLogoUpload} />
            <button className="btn btn-secondary btn-sm" onClick={() => document.getElementById('logo-upload').click()} disabled={uploadingLogo}>
              <i className="ti ti-upload" style={{ fontSize:14 }} />
              {uploadingLogo ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </button>
          </div>
        </div>
      </div>

      {/* Info general */}
      <div className="card" style={{ marginBottom:16 }}>
        <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 16px' }}>Información general</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {[
            { key:'name',        label:'Nombre de la clínica *', col:'1/-1' },
            { key:'description', label:'Descripción',             col:'1/-1', textarea:true },
            { key:'address',     label:'Dirección',               col:'1/-1' },
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
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <i className="ti ti-device-floppy" style={{ fontSize:15 }} />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {saved && <span className="badge badge-green">✓ Guardado</span>}
        </div>
      </div>

      {/* Plan */}
      <div className="card">
        <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 16px' }}>Plan actual</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {PLANS.map(p => (
            <div key={p.id} style={{ padding:16, borderRadius:14, border:`2px solid ${clinic.plan===p.id?p.color:'var(--border)'}`, background: clinic.plan===p.id?`${p.color}10`:'white', transition:'all 0.15s' }}>
              <p style={{ fontSize:14, fontWeight:800, color:p.color, margin:'0 0 4px' }}>{p.name}</p>
              <p style={{ fontSize:22, fontWeight:900, margin:'0 0 10px', letterSpacing:'-0.5px' }}>
                ${p.price}<span style={{ fontSize:11, fontWeight:500, color:'var(--text-muted)' }}>/mes</span>
              </p>
              {clinic.plan===p.id
                ? <span className="badge badge-green">Plan activo</span>
                : <button className="btn btn-secondary btn-sm" onClick={() => alert('Contacta a Lumi para cambiar tu plan: hola@getlumi.mx')}>Cambiar</button>
              }
            </div>
          ))}
        </div>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:12 }}>
          Para cambiar de plan escríbenos a <strong>hola@getlumi.mx</strong>
        </p>
      </div>
    </div>
  )
}
