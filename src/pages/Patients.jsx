import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Patients({ clinic }) {
  const [patients, setPatients]     = useState([])
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)
  const [records, setRecords]       = useState([])
  const [showRecord, setShowRecord] = useState(false)
  const [showNew, setShowNew]       = useState(false)
  const [pointsMsg, setPointsMsg]   = useState(null)

  const [recordForm, setRecordForm] = useState({
    diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:''
  })

  const [newForm, setNewForm] = useState({
    owner_name:'', owner_phone:'', owner_email:'',
    pet_name:'', species:'perro', breed:'', weight:'', gender:'macho', notes:''
  })

  useEffect(() => { fetchPatients() }, [])

  const fetchPatients = async () => {
    const { data } = await supabase
      .from('vet_patients')
      .select('*, pets(id,name,breed,photo_url,birthdate,gender,lumi_id), profiles(name,phone,email)')
      .eq('clinic_id', clinic.id)
      .order('last_visit', { ascending: false })
    setPatients(data || [])
  }

  const fetchRecords = async (petId) => {
    const { data } = await supabase
      .from('vet_records')
      .select('*')
      .eq('clinic_id', clinic.id)
      .eq('pet_id', petId)
      .order('date', { ascending: false })
    setRecords(data || [])
  }

  const selectPatient = async (p) => {
    setSelected(p)
    await fetchRecords(p.pet_id)
  }

  const saveRecord = async () => {
    const { data: record } = await supabase
      .from('vet_records')
      .insert({
        clinic_id: clinic.id,
        pet_id: selected.pet_id,
        date: new Date().toISOString().slice(0, 10),
        ...recordForm,
        weight: recordForm.weight ? parseFloat(recordForm.weight) : null,
        temperature: recordForm.temperature ? parseFloat(recordForm.temperature) : null,
      })
      .select()
      .single()

    await supabase
      .from('vet_patients')
      .update({ last_visit: new Date().toISOString().slice(0, 10) })
      .eq('id', selected.id)

    if (record && selected.pets?.lumi_id && selected.owner_id) {
      await supabase.rpc('grant_visit_points', {
        p_clinic_id: clinic.id,
        p_owner_id:  selected.owner_id,
        p_pet_id:    selected.pet_id,
        p_record_id: record.id,
      })
      setPointsMsg(`+15 puntos otorgados a ${selected.profiles?.name || 'el dueño'} 🎉`)
      setTimeout(() => setPointsMsg(null), 4000)
    }

    await fetchRecords(selected.pet_id)
    setShowRecord(false)
    setRecordForm({ diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:'' })
  }

  const saveNewPatient = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .insert({
        name:  newForm.owner_name,
        phone: newForm.owner_phone,
        email: newForm.owner_email,
        is_regular_patient: true,
      })
      .select()
      .single()

    if (!profile) return

    const { data: pet } = await supabase
      .from('pets')
      .insert({
        name:     newForm.pet_name,
        species:  newForm.species,
        breed:    newForm.breed,
        gender:   newForm.gender,
        owner_id: profile.id,
        notes:    newForm.notes,
      })
      .select()
      .single()

    if (!pet) return

    await supabase.from('vet_patients').insert({
      clinic_id: clinic.id,
      pet_id:    pet.id,
      owner_id:  profile.id,
    })

    setShowNew(false)
    setNewForm({ owner_name:'', owner_phone:'', owner_email:'', pet_name:'', species:'perro', breed:'', weight:'', gender:'macho', notes:'' })
    fetchPatients()
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

  const isLumi = (p) => !!p.pets?.lumi_id

  return (
    <div style={{ display:'grid', gridTemplateColumns: selected ? '340px 1fr' : '1fr', gap:20 }}>

      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <p style={{ fontSize:20, fontWeight:800, margin:0 }}>
            Pacientes <span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>({patients.length})</span>
          </p>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <i className="ti ti-plus" /> Nuevo paciente
          </button>
        </div>

        {pointsMsg && (
          <div style={{ background:'#DCFCE7', border:'1px solid #16A34A', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#15803D', fontWeight:600 }}>
            {pointsMsg}
          </div>
        )}

        <input className="input" style={{ marginBottom:14 }} value={search}
          onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar mascota o dueño..." />

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => selectPatient(p)}
              style={{ padding:'12px 14px', background:'white', borderRadius:12,
                border:`1.5px solid ${selected?.id === p.id ? 'var(--purple)' : 'var(--border)'}`,
                cursor:'pointer', display:'flex', alignItems:'center', gap:10, boxShadow:'var(--shadow)' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'var(--purple-light)',
                overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {p.pets?.photo_url
                  ? <img src={p.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:20 }} />}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <p style={{ fontSize:14, fontWeight:700, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.pets?.name}
                  </p>
                  {isLumi(p)
                    ? <span style={{ fontSize:10, background:'#EDE9FE', color:'#6B21A8', borderRadius:6, padding:'1px 6px', fontWeight:700, flexShrink:0 }}>LUMI</span>
                    : <span style={{ fontSize:10, background:'#F1F5F9', color:'#64748B', borderRadius:6, padding:'1px 6px', fontWeight:700, flexShrink:0 }}>REGULAR</span>
                  }
                </div>
                <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>{p.pets?.breed} · {calcAge(p.pets?.birthdate)}</p>
                <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>Dueño: {p.profiles?.name || '—'}</p>
              </div>
              {p.last_visit && (
                <p style={{ fontSize:10, color:'var(--text-muted)', flexShrink:0 }}>
                  {new Date(p.last_visit+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}
                </p>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)' }}>
              <i className="ti ti-paw" style={{ fontSize:36, display:'block', marginBottom:8 }} />
              <p style={{ fontSize:13, margin:'0 0 12px' }}>Sin pacientes registrados</p>
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Agregar primero</button>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:52, height:52, borderRadius:14, overflow:'hidden', background:'var(--purple-light)',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                {selected.pets?.photo_url
                  ? <img src={selected.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <i className="ti ti-paw" style={{ fontSize:24, color:'var(--purple)' }} />}
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <p style={{ fontSize:18, fontWeight:800, margin:'0 0 2px' }}>{selected.pets?.name}</p>
                  {isLumi(selected)
                    ? <span style={{ fontSize:11, background:'#EDE9FE', color:'#6B21A8', borderRadius:6, padding:'2px 8px', fontWeight:700 }}>🐾 LUMI</span>
                    : <span style={{ fontSize:11, background:'#F1F5F9', color:'#64748B', borderRadius:6, padding:'2px 8px', fontWeight:700 }}>REGULAR</span>
                  }
                </div>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>
                  {selected.pets?.breed} · {selected.pets?.gender} · {calcAge(selected.pets?.birthdate)}
                </p>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" onClick={() => setShowRecord(true)}>
                <i className="ti ti-file-plus" /> Nueva consulta
              </button>
              <button className="btn btn-icon" style={{ background:'var(--bg)' }} onClick={() => setSelected(null)}>
                <i className="ti ti-x" />
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <p style={{ fontSize:13, fontWeight:700, margin:'0 0 8px', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Dueño</p>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:14 }}><i className="ti ti-user" style={{ color:'var(--purple)' }} /> {selected.profiles?.name || '—'}</span>
              <span style={{ fontSize:14 }}><i className="ti ti-phone" style={{ color:'var(--purple)' }} /> {selected.profiles?.phone || '—'}</span>
              {selected.profiles?.email && (
                <span style={{ fontSize:14 }}><i className="ti ti-mail" style={{ color:'var(--purple)' }} /> {selected.profiles?.email}</span>
              )}
            </div>
            {isLumi(selected) && (
              <div style={{ marginTop:10, padding:'8px 12px', background:'#EDE9FE', borderRadius:8, fontSize:12, color:'#6B21A8', fontWeight:600 }}>
                🐾 Paciente Lumi — al guardar consulta recibirá +15 puntos automáticamente
              </div>
            )}
          </div>

          <div className="card">
            <p style={{ fontSize:15, fontWeight:800, margin:'0 0 16px' }}>Historial de consultas</p>
            {records.length === 0 ? (
              <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Sin consultas registradas</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {records.map(r => (
                  <div key={r.id} style={{ padding:'14px', background:'var(--bg)', borderRadius:12, borderLeft:'3px solid var(--purple)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <p style={{ fontSize:13, fontWeight:700, margin:0 }}>
                        {new Date(r.date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}
                      </p>
                      <div style={{ display:'flex', gap:8 }}>
                        {r.weight && <span className="badge badge-gray">{r.weight} kg</span>}
                        {r.temperature && <span className="badge badge-amber">{r.temperature}°C</span>}
                      </div>
                    </div>
                    {r.diagnosis  && <p style={{ fontSize:13, margin:'0 0 4px' }}><strong>Diagnóstico:</strong> {r.diagnosis}</p>}
                    {r.treatment  && <p style={{ fontSize:13, margin:'0 0 4px' }}><strong>Tratamiento:</strong> {r.treatment}</p>}
                    {r.notes      && <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>{r.notes}</p>}
                    {r.next_visit && <p style={{ fontSize:12, color:'var(--purple)', margin:'6px 0 0', fontWeight:600 }}>📅 Próxima visita: {new Date(r.next_visit+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long'})}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showRecord && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRecord(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>Nueva consulta — {selected.pets?.name}</p>
            {isLumi(selected) && (
              <div style={{ background:'#EDE9FE', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:12, color:'#6B21A8', fontWeight:600 }}>
                🐾 Paciente Lumi — se otorgarán +15 puntos al guardar
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="grid-2">
                <div>
                  <label className="label">Peso (kg)</label>
                  <input className="input" type="number" step="0.1" value={recordForm.weight}
                    onChange={e => setRecordForm(f=>({...f,weight:e.target.value}))} placeholder="3.5" />
                </div>
                <div>
                  <label className="label">Temperatura (°C)</label>
                  <input className="input" type="number" step="0.1" value={recordForm.temperature}
                    onChange={e => setRecordForm(f=>({...f,temperature:e.target.value}))} placeholder="38.5" />
                </div>
              </div>
              <div>
                <label className="label">Diagnóstico</label>
                <input className="input" value={recordForm.diagnosis}
                  onChange={e => setRecordForm(f=>({...f,diagnosis:e.target.value}))} placeholder="Diagnóstico principal..." />
              </div>
              <div>
                <label className="label">Tratamiento</label>
                <input className="input" value={recordForm.treatment}
                  onChange={e => setRecordForm(f=>({...f,treatment:e.target.value}))} placeholder="Medicamentos, procedimientos..." />
              </div>
              <div>
                <label className="label">Notas SOAP</label>
                <textarea className="input" rows={3} value={recordForm.notes}
                  onChange={e => setRecordForm(f=>({...f,notes:e.target.value}))}
                  placeholder="Observaciones adicionales..." style={{ resize:'vertical' }} />
              </div>
              <div>
                <label className="label">Próxima visita</label>
                <input className="input" type="date" value={recordForm.next_visit}
                  onChange={e => setRecordForm(f=>({...f,next_visit:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowRecord(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveRecord} style={{ flex:2, justifyContent:'center' }}>
                  Guardar consulta {isLumi(selected) ? '(+15 pts)' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal" style={{ maxWidth:540 }}>
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 6px' }}>Nuevo paciente</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 20px' }}>Paciente regular — sin cuenta Lumi App</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              <p style={{ fontSize:13, fontWeight:700, margin:'4px 0 0', color:'var(--purple)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Datos del dueño</p>
              <div className="grid-2">
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Nombre completo *</label>
                  <input className="input" value={newForm.owner_name}
                    onChange={e => setNewForm(f=>({...f,owner_name:e.target.value}))} placeholder="Juan García" />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={newForm.owner_phone}
                    onChange={e => setNewForm(f=>({...f,owner_phone:e.target.value}))} placeholder="9981234567" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={newForm.owner_email}
                    onChange={e => setNewForm(f=>({...f,owner_email:e.target.value}))} placeholder="juan@email.com" />
                </div>
              </div>

              <p style={{ fontSize:13, fontWeight:700, margin:'8px 0 0', color:'var(--purple)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Datos de la mascota</p>
              <div className="grid-2">
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Nombre de la mascota *</label>
                  <input className="input" value={newForm.pet_name}
                    onChange={e => setNewForm(f=>({...f,pet_name:e.target.value}))} placeholder="Max" />
                </div>
                <div>
                  <label className="label">Especie</label>
                  <select className="input" value={newForm.species}
                    onChange={e => setNewForm(f=>({...f,species:e.target.value}))}>
                    {['perro','gato','conejo','ave','reptil','otro'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Raza</label>
                  <input className="input" value={newForm.breed}
                    onChange={e => setNewForm(f=>({...f,breed:e.target.value}))} placeholder="Labrador..." />
                </div>
                <div>
                  <label className="label">Género</label>
                  <select className="input" value={newForm.gender}
                    onChange={e => setNewForm(f=>({...f,gender:e.target.value}))}>
                    <option value="macho">Macho</option>
                    <option value="hembra">Hembra</option>
                  </select>
                </div>
                <div>
                  <label className="label">Peso (kg)</label>
                  <input className="input" type="number" step="0.1" value={newForm.weight}
                    onChange={e => setNewForm(f=>({...f,weight:e.target.value}))} placeholder="5.0" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Notas</label>
                  <textarea className="input" rows={2} value={newForm.notes}
                    onChange={e => setNewForm(f=>({...f,notes:e.target.value}))}
                    placeholder="Alergias, condiciones previas..." style={{ resize:'vertical' }} />
                </div>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowNew(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveNewPatient}
                  disabled={!newForm.owner_name || !newForm.pet_name}
                  style={{ flex:2, justifyContent:'center' }}>Guardar paciente</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
