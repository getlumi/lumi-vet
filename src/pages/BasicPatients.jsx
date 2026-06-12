import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TYPE_LABELS = {
  consulta:    'Consulta',
  bano:        'Baño',
  compra:      'Compra',
  otro:        'Otro',
  carnet:      'Carnet',
  certificado: 'Certificado',
}

const calcAge = (bd) => {
  if (!bd) return null
  const y = Math.floor((Date.now() - new Date(bd)) / (1000 * 60 * 60 * 24 * 365.25))
  return y > 0 ? `${y} años` : 'Cachorro'
}

export default function BasicPatients({ clinic, onNavigate }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [records, setRecords]   = useState([])
  const [vaccines, setVaccines] = useState([])
  const [certificates, setCertificates] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => { fetchPatients() }, [])

  const fetchPatients = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vet_patients')
      .select('*, pets(id,name,breed,photo_url,birthdate,gender,lumi_id,pet_type), profiles(id,name,phone,email)')
      .eq('clinic_id', clinic.id)
      .order('last_visit', { ascending: false })
    if (error) console.error('[BasicPatients] fetch error:', error.message)
    setPatients(data || [])
    setLoading(false)
  }

  const openPatient = async (p) => {
    setSelected(p)
    setDetailLoading(true)
    const [recRes, vacRes, certRes] = await Promise.all([
      supabase.from('vet_records').select('*').eq('clinic_id', clinic.id).eq('pet_id', p.pet_id).order('created_at', { ascending: false }),
      supabase.from('vaccines').select('*').eq('pet_id', p.pet_id).order('created_at', { ascending: false }),
      supabase.from('health_certificates').select('*').eq('pet_id', p.pet_id).eq('clinic_id', clinic.id).order('issued_at', { ascending: false }),
    ])
    setRecords(recRes.data || [])
    setVaccines(vacRes.data || [])
    setCertificates(certRes.data || [])
    setDetailLoading(false)
  }

  const filtered = patients.filter(p => {
    const q = search.toLowerCase()
    return (p.pets?.name || '').toLowerCase().includes(q)
      || (p.profiles?.name || '').toLowerCase().includes(q)
      || (p.pets?.lumi_id || '').toLowerCase().includes(q.replace(/[^a-z0-9]/g, ''))
  })

  if (selected) {
    const pet = selected.pets
    const owner = selected.profiles
    return (
      <div className="basic-screen">
        <div className="basic-header">
          <button className="basic-back" onClick={() => setSelected(null)} aria-label="Volver">
            <i className="ti ti-arrow-left" />
          </button>
          <p className="basic-title">{pet?.name || 'Paciente'}</p>
        </div>

        <div className="basic-body">
          <div className="basic-pet-card">
            <div className="basic-pet-avatar">
              {pet?.photo_url ? <img src={pet.photo_url} alt="" /> : <i className="ti ti-paw" />}
            </div>
            <div>
              <p className="basic-pet-name">{pet?.name}</p>
              <p className="basic-pet-meta">{pet?.pet_type} · {pet?.breed} · {calcAge(pet?.birthdate)}</p>
              <p className="basic-pet-owner">{pet?.lumi_id}</p>
            </div>
          </div>

          <div className="card">
            <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dueño</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13 }}><i className="ti ti-user" style={{ color: 'var(--purple)', marginRight: 6 }} />{owner?.name || '—'}</span>
              {owner?.phone && <span style={{ fontSize: 13 }}><i className="ti ti-phone" style={{ color: 'var(--purple)', marginRight: 6 }} />{owner.phone}</span>}
              {owner?.email && <span style={{ fontSize: 13 }}><i className="ti ti-mail" style={{ color: 'var(--purple)', marginRight: 6 }} />{owner.email}</span>}
            </div>
          </div>

          {detailLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Cargando historial...</p>
          ) : (
            <>
              {vaccines.length > 0 && (
                <div className="card">
                  <p style={{ fontSize: 13, fontWeight: 800, margin: '0 0 12px' }}>Carnet de vacunas</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {vaccines.map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>{v.name}</p>
                          {v.notes && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{v.notes}</p>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 2px' }}>
                            {v.applied_date ? new Date(v.applied_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                          {v.next_date && <p style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 600, margin: 0 }}>Refuerzo: {new Date(v.next_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {certificates.length > 0 && (
                <div className="card" style={{ border: '1px solid #BAE6FD' }}>
                  <p style={{ fontSize: 13, fontWeight: 800, margin: '0 0 12px', color: '#0369A1' }}>Certificados de salud</p>
                  {certificates.map(c => {
                    const vigente = new Date(c.valid_until) >= new Date()
                    return (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: vigente ? '#F0F9FF' : '#F8F8F8', borderRadius: 8, marginBottom: 6, border: `1px solid ${vigente ? '#BAE6FD' : '#E5E7EB'}` }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: vigente ? '#0369A1' : 'var(--text-muted)', margin: 0 }}>
                            {c.condition === 'apto' ? 'APTO PARA VIAJAR' : c.condition === 'condicionado' ? 'APTO CON CONDICIONES' : 'NO APTO'}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                            Emitido: {new Date(c.issued_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, background: vigente ? '#DCFCE7' : '#FEE2E2', color: vigente ? '#16A34A' : '#DC2626', borderRadius: 10, padding: '2px 8px' }}>{vigente ? 'Vigente' : 'Vencido'}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="card">
                <p style={{ fontSize: 15, fontWeight: 800, margin: '0 0 16px' }}>Historial de visitas</p>
                {records.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Sin visitas registradas</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {records.map(r => (
                      <div key={r.id} style={{ padding: '12px', background: 'var(--bg)', borderRadius: 12, borderLeft: '3px solid var(--purple)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                            {new Date(r.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          {r.points_awarded > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                              +{r.points_awarded} pts
                            </span>
                          )}
                        </div>
                        {r.type && (
                          <span style={{ fontSize: 11, background: '#EDE9FE', color: '#6B21A8', borderRadius: 6, padding: '1px 8px', fontWeight: 700 }}>
                            {TYPE_LABELS[r.type] || r.type}
                          </span>
                        )}
                        {r.description && <p style={{ fontSize: 13, margin: '6px 0 0', color: 'var(--text-secondary)' }}>{r.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="basic-screen">
      <div className="basic-header">
        <button className="basic-back" onClick={() => onNavigate('home')} aria-label="Volver">
          <i className="ti ti-arrow-left" />
        </button>
        <p className="basic-title">Pacientes ({patients.length})</p>
      </div>

      <div className="basic-body">
        <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, dueño o código Lumi..." />

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <i className="ti ti-paw" style={{ fontSize: 36, display: 'block', marginBottom: 8 }} />
            <p style={{ fontSize: 13 }}>Sin pacientes registrados todavía</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(p => (
              <div key={p.id} onClick={() => openPatient(p)}
                style={{ padding: '12px 14px', background: 'white', borderRadius: 12, border: '1.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--purple-light)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.pets?.photo_url ? <img src={p.pets.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ti ti-paw" style={{ color: 'var(--purple)', fontSize: 20 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px' }}>{p.pets?.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{p.pets?.breed} · {calcAge(p.pets?.birthdate)}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Dueño: {p.profiles?.name || '—'}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {p.last_visit && <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 2px' }}>{new Date(p.last_visit + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>}
                  {p.visit_count > 0 && <span style={{ fontSize: 10, background: '#EDE9FE', color: '#6B21A8', borderRadius: 6, padding: '1px 6px', fontWeight: 700 }}>{p.visit_count} visitas</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
