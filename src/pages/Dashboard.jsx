import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COMMON_VACCINES = [
  'Rabia', 'Parvovirus', 'Moquillo', 'Hepatitis',
  'Leptospirosis', 'Bordetella', 'Influenza canina',
  'Leishmaniasis', 'Coronavirus canino', 'Otra',
]

function StatusBadge({ status, nextDate }) {
  const today = new Date()
  const next = nextDate ? new Date(nextDate) : null
  const daysLeft = next ? Math.ceil((next - today) / (1000 * 60 * 60 * 24)) : null
  let bg, color, icon, label
  if (status === 'pending') {
    bg='#FEF3C7'; color='#D97706'; icon='ti-clock'; label='Pendiente'
  } else if (!next || daysLeft === null) {
    bg='#DCFCE7'; color='#16A34A'; icon='ti-check'; label='Aplicada'
  } else if (daysLeft < 0) {
    bg='#FEE2E2'; color='#DC2626'; icon='ti-alert-triangle'; label='Vencida'
  } else if (daysLeft <= 30) {
    bg='#FEF3C7'; color='#D97706'; icon='ti-alert-circle'; label=`Vence en ${daysLeft}d`
  } else {
    bg='#DCFCE7'; color='#16A34A'; icon='ti-check'; label='Al día'
  }
  return (
    <span style={{ background:bg, color, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}>
      <i className={`ti ${icon}`} style={{ fontSize:11 }} />{label}
    </span>
  )
}

export default function VaccinePage({ session, onNavigate }) {
  const [pet, setPet]           = useState(null)
  const [vaccines, setVaccines] = useState([])
  const [visits, setVisits]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [authCode, setAuthCode] = useState('')
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({
    name:'', applied_date:'', next_date:'', vet_name:'', vet_clinic:'',
    lot_number:'', notes:'', photo:null, photoPreview:null,
    registered_by:'unregistered_vet', status:'applied',
  })

  useEffect(() => { if (session?.user?.id) fetchAll() }, [session])

  const fetchAll = async () => {
    try {
      const { data: petData } = await supabase.from('pets').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (petData) {
        setPet(petData)
        const [vaxRes, visitRes] = await Promise.all([
          supabase.from('vaccines').select('*').eq('pet_id', petData.id).order('applied_date', { ascending: false }),
          supabase.from('vet_records').select('*, vet_clinics(name)').eq('pet_id', petData.id).order('created_at', { ascending: false }).limit(20),
        ])
        if (vaxRes.data) setVaccines(vaxRes.data)
        if (visitRes.data) setVisits(visitRes.data)
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const generateCode = async () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    const { error } = await supabase.from('vet_auth_codes').insert({
      pet_id: pet.id, owner_id: session.user.id, code,
      expires_at: new Date(Date.now() + 10*60*1000).toISOString()
    })
    if (error) { console.error('Error generando código:', error.message); return }
    setAuthCode(code); setShowCode(true)
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setForm(f => ({ ...f, photo:file, photoPreview:URL.createObjectURL(file) }))
  }

  const handleSave = async () => {
    if (!form.name || !form.applied_date) return
    setSaving(true)
    try {
      let photoUrl = null
      if (form.photo) {
        const path = `${session.user.id}/${Date.now()}`
        const { error: upErr } = await supabase.storage.from('vaccine-proofs').upload(path, form.photo)
        if (!upErr) {
          const { data } = supabase.storage.from('vaccine-proofs').getPublicUrl(path)
          photoUrl = data.publicUrl
        }
      }
      await supabase.from('vaccines').insert({
        pet_id: pet.id, name: form.name,
        applied_date: form.applied_date || null, next_date: form.next_date || null,
        vet_name: form.vet_name || null, vet_clinic: form.vet_clinic || null,
        lot_number: form.lot_number || null, notes: form.notes || null,
        photo_url: photoUrl, registered_by: form.registered_by, status: form.status,
      })
      await fetchAll()
      setShowAdd(false)
      setForm({ name:'', applied_date:'', next_date:'', vet_name:'', vet_clinic:'', lot_number:'', notes:'', photo:null, photoPreview:null, registered_by:'unregistered_vet', status:'applied' })
    } catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' })
  }

  const pending  = vaccines.filter(v => v.status === 'pending' || (v.next_date && new Date(v.next_date) < new Date()))
  const upToDate = vaccines.filter(v => v.status === 'applied' && (!v.next_date || new Date(v.next_date) >= new Date()))

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh' }}>
      <i className="ti ti-vaccine" style={{ fontSize:32, color:'var(--purple)', opacity:0.5 }} />
    </div>
  )

  return (
    <div style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg)' }}>
      <div className="page" style={{ background:'var(--bg)' }}>

        {/* Header */}
        <div style={{ background:'var(--gradient-dark)', padding:'16px 16px 24px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, background:'rgba(255,255,255,0.06)', borderRadius:'50%' }} />
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <button onClick={() => onNavigate('pet')} style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', fontSize:18 }}>
              <i className="ti ti-arrow-left" />
            </button>
            <div>
              <p style={{ fontSize:17, fontWeight:800, color:'white', margin:0 }}>Carnet de Vacunas</p>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.6)', margin:0 }}>{pet?.name} · {vaccines.length} registros</p>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[
              { label:'Total', value:vaccines.length, icon:'ti-vaccine', color:'#C4B5FD' },
              { label:'Al día', value:upToDate.length, icon:'ti-check-circle', color:'#86EFAC' },
              { label:'Pendientes', value:pending.length, icon:'ti-alert-circle', color:'#FDE68A' },
            ].map(s => (
              <div key={s.label} style={{ background:'rgba(255,255,255,0.12)', borderRadius:12, padding:'10px', border:'1px solid rgba(255,255,255,0.15)', textAlign:'center' }}>
                <i className={`ti ${s.icon}`} style={{ fontSize:18, color:s.color, display:'block', marginBottom:4 }} />
                <p style={{ fontSize:20, fontWeight:900, color:'white', margin:0 }}>{s.value}</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.6)', margin:0, fontWeight:600 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:'14px', paddingBottom:100, display:'flex', flexDirection:'column', gap:12 }}>

          {/* Botones acción */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <button onClick={() => setShowAdd(true)}
              style={{ padding:'12px', borderRadius:14, border:'1.5px solid var(--border)', background:'var(--white)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <i className="ti ti-user-plus" style={{ fontSize:22, color:'var(--purple)' }} />
              <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>Vet no registrado</span>
              <span style={{ fontSize:10, color:'var(--text-muted)', textAlign:'center' }}>Campaña o clínica sin Lumi</span>
            </button>
            <button onClick={generateCode}
              style={{ padding:'12px', borderRadius:14, border:'1.5px solid var(--purple)', background:'var(--purple-light)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <i className="ti ti-key" style={{ fontSize:22, color:'var(--purple)' }} />
              <span style={{ fontSize:12, fontWeight:700, color:'var(--purple)' }}>Autorizar veterinario</span>
              <span style={{ fontSize:10, color:'var(--purple)', opacity:0.7, textAlign:'center' }}>Código de 4 dígitos</span>
            </button>
          </div>

          {/* Código de autorización */}
          {showCode && (
            <div style={{ background:'var(--gradient-dark)', borderRadius:16, padding:'20px', textAlign:'center' }}>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.6)', margin:'0 0 8px', fontWeight:600, letterSpacing:1 }}>CÓDIGO PARA EL VETERINARIO</p>
              <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:12 }}>
                {authCode.split('').map((d, i) => (
                  <div key={i} style={{ width:52, height:64, background:'rgba(255,255,255,0.15)', borderRadius:12, border:'2px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:32, fontWeight:900, color:'white' }}>{d}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.6)', margin:'0 0 12px' }}>Válido por 10 minutos</p>
              <button onClick={() => setShowCode(false)} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, padding:'8px 20px', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Cerrar
              </button>
            </div>
          )}

          {/* Historial de visitas veterinarias */}
          {visits.length > 0 && (
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.7px', margin:'8px 0 12px' }}>
                Historial de visitas
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {visits.map(v => (
                  <div key={v.id} style={{ background:'var(--white)', borderRadius:14, border:'1px solid var(--border)', padding:'12px 14px', boxShadow:'var(--shadow-sm)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:32, height:32, borderRadius:9, background: v.type==='producto'?'#DCFCE7':v.type==='servicio'?'#FEF3C7':'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <i className={`ti ${v.type==='producto'?'ti-package':v.type==='servicio'?'ti-scissors':'ti-stethoscope'}`} style={{ fontSize:15, color: v.type==='producto'?'#16A34A':v.type==='servicio'?'#D97706':'var(--purple)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', margin:0 }}>
                            {v.type==='producto'?'Compra de productos':v.type==='servicio'?'Servicio':'Consulta médica'}
                          </p>
                          <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>
                            {v.vet_clinics?.name || 'Veterinaria Lumi'}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontSize:11, color:'var(--text-muted)', margin:'0 0 2px' }}>
                          {new Date(v.date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}
                        </p>
                        {v.price > 0 && <p style={{ fontSize:12, fontWeight:700, color:'var(--purple)', margin:0 }}>${v.price}</p>}
                      </div>
                    </div>
                    {v.description && <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'4px 0 0', lineHeight:1.4 }}>{v.description}</p>}
                    {v.diagnosis && <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'4px 0 0' }}><strong>Diagnóstico:</strong> {v.diagnosis}</p>}
                    {v.treatment && <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'2px 0 0' }}><strong>Tratamiento:</strong> {v.treatment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de vacunas */}
          {vaccines.length === 0 && visits.length === 0 ? (
            <div style={{ background:'var(--white)', borderRadius:16, border:'1px solid var(--border)', padding:'32px 16px', textAlign:'center' }}>
              <div style={{ width:60, height:60, borderRadius:18, background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <i className="ti ti-vaccine" style={{ fontSize:28, color:'var(--purple)' }} />
              </div>
              <p style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:'0 0 6px' }}>Sin registros aún</p>
              <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0, lineHeight:1.5 }}>
                Agrega las vacunas de {pet?.name} para tener su carnet completo
              </p>
            </div>
          ) : vaccines.length > 0 && (
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.7px', margin:'8px 0 12px' }}>
                Vacunas
              </p>
              {vaccines.map(vax => (
                <div key={vax.id} style={{ background:'var(--white)', borderRadius:14, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow-sm)', marginBottom:8 }}>
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', margin:'0 0 4px' }}>{vax.name}</p>
                        <StatusBadge status={vax.status} nextDate={vax.next_date || vax.expiry_date} />
                      </div>
                      {vax.photo_url && (
                        <img src={vax.photo_url} alt="comprobante" style={{ width:48, height:48, borderRadius:10, objectFit:'cover', marginLeft:10, border:'1px solid var(--border)' }} />
                      )}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }}>
                      {vax.applied_date && (
                        <div style={{ background:'var(--bg)', borderRadius:8, padding:'8px 10px' }}>
                          <p style={{ fontSize:10, color:'var(--text-muted)', margin:'0 0 2px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Aplicada</p>
                          <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{formatDate(vax.applied_date)}</p>
                        </div>
                      )}
                      {(vax.next_date || vax.expiry_date) && (
                        <div style={{ background: new Date(vax.next_date || vax.expiry_date) < new Date() ? '#FEF3C7' : 'var(--bg)', borderRadius:8, padding:'8px 10px' }}>
                          <p style={{ fontSize:10, color:'var(--text-muted)', margin:'0 0 2px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Próxima dosis</p>
                          <p style={{ fontSize:13, fontWeight:700, color: new Date(vax.next_date || vax.expiry_date) < new Date() ? '#D97706' : 'var(--text-primary)', margin:0 }}>{formatDate(vax.next_date || vax.expiry_date)}</p>
                        </div>
                      )}
                    </div>
                    {(vax.vet_name || vax.vet_clinic) && (
                      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:6 }}>
                        <i className="ti ti-stethoscope" style={{ fontSize:13, color:'var(--text-muted)' }} />
                        <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0, fontWeight:500 }}>
                          {[vax.vet_name, vax.vet_clinic].filter(Boolean).join(' — ')}
                        </p>
                        {vax.registered_by === 'unregistered_vet' && (
                          <span style={{ background:'#FEF3C7', color:'#D97706', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>No registrado</span>
                        )}
                        {vax.registered_by === 'vet' && (
                          <span style={{ background:'#DCFCE7', color:'#16A34A', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>Verificado</span>
                        )}
                      </div>
                    )}
                    {vax.notes && <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'6px 0 0', lineHeight:1.5 }}>{vax.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal agregar vacuna */}
      {showAdd && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false) }}
          style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(26,10,46,0.7)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ width:'100%', background:'var(--bg)', borderRadius:'24px 24px 0 0', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
              <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2 }} />
            </div>
            <div style={{ padding:'4px 16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
              <p style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Registrar vacuna</p>
              <button onClick={() => setShowAdd(false)} style={{ width:32, height:32, borderRadius:'50%', background:'var(--purple-light)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--purple)', fontSize:18 }}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div style={{ overflowY:'auto', flex:1, padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 8px' }}>Vacuna *</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                  {COMMON_VACCINES.map(v => (
                    <button key={v} onClick={() => setForm(f => ({ ...f, name: v === 'Otra' ? '' : v }))}
                      style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${form.name === v ? 'var(--purple)' : 'var(--border)'}`, background: form.name === v ? 'var(--purple-light)' : 'var(--white)', color: form.name === v ? 'var(--purple)' : 'var(--text-secondary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {v}
                    </button>
                  ))}
                </div>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="O escribe el nombre..."
                  style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:14, color:'var(--text-primary)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 8px' }}>Estado</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[{ val:'applied', label:'Aplicada' }, { val:'pending', label:'Pendiente' }].map(s => (
                    <button key={s.val} onClick={() => setForm(f => ({ ...f, status:s.val }))}
                      style={{ padding:'10px', borderRadius:10, border:`1.5px solid ${form.status === s.val ? 'var(--purple)' : 'var(--border)'}`, background: form.status === s.val ? 'var(--purple-light)' : 'var(--white)', color: form.status === s.val ? 'var(--purple)' : 'var(--text-secondary)', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 6px' }}>Fecha aplicación *</p>
                  <input type="date" value={form.applied_date} onChange={e => setForm(f => ({ ...f, applied_date:e.target.value }))}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 6px' }}>Próxima dosis</p>
                  <input type="date" value={form.next_date} onChange={e => setForm(f => ({ ...f, next_date:e.target.value }))}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 6px' }}>Veterinario</p>
                  <input value={form.vet_name} onChange={e => setForm(f => ({ ...f, vet_name:e.target.value }))} placeholder="Dr. García"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 6px' }}>Clínica</p>
                  <input value={form.vet_clinic} onChange={e => setForm(f => ({ ...f, vet_clinic:e.target.value }))} placeholder="VetCare Cancún"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} placeholder="Notas adicionales (opcional)"
                rows={2} style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:14, fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box' }} />
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 8px' }}>Foto del comprobante</p>
                <div onClick={() => document.getElementById('vaccine-photo').click()}
                  style={{ border:'2px dashed var(--border)', borderRadius:12, padding:'16px', textAlign:'center', cursor:'pointer', background: form.photoPreview ? 'transparent' : 'var(--bg)', overflow:'hidden' }}>
                  {form.photoPreview
                    ? <img src={form.photoPreview} alt="comprobante" style={{ width:'100%', maxHeight:120, objectFit:'cover', borderRadius:8 }} />
                    : <div>
                        <i className="ti ti-camera" style={{ fontSize:24, color:'var(--text-muted)', display:'block', marginBottom:4 }} />
                        <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>Toca para subir foto</p>
                      </div>
                  }
                </div>
                <input id="vaccine-photo" type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoChange} />
              </div>
              <div style={{ display:'flex', gap:10, paddingBottom:16 }}>
                <button onClick={() => setShowAdd(false)}
                  style={{ flex:1, padding:'13px', borderRadius:12, border:'1px solid var(--border)', background:'var(--bg)', fontSize:14, fontWeight:700, cursor:'pointer', color:'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !form.name || !form.applied_date}
                  style={{ flex:2, padding:'13px', borderRadius:12, border:'none', background: (!form.name || !form.applied_date) ? 'var(--border)' : 'var(--gradient)', color:'white', fontSize:14, fontWeight:700, cursor: (!form.name || !form.applied_date) ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <i className="ti ti-device-floppy" style={{ fontSize:16 }} />
                  {saving ? 'Guardando...' : 'Guardar vacuna'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
