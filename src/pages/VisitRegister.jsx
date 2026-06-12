import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  localToday, formatLumiId, searchPetByLumiCode,
  getVisitPoints, ensurePatientRegistered, grantVisitPoints, touchPatientVisit,
} from '../lib/visitHelpers'

const VISIT_TYPES = [
  { id: 'consulta', label: 'Consulta', icon: 'ti-stethoscope' },
  { id: 'bano',     label: 'Baño',     icon: 'ti-bath' },
  { id: 'compra',   label: 'Compra',   icon: 'ti-shopping-cart' },
  { id: 'otro',     label: 'Otro',     icon: 'ti-dots' },
]

export default function VisitRegister({ clinic, onNavigate }) {
  const [code, setCode]           = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError]         = useState('')
  const [pet, setPet]              = useState(null)

  const [visitType, setVisitType] = useState(null)
  const [otherReason, setOtherReason] = useState('')
  const [saving, setSaving]       = useState(false)
  const [success, setSuccess]     = useState(null)

  const handleSearch = async () => {
    setError(''); setSuccess(null); setPet(null)
    setSearching(true)
    const { pet: found, error: err } = await searchPetByLumiCode(code)
    setSearching(false)
    if (err) { setError(err); return }
    setPet(found)
  }

  const reset = () => {
    setCode(''); setPet(null); setVisitType(null); setOtherReason('')
    setError(''); setSuccess(null)
  }

  const canRegister = pet && visitType && (visitType !== 'otro' || otherReason.trim())

  const handleRegister = async () => {
    if (!canRegister) return
    setSaving(true)
    setError('')

    try {
      const ownerId = pet.profiles?.id || null
      const points = await getVisitPoints(clinic.id, pet.id)

      const description = visitType === 'otro' ? otherReason.trim() : null

      const { data: record, error: insErr } = await supabase
        .from('vet_records')
        .insert({
          clinic_id: clinic.id,
          pet_id: pet.id,
          date: localToday(),
          type: visitType,
          description,
          vet_nombre: clinic.nombre_vet || null,
          vet_cedula: clinic.cedula || null,
          points_awarded: ownerId ? points : null,
        })
        .select()
        .single()

      if (insErr) { setError(`Error al guardar: ${insErr.message}`); setSaving(false); return }

      const { vetPatient, error: regErr } = await ensurePatientRegistered(clinic.id, pet, ownerId)
      if (regErr) console.error('[ensurePatientRegistered]', regErr)
      if (vetPatient) await touchPatientVisit(vetPatient.id, vetPatient.visit_count)

      if (ownerId) {
        await grantVisitPoints({ clinicId: clinic.id, ownerId, petId: pet.id, recordId: record.id, points })
      }

      setSuccess({ points: ownerId ? points : 0, ownerName: pet.profiles?.name || 'el dueño' })
    } catch (e) {
      setError(`Error inesperado: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const todayLabel = new Date(localToday() + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="basic-screen">
      <div className="basic-header">
        <button className="basic-back" onClick={() => onNavigate('home')} aria-label="Volver">
          <i className="ti ti-arrow-left" />
        </button>
        <p className="basic-title">Registrar visita</p>
      </div>

      <div className="basic-body">
        {success ? (
          <div className="basic-success">
            <div className="basic-success-icon"><i className="ti ti-check" /></div>
            <p className="basic-success-title">Visita registrada</p>
            <p className="basic-success-text">
              {success.points > 0
                ? `+${success.points} puntos otorgados a ${success.ownerName}`
                : 'El paciente no tiene cuenta Lumi vinculada, no se otorgaron puntos.'}
            </p>
            <button className="btn btn-primary" style={{ justifyContent: 'center', width: '100%' }} onClick={reset}>
              Registrar otra visita
            </button>
          </div>
        ) : (
          <>
            <div className="basic-field">
              <label className="label">Código Lumi del paciente</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={code}
                  onChange={e => { setCode(formatLumiId(e.target.value)); setError(''); setPet(null) }}
                  placeholder="LMI-2026-XXXXXX"
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', letterSpacing: '1px', textAlign: 'center' }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn btn-primary" onClick={handleSearch} disabled={searching || !code.trim()}>
                  {searching ? '...' : 'Buscar'}
                </button>
              </div>
              {error && <p style={{ fontSize: 13, color: 'var(--red)', margin: '6px 0 0' }}>{error}</p>}
            </div>

            {pet && (
              <>
                <div className="basic-pet-card">
                  <div className="basic-pet-avatar">
                    {pet.photo_url
                      ? <img src={pet.photo_url} alt="" />
                      : <i className="ti ti-paw" />}
                  </div>
                  <div>
                    <p className="basic-pet-name">{pet.name}</p>
                    <p className="basic-pet-meta">{pet.pet_type} · {pet.breed || 'Sin raza'}</p>
                    <p className="basic-pet-owner">Dueño: {pet.profiles?.name || 'Sin cuenta vinculada'}</p>
                  </div>
                </div>

                <div className="basic-field">
                  <label className="label">Fecha</label>
                  <div className="basic-readonly">{todayLabel}</div>
                </div>

                <div className="basic-field">
                  <label className="label">Motivo de la visita</label>
                  <div className="basic-visit-grid">
                    {VISIT_TYPES.map(t => (
                      <button
                        key={t.id}
                        className={`basic-visit-btn ${visitType === t.id ? 'active' : ''}`}
                        onClick={() => setVisitType(t.id)}
                      >
                        <i className={`ti ${t.icon}`} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {visitType === 'otro' && (
                  <div className="basic-field">
                    <label className="label">Motivo *</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={otherReason}
                      onChange={e => setOtherReason(e.target.value)}
                      placeholder="Describe el motivo de la visita..."
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                )}

                {error && <p style={{ fontSize: 13, color: 'var(--red)', margin: 0 }}>{error}</p>}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                  onClick={handleRegister}
                  disabled={!canRegister || saving}
                >
                  {saving ? 'Registrando...' : 'Registrar visita'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
