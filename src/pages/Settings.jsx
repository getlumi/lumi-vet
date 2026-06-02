import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const PLANS = [
  { id:'basic', name:'Básico',  price:299, color:'#6B7280' },
  { id:'pro',   name:'Pro ⭐',  price:599, color:'#6B21A8' },
  { id:'plus',  name:'Plus 💎', price:999, color:'#C026D3' },
]

export default function Settings({ clinic, session, onUpdate }) {
  const [form, setForm] = useState({
    name:        clinic.name        || '',
    address:     clinic.address     || '',
    city:        clinic.city        || '',
    phone:       clinic.phone       || '',
    whatsapp:    clinic.whatsapp    || '',
    email:       clinic.email       || '',
    description: clinic.description || '',
    nombre_vet:  clinic.nombre_vet  || '',
    cedula:      clinic.cedula      || '',
  })
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoUrl, setLogoUrl]         = useState(clinic.logo_url || null)

  // PIN de firma
  const [pinForm, setPinForm]         = useState({ pin:'', pinConfirm:'' })
  const [savingPin, setSavingPin]     = useState(false)
  const [savedPin, setSavedPin]       = useState(false)
  const [pinError, setPinError]       = useState('')
  const [showPin, setShowPin]         = useState(false)
  const hasPin = !!clinic.firma_pin

  const save = async () => {
    setSaving(true)
    const { data } = await supabase.from('vet_clinics').update(form).eq('id', clinic.id).select().single()
    if (data) { onUpdate(data); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  const savePin = async () => {
    setPinError('')
    if (pinForm.pin.length < 4) { setPinError('El PIN debe tener al menos 4 dígitos'); return }
    if (pinForm.pin !== pinForm.pinConfirm) { setPinError('Los PINs no coinciden'); return }
    setSavingPin(true)
    const { data } = await supabase.from('vet_clinics').update({ firma_pin: pinForm.pin }).eq('id', clinic.id).select().single()
    if (data) { onUpdate(data); setSavedPin(true); setPinForm({ pin:'', pinConfirm:'' }); setTimeout(() => setSavedPin(false), 3000) }
    setSavingPin(false)
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
          <div style={{ width:80, height:80, borderRadius:16, border:'2px dashed var(--border)', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width:'100%', height:'100%', objectFit:'contain', padding:4 }} />
                     : <i className="ti ti-building-hospital" style={{ fontSize:28, color:'var(--text-muted)' }} />}
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:'0 0 4px' }}>{logoUrl ? 'Logo actual' : 'Sin logo'}</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 12px' }}>PNG, JPG o SVG · Máximo 2MB · Recomendado 400×400px</p>
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

      {/* Datos del veterinario */}
      <div className="card" style={{ marginBottom:16, border:'1.5px solid rgba(107,33,237,0.2)', background:'rgba(107,33,237,0.02)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(107,33,237,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-certificate" style={{ fontSize:18, color:'#6B21A8' }} />
          </div>
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.8px', margin:0 }}>Datos del veterinario responsable</p>
            <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Requeridos para validez oficial en carnets y certificados de viaje</p>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label className="label">Nombre completo del veterinario responsable</label>
            <input className="input" placeholder="Dr. Juan Pérez González" value={form.nombre_vet} onChange={e => setForm(v=>({...v, nombre_vet:e.target.value}))} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label className="label">Cédula profesional</label>
            <input className="input" placeholder="Ej: 12345678" value={form.cedula} onChange={e => setForm(v=>({...v, cedula:e.target.value}))} />
            <p style={{ fontSize:11, color:'var(--text-muted)', margin:'6px 0 0' }}>
              <i className="ti ti-info-circle" style={{ fontSize:12, verticalAlign:'-2px', marginRight:4 }} />
              Registrada en la SEP. Aparecerá en los carnets y certificados generados por Lumi.
            </p>
          </div>
        </div>
        <div style={{ marginTop:16, display:'flex', gap:10, alignItems:'center' }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <i className="ti ti-device-floppy" style={{ fontSize:15 }} />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {saved && <span className="badge badge-green">✓ Guardado</span>}
        </div>
      </div>

      {/* PIN de firma digital */}
      <div className="card" style={{ marginBottom:16, border:'1.5px solid rgba(14,165,233,0.2)', background:'rgba(14,165,233,0.02)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(14,165,233,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-shield-check" style={{ fontSize:18, color:'#0EA5E9' }} />
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.8px', margin:0 }}>PIN de firma digital</p>
            <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Para autorizar certificados de salud con validez verificable</p>
          </div>
          {hasPin && (
            <span style={{ fontSize:11, fontWeight:700, background:'#DCFCE7', color:'#16A34A', borderRadius:10, padding:'3px 10px' }}>
              ✓ Configurado
            </span>
          )}
        </div>

        <div style={{ background:'rgba(14,165,233,0.06)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:12, color:'#0369A1', lineHeight:1.6 }}>
          <strong>¿Cómo funciona?</strong> Al emitir un certificado de salud, ingresarás este PIN para firmarlo digitalmente. El certificado incluirá un código QR verificable que cualquier aerolínea o autoridad puede escanear para confirmar su autenticidad.
        </div>

        {!showPin && (
          <button className="btn btn-secondary" onClick={() => setShowPin(true)} style={{ color:'#0EA5E9', borderColor:'#0EA5E9' }}>
            <i className="ti ti-pencil" style={{ fontSize:14 }} />
            {hasPin ? 'Cambiar PIN de firma' : 'Configurar PIN de firma'}
          </button>
        )}

        {showPin && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label className="label">PIN de firma (4-6 dígitos)</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••"
                value={pinForm.pin}
                onChange={e => setPinForm(f=>({...f, pin:e.target.value.replace(/\D/g,'')}))}
                style={{ letterSpacing:'4px', fontSize:18, textAlign:'center' }}
              />
            </div>
            <div>
              <label className="label">Confirmar PIN</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••"
                value={pinForm.pinConfirm}
                onChange={e => setPinForm(f=>({...f, pinConfirm:e.target.value.replace(/\D/g,'')}))}
                style={{ letterSpacing:'4px', fontSize:18, textAlign:'center' }}
              />
            </div>
            {pinError && <p style={{ fontSize:12, color:'var(--red)', margin:0 }}>{pinError}</p>}
            {savedPin && <p style={{ fontSize:12, color:'#16A34A', fontWeight:700, margin:0 }}>✓ PIN guardado correctamente</p>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary" onClick={() => { setShowPin(false); setPinForm({ pin:'', pinConfirm:'' }); setPinError('') }} style={{ flex:1, justifyContent:'center' }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={savePin} disabled={savingPin} style={{ flex:2, justifyContent:'center', background:'#0EA5E9', borderColor:'#0EA5E9' }}>
                <i className="ti ti-shield-check" style={{ fontSize:15 }} />
                {savingPin ? 'Guardando...' : 'Guardar PIN'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plan */}
      <div className="card">
        <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.8px', margin:'0 0 16px' }}>Plan actual</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {PLANS.map(p => (
            <div key={p.id} style={{ padding:16, borderRadius:14, border:`2px solid ${clinic.plan===p.id?p.color:'var(--border)'}`, background:clinic.plan===p.id?`${p.color}10`:'white', transition:'all 0.15s' }}>
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
