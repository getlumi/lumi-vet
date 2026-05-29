import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATS = ['consulta','cirugía','vacuna','grooming','baño','laboratorio','otro']

export default function Services({ clinic }) {
  const [services, setServices] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [saving, setSaving]       = useState(false)

  const emptyForm = {
    name:'', description:'', price:'', duration:'30', category:'consulta',
    is_bath_service: false,
    price_small:'', price_medium:'', price_large:'',
    small_max_kg:'10', medium_max_kg:'20', large_max_kg:'40',
    extra_1_name:'', extra_1_price:'',
    extra_2_name:'', extra_2_price:'',
    extra_3_name:'', extra_3_price:'',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { fetchServices() }, [])

  const fetchServices = async () => {
    const { data } = await supabase.from('vet_services').select('*').eq('clinic_id', clinic.id).order('category')
    setServices(data || [])
  }

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (s) => {
    setEditItem(s)
    setForm({
      name:           s.name        || '',
      description:    s.description || '',
      price:          String(s.price    ?? ''),
      duration:       String(s.duration ?? '30'),
      category:       s.category    || 'consulta',
      is_bath_service: s.is_bath_service || false,
      price_small:    String(s.price_small  ?? ''),
      price_medium:   String(s.price_medium ?? ''),
      price_large:    String(s.price_large  ?? ''),
      small_max_kg:   String(s.small_max_kg  ?? '10'),
      medium_max_kg:  String(s.medium_max_kg ?? '20'),
      large_max_kg:   String(s.large_max_kg  ?? '40'),
      extra_1_name:   s.extra_1_name  || '',
      extra_1_price:  String(s.extra_1_price ?? ''),
      extra_2_name:   s.extra_2_name  || '',
      extra_2_price:  String(s.extra_2_price ?? ''),
      extra_3_name:   s.extra_3_name  || '',
      extra_3_price:  String(s.extra_3_price ?? ''),
    })
    setShowModal(true)
  }

  const saveService = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const isBath = form.is_bath_service
    const payload = {
      clinic_id:      clinic.id,
      name:           form.name.trim(),
      description:    form.description.trim() || null,
      price:          !isBath && form.price ? parseFloat(form.price) : null,
      duration:       parseInt(form.duration) || 30,
      category:       form.category,
      is_bath_service: isBath,
      price_small:    isBath && form.price_small  ? parseFloat(form.price_small)  : null,
      price_medium:   isBath && form.price_medium ? parseFloat(form.price_medium) : null,
      price_large:    isBath && form.price_large  ? parseFloat(form.price_large)  : null,
      small_max_kg:   isBath ? parseFloat(form.small_max_kg)  || 10 : null,
      medium_max_kg:  isBath ? parseFloat(form.medium_max_kg) || 20 : null,
      large_max_kg:   isBath ? parseFloat(form.large_max_kg)  || 40 : null,
      extra_1_name:   isBath ? form.extra_1_name.trim()  || null : null,
      extra_1_price:  isBath && form.extra_1_price ? parseFloat(form.extra_1_price) : null,
      extra_2_name:   isBath ? form.extra_2_name.trim()  || null : null,
      extra_2_price:  isBath && form.extra_2_price ? parseFloat(form.extra_2_price) : null,
      extra_3_name:   isBath ? form.extra_3_name.trim()  || null : null,
      extra_3_price:  isBath && form.extra_3_price ? parseFloat(form.extra_3_price) : null,
    }
    if (editItem) {
      await supabase.from('vet_services').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('vet_services').insert({ ...payload, is_active: true })
    }
    setSaving(false)
    fetchServices(); setShowModal(false)
  }

  const toggleActive = async (id, val) => {
    await supabase.from('vet_services').update({ is_active: !val }).eq('id', id)
    fetchServices()
  }

  const deleteService = async (id) => {
    if (!confirm('¿Eliminar este servicio?')) return
    await supabase.from('vet_services').delete().eq('id', id)
    fetchServices()
  }

  const isBathForm = form.is_bath_service

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 4px' }}>Catálogo</p>
          <p style={{ fontSize:24, fontWeight:700, color:'var(--purple-dark)', margin:0, letterSpacing:'-0.3px' }}>Servicios</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus" /> Agregar servicio</button>
      </div>

      <div className="card">
        {services.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <i className="ti ti-stethoscope" style={{ fontSize:40, color:'var(--text-muted)', display:'block', marginBottom:12 }} />
            <p style={{ fontWeight:700, marginBottom:8 }}>Sin servicios registrados</p>
            <button className="btn btn-primary" onClick={openAdd}>+ Agregar primero</button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Servicio</th><th>Categoría</th><th>Duración</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td>
                    <p style={{ fontWeight:700, margin:'0 0 2px' }}>{s.name}</p>
                    <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>
                      {s.is_bath_service
                        ? `🛁 Chico $${s.price_small||'—'} · Mediano $${s.price_medium||'—'} · Grande $${s.price_large||'—'}`
                        : s.description}
                    </p>
                  </td>
                  <td>
                    <span className="badge badge-purple" style={{ textTransform:'capitalize' }}>{s.category}</span>
                    {s.is_bath_service && <span className="badge badge-amber" style={{ marginLeft:4 }}>Baño</span>}
                  </td>
                  <td style={{ color:'var(--text-secondary)' }}>{s.duration} min</td>
                  <td style={{ fontWeight:700 }}>
                    {s.is_bath_service ? `$${s.price_small||0}–$${s.price_large||0}` : s.price ? `$${s.price}` : '—'}
                  </td>
                  <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>{s.is_active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(s)}><i className="ti ti-pencil" /></button>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(s.id, s.is_active)}>{s.is_active ? 'Desactivar' : 'Activar'}</button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteService(s.id)}><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth:560, maxHeight:'90vh', overflowY:'auto' }}>
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>{editItem ? 'Editar' : 'Nuevo'} servicio</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Baño completo, Consulta general..." />
              </div>
              <div>
                <label className="label">Descripción</label>
                <input className="input" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Incluye..." />
              </div>
              <div className="grid-2">
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {CATS.map(c => <option key={c} value={c} style={{ textTransform:'capitalize' }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Duración (min)</label>
                  <input className="input" type="number" value={form.duration} onChange={e => setForm(f=>({...f,duration:e.target.value}))} />
                </div>
              </div>

              {/* Toggle baño */}
              <div style={{ background:'var(--purple-lighter)', borderRadius:12, padding:14 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.is_bath_service}
                    onChange={e => setForm(f=>({...f,is_bath_service:e.target.checked}))}
                    style={{ width:18, height:18, accentColor:'var(--purple)' }} />
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:'var(--purple)', margin:0 }}>🛁 Este es un servicio de baño</p>
                    <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>Activa precios por talla y extras personalizables</p>
                  </div>
                </label>
              </div>

              {/* Precio simple (no baño) */}
              {!isBathForm && (
                <div>
                  <label className="label">Precio</label>
                  <input className="input" type="number" value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder="350.00" />
                </div>
              )}

              {/* Panel de baño */}
              {isBathForm && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {/* Rangos */}
                  <div style={{ background:'var(--bg)', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 10px' }}>Rangos de talla por peso</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      <div>
                        <label className="label">Chico hasta (kg)</label>
                        <input className="input" type="number" value={form.small_max_kg} onChange={e => setForm(f=>({...f,small_max_kg:e.target.value}))} placeholder="10" />
                      </div>
                      <div>
                        <label className="label">Mediano hasta (kg)</label>
                        <input className="input" type="number" value={form.medium_max_kg} onChange={e => setForm(f=>({...f,medium_max_kg:e.target.value}))} placeholder="20" />
                      </div>
                      <div>
                        <label className="label">Grande hasta (kg)</label>
                        <input className="input" type="number" value={form.large_max_kg} onChange={e => setForm(f=>({...f,large_max_kg:e.target.value}))} placeholder="40" />
                      </div>
                    </div>
                  </div>
                  {/* Precios */}
                  <div style={{ background:'var(--bg)', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 10px' }}>Precios por talla</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      <div>
                        <label className="label">🐕 Chico</label>
                        <input className="input" type="number" value={form.price_small} onChange={e => setForm(f=>({...f,price_small:e.target.value}))} placeholder="150" />
                      </div>
                      <div>
                        <label className="label">🐕 Mediano</label>
                        <input className="input" type="number" value={form.price_medium} onChange={e => setForm(f=>({...f,price_medium:e.target.value}))} placeholder="200" />
                      </div>
                      <div>
                        <label className="label">🐕 Grande</label>
                        <input className="input" type="number" value={form.price_large} onChange={e => setForm(f=>({...f,price_large:e.target.value}))} placeholder="250" />
                      </div>
                    </div>
                  </div>
                  {/* Extras */}
                  <div style={{ background:'var(--bg)', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 10px' }}>Extras (opcional)</p>
                    {[1,2,3].map(n => (
                      <div key={n} style={{ display:'grid', gridTemplateColumns:'1fr 90px', gap:8, marginBottom:8 }}>
                        <input className="input" value={form[`extra_${n}_name`]}
                          onChange={e => setForm(f=>({...f,[`extra_${n}_name`]:e.target.value}))}
                          placeholder={`Extra ${n} — ej: Perfume, Moño, Corte de uñas`} />
                        <input className="input" type="number" value={form[`extra_${n}_price`]}
                          onChange={e => setForm(f=>({...f,[`extra_${n}_price`]:e.target.value}))}
                          placeholder="$0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveService} disabled={!form.name.trim() || saving} style={{ flex:2, justifyContent:'center' }}>
                  {saving ? 'Guardando...' : 'Guardar servicio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
