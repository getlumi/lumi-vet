import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Patients({ clinic, openNew, onNavigateAppointment }) {
  const [tab, setTab]               = useState('lumi')
  const [patients, setPatients]     = useState([])
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)
  const [records, setRecords]       = useState([])
  const [vaccines, setVaccines]     = useState([])
  const [visits, setVisits]         = useState([])
  const [showRecord, setShowRecord] = useState(false)
  const [showNew, setShowNew]       = useState(openNew || false)
  const [showVisit, setShowVisit]   = useState(false)
  const [showCarnet, setShowCarnet] = useState(false)
  const [pointsMsg, setPointsMsg]   = useState(null)

  // Lumi search
  const [lumiCode, setLumiCode]     = useState('')
  const [lumiSearch, setLumiSearch] = useState(null)
  const [lumiLoading, setLumiLoading] = useState(false)
  const [lumiError, setLumiError]   = useState('')

  // Carnet update
  const [carnetCode, setCarnetCode] = useState('')
  const [carnetError, setCarnetError] = useState('')
  const [carnetStep, setCarnetStep] = useState('code') // 'code' | 'form'
  const [vaccineForm, setVaccineForm] = useState({ name:'', date:'', next_date:'', notes:'' })

  // Visit form
  const [visitForm, setVisitForm] = useState({ type:'servicio', description:'', price:'' })

  // Record form
  const [recordForm, setRecordForm] = useState({
    diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:''
  })

  // New patient form
  const [newForm, setNewForm] = useState({
    owner_name:'', owner_phone:'', owner_email:'',
    pet_name:'', species:'perro', breed:'', weight:'', gender:'macho', notes:''
  })

  useEffect(() => { fetchPatients() }, [])

  const fetchPatients = async () => {
    const { data } = await supabase
      .from('vet_patients')
      .select('*, pets(id,name,breed,photo_url,birthdate,gender,lumi_id,species,description), profiles(id,name,phone,email,lumi_id)')
      .eq('clinic_id', clinic.id)
      .order('last_visit', { ascending: false })
    setPatients(data || [])
  }

  const fetchRecords = async (petId) => {
    const [recRes, vacRes, visRes] = await Promise.all([
      supabase.from('vet_records').select('*').eq('clinic_id', clinic.id).eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('vaccines').select('*').eq('pet_id', petId).order('date', { ascending: false }),
      supabase.from('vet_visit_points').select('*').eq('clinic_id', clinic.id).eq('pet_id', petId).order('created_at', { ascending: false }),
    ])
    setRecords(recRes.data || [])
    setVaccines(vacRes.data || [])
    setVisits(visRes.data || [])
  }

  const selectPatient = async (p) => {
    setSelected(p)
    await fetchRecords(p.pet_id)
  }

  // Buscar paciente Lumi por código
  const searchLumiCode = async () => {
    if (!lumiCode.trim()) return
    setLumiLoading(true)
    setLumiError('')
    setLumiSearch(null)
    const { data: pet } = await supabase
      .from('pets')
      .select('*, profiles(id,name,phone,email,lumi_id)')
      .eq('lumi_id', lumiCode.trim().toUpperCase())
      .single()
    if (!pet) { setLumiError('No se encontró ninguna mascota con ese código'); setLumiLoading(false); return }
    const { data: lastVisit } = await supabase
      .from('vet_records').select('*').eq('clinic_id', clinic.id).eq('pet_id', pet.id)
      .order('date', { ascending: false }).limit(1).single()
    setLumiSearch({ pet, lastVisit })
    setLumiLoading(false)
  }

  const registerLumiPatient = async () => {
    if (!lumiSearch) return
    const { pet } = lumiSearch
    const { data: existing } = await supabase.from('vet_patients').select('id').eq('clinic_id', clinic.id).eq('pet_id', pet.id).single()
    if (existing) { setLumiError('Esta mascota ya está registrada en tu clínica'); return }
    await supabase.from('vet_patients').insert({ clinic_id: clinic.id, pet_id: pet.id, owner_id: pet.profiles?.id })
    setShowNew(false); setLumiCode(''); setLumiSearch(null)
    fetchPatients()
  }

  // Guardar consulta
  const saveRecord = async () => {
    const { data: record } = await supabase.from('vet_records').insert({
      clinic_id: clinic.id, pet_id: selected.pet_id,
      date: new Date().toISOString().slice(0, 10),
      ...recordForm,
      weight: recordForm.weight ? parseFloat(recordForm.weight) : null,
      temperature: recordForm.temperature ? parseFloat(recordForm.temperature) : null,
    }).select().single()
    await supabase.from('vet_patients').update({ last_visit: new Date().toISOString().slice(0, 10) }).eq('id', selected.id)
    if (record && selected.pets?.lumi_id && selected.owner_id) {
      await supabase.rpc('grant_visit_points', {
        p_clinic_id: clinic.id, p_owner_id: selected.owner_id,
        p_pet_id: selected.pet_id, p_record_id: record.id,
      })
      setPointsMsg(`+15 puntos otorgados a ${selected.profiles?.name || 'el dueño'} 🎉`)
      setTimeout(() => setPointsMsg(null), 4000)
    }
    await fetchRecords(selected.pet_id)
    setShowRecord(false)
    setRecordForm({ diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:'' })
  }

  // Guardar visita (servicio o producto)
  const saveVisit = async () => {
    await supabase.from('vet_transactions').insert({
      clinic_id:   clinic.id,
      pet_id:      selected.pet_id,
      owner_id:    selected.owner_id,
      type:        'income',
      category:    visitForm.type,
      description: visitForm.description,
      amount:      visitForm.price ? parseFloat(visitForm.price) : 0,
      date:        new Date().toISOString().slice(0, 10),
    })
    // Sumar visita al score del paciente
    await supabase.from('vet_patients').update({
      last_visit:   new Date().toISOString().slice(0, 10),
      visit_count:  (selected.visit_count || 0) + 1,
    }).eq('id', selected.id)

    setShowVisit(false)
    setVisitForm({ type:'servicio', description:'', price:'' })
    fetchPatients()
    fetchRecords(selected.pet_id)
  }

  // Verificar código de carnet
  const verifyCarnetCode = async () => {
    setCarnetError('')
    const { data } = await supabase
      .from('vet_auth_codes')
      .select('*')
      .eq('pet_id', selected.pet_id)
      .eq('code', carnetCode.trim().toUpperCase())
      .single()
    if (!data) { setCarnetError('Código incorrecto. Pide al dueño el código de su app.'); return }
    setCarnetStep('form')
  }

  // Guardar vacuna en carnet
  const saveVaccine = async () => {
    await supabase.from('vaccines').insert({
      pet_id:    selected.pet_id,
      clinic_id: clinic.id,
      ...vaccineForm,
    })
    await fetchRecords(selected.pet_id)
    setShowCarnet(false)
    setCarnetCode('')
    setCarnetStep('code')
    setVaccineForm({ name:'', date:'', next_date:'', notes:'' })
  }

  // Guardar nuevo paciente regular
  const saveNewPatient = async () => {
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .insert({ name: newForm.owner_name, phone: newForm.owner_phone, email: newForm.owner_email, is_regular_patient: true })
      .select().single()
    if (profError || !profile) return

    const { data: pet, error: petError } = await supabase
      .from('pets')
      .insert({ name: newForm.pet_name, species: newForm.species, breed: newForm.breed, gender: newForm.gender, owner_id: profile.id, notes: newForm.notes })
      .select().single()
    if (petError || !pet) return

    await supabase.from('vet_patients').insert({ clinic_id: clinic.id, pet_id: pet.id, owner_id: profile.id })
    setShowNew(false)
    setNewForm({ owner_name:'', owner_phone:'', owner_email:'', pet_name:'', species:'perro', breed:'', weight:'', gender:'macho', notes:'' })
    fetchPatients()
  }

  const isLumi = (p) => !!p.pets?.lumi_id
  const calcAge = (bd) => {
    if (!bd) return null
    const y = Math.floor((Date.now() - new Date(bd)) / (1000*60*60*24*365.25))
    return y > 0 ? `${y} años` : 'Cachorro'
  }
  const lumiCount    = patients.filter(p => isLumi(p)).length
  const regularCount = patients.filter(p => !isLumi(p)).length
  const filtered = patients.filter(p => {
    const matchSearch = p.pets?.name?.toLowerCase().includes(search.toLowerCase()) || p.profiles?.name?.toLowerCase().includes(search.toLowerCase())
    const matchTab = tab === 'lumi' ? isLumi(p) : !isLumi(p)
    return matchSearch && matchTab
  })

  return (
    <div style={{ display:'grid', gridTemplateColumns: selected ? '340px 1fr' : '1fr', gap:20 }}>

      {/* ===== LISTA ===== */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <p style={{ fontSize:20, fontWeight:800, margin:0 }}>Pacientes</p>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <i className="ti ti-plus" /> Nuevo paciente
          </button>
        </div>

        {pointsMsg && (
          <div style={{ background:'#DCFCE7', border:'1px solid #16A34A', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#15803D', fontWeight:600 }}>
            {pointsMsg}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', marginBottom:14, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          <button onClick={() => setTab('lumi')} style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', background: tab==='lumi' ? '#6B21A8' : 'white', color: tab==='lumi' ? 'white' : 'var(--text-secondary)' }}>
            🐾 Lumi ({lumiCount})
          </button>
          <button onClick={() => setTab('regular')} style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', background: tab==='regular' ? '#6B21A8' : 'white', color: tab==='regular' ? 'white' : 'var(--text-secondary)' }}>
            👤 Regulares ({regularCount})
          </button>
        </div>

        <input className="input" style={{ marginBottom:12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar mascota o dueño..." />

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => selectPatient(p)}
              style={{ padding:'12px 14px', background:'white', borderRadius:12, border:`1.5px solid ${selected?.id===p.id ? 'var(--purple)' : 'var(--border)'}`, cursor:'pointer', display:'flex', alignItems:'center', gap:10, boxShadow:'var(--shadow)' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'var(--purple-light)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {p.pets?.photo_url ? <img src={p.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:20 }} />}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <p style={{ fontSize:14, fontWeight:700, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.pets?.name}</p>
                  {isLumi(p)
                    ? <span style={{ fontSize:10, background:'#EDE9FE', color:'#6B21A8', borderRadius:6, padding:'1px 6px', fontWeight:700, flexShrink:0 }}>LUMI</span>
                    : <span style={{ fontSize:10, background:'#F1F5F9', color:'#64748B', borderRadius:6, padding:'1px 6px', fontWeight:700, flexShrink:0 }}>REGULAR</span>}
                </div>
                <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>{p.pets?.breed} · {calcAge(p.pets?.birthdate)}</p>
                <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>Dueño: {p.profiles?.name || '—'}</p>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                {p.last_visit && <p style={{ fontSize:10, color:'var(--text-muted)', margin:'0 0 2px' }}>{new Date(p.last_visit+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</p>}
                {p.visit_count > 0 && <span style={{ fontSize:10, background:'#EDE9FE', color:'#6B21A8', borderRadius:6, padding:'1px 6px', fontWeight:700 }}>{p.visit_count} visitas</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)' }}>
              <i className="ti ti-paw" style={{ fontSize:36, display:'block', marginBottom:8 }} />
              <p style={{ fontSize:13, margin:'0 0 12px' }}>Sin pacientes {tab==='lumi' ? 'Lumi' : 'regulares'}</p>
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Agregar primero</button>
            </div>
          )}
        </div>
      </div>

      {/* ===== EXPEDIENTE ===== */}
      {selected && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {selected.pets?.photo_url ? <img src={selected.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <i className="ti ti-paw" style={{ fontSize:24, color:'var(--purple)' }} />}
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <p style={{ fontSize:18, fontWeight:800, margin:'0 0 2px' }}>{selected.pets?.name}</p>
                  {isLumi(selected)
                    ? <span style={{ fontSize:11, background:'#EDE9FE', color:'#6B21A8', borderRadius:6, padding:'2px 8px', fontWeight:700 }}>🐾 LUMI</span>
                    : <span style={{ fontSize:11, background:'#F1F5F9', color:'#64748B', borderRadius:6, padding:'2px 8px', fontWeight:700 }}>REGULAR</span>}
                </div>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>
                  {selected.pets?.species} · {selected.pets?.breed} · {selected.pets?.gender} · {calcAge(selected.pets?.birthdate)}
                </p>
              </div>
            </div>
            <button className="btn btn-icon" style={{ background:'var(--bg)' }} onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
          </div>

          {/* Botones de acción */}
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowVisit(true)}>
              <i className="ti ti-plus" /> + Visita
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowRecord(true)}>
              <i className="ti ti-file-plus" /> Nueva consulta
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigateAppointment && onNavigateAppointment({ pet_name: selected.pets?.name, owner_name: selected.profiles?.name || '' })}>
              <i className="ti ti-calendar-plus" /> Agendar cita
            </button>
            {isLumi(selected) && (
              <button className="btn btn-secondary btn-sm" style={{ color:'var(--purple)', borderColor:'var(--purple)' }}
                onClick={() => { setShowCarnet(true); setCarnetStep('code'); setCarnetCode(''); setCarnetError('') }}>
                <i className="ti ti-certificate" /> Actualizar carnet
              </button>
            )}
          </div>

          {/* Dueño */}
          <div className="card" style={{ marginBottom:14 }}>
            <p style={{ fontSize:12, fontWeight:700, margin:'0 0 8px', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Dueño</p>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:13 }}><i className="ti ti-user" style={{ color:'var(--purple)' }} /> {selected.profiles?.name || '—'}</span>
              <span style={{ fontSize:13 }}><i className="ti ti-phone" style={{ color:'var(--purple)' }} /> {selected.profiles?.phone || '—'}</span>
              {selected.profiles?.email && <span style={{ fontSize:13 }}><i className="ti ti-mail" style={{ color:'var(--purple)' }} /> {selected.profiles?.email}</span>}
            </div>
            {isLumi(selected) && (
              <div style={{ marginTop:10, padding:'7px 12px', background:'#EDE9FE', borderRadius:8, fontSize:12, color:'#6B21A8', fontWeight:600 }}>
                🐾 Código Lumi: {selected.pets?.lumi_id} · Visitas registradas: {selected.visit_count || 0}
              </div>
            )}
          </div>

          {/* Carnet vacunas */}
          {isLumi(selected) && (
            <div className="card" style={{ marginBottom:14 }}>
              <p style={{ fontSize:13, fontWeight:800, margin:'0 0 12px' }}>💉 Carnet de vacunas</p>
              {vaccines.length === 0 ? (
                <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'12px 0' }}>Sin vacunas registradas</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {vaccines.map(v => (
                    <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--bg)', borderRadius:8 }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:700, margin:'0 0 2px' }}>{v.name}</p>
                        {v.notes && <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{v.notes}</p>}
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontSize:11, color:'var(--text-secondary)', margin:'0 0 2px' }}>{v.date ? new Date(v.date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}) : '—'}</p>
                        {v.next_date && <p style={{ fontSize:11, color:'var(--purple)', fontWeight:600, margin:0 }}>Refuerzo: {new Date(v.next_date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Historial visitas */}
          {visits.length > 0 && (
            <div className="card" style={{ marginBottom:14 }}>
              <p style={{ fontSize:13, fontWeight:800, margin:'0 0 12px' }}>🏷️ Historial de visitas ({visits.length})</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {visits.slice(0,5).map(v => (
                  <div key={v.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'var(--bg)', borderRadius:8, fontSize:12 }}>
                    <span style={{ color:'var(--text-secondary)' }}>{new Date(v.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}</span>
                    <span style={{ fontWeight:600, color:'var(--purple)' }}>{v.reason}</span>
                    <span style={{ fontWeight:700 }}>+{v.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial consultas */}
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

      {/* ===== MODAL + VISITA ===== */}
      {showVisit && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowVisit(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>+ Visita — {selected.pets?.name}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label className="label">Tipo de visita</label>
                <div style={{ display:'flex', gap:8 }}>
                  {['servicio','producto'].map(t => (
                    <button key={t} onClick={() => setVisitForm(f=>({...f,type:t}))}
                      style={{ flex:1, padding:'10px', borderRadius:8, border:`2px solid ${visitForm.type===t ? '#6B21A8' : 'var(--border)'}`,
                        background: visitForm.type===t ? '#EDE9FE' : 'white', cursor:'pointer', fontWeight:700, fontSize:13, color: visitForm.type===t ? '#6B21A8' : 'var(--text-secondary)', textTransform:'capitalize' }}>
                      {t === 'servicio' ? '🛠 Servicio' : '📦 Producto'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Descripción</label>
                <input className="input" value={visitForm.description} onChange={e => setVisitForm(f=>({...f,description:e.target.value}))}
                  placeholder={visitForm.type==='servicio' ? 'Consulta, vacuna, cirugía...' : 'Alimento, medicamento, accesorio...'} />
              </div>
              <div>
                <label className="label">Precio</label>
                <input className="input" type="number" value={visitForm.price} onChange={e => setVisitForm(f=>({...f,price:e.target.value}))} placeholder="0.00" />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowVisit(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveVisit} disabled={!visitForm.description} style={{ flex:2, justifyContent:'center' }}>Registrar visita</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL NUEVA CONSULTA ===== */}
      {showRecord && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowRecord(false)}>
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
                <button className="btn btn-primary" onClick={saveRecord} style={{ flex:2, justifyContent:'center' }}>
                  Guardar consulta {isLumi(selected) ? '(+15 pts)' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL ACTUALIZAR CARNET ===== */}
      {showCarnet && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowCarnet(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 6px' }}>💉 Actualizar carnet digital</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 20px' }}>{selected.pets?.name} · {selected.pets?.lumi_id}</p>

            {carnetStep === 'code' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ background:'#FEF3C7', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#92400E' }}>
                  <strong>¿Cómo obtener el código?</strong><br/>
                  Pide al dueño que abra su Lumi App → Perfil de mascota → Carnet → Código de autorización.
                </div>
                <div>
                  <label className="label">Código de autorización</label>
                  <input className="input" value={carnetCode} onChange={e => { setCarnetCode(e.target.value.toUpperCase()); setCarnetError('') }}
                    placeholder="Código del dueño" style={{ letterSpacing:'2px', fontFamily:'monospace', textAlign:'center', fontSize:16 }} />
                  {carnetError && <p style={{ fontSize:12, color:'var(--red)', margin:'4px 0 0' }}>{carnetError}</p>}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowCarnet(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={verifyCarnetCode} disabled={!carnetCode.trim()} style={{ flex:2, justifyContent:'center' }}>Verificar código</button>
                </div>
              </div>
            )}

            {carnetStep === 'form' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'#DCFCE7', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#15803D', fontWeight:600 }}>
                  ✓ Código verificado — agrega la vacuna al carnet
                </div>
                <div>
                  <label className="label">Nombre de la vacuna *</label>
                  <input className="input" value={vaccineForm.name} onChange={e => setVaccineForm(f=>({...f,name:e.target.value}))} placeholder="Rabia, Moquillo, Parvovirus..." />
                </div>
                <div className="grid-2">
                  <div>
                    <label className="label">Fecha de aplicación *</label>
                    <input className="input" type="date" value={vaccineForm.date} onChange={e => setVaccineForm(f=>({...f,date:e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Fecha de refuerzo</label>
                    <input className="input" type="date" value={vaccineForm.next_date} onChange={e => setVaccineForm(f=>({...f,next_date:e.target.value}))} />
                  </div>
                </div>
                <div>
                  <label className="label">Notas</label>
                  <input className="input" value={vaccineForm.notes} onChange={e => setVaccineForm(f=>({...f,notes:e.target.value}))} placeholder="Laboratorio, lote, dosis..." />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" onClick={() => setCarnetStep('code')} style={{ flex:1, justifyContent:'center' }}>Atrás</button>
                  <button className="btn btn-primary" onClick={saveVaccine} disabled={!vaccineForm.name || !vaccineForm.date} style={{ flex:2, justifyContent:'center' }}>Guardar en carnet</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MODAL NUEVO PACIENTE ===== */}
      {showNew && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowNew(false)}>
          <div className="modal" style={{ maxWidth:540 }}>
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 16px' }}>Nuevo paciente</p>
            <div style={{ display:'flex', marginBottom:20, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              <button onClick={() => setTab('lumi')} style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', background: tab==='lumi' ? '#6B21A8' : 'white', color: tab==='lumi' ? 'white' : 'var(--text-secondary)' }}>🐾 Paciente Lumi</button>
              <button onClick={() => setTab('regular')} style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', background: tab==='regular' ? '#6B21A8' : 'white', color: tab==='regular' ? 'white' : 'var(--text-secondary)' }}>👤 Paciente Regular</button>
            </div>

            {tab === 'lumi' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>
                  Ingresa el código Lumi del dueño (ej: <strong>LMI-2026-L1RD62</strong>) para cargar automáticamente los datos.
                </p>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="input" value={lumiCode} onChange={e => { setLumiCode(e.target.value.toUpperCase()); setLumiError(''); setLumiSearch(null) }}
                    placeholder="LMI-2026-XXXXXX" style={{ flex:1, fontFamily:'monospace', letterSpacing:'1px' }}
                    onKeyDown={e => e.key==='Enter' && searchLumiCode()} />
                  <button className="btn btn-primary" onClick={searchLumiCode} disabled={lumiLoading || !lumiCode.trim()}>
                    {lumiLoading ? '...' : <><i className="ti ti-search" /> Buscar</>}
                  </button>
                </div>
                {lumiError && <p style={{ fontSize:13, color:'var(--red)', margin:0 }}>{lumiError}</p>}
                {lumiSearch && (
                  <div style={{ background:'#F5F3FF', border:'1.5px solid #6B21A8', borderRadius:12, padding:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:52, height:52, borderRadius:12, overflow:'hidden', background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {lumiSearch.pet.photo_url ? <img src={lumiSearch.pet.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <i className="ti ti-paw" style={{ color:'var(--purple)', fontSize:22 }} />}
                      </div>
                      <div>
                        <p style={{ fontSize:16, fontWeight:800, margin:'0 0 2px' }}>{lumiSearch.pet.name}</p>
                        <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0 }}>{lumiSearch.pet.species} · {lumiSearch.pet.breed} · {lumiSearch.pet.gender}</p>
                        <p style={{ fontSize:12, color:'var(--purple)', fontWeight:600, margin:'2px 0 0' }}>Dueño: {lumiSearch.pet.profiles?.name}</p>
                      </div>
                    </div>
                    {lumiSearch.lastVisit && (
                      <div style={{ background:'white', borderRadius:8, padding:'8px 12px', fontSize:12, color:'var(--text-secondary)', marginBottom:12 }}>
                        <strong>Última visita aquí:</strong> {new Date(lumiSearch.lastVisit.date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}
                        {lumiSearch.lastVisit.diagnosis && <> · {lumiSearch.lastVisit.diagnosis}</>}
                      </div>
                    )}
                    <button className="btn btn-primary" onClick={registerLumiPatient} style={{ width:'100%', justifyContent:'center' }}>
                      <i className="ti ti-user-plus" /> Registrar en mi clínica
                    </button>
                  </div>
                )}
                <button className="btn btn-secondary" onClick={() => setShowNew(false)} style={{ justifyContent:'center' }}>Cancelar</button>
              </div>
            )}

            {tab === 'regular' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <p style={{ fontSize:13, fontWeight:700, color:'var(--purple)', textTransform:'uppercase', letterSpacing:'0.5px', margin:0 }}>Datos del dueño</p>
                <div className="grid-2">
                  <div style={{ gridColumn:'1/-1' }}>
                    <label className="label">Nombre completo *</label>
                    <input className="input" value={newForm.owner_name} onChange={e => setNewForm(f=>({...f,owner_name:e.target.value}))} placeholder="Juan García" />
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <input className="input" value={newForm.owner_phone} onChange={e => setNewForm(f=>({...f,owner_phone:e.target.value}))} placeholder="9981234567" />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" type="email" value={newForm.owner_email} onChange={e => setNewForm(f=>({...f,owner_email:e.target.value}))} placeholder="juan@email.com" />
                  </div>
                </div>
                <p style={{ fontSize:13, fontWeight:700, color:'var(--purple)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'8px 0 0' }}>Datos de la mascota</p>
                <div className="grid-2">
                  <div style={{ gridColumn:'1/-1' }}>
                    <label className="label">Nombre *</label>
                    <input className="input" value={newForm.pet_name} onChange={e => setNewForm(f=>({...f,pet_name:e.target.value}))} placeholder="Max" />
                  </div>
                  <div>
                    <label className="label">Especie</label>
                    <select className="input" value={newForm.species} onChange={e => setNewForm(f=>({...f,species:e.target.value}))}>
                      {['perro','gato','conejo','ave','reptil','otro'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Raza</label>
                    <input className="input" value={newForm.breed} onChange={e => setNewForm(f=>({...f,breed:e.target.value}))} placeholder="Labrador..." />
                  </div>
                  <div>
                    <label className="label">Género</label>
                    <select className="input" value={newForm.gender} onChange={e => setNewForm(f=>({...f,gender:e.target.value}))}>
                      <option value="macho">Macho</option>
                      <option value="hembra">Hembra</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Peso (kg)</label>
                    <input className="input" type="number" step="0.1" value={newForm.weight} onChange={e => setNewForm(f=>({...f,weight:e.target.value}))} placeholder="5.0" />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label className="label">Notas</label>
                    <textarea className="input" rows={2} value={newForm.notes} onChange={e => setNewForm(f=>({...f,notes:e.target.value}))} placeholder="Alergias, condiciones previas..." style={{ resize:'vertical' }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowNew(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={saveNewPatient} disabled={!newForm.owner_name || !newForm.pet_name} style={{ flex:2, justifyContent:'center' }}>Guardar paciente</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
