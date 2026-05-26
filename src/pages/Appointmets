import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const HOURS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']
const STATUS_COLORS = { pending:'badge-amber', confirmed:'badge-green', completed:'badge-purple', cancelled:'badge-red' }
const STATUS_LABELS = { pending:'Pendiente', confirmed:'Confirmada', completed:'Completada', cancelled:'Cancelada' }

export default function Appointments({ clinic }) {
  const [appointments, setAppointments] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10))
  const [showModal, setShowModal]       = useState(false)
  const [loading, setLoading]           = useState(true)
  const [form, setForm] = useState({ pet_name:'', owner_name:'', time:'09:00', notes:'', status:'confirmed', price:'' })

  useEffect(() => { fetchAppointments() }, [selectedDate])

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

  const saveAppointment = async () => {
    const { error } = await supabase.from('vet_appointments').insert({
      clinic_id: clinic.id,
      date: selectedDate,
      time: form.time,
      notes: form.notes,
      status: form.status,
      price: form.price ? parseFloat(form.price) : null,
    })
    if (!error) { fetchAppointments(); setShowModal(false); setForm({ pet_name:'', owner_name:'', time:'09:00', notes:'', status:'confirmed', price:'' }) }
  }

  const updateStatus = async (id, status) => {
    await supabase.from('vet_appointments').update({ status }).eq('id', id)
    fetchAppointments()
  }

  const formatDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })

  // Navegar días
  const changeDay = (days) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().slice(0,10))
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <p style={{ fontSize:22, fontWeight:800, margin:'0 0 4px' }}>Agenda</p>
          <p style={{ fontSize:14, color:'var(--text-secondary)', margin:0, textTransform:'capitalize' }}>{formatDate(selectedDate)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="ti ti-plus" /> Nueva cita
        </button>
      </div>

      {/* Navegación de fecha */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="btn btn-secondary btn-icon" onClick={() => changeDay(-1)}><i className="ti ti-chevron-left" /></button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input" style={{ width:'auto' }} />
        <button className="btn btn-secondary btn-icon" onClick={() => changeDay(1)}><i className="ti ti-chevron-right" /></button>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(new Date().toISOString().slice(0,10))}>Hoy</button>
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
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 16px' }}>Agrega la primera cita del día</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nueva cita</button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Mascota / Dueño</th>
                <th>Notas</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
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
                      <span style={{ fontWeight:600 }}>{appt.pets?.name || appt.notes?.split(' ')[0] || 'Mascota'}</span>
                    </div>
                  </td>
                  <td style={{ color:'var(--text-secondary)', fontSize:13 }}>{appt.notes || '—'}</td>
                  <td style={{ fontWeight:700 }}>{appt.price ? `$${appt.price}` : '—'}</td>
                  <td><span className={`badge ${STATUS_COLORS[appt.status]}`}>{STATUS_LABELS[appt.status]}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      {appt.status === 'pending' && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(appt.id,'confirmed')}>Confirmar</button>}
                      {appt.status === 'confirmed' && <button className="btn btn-primary btn-sm" onClick={() => updateStatus(appt.id,'completed')}>Completar</button>}
                      {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                        <button className="btn btn-danger btn-sm" onClick={() => updateStatus(appt.id,'cancelled')}>Cancelar</button>
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
          <div className="modal">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p style={{ fontSize:17, fontWeight:800, margin:0 }}>Nueva cita</p>
              <button className="btn btn-icon" onClick={() => setShowModal(false)} style={{ background:'var(--bg)' }}><i className="ti ti-x" /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="grid-2">
                <div>
                  <label className="label">Hora *</label>
                  <select className="input" value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))}>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select className="input" value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
                    <option value="pending">Pendiente</option>
                    <option value="confirmed">Confirmada</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Notas / Motivo</label>
                <input className="input" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Consulta general, vacunación..." />
              </div>
              <div>
                <label className="label">Precio (opcional)</label>
                <input className="input" type="number" value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder="350" />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveAppointment} style={{ flex:2, justifyContent:'center' }}>Guardar cita</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
