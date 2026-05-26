import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Services({ clinic }) {
  const [services, setServices] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name:'', description:'', price:'', duration:'30', category:'consulta' })

  useEffect(() => { fetchServices() }, [])

  const fetchServices = async () => {
    const { data } = await supabase.from('vet_services').select('*').eq('clinic_id', clinic.id).order('category')
    setServices(data || [])
  }

  const saveService = async () => {
    await supabase.from('vet_services').insert({ ...form, clinic_id: clinic.id, price: parseFloat(form.price)||null, duration: parseInt(form.duration)||30 })
    fetchServices(); setShowModal(false); setForm({ name:'', description:'', price:'', duration:'30', category:'consulta' })
  }

  const toggleActive = async (id, val) => {
    await supabase.from('vet_services').update({ is_active: !val }).eq('id', id)
    fetchServices()
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <p style={{ fontSize:20, fontWeight:800, margin:0 }}>Servicios</p>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><i className="ti ti-plus" /> Agregar servicio</button>
      </div>
      <div className="card">
        {services.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <i className="ti ti-stethoscope" style={{ fontSize:40, color:'var(--text-muted)', display:'block', marginBottom:12 }} />
            <p style={{ fontWeight:700, marginBottom:8 }}>Sin servicios registrados</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Agregar primero</button>
          </div>
        ) : (
          <table className="table">
            <thead><tr><th>Servicio</th><th>Categoría</th><th>Duración</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td><p style={{ fontWeight:700, margin:'0 0 2px' }}>{s.name}</p><p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{s.description}</p></td>
                  <td><span className="badge badge-purple" style={{ textTransform:'capitalize' }}>{s.category}</span></td>
                  <td>{s.duration} min</td>
                  <td style={{ fontWeight:700 }}>{s.price ? `$${s.price}` : '—'}</td>
                  <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>{s.is_active ? 'Activo' : 'Inactivo'}</span></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => toggleActive(s.id, s.is_active)}>{s.is_active ? 'Desactivar' : 'Activar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>Nuevo servicio</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Consulta general" /></div>
              <div><label className="label">Descripción</label><input className="input" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Incluye..." /></div>
              <div className="grid-2">
                <div><label className="label">Categoría</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {['consulta','cirugía','vacuna','grooming','laboratorio','otro'].map(c=><option key={c} style={{textTransform:'capitalize'}}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label">Duración (min)</label><input className="input" type="number" value={form.duration} onChange={e => setForm(f=>({...f,duration:e.target.value}))} /></div>
                <div style={{ gridColumn:'1/-1' }}><label className="label">Precio</label><input className="input" type="number" value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder="350.00" /></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveService} disabled={!form.name} style={{ flex:2, justifyContent:'center' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
