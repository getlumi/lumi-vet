import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import {
  localToday, formatLumiId, searchPetByLumiCode,
  getVisitPoints, ensurePatientRegistered, grantVisitPoints, touchPatientVisit,
} from '../lib/visitHelpers'

const CONDITIONS = [
  { v: 'apto',          l: 'Apto para viajar',    c: '#16A34A' },
  { v: 'condicionado',  l: 'Apto con condiciones', c: '#D97706' },
  { v: 'no_apto',       l: 'No apto',             c: '#DC2626' },
]

export default function VisitCertificate({ clinic, onNavigate }) {
  const [code, setCode]           = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError]         = useState('')
  const [pet, setPet]              = useState(null)

  const [certForm, setCertForm] = useState({
    weight: '', temperature: '', condition: 'apto',
    observations: '', valid_days: '10', firma_pin: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

  const handleSearch = async () => {
    setError(''); setPet(null); setSuccess(null)
    setSearching(true)
    const { pet: found, error: err } = await searchPetByLumiCode(code)
    setSearching(false)
    if (err) { setError(err); return }
    setPet(found)
  }

  const reset = () => {
    setCode(''); setPet(null)
    setCertForm({ weight: '', temperature: '', condition: 'apto', observations: '', valid_days: '10', firma_pin: '' })
    setError(''); setSuccess(null)
  }

  const canSave = pet && (!clinic.firma_pin || certForm.firma_pin)

  const generateCertPDF = async (cert, vaccines) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 18
    const owner = pet.profiles

    doc.setFillColor(248, 248, 250); doc.rect(0, 0, W, 48, 'F')
    doc.setFillColor(107, 33, 168); doc.rect(0, 0, W, 3, 'F')
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
    doc.text(cert.clinic_name || clinic.name || 'Clinica Veterinaria', M, 22)
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120)
    if (clinic.address) doc.text(clinic.address, M, 29)
    if (clinic.phone)   doc.text('Tel: ' + clinic.phone, M, 34)
    doc.setFontSize(8); doc.setTextColor(107, 33, 168); doc.setFont('helvetica', 'bold')
    doc.text('LUMI', W - M, 18, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150)
    doc.text('Plataforma veterinaria digital', W - M, 23, { align: 'right' })
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
    doc.text('CERTIFICADO DE SALUD ANIMAL', W / 2, 58, { align: 'center' })
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150)
    doc.text('Documento oficial para tramites de viaje', W / 2, 64, { align: 'center' })
    doc.setDrawColor(220, 220, 225); doc.setLineWidth(0.4); doc.line(M, 68, W - M, 68)

    let y = 76
    doc.setFontSize(7.5); doc.setTextColor(140, 140, 140); doc.setFont('helvetica', 'normal')
    doc.text('No. ' + cert.id.slice(0, 8).toUpperCase(), M, y)
    doc.text('Emitido: ' + new Date(cert.issued_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, y, { align: 'center' })
    doc.text('Valido hasta: ' + new Date(cert.valid_until + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, y, { align: 'right' })
    y += 10

    const isApto = cert.condition === 'apto', isCond = cert.condition === 'condicionado'
    if (isApto) { doc.setFillColor(240,253,244); doc.setDrawColor(134,239,172); doc.setTextColor(22,163,74) }
    else if (isCond) { doc.setFillColor(255,247,237); doc.setDrawColor(217,119,6); doc.setTextColor(161,64,0) }
    else { doc.setFillColor(254,242,242); doc.setDrawColor(220,38,38); doc.setTextColor(185,28,26) }
    doc.setLineWidth(0.5); doc.roundedRect(M, y, W-(M*2), 14, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(isApto?'APTO PARA VIAJAR':isCond?'APTO CON CONDICIONES':'NO APTO PARA VIAJAR', W/2, y+9, { align:'center' })
    y += 20

    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(107,33,168)
    doc.text('DATOS DE LA MASCOTA', M, y)
    y += 4; doc.setDrawColor(220,220,225); doc.setLineWidth(0.3); doc.line(M,y,W-M,y); y += 6
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(30,30,30)
    doc.text(pet?.name || '—', M, y)
    if (pet?.lumi_id) { doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(107,33,168); doc.text('ID: '+pet.lumi_id, W-M, y, { align:'right' }) }
    y += 6
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80)
    const edad = pet?.birthdate ? Math.floor((Date.now()-new Date(pet.birthdate))/(1000*60*60*24*365.25))+' anos' : '—'
    doc.text('Especie: '+(pet?.pet_type||'—'), M, y)
    doc.text('Raza: '+(pet?.breed||'—'), M+45, y)
    doc.text('Genero: '+(pet?.gender||'—'), M+100, y)
    doc.text('Edad: '+edad, M+145, y)
    y += 6
    if (cert.weight || cert.temperature) {
      doc.setTextColor(100,100,100)
      if (cert.weight) doc.text('Peso: '+cert.weight+' kg', M, y)
      if (cert.temperature) doc.text('Temperatura: '+cert.temperature+' C', M+45, y)
      y += 6
    }
    y += 4

    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(107,33,168)
    doc.text('DATOS DEL PROPIETARIO', M, y)
    y += 4; doc.setDrawColor(220,220,225); doc.line(M,y,W-M,y); y += 6
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60)
    doc.text('Nombre: '+(owner?.name||'—'), M, y)
    if (owner?.phone) doc.text('Tel: '+owner.phone, M+90, y)
    y += 6
    if (owner?.email) { doc.text('Email: '+owner.email, M, y); y += 6 }
    y += 4

    if (cert.observations) {
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(107,33,168)
      doc.text('OBSERVACIONES', M, y)
      y += 4; doc.setDrawColor(220,220,225); doc.line(M,y,W-M,y); y += 6
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60)
      const obsLines = doc.splitTextToSize(cert.observations, W-(M*2))
      doc.text(obsLines, M, y); y += obsLines.length * 5 + 6
    }

    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(107,33,168)
    doc.text('VACUNAS REGISTRADAS', M, y)
    y += 4; doc.setDrawColor(220,220,225); doc.line(M,y,W-M,y); y += 6
    if (!vaccines || vaccines.length === 0) {
      doc.setFont('helvetica','italic'); doc.setFontSize(8.5); doc.setTextColor(160,160,160)
      doc.text('Sin vacunas registradas en el sistema', M, y); y += 8
    } else {
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(120,120,120)
      doc.text('VACUNA', M, y); doc.text('APLICADA', M+80, y); doc.text('REFUERZO', M+125, y); doc.text('ESTADO', W-M, y, { align:'right' })
      y += 3; doc.setDrawColor(200,200,205); doc.line(M,y,W-M,y); y += 5
      vaccines.slice(0,6).forEach(v => {
        if (y > 235) { doc.addPage(); y = 20 }
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(40,40,40)
        doc.text(v.name||'—', M, y)
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,80,80)
        const applied = v.applied_date ? new Date(v.applied_date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}) : '—'
        const next = v.next_date ? new Date(v.next_date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}) : '—'
        doc.text(applied, M+80, y); doc.text(next, M+125, y)
        if (v.registered_by==='vet') { doc.setTextColor(22,163,74); doc.setFont('helvetica','bold'); doc.text('Verificado', W-M, y, { align:'right' }) }
        else { doc.setTextColor(160,160,160); doc.setFont('helvetica','normal'); doc.text('Manual', W-M, y, { align:'right' }) }
        y += 4; doc.setDrawColor(235,235,238); doc.setLineWidth(0.2); doc.line(M,y,W-M,y); y += 4
      })
    }
    y += 6

    if (y > 230) { doc.addPage(); y = 20 }
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(40,40,40)
    doc.text('Dr. '+(cert.vet_nombre||clinic.nombre_vet||'Medico Veterinario'), M, y+23)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,100,100)
    const vetCedula = cert.vet_cedula || clinic.cedula
    if (vetCedula) doc.text('Cedula Profesional: '+vetCedula, M, y+29)
    doc.text(cert.clinic_name||clinic.name||'', M, y+35)

    if (cert.firma_verificada) {
      doc.setFillColor(220,252,231); doc.setDrawColor(134,239,172); doc.setLineWidth(0.5)
      doc.roundedRect(M, y+18, 90, 10, 2, 2, 'FD')
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(22,163,74)
      doc.text('Firmado digitalmente · Lumi Vet', M+3, y+25)
    }

    if (cert.codigo_verificacion) {
      const verifyUrl = 'https://lumi-app-indol.vercel.app?cert='+cert.codigo_verificacion
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data='+encodeURIComponent(verifyUrl)
      try {
        const qrImg = new Image(); qrImg.crossOrigin = 'anonymous'; qrImg.src = qrUrl
        await new Promise(resolve => { qrImg.onload = resolve; qrImg.onerror = resolve; setTimeout(resolve, 3000) })
        if (qrImg.complete && qrImg.naturalWidth > 0) {
          const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80
          canvas.getContext('2d').drawImage(qrImg, 0, 0, 80, 80)
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', W-M-22, y+15, 22, 22)
        }
      } catch (e) {}
      doc.setFontSize(7); doc.setTextColor(100,100,100); doc.setFont('helvetica','bold')
      doc.text('Verificar autenticidad:', W-M, y+42, { align:'right' })
      doc.setFont('helvetica','normal'); doc.setTextColor(107,33,168)
      doc.text('lumi-app-indol.vercel.app?cert='+cert.codigo_verificacion, W-M, y+47, { align:'right' })
    }

    doc.setFillColor(248,248,250); doc.rect(0,277,W,20,'F')
    doc.setFillColor(107,33,168); doc.rect(0,277,W,1,'F')
    doc.setFontSize(7); doc.setTextColor(150,150,150); doc.setFont('helvetica','normal')
    doc.text('Documento generado por Lumi — La luz de tu mascota | hola@getlumi.mx', W/2, 282, { align:'center' })
    doc.text('Los requisitos de viaje pueden variar segun destino. Verifique con las autoridades antes de viajar.', W/2, 287, { align:'center' })
    doc.save('Certificado_Salud_'+(pet?.name||'mascota')+'_'+new Date().toISOString().slice(0,10)+'.pdf')
  }

  const handleSave = async () => {
    if (!canSave) return
    if (clinic.firma_pin && certForm.firma_pin !== clinic.firma_pin) {
      setError('PIN incorrecto. Verifica tu PIN de firma en Ajustes.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const ownerId = pet.profiles?.id || null
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + parseInt(certForm.valid_days || 10))
      const firmaVerificada = !!(clinic.firma_pin && certForm.firma_pin === clinic.firma_pin)

      const { data: cert, error: certErr } = await supabase.from('health_certificates').insert({
        pet_id: pet.id, clinic_id: clinic.id,
        vet_nombre: clinic.nombre_vet || null, vet_cedula: clinic.cedula || null,
        clinic_name: clinic.name, clinic_logo_url: clinic.logo_url || null,
        weight: certForm.weight ? parseFloat(certForm.weight) : null,
        temperature: certForm.temperature ? parseFloat(certForm.temperature) : null,
        condition: certForm.condition, observations: certForm.observations || null,
        valid_until: validUntil.toISOString().slice(0, 10), firma_verificada: firmaVerificada,
      }).select().single()
      if (certErr) { setError(`Error: ${certErr.message}`); setSaving(false); return }

      const codigoVerificacion = cert.id.replace(/-/g, '').slice(0, 8).toUpperCase()
      await supabase.from('health_certificates').update({ codigo_verificacion: codigoVerificacion }).eq('id', cert.id)
      const certConCodigo = { ...cert, codigo_verificacion: codigoVerificacion, firma_verificada: firmaVerificada }

      if (ownerId) {
        await supabase.from('notifications').insert({
          user_id: ownerId, type: 'health_certificate',
          title: 'Certificado de salud emitido',
          body: `${clinic.name} emitió un certificado de salud para ${pet.name}. Válido hasta el ${validUntil.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}.`,
          from_pet_id: pet.id, data: JSON.stringify({ cert_id: cert.id }), read: false,
        })
      }

      const { data: vaccines } = await supabase.from('vaccines').select('*').eq('pet_id', pet.id).order('created_at', { ascending: false })

      const points = await getVisitPoints(clinic.id, pet.id)
      const { data: record, error: recErr } = await supabase
        .from('vet_records')
        .insert({
          clinic_id: clinic.id,
          pet_id: pet.id,
          date: localToday(),
          type: 'certificado',
          description: `Certificado de salud emitido (${CONDITIONS.find(c => c.v === certForm.condition)?.l || certForm.condition})`,
          vet_nombre: clinic.nombre_vet || null,
          vet_cedula: clinic.cedula || null,
          points_awarded: ownerId ? points : null,
        })
        .select()
        .single()
      if (recErr) console.error('[VisitCertificate] vet_records error:', recErr.message)

      const { vetPatient, error: regErr } = await ensurePatientRegistered(clinic.id, pet, ownerId)
      if (regErr) console.error('[ensurePatientRegistered]', regErr)
      if (vetPatient) await touchPatientVisit(vetPatient.id, vetPatient.visit_count)

      if (ownerId && record) {
        await grantVisitPoints({ clinicId: clinic.id, ownerId, petId: pet.id, recordId: record.id, points })
      }

      await generateCertPDF(certConCodigo, vaccines || [])

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
        <p className="basic-title">Certificado de salud</p>
      </div>

      <div className="basic-body">
        {success ? (
          <div className="basic-success">
            <div className="basic-success-icon"><i className="ti ti-check" /></div>
            <p className="basic-success-title">Certificado emitido</p>
            <p className="basic-success-text">
              {success.points > 0
                ? `+${success.points} puntos otorgados a ${success.ownerName}. El PDF se descargó automáticamente.`
                : 'El PDF se descargó automáticamente.'}
            </p>
            <button className="btn btn-primary" style={{ justifyContent: 'center', width: '100%' }} onClick={reset}>
              Emitir otro certificado
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
                    {pet.photo_url ? <img src={pet.photo_url} alt="" /> : <i className="ti ti-paw" />}
                  </div>
                  <div>
                    <p className="basic-pet-name">{pet.name}</p>
                    <p className="basic-pet-meta">{pet.pet_type} · {pet.breed || 'Sin raza'}</p>
                    <p className="basic-pet-owner">Dueño: {pet.profiles?.name || 'Sin cuenta vinculada'}</p>
                  </div>
                </div>

                {(!clinic.cedula || !clinic.nombre_vet) && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
                    Completa tu cédula profesional en Ajustes para que el certificado tenga validez oficial.
                  </div>
                )}
                {(clinic.nombre_vet || clinic.cedula) && (
                  <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="ti ti-certificate" style={{ fontSize: 16, color: '#0369A1' }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#0369A1', margin: 0 }}>Dr. {clinic.nombre_vet}</p>
                      {clinic.cedula && <p style={{ fontSize: 11, color: '#0369A1', margin: 0, opacity: 0.7 }}>Cédula: {clinic.cedula} · {clinic.name}</p>}
                    </div>
                  </div>
                )}

                <div className="grid-2">
                  <div className="basic-field">
                    <label className="label">Peso (kg)</label>
                    <input className="input" type="number" step="0.1" value={certForm.weight}
                      onChange={e => setCertForm(f => ({ ...f, weight: e.target.value }))} placeholder="3.5" />
                  </div>
                  <div className="basic-field">
                    <label className="label">Temperatura (C)</label>
                    <input className="input" type="number" step="0.1" value={certForm.temperature}
                      onChange={e => setCertForm(f => ({ ...f, temperature: e.target.value }))} placeholder="38.5" />
                  </div>
                </div>

                <div className="basic-field">
                  <label className="label">Dictamen *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {CONDITIONS.map(o => (
                      <button key={o.v} onClick={() => setCertForm(f => ({ ...f, condition: o.v }))}
                        style={{
                          padding: '8px 4px', borderRadius: 8,
                          border: `2px solid ${certForm.condition === o.v ? o.c : 'var(--border)'}`,
                          background: certForm.condition === o.v ? `${o.c}10` : 'white',
                          cursor: 'pointer', fontSize: 11, fontWeight: 700,
                          color: certForm.condition === o.v ? o.c : 'var(--text-secondary)',
                        }}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="basic-field">
                  <label className="label">Observaciones</label>
                  <textarea className="input" rows={3} value={certForm.observations}
                    onChange={e => setCertForm(f => ({ ...f, observations: e.target.value }))}
                    placeholder="Estado general, condiciones especiales..." style={{ resize: 'vertical' }} />
                </div>

                <div className="basic-field">
                  <label className="label">Válido por (días)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['7', '10', '30'].map(d => (
                      <button key={d} onClick={() => setCertForm(f => ({ ...f, valid_days: d }))}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 8,
                          border: `2px solid ${certForm.valid_days === d ? '#0369A1' : 'var(--border)'}`,
                          background: certForm.valid_days === d ? '#E0F2FE' : 'white',
                          cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          color: certForm.valid_days === d ? '#0369A1' : 'var(--text-secondary)',
                        }}>
                        {d} días
                      </button>
                    ))}
                  </div>
                </div>

                {clinic.firma_pin && (
                  <div style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#0369A1', margin: '0 0 8px' }}>
                      <i className="ti ti-shield-check" style={{ marginRight: 6 }} />PIN de firma digital — requerido para certificar
                    </p>
                    <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder="Ingresa tu PIN de firma"
                      value={certForm.firma_pin}
                      onChange={e => setCertForm(f => ({ ...f, firma_pin: e.target.value.replace(/\D/g, '') }))}
                      style={{ letterSpacing: '4px', fontSize: 16, textAlign: 'center' }} />
                  </div>
                )}

                {error && <p style={{ fontSize: 13, color: 'var(--red)', margin: 0 }}>{error}</p>}

                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4, background: '#0369A1', borderColor: '#0369A1' }}
                  onClick={handleSave} disabled={!canSave || saving}>
                  <i className="ti ti-file-download" style={{ fontSize: 15 }} />
                  {saving ? 'Generando...' : 'Emitir certificado + PDF'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
