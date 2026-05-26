import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Patients({ clinic }) {
  const [patients, setPatients] = useState([])
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [records, setRecords]   = useState([])
  const [showRecord, setShowRecord] = useState(false)
  const [recordForm, setRecordForm] = useState({ diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:'' })

  useEffect(() => { fetchPatients() }, [])

  const fetchPatients = async () => {
    const { data } = await supabase
      .from('vet_patients')
      .select('*, pets(id,name,breed,photo_url,birthdate,gender,lumi_id), profiles(name,phone)')
      .eq('clinic_id', clinic.id)
      .order('last_visit', { ascending:false })
    setPatients(data || [])
  }

  const fetchRecords = async (petId) => {
    const { data } = await supabase
      .from('vet_records')
      .select('*')
      .eq('clinic_id', clinic.id)
      .eq('pet_id', petId)
      .order('date', { ascending:false })
    setRecords(data || [])
  }

  const selectPatient = async (p) => {
    setSelected(p)
    await fetchRecords(p.pet_id)
  }

  const saveRecord = async () => {
    await supabase.from('vet_records').insert({
      clinic_id: clinic.id,
      pet_id: selected.pet_id,
      date: new Date().toISOString().slice(0,10),
      ...recordForm,
      weight: recordForm.weight ? parseFloat(recordForm.weight) : null,
      temperature: recordForm.temperature ? parseFloat(recordForm.temperature) : null,
    })
    await fetchRecords(selected.pet_id)
    await supabase.from('vet_patients').update({ last_visit: new Date().toISOString().slice(0,10) }).eq('id', selected.id)
    setShowRecord(false)
    setRecordForm({ diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:'' })
  }

  const filtered = patients.filter(p =>
    p.pets?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.profiles?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const calcAge = (bd) => {
    if (!bd) return null
    const y = Math.floor((Date.now() - new Date(bd)) / (1000*60*60*24*365.25))
    return y > 0 ? `${y} años` : 'Cachorro'
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns: selected ? '340px 1fr' : '1fr', gap:20 }}>
      {/* Lista de pacientes */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <p style={{ fontSize:20, fontWeight:800, margin:0 }}>Pacientes <span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>({patients.length})</span></p>
        </div>
        <input className="input" style={{ marginBottom:14 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar mascota o dueño..." />
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => selectPatient(p)} style={{ padding:'12px 14px', background:'white', borderRadius:12, border:`1.5px solid ${selected?.id === p.id ? 'var(--purple)' : 'var(--border)'}`, cursor:'pointer', display:'flex', alignItems:'center', gap:10, boxShadow:'var(--shadow)' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'var(--purple-light)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {p.pets?.photo_url ? <img src={p.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:20 }} />}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:14, fontWeight:700, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.pets?.name}</p>
                <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>{p.pets?.breed} · {calcAge(p.pets?.birthdate)}</p>
                <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>Dueño: {p.profiles?.name || '—'}</p>
              </div>
              {p.last_visit && <p style={{ fontSize:10, color:'var(--text-muted)', flexShrink:0 }}>{new Date(p.last_visit+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</p>}
            </div>
          ))}
          {filtered.length === 0 && <p style={{ textAlign:'center', color:'var(--text-muted)', padding:20 }}>Sin resultados</p>}
        </div>
      </div>

      {/* Expediente */}
      {selected && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:52, height:52, borderRadius:14, overflow:'hidden', background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {selected.pets?.photo_url ? <img src={selected.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <i className="ti ti-paw" style={{ fontSize:24, color:'var(--purple)' }} />}
              </div>
              <div>
                <p style={{ fontSize:18, fontWeight:800, margin:'0 0 2px' }}>{selected.pets?.name}</p>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>{selected.pets?.breed} · {selected.pets?.gender} · {calcAge(selected.pets?.birthdate)}</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" onClick={() => setShowRecord(true)}>
                <i className="ti ti-file-plus" /> Nueva consulta
              </button>
              <button className="btn btn-icon" style={{ background:'var(--bg)' }} onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
          </div>

          {/* Info dueño */}
          <div className="card" style={{ marginBottom:16 }}>
            <p style={{ fontSize:13, fontWeight:700, margin:'0 0 8px', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Dueño</p>
            <div style={{ display:'flex', gap:16 }}>
              <span style={{ fontSize:14 }}><i className="ti ti-user" style={{ color:'var(--purple)' }} /> {selected.profiles?.name || '—'}</span>
              <span style={{ fontSize:14 }}><i className="ti ti-phone" style={{ color:'var(--purple)' }} /> {selected.profiles?.phone || '—'}</span>
            </div>
          </div>

          {/* Historial */}
          <div className="card">
            <p style={{ fontSize:15, fontWeight:800, margin:'0 0 16px' }}>Historial de consultas</p>
            {records.length === 0 ? (
              <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Sin consultas registradas</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {records.map(r => (
                  <div key={r.id} style={{ padding:'14px', background:'var(--bg)', borderRadius:12, borderLeft:'3px solid var(--purple)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <p style={{ fontSize:13, fontWeight:700, margin:0 }}>{new Date(r.date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</p>
                      <div style={{ display:'flex', gap:8 }}>
                        {r.weight && <span className="badge badge-gray">{r.weight} kg</span>}
                        {r.temperature && <span className="badge badge-amber">{r.temperature}°C</span>}
                      </div>
                    </div>
                    {r.diagnosis && <p style={{ fontSize:13, margin:'0 0 4px' }}><strong>Diagnóstico:</strong> {r.diagnosis}</p>}
                    {r.treatment && <p style={{ fontSize:13, margin:'0 0 4px' }}><strong>Tratamiento:</strong> {r.treatment}</p>}
                    {r.notes && <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>{r.notes}</p>}
                    {r.next_visit && <p style={{ fontSize:12, color:'var(--purple)', margin:'6px 0 0', fontWeight:600 }}>📅 Próxima visita: {new Date(r.next_visit+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long'})}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal nueva consulta */}
      {showRecord && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRecord(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>Nueva consulta — {selected.pets?.name}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="grid-2">
                <div>
                  <label className="label">Peso (kg)</label>
                  <input className="input" type="number" step="0.1" value={recordForm.weight} onChange={e => setRecordForm(f=>({...f,weight:e.target.value}))} placeholder="3.5" />
                </div>
                <div>
                  <label className="label">Temperatura (°C)</label>
                  <input className="input" type="number" step="0.1" value={recordForm.temperature} onChange={e => setRecordForm(f=>({...f,temperature:e.target.value}))} placeholder="38.5" />
                </div>
              </div>
              <div>
                <label className="label">Diagnóstico</label>
                <input className="input" value={recordForm.diagnosis} onChange={e => setRecordForm(f=>({...f,diagnosis:e.target.value}))} placeholder="Diagnóstico principal..." />
              </div>
              <div>
                <label className="label">Tratamiento</label>
                <input className="input" value={recordForm.treatment} onChange={e => setRecordForm(f=>({...f,treatment:e.target.value}))} placeholder="Medicamentos, procedimientos..." />
              </div>
              <div>
                <label className="label">Notas SOAP</label>
                <textarea className="input" rows={3} value={recordForm.notes} onChange={e => setRecordForm(f=>({...f,notes:e.target.value}))} placeholder="Observaciones adicionales..." style={{ resize:'vertical' }} />
              </div>
              <div>
                <label className="label">Próxima visita</label>
                <input className="input" type="date" value={recordForm.next_visit} onChange={e => setRecordForm(f=>({...f,next_visit:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowRecord(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveRecord} style={{ flex:2, justifyContent:'center' }}>Guardar consulta</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
