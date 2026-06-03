import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const HOURS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00']
const STATUS_COLORS = { pending:'badge-amber', confirmed:'badge-green', completed:'badge-purple', cancelled:'badge-red' }
const STATUS_LABELS = { pending:'Pendiente', confirmed:'Confirmada', completed:'Completada', cancelled:'Cancelada' }

export default function Appointments({
  const localToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(new Date())
 ({ clinic, initialForm }) {
  const [appointments, setAppointments] = useState([])
  const [services, setServices]         = useState([])
  const [selectedDate, setSelectedDate] = useState(localToday())
  const [showModal, setShowModal]       = useState(!!initialForm)
  const [loading, setLoading]           = useState(true)
  const [lumiLoading, setLumiLoading]   = useState(false)
  const [lumiPet, setLumiPet]           = useState(null)

  const emptyForm = {
    lumi_code:'', pet_id:null, pet_name:'', owner_name:'',
    date: localToday(),
    time:'09:00', notes:'', status:'confirmed', price:'',
    service_id: null, service_name:'',
    bath_size: null, bath_extras: [],
  }
  const [form, setForm] = useState(initialForm || emptyForm)

  useEffect(() => { fetchAppointments() }, [selectedDate])
  useEffect(() => { fetchServices() }, [])

  const fetchAppointments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('vet_appointments')
      .select('*, pets(name,photo_url)')
      .eq('clinic_id', clinic.id)
      .eq('date', selectedDate)
      .order('time')
    setAppointments(data || [])
    setLoading(false)
  }

  // FIX: leer de vet_services, no de vet_inventory
  const fetchServices = async () => {
    const { data } = await supabase
      .from('vet_services')
      .select('id, name, price, is_bath_service, is_active, price_small, price_medium, price_large, small_max_kg, medium_max_kg, large_max_kg, extra_1_name, extra_1_price, extra_2_name, extra_2_price, extra_3_name, extra_3_price')
      .eq('clinic_id', clinic.id)
      .eq('is_active', true)
      .order('name')
    // mapear price → sale_price para compatibilidad con el resto del código
    setServices((data || []).map(s => ({ ...s, sale_price: s.price })))
  }

  const searchLumi = async (code) => {
    if (!code || code.length < 10) return
    setLumiLoading(true)
    const { data: pet } = await supabase
      .from('pets')
      .select('id, name, weight, breed, pet_type, profiles(name)')
      .eq('lumi_id', code.trim().toUpperCase())
      .single()
    if (pet) {
      setLumiPet(pet)
      setForm(f => ({ ...f, pet_id: pet.id, pet_name: pet.name, owner_name: pet.profiles?.name || '' }))
      if (form.service_id) {
        const svc = services.find(s => s.id === form.service_id)
        if (svc?.is_bath_service && pet.weight) autoSelectBathSize(svc, pet.weight)
      }
    }
    setLumiLoading(false)
  }

  const handleServiceChange = (serviceId) => {
    if (!serviceId) {
      setForm(f => ({ ...f, service_id:null, service_name:'', bath_size:null, bath_extras:[], price:'' }))
      return
    }
    const svc = services.find(s => s.id === serviceId)
    if (!svc) return
    const newForm = { ...form, service_id: svc.id, service_name: svc.name, bath_size:null, bath_extras:[], price: svc.price ? String(svc.price) : '' }
    if (svc.is_bath_service && lumiPet?.weight) {
      const size = calcBathSize(svc, lumiPet.weight)
      newForm.bath_size = size
      newForm.price = String(getBathPrice(svc, size) || '')
    }
    setForm(newForm)
  }

  const calcBathSize = (svc, weight) => {
    if (weight <= (svc.small_max_kg || 10)) return 'small'
    if (weight <= (svc.medium_max_kg || 20)) return 'medium'
    return 'large'
  }

  const getBathPrice = (svc, size) => {
    if (size === 'small')  return svc.price_small
    if (size === 'medium') return svc.price_medium
    return svc.price_large
  }

  const autoSelectBathSize = (svc, weight) => {
    const size = calcBathSize(svc, weight)
    const price = getBathPrice(svc, size)
    setForm(f => ({ ...f, bath_size: size, price: String(price || '') }))
  }

  const handleBathSize = (size, svc) => {
    const price = svc ? getBathPrice(svc, size) : 0
    const extrasTotal = form.bath_extras.reduce((sum, e) => sum + (e.price || 0), 0)
    setForm(f => ({ ...f, bath_size: size, price: String((price || 0) + extrasTotal) }))
  }

  const toggleExtra = (extra, svc, currentBathSize) => {
    const basePrice = svc ? (getBathPrice(svc, currentBathSize) || 0) : 0
    const exists = form.bath_extras.find(e => e.name === extra.name)
    const newExtras = exists
      ? form.bath_extras.filter(e => e.name !== extra.name)
      : [...form.bath_extras, extra]
    const extrasTotal = newExtras.reduce((sum, e) => sum + (e.price || 0), 0)
    setForm(f => ({ ...f, bath_extras: newExtras, price: String(basePrice + extrasTotal) }))
  }

  const selectedService = services.find(s => s.id === form.service_id)
  const isBath = selectedService?.is_bath_service

  const bathExtrasAvailable = selectedService ? [
    selectedService.extra_1_name && { name: selectedService.extra_1_name, price: selectedService.extra_1_price || 0 },
    selectedService.extra_2_name && { name: selectedService.extra_2_name, price: selectedService.extra_2_price || 0 },
    selectedService.extra_3_name && { name: selectedService.extra_3_name, price: selectedService.extra_3_price || 0 },
  ].filter(Boolean) : []

  const saveAppointment = async () => {
    if (!form.pet_name.trim() || !form.owner_name.trim()) return
    const { error } = await supabase.from('vet_appointments').insert({
      clinic_id:    clinic.id,
      date:         form.date,
      time:         form.time,
      notes:        form.notes,
      status:       form.status,
      price:        form.price ? parseFloat(form.price) : null,
      pet_id:       form.pet_id || null,
      pet_name:     form.pet_name,
      owner_name:   form.owner_name,
      service_name: form.service_name || null,
      bath_size:    form.bath_size || null,
      bath_extras:  form.bath_extras.length > 0 ? form.bath_extras : null,
    })
    if (!error) {
      if (form.date === selectedDate) fetchAppointments()
      setShowModal(false)
      setForm(emptyForm)
      setLumiPet(null)
    }
  }

  const updateStatus = async (id, status) => {
    await supabase.from('vet_appointments').update({ status }).eq('id', id)
    fetchAppointments()
  }

  const deleteAppointment = async (id) => {
    if (!confirm('¿Eliminar esta cita permanentemente?')) return
    await supabase.from('vet_appointments').delete().eq('id', id)
    fetchAppointments()
  }

  const formatDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })
  const changeDay = (days) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setSelectedDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(d))
  }

  const BATH_LABELS = {
    small:  { label:'Chico',   icon:'🐕', desc: selectedService ? `hasta ${selectedService.small_max_kg} kg`  : '' },
    medium: { label:'Mediano', icon:'🐕', desc: selectedService ? `hasta ${selectedService.medium_max_kg} kg` : '' },
    large:  { label:'Grande',  icon:'🐕', desc: selectedService ? `hasta ${selectedService.large_max_kg} kg`  : '' },
  }

  const canSave = form.pet_name.trim() && form.owner_name.trim()

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 4px' }}>Gestión</p>
          <p style={{ fontSize:24, fontWeight:700, color:'var(--purple-dark)', margin:0, letterSpacing:'-0.3px' }}>Agenda</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setLumiPet(null); setShowModal(true) }}>
          <i className="ti ti-plus" /> Nueva cita
        </button>
      </div>

      {/* Navegación de fecha */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="btn btn-secondary btn-icon" onClick={() => changeDay(-1)}><i className="ti ti-chevron-left" /></button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input" style={{ width:'auto' }} />
        <button className="btn btn-secondary btn-icon" onClick={() => changeDay(1)}><i className="ti ti-chevron-right" /></button>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(localToday())}>Hoy</button>
        <span className="badge badge-purple" style={{ marginLeft:'auto' }}>{appointments.length} citas</span>
      </div>

      {/* Lista de citas */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>Cargando...</div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <i className="ti ti-calendar" style={{ fontSize:40, color:'var(--text-muted)', display:'block', marginBottom:12 }} />
            <p style={{ fontSize:15, fontWeight:700, margin:'0 0 6px' }}>Sin citas para este día</p>
            <button className="btn btn-primary" onClick={() => { setForm({...emptyForm, date:selectedDate}); setShowModal(true) }}>+ Nueva cita</button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Hora</th><th>Mascota</th><th>Dueño</th><th>Servicio</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {appointments.map(appt => (
                <tr key={appt.id}>
                  <td style={{ fontWeight:700, color:'var(--purple)' }}>{appt.time?.slice(0,5)}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'var(--purple-light)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {appt.pets?.photo_url ? <img src={appt.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:14 }} />}
                      </div>
                      <span style={{ fontWeight:600 }}>{appt.pets?.name || appt.pet_name || '—'}</span>
                    </div>
                  </td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{appt.owner_name || '—'}</td>
                  <td style={{ fontSize:13, color:'var(--text-secondary)' }}>
                    {appt.service_name || appt.notes || '—'}
                    {appt.bath_size && <span className="badge badge-amber" style={{ marginLeft:6, fontSize:10 }}>{appt.bath_size === 'small' ? 'Chico' : appt.bath_size === 'medium' ? 'Mediano' : 'Grande'}</span>}
                  </td>
                  <td style={{ fontWeight:700 }}>{appt.price ? `$${appt.price}` : '—'}</td>
                  <td><span className={`badge ${STATUS_COLORS[appt.status]}`}>{STATUS_LABELS[appt.status]}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      {appt.status === 'pending'   && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(appt.id,'confirmed')}>Confirmar</button>}
                      {appt.status === 'confirmed' && <button className="btn btn-primary btn-sm"   onClick={() => updateStatus(appt.id,'completed')}>Completar</button>}
                      {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                        <button className="btn btn-danger btn-sm" onClick={() => updateStatus(appt.id,'cancelled')}>Cancelar</button>
                      )}
                      {(appt.status === 'cancelled' || appt.status === 'completed') && (
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteAppointment(appt.id)}><i className="ti ti-trash" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva cita */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth:540, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p style={{ fontSize:17, fontWeight:800, margin:0 }}>Nueva cita</p>
              <button className="btn btn-icon" onClick={() => setShowModal(false)} style={{ background:'var(--bg)' }}><i className="ti ti-x" /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Código Lumi */}
              <div>
                <label className="label">Código Lumi (opcional)</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="input" value={form.lumi_code}
                    onChange={e => { const v = e.target.value.toUpperCase(); setForm(f=>({...f,lumi_code:v})); searchLumi(v) }}
                    placeholder="LMI-2026-XXXXXX" style={{ flex:1, fontFamily:'monospace' }} />
                  {lumiLoading && <span style={{ alignSelf:'center', fontSize:12, color:'var(--text-muted)' }}>Buscando...</span>}
                </div>
                {lumiPet && (
                  <div style={{ marginTop:6, padding:'8px 12px', background:'#DCFCE7', borderRadius:8, fontSize:12, color:'#15803D', fontWeight:600 }}>
                    ✓ {lumiPet.name} · {lumiPet.breed} {lumiPet.weight ? `· ${lumiPet.weight} kg` : ''}
                  </div>
                )}
              </div>

              {/* Mascota y dueño */}
              <div className="grid-2">
                <div>
                  <label className="label">Nombre mascota *</label>
                  <input className="input" value={form.pet_name} onChange={e => setForm(f=>({...f,pet_name:e.target.value}))} placeholder="Max" style={{ borderColor: !form.pet_name.trim() ? '#FCA5A5' : undefined }} />
                </div>
                <div>
                  <label className="label">Nombre dueño *</label>
                  <input className="input" value={form.owner_name} onChange={e => setForm(f=>({...f,owner_name:e.target.value}))} placeholder="Juan García" style={{ borderColor: !form.owner_name.trim() ? '#FCA5A5' : undefined }} />
                </div>
              </div>

              {/* Fecha y hora */}
              <div className="grid-2">
                <div>
                  <label className="label">Fecha *</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Hora *</label>
                  <select className="input" value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))}>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {/* Servicio */}
              <div>
                <label className="label">Servicio</label>
                {services.length === 0 ? (
                  <p style={{ fontSize:12, color:'var(--text-muted)', margin:'4px 0 0' }}>
                    No hay servicios activos. Agrégalos en la sección Servicios.
                  </p>
                ) : (
                  <select className="input" value={form.service_id || ''} onChange={e => handleServiceChange(e.target.value || null)}>
                    <option value="">— Seleccionar servicio (opcional) —</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.is_bath_service ? ' 🛁' : ''}{s.price ? ` — $${s.price}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Panel de baño */}
              {isBath && (
                <div style={{ background:'var(--purple-lighter, #F5F3FF)', borderRadius:14, padding:14, display:'flex', flexDirection:'column', gap:12 }}>
                  <p style={{ fontSize:12, fontWeight:700, color:'var(--purple)', textTransform:'uppercase', letterSpacing:'0.5px', margin:0 }}>🛁 Configuración del baño</p>
                  {form.bath_size && (
                    <div style={{ background:'var(--purple)', borderRadius:10, padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:13, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>Total estimado</span>
                      <span style={{ fontSize:18, fontWeight:900, color:'white' }}>${form.price || '0'}</span>
                    </div>
                  )}

                  {lumiPet?.weight && (
                    <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0 }}>
                      Peso de {lumiPet.name}: <strong>{lumiPet.weight} kg</strong>
                      {form.bath_size && <span style={{ marginLeft:8, color:'var(--purple)', fontWeight:700 }}>→ Talla sugerida: {BATH_LABELS[form.bath_size]?.label}</span>}
                    </p>
                  )}

                  <div>
                    <label className="label">Talla</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      {['small','medium','large'].map(size => {
                        const info = BATH_LABELS[size]
                        const price = selectedService ? getBathPrice(selectedService, size) : null
                        const isSelected = form.bath_size === size
                        return (
                          <button key={size} onClick={() => handleBathSize(size, selectedService)}
                            style={{ padding:'10px 8px', borderRadius:10, border:`2px solid ${isSelected?'var(--purple)':'var(--border)'}`, background: isSelected?'var(--purple-light)':'white', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                            <p style={{ fontSize:18, margin:'0 0 2px' }}>{info.icon}</p>
                            <p style={{ fontSize:12, fontWeight:700, color: isSelected?'var(--purple)':'var(--text-primary)', margin:'0 0 2px' }}>{info.label}</p>
                            <p style={{ fontSize:10, color:'var(--text-muted)', margin:'0 0 4px' }}>{info.desc}</p>
                            {price && <p style={{ fontSize:13, fontWeight:800, color: isSelected?'var(--purple)':'var(--text-secondary)', margin:0 }}>${price}</p>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {bathExtrasAvailable.length > 0 && (
                    <div>
                      <label className="label">Extras</label>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {bathExtrasAvailable.map(extra => {
                          const selected = form.bath_extras.find(e => e.name === extra.name)
                          return (
                            <label key={extra.name} onClick={() => toggleExtra(extra, selectedService, form.bath_size)}
                              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background: selected?'var(--purple-light)':'white', borderRadius:8, border:`1px solid ${selected?'var(--purple)':'var(--border)'}`, cursor:'pointer', transition:'all 0.15s' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <input type="checkbox" checked={!!selected} readOnly style={{ accentColor:'var(--purple)' }} />
                                <span style={{ fontSize:13, fontWeight:600, color: selected?'var(--purple)':'var(--text-primary)' }}>{extra.name}</span>
                              </div>
                              <span style={{ fontSize:13, fontWeight:700, color:'var(--purple)' }}>+${extra.price}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="label">Notas / Motivo</label>
                <input className="input" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Consulta general, vacunación..." />
              </div>

              {/* Estado y precio */}
              <div className="grid-2">
                <div>
                  <label className="label">Estado</label>
                  <select className="input" value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
                    <option value="pending">Pendiente</option>
                    <option value="confirmed">Confirmada</option>
                  </select>
                </div>
                <div>
                  <label className="label">Precio total</label>
                  <input className="input" type="text" inputMode="numeric" key={form.bath_size || 'no-bath'} value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder="0.00" style={{ fontWeight:700, color:'var(--purple)' }} />
                </div>
              </div>

              {!canSave && <p style={{ fontSize:12, color:'#DC2626', margin:0 }}>* Nombre de mascota y dueño son obligatorios</p>}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveAppointment} disabled={!canSave} style={{ flex:2, justifyContent:'center', opacity: canSave?1:0.5 }}>
                  Guardar cita
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
