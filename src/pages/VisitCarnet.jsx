import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  localToday, formatLumiId, searchPetByLumiCode,
  getVisitPoints, ensurePatientRegistered, grantVisitPoints, touchPatientVisit,
} from '../lib/visitHelpers'

export default function VisitCarnet({ clinic, onNavigate }) {
  // Paso 1: código Lumi
  const [code, setCode]           = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError]         = useState('')
  const [pet, setPet]              = useState(null)

  // Paso 2: código de autorización del dueño
  const [authCode, setAuthCode]   = useState('')
  const [authError, setAuthError] = useState('')
  const [authVerifying, setAuthVerifying] = useState(false)
  const [authVerified, setAuthVerified]   = useState(false)

  // Paso 3: form de vacuna
  const [vaccineForm, setVaccineForm] = useState({ name: '', date: '', next_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

  const handleSearch = async () => {
    setError(''); setPet(null); setAuthVerified(false); setAuthCode(''); setAuthError(''); setSuccess(null)
    setSearching(true)
    const { pet: found, error: err } = await searchPetByLumiCode(code)
    setSearching(false)
    if (err) { setError(err); return }
    setPet(found)
  }

  const handleVerifyAuth = async () => {
    setAuthError('')
    if (!authCode.trim()) return
    setAuthVerifying(true)
    const { data, error: err } = await supabase
      .from('vet_auth_codes')
      .select('*')
      .eq('pet_id', pet.id)
      .eq('code', authCode.trim())
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    setAuthVerifying(false)
    if (err || !data) { setAuthError('Código incorrecto o expirado.'); return }
    await supabase.from('vet_auth_codes').update({ used: true }).eq('id', data.id)
    setAuthVerified(true)
  }

  const reset = () => {
    setCode(''); setPet(null); setAuthCode(''); setAuthError(''); setAuthVerified(false)
    setVaccineForm({ name: '', date: '', next_date: '', notes: '' })
    setError(''); setSuccess(null)
  }

  const canSave = pet && authVerified && vaccineForm.name && vaccineForm.date

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')

    try {
      const ownerId = pet.profiles?.id || null

      // 1. Guardar vacuna en carnet
      const { error: vacErr } = await supabase.from('vaccines').insert({
        pet_id: pet.id,
        name: vaccineForm.name,
        applied_date: vaccineForm.date,
        next_date: vaccineForm.next_date || null,
        notes: vaccineForm.notes || null,
        vet_clinic: clinic.name,
        vet_id: clinic.id,
        vet_nombre: clinic.nombre_vet || null,
        vet_cedula: clinic.cedula || null,
        registered_by: 'vet',
        status: 'applied',
      })
      if (vacErr) { setError(`Error al guardar vacuna: ${vacErr.message}`); setSaving(false); return }

      // 2. Calcular puntos y registrar como visita en el historial
      const points = await getVisitPoints(clinic.id, pet.id)
      const { data: record, error: recErr } = await supabase
        .from('vet_records')
        .insert({
          clinic_id: clinic.id,
          pet_id: pet.id,
          date: localToday(),
          type: 'carnet',
          description: `Vacuna: ${vaccineForm.name}`,
          vet_nombre: clinic.nombre_vet || null,
          vet_cedula: clinic.cedula || null,
          points_awarded: ownerId ? points : null,
        })
        .select()
        .single()
      if (recErr) console.error('[VisitCarnet] vet_records error:', recErr.message)

      // 3. Auto-registro y actualización de visita
      const { vetPatient, error: regErr } = await ensurePatientRegistered(clinic.id, pet, ownerId)
      if (regErr) console.error('[ensurePatientRegistered]', regErr)
      if (vetPatient) await touchPatientVisit(vetPatient.id, vetPatient.visit_count)

      // 4. Otorgar puntos
      if (ownerId && record) {
        await grantVisitPoints({ clinicId: clinic.id, ownerId, petId: pet.id, recordId: record.id, points })
      }

      // 5. Notificar al dueño del carnet actualizado
      if (ownerId) {
        await supabase.from('notifications').insert({
          user_id: ownerId,
          type: 'vaccine_update',
          title: 'Carnet actualizado',
          body: `Tu veterinaria registró la vacuna "${vaccineForm.name}" para ${pet.name}.`,
          from_pet_id: pet.id,
          data: JSON.stringify({ pet_id: pet.id, vaccine: vaccineForm.name }),
          read: false,
        })
      }

      setSuccess({ points: ownerId ? points : 0, ownerName: pet.profiles?.name || 'el dueño' })
    } catch (e) {
      setError(`Error inesperado: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="basic-screen">
      <div className="basic-header">
        <button className="basic-back" onClick={() => onNavigate('home')} aria-label="Volver">
          <i className="ti ti-arrow-left" />
        </button>
        <p className="basic-title">Actualizar carnet</p>
      </div>

      <div className="basic-body">
        {success ? (
          <div className="basic-success">
            <div className="basic-success-icon"><i className="ti ti-check" /></div>
            <p className="basic-success-title">Carnet actualizado</p>
            <p className="basic-success-text">
              {success.points > 0
                ? `+${success.points} puntos otorgados a ${success.ownerName}`
                : 'No se otorgaron puntos.'}
            </p>
            <button className="btn btn-primary" style={{ justifyContent: 'center', width: '100%' }} onClick={reset}>
              Actualizar otro carnet
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
              <div className="basic-pet-card">
                <div className="basic-pet-avatar">
                  {pet.photo_url ? <img src={pet.photo_url} alt="" /> : <i className="ti ti-paw" />}
                </div>
                <div>
                  <p className="basic-pet-name">{pet.name}</p>
                  <p className="basic-pet-meta">{pet.pet_type} · {pet.breed || 'Sin raza'}</p>
                  <p className="basic-pet-owner">Dueño: {pet.profiles?.name || 'Sin cuenta vinculada'}</p>
                </div>
              </div>
            )}

            {pet && !authVerified && (
              <div className="basic-field">
                <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#92400E', marginBottom: 10 }}>
                  <strong>Cómo obtener el código:</strong> Lumi App → Carnet → Autorizar veterinario
                </div>
                <label className="label">Código de autorización del dueño</label>
                <input
                  className="input"
                  value={authCode}
                  onChange={e => { setAuthCode(e.target.value.toUpperCase()); setAuthError('') }}
                  placeholder="Código del dueño"
                  style={{ letterSpacing: '2px', fontFamily: 'var(--font-mono)', textAlign: 'center', fontSize: 16 }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyAuth()}
                />
                {authError && <p style={{ fontSize: 12, color: 'var(--red)', margin: '4px 0 0' }}>{authError}</p>}
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                  onClick={handleVerifyAuth} disabled={!authCode.trim() || authVerifying}>
                  {authVerifying ? 'Verificando...' : 'Verificar código'}
                </button>
              </div>
            )}

            {pet && authVerified && (
              <>
                <div style={{ background: '#DCFCE7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#15803D', fontWeight: 600 }}>
                  Código verificado
                </div>
                {(clinic.nombre_vet || clinic.cedula) && (
                  <div style={{ background: 'rgba(107,33,168,0.05)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#6B21A8' }}>
                    <i className="ti ti-certificate" style={{ marginRight: 6 }} />
                    {clinic.nombre_vet} {clinic.cedula ? `· Ced. ${clinic.cedula}` : ''}
                  </div>
                )}
                <div className="basic-field">
                  <label className="label">Nombre de la vacuna *</label>
                  <input className="input" value={vaccineForm.name}
                    onChange={e => setVaccineForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Rabia, Moquillo, Parvovirus..." />
                </div>
                <div className="grid-2">
                  <div className="basic-field">
                    <label className="label">Fecha de aplicación *</label>
                    <input className="input" type="date" value={vaccineForm.date}
                      onChange={e => setVaccineForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="basic-field">
                    <label className="label">Fecha de refuerzo</label>
                    <input className="input" type="date" value={vaccineForm.next_date}
                      onChange={e => setVaccineForm(f => ({ ...f, next_date: e.target.value }))} />
                  </div>
                </div>
                <div className="basic-field">
                  <label className="label">Notas</label>
                  <input className="input" value={vaccineForm.notes}
                    onChange={e => setVaccineForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Laboratorio, lote, dosis..." />
                </div>

                {error && <p style={{ fontSize: 13, color: 'var(--red)', margin: 0 }}>{error}</p>}

                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                  onClick={handleSave} disabled={!canSave || saving}>
                  {saving ? 'Guardando...' : 'Guardar en carnet'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
