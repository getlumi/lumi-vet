import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'

const HOURS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']

export default function Patients({ clinic, openNew }) {
  const [tab, setTab]                       = useState('todos')
  const [lumiPatients, setLumiPatients]     = useState([])
  const [regularPatients, setRegularPatients] = useState([])
  const [inventory, setInventory]           = useState([])
  const [search, setSearch]                 = useState('')
  const [selected, setSelected]             = useState(null)
  const [selectedType, setSelectedType]     = useState(null)
  const [records, setRecords]               = useState([])
  const [vaccines, setVaccines]             = useState([])
  const [certificates, setCertificates]     = useState([])
  const [showRecord, setShowRecord]         = useState(false)
  const [showNew, setShowNew]               = useState(openNew || false)
  const [showVisit, setShowVisit]           = useState(false)
  const [showCarnet, setShowCarnet]         = useState(false)
  const [showAppt, setShowAppt]             = useState(false)
  const [showCert, setShowCert]             = useState(false)
  const [pointsMsg, setPointsMsg]           = useState(null)
  const [saving, setSaving]                 = useState(false)

  const [lumiCode, setLumiCode]             = useState('')
  const [lumiSearch, setLumiSearch]         = useState(null)
  const [lumiLoading, setLumiLoading]       = useState(false)
  const [lumiError, setLumiError]           = useState('')

  const [carnetCode, setCarnetCode]         = useState('')
  const [carnetError, setCarnetError]       = useState('')
  const [carnetStep, setCarnetStep]         = useState('code')
  const [vaccineForm, setVaccineForm]       = useState({ name:'', date:'', next_date:'', notes:'' })

  const [visitType, setVisitType]           = useState('servicio')
  const [serviceDesc, setServiceDesc]       = useState('')
  const [servicePrice, setServicePrice]     = useState('')
  const [cartItems, setCartItems]           = useState([])
  const [invSearch, setInvSearch]           = useState('')

  const [recordForm, setRecordForm]         = useState({ diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:'' })
  const [apptForm, setApptForm]             = useState({ date: new Date().toISOString().slice(0,10), time:'09:00', notes:'', status:'confirmed', price:'', lumi_code:'' })
  const [newForm, setNewForm]               = useState({ owner_name:'', owner_phone:'', owner_email:'', pet_name:'', pet_type:'perro', breed:'', weight:'', gender:'macho', notes:'' })

  // Certificado de salud
  const [certForm, setCertForm] = useState({
    weight: '', temperature: '', condition: 'apto',
    observations: '', valid_days: '10'
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: lumi, error: lumiErr } = await supabase
      .from('vet_patients')
      .select('*, pets(id,name,breed,photo_url,birthdate,gender,lumi_id,pet_type,description), profiles(id,name,phone,email)')
      .eq('clinic_id', clinic.id)
    if (lumiErr) console.error('lumi error:', lumiErr.message)
    setLumiPatients(lumi || [])

    const { data: regular, error: regErr } = await supabase
      .from('vet_regular_patients').select('*').eq('clinic_id', clinic.id)
    if (regErr) console.error('regular error:', regErr.message)
    setRegularPatients(regular || [])

    const { data: inv } = await supabase
      .from('vet_inventory').select('id,name,unit,sale_price,stock,category')
      .eq('clinic_id', clinic.id).gt('stock', 0).order('name')
    setInventory(inv || [])
  }

  const fetchLumiRecords = async (petId) => {
    const [recRes, vacRes, certRes] = await Promise.all([
      supabase.from('vet_records').select('*').eq('clinic_id', clinic.id).eq('pet_id', petId).order('created_at', { ascending: false }),
      supabase.from('vaccines').select('*').eq('pet_id', petId).order('created_at', { ascending: false }),
      supabase.from('health_certificates').select('*').eq('pet_id', petId).eq('clinic_id', clinic.id).order('issued_at', { ascending: false }),
    ])
    setRecords(recRes.data || [])
    setVaccines(vacRes.data || [])
    setCertificates(certRes.data || [])
  }

  const fetchRegularRecords = async (patientId) => {
    const { data } = await supabase.from('vet_regular_records').select('*').eq('regular_patient_id', patientId).order('created_at', { ascending: false })
    setRecords(data || [])
    setVaccines([])
    setCertificates([])
  }

  const selectLumi    = async (p) => { setSelected(p); setSelectedType('lumi');    await fetchLumiRecords(p.pet_id) }
  const selectRegular = async (p) => { setSelected(p); setSelectedType('regular'); await fetchRegularRecords(p.id) }

  const searchLumiCode = async () => {
    if (!lumiCode.trim()) return
    setLumiLoading(true); setLumiError(''); setLumiSearch(null)
    const { data: pet } = await supabase.from('pets').select('*, profiles(id,name,phone,email)').eq('lumi_id', lumiCode.trim().toUpperCase()).single()
    if (!pet) { setLumiError('No se encontró ninguna mascota con ese código'); setLumiLoading(false); return }
    const { data: lastVisit } = await supabase.from('vet_records').select('*').eq('clinic_id', clinic.id).eq('pet_id', pet.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setLumiSearch({ pet, lastVisit })
    setLumiLoading(false)
  }

  const registerLumiPatient = async () => {
    if (!lumiSearch) return
    const { pet } = lumiSearch
    const { data: existing } = await supabase.from('vet_patients').select('id').eq('clinic_id', clinic.id).eq('pet_id', pet.id).maybeSingle()
    if (existing) { setLumiError('Esta mascota ya está registrada en tu clínica'); return }
    const { error } = await supabase.from('vet_patients').insert({ clinic_id: clinic.id, pet_id: pet.id, owner_id: pet.profiles?.id })
    if (error) { setLumiError(`Error: ${error.message}`); return }
    setShowNew(false); setLumiCode(''); setLumiSearch(null); setLumiError('')
    fetchAll()
  }

  const saveNewPatient = async () => {
    if (!newForm.owner_name.trim() || !newForm.pet_name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('vet_regular_patients').insert({
      clinic_id: clinic.id, owner_name: newForm.owner_name.trim(), owner_phone: newForm.owner_phone.trim(),
      owner_email: newForm.owner_email.trim(), pet_name: newForm.pet_name.trim(), species: newForm.pet_type,
      breed: newForm.breed.trim(), gender: newForm.gender, weight: newForm.weight ? parseFloat(newForm.weight) : null, notes: newForm.notes.trim(),
    })
    setSaving(false)
    if (!error) {
      setShowNew(false)
      setNewForm({ owner_name:'', owner_phone:'', owner_email:'', pet_name:'', pet_type:'perro', breed:'', weight:'', gender:'macho', notes:'' })
      fetchAll()
    }
  }

  const saveRecord = async () => {
    if (selectedType === 'lumi') {
      const { data: record } = await supabase.from('vet_records').insert({
        clinic_id: clinic.id, pet_id: selected.pet_id,
        date: new Date().toISOString().slice(0,10),
        vet_nombre: clinic.nombre_vet || null, vet_cedula: clinic.cedula || null,
        ...recordForm,
        weight: recordForm.weight ? parseFloat(recordForm.weight) : null,
        temperature: recordForm.temperature ? parseFloat(recordForm.temperature) : null,
      }).select().single()
      await supabase.from('vet_patients').update({ last_visit: new Date().toISOString().slice(0,10) }).eq('id', selected.id)
      if (record && selected.pets?.lumi_id && selected.owner_id) {
        await supabase.rpc('grant_visit_points', { p_clinic_id: clinic.id, p_owner_id: selected.owner_id, p_pet_id: selected.pet_id, p_record_id: record.id })
        setPointsMsg(`+15 puntos otorgados a ${selected.profiles?.name || 'el dueño'} 🎉`)
        setTimeout(() => setPointsMsg(null), 4000)
      }
      await fetchLumiRecords(selected.pet_id)
    } else {
      await supabase.from('vet_regular_records').insert({
        clinic_id: clinic.id, regular_patient_id: selected.id,
        date: new Date().toISOString().slice(0,10),
        ...recordForm,
        weight: recordForm.weight ? parseFloat(recordForm.weight) : null,
        temperature: recordForm.temperature ? parseFloat(recordForm.temperature) : null,
      })
      await supabase.from('vet_regular_patients').update({ last_visit: new Date().toISOString().slice(0,10) }).eq('id', selected.id)
      await fetchRegularRecords(selected.id)
    }
    setShowRecord(false)
    setRecordForm({ diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:'' })
  }

  const saveVisit = async () => {
    const today = new Date().toISOString().slice(0,10)
    const patientId = selectedType === 'lumi' ? selected.pet_id : selected.id
    const ownerId   = selectedType === 'lumi' ? selected.owner_id : null

    if (visitType === 'servicio') {
      if (selectedType === 'lumi') {
        await supabase.from('vet_transactions').insert({ clinic_id: clinic.id, pet_id: patientId, owner_id: ownerId, type:'income', category:'servicio', description: serviceDesc, amount: servicePrice ? parseFloat(servicePrice) : 0, date: today })
        await supabase.from('vet_records').insert({ clinic_id: clinic.id, pet_id: patientId, date: today, type:'servicio', description: serviceDesc, price: servicePrice ? parseFloat(servicePrice) : null, vet_nombre: clinic.nombre_vet || null, vet_cedula: clinic.cedula || null })
      } else {
        await supabase.from('vet_regular_records').insert({ clinic_id: clinic.id, regular_patient_id: selected.id, date: today, type:'servicio', description: serviceDesc, price: servicePrice ? parseFloat(servicePrice) : 0 })
      }
    } else {
      const totalAmount = cartItems.reduce((sum, c) => sum + c.qty * c.unit_price, 0)
      const productDesc = cartItems.map(c => `${c.name} x${c.qty}`).join(', ')
      for (const item of cartItems) {
        if (item.qty <= 0) continue
        if (selectedType === 'lumi') {
          await supabase.from('vet_transactions').insert({ clinic_id: clinic.id, pet_id: patientId, owner_id: ownerId, type:'income', category:'producto', description: `${item.name} x${item.qty}`, amount: item.qty * item.unit_price, date: today })
        } else {
          await supabase.from('vet_regular_records').insert({ clinic_id: clinic.id, regular_patient_id: selected.id, date: today, type:'producto', description: `${item.name} x${item.qty}`, price: item.qty * item.unit_price })
        }
        const invItem = inventory.find(i => i.id === item.inventory_id)
        if (invItem) await supabase.from('vet_inventory').update({ stock: Math.max(0, invItem.stock - item.qty) }).eq('id', item.inventory_id)
      }
      if (selectedType === 'lumi') {
        await supabase.from('vet_records').insert({ clinic_id: clinic.id, pet_id: patientId, date: today, type:'producto', description: productDesc, price: totalAmount, vet_nombre: clinic.nombre_vet || null, vet_cedula: clinic.cedula || null })
      }
    }

    if (selectedType === 'lumi') {
      await supabase.from('vet_patients').update({ last_visit: today, visit_count: (selected.visit_count || 0) + 1 }).eq('id', selected.id)
      if (selected.owner_id && selected.pet_id) {
        await supabase.rpc('grant_visit_points', { p_clinic_id: clinic.id, p_owner_id: selected.owner_id, p_pet_id: selected.pet_id, p_record_id: null, p_points: 8 })
        setPointsMsg(`+8 puntos otorgados a ${selected.profiles?.name || 'el dueño'} 🎉`)
        setTimeout(() => setPointsMsg(null), 4000)
      }
    } else {
      await supabase.from('vet_regular_patients').update({ last_visit: today, visit_count: (selected.visit_count || 0) + 1 }).eq('id', selected.id)
    }
    setShowVisit(false)
    setServiceDesc(''); setServicePrice(''); setCartItems([]); setInvSearch('')
    fetchAll()
  }

  const addToCart = (item) => {
    setCartItems(prev => {
      const existing = prev.find(c => c.inventory_id === item.id)
      if (existing) return prev.map(c => c.inventory_id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { inventory_id: item.id, name: item.name, qty: 1, unit_price: item.sale_price || 0, unit: item.unit }]
    })
  }

  const updateQty = (inventoryId, qty) => {
    if (qty <= 0) { setCartItems(prev => prev.filter(c => c.inventory_id !== inventoryId)); return }
    setCartItems(prev => prev.map(c => c.inventory_id === inventoryId ? { ...c, qty } : c))
  }

  const cartTotal = cartItems.reduce((sum, c) => sum + c.qty * c.unit_price, 0)

  const saveAppt = async () => {
    const petName   = selectedType === 'lumi' ? selected.pets?.name    : selected.pet_name
    const ownerName = selectedType === 'lumi' ? selected.profiles?.name : selected.owner_name
    await supabase.from('vet_appointments').insert({
      clinic_id: clinic.id, pet_id: selectedType === 'lumi' ? selected.pet_id : null,
      pet_name: petName, owner_name: ownerName, date: apptForm.date, time: apptForm.time,
      notes: apptForm.notes, status: apptForm.status, price: apptForm.price ? parseFloat(apptForm.price) : null,
    })
    setShowAppt(false)
    setApptForm({ date: new Date().toISOString().slice(0,10), time:'09:00', notes:'', status:'confirmed', price:'' })
    setPointsMsg('Cita agendada correctamente')
    setTimeout(() => setPointsMsg(null), 3000)
  }

  const verifyCarnetCode = async () => {
    setCarnetError('')
    const { data } = await supabase.from('vet_auth_codes').select('*')
      .eq('pet_id', selected.pet_id).eq('code', carnetCode.trim())
      .eq('used', false).gt('expires_at', new Date().toISOString()).maybeSingle()
    if (!data) { setCarnetError('Codigo incorrecto o expirado.'); return }
    await supabase.from('vet_auth_codes').update({ used: true }).eq('id', data.id)
    setCarnetStep('form')
  }

  const saveVaccine = async () => {
    const { error } = await supabase.from('vaccines').insert({
      pet_id: selected.pet_id, name: vaccineForm.name, applied_date: vaccineForm.date,
      next_date: vaccineForm.next_date || null, notes: vaccineForm.notes || null,
      vet_clinic: clinic.name, vet_id: clinic.id,
      vet_nombre: clinic.nombre_vet || null, vet_cedula: clinic.cedula || null,
      registered_by: 'vet', status: 'applied',
    })
    if (error) { setCarnetError(`Error: ${error.message}`); return }
    if (selected.owner_id) {
      await supabase.from('notifications').insert({
        user_id: selected.owner_id, type: 'vaccine_update',
        title: 'Carnet actualizado',
        body: `Tu veterinaria registro la vacuna "${vaccineForm.name}" para ${selected.pets?.name}.`,
        from_pet_id: selected.pet_id,
        data: JSON.stringify({ pet_id: selected.pet_id, vaccine: vaccineForm.name }), read: false,
      })
      await supabase.rpc('grant_visit_points', { p_clinic_id: clinic.id, p_owner_id: selected.owner_id, p_pet_id: selected.pet_id, p_record_id: null, p_points: 5 })
    }
    await fetchLumiRecords(selected.pet_id)
    setShowCarnet(false); setCarnetCode(''); setCarnetStep('code')
    setVaccineForm({ name:'', date:'', next_date:'', notes:'' })
    setPointsMsg('Carnet actualizado correctamente')
    setTimeout(() => setPointsMsg(null), 4000)
  }

  // Guardar certificado de salud + generar PDF
  const saveCertificate = async () => {
    setSaving(true)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + parseInt(certForm.valid_days || 10))

    const { data: cert, error } = await supabase.from('health_certificates').insert({
      pet_id:          selected.pet_id,
      clinic_id:       clinic.id,
      vet_nombre:      clinic.nombre_vet  || null,
      vet_cedula:      clinic.cedula      || null,
      clinic_name:     clinic.name,
      clinic_logo_url: clinic.logo_url    || null,
      weight:          certForm.weight    ? parseFloat(certForm.weight) : null,
      temperature:     certForm.temperature ? parseFloat(certForm.temperature) : null,
      condition:       certForm.condition,
      observations:    certForm.observations || null,
      valid_until:     validUntil.toISOString().slice(0,10),
    }).select().single()

    if (error) { console.error(error); setSaving(false); return }

    // Notificar al dueño
    if (selected.owner_id) {
      await supabase.from('notifications').insert({
        user_id: selected.owner_id, type: 'health_certificate',
        title: 'Certificado de salud emitido',
        body: `${clinic.name} emitio un certificado de salud para ${selected.pets?.name}. Valido hasta el ${validUntil.toLocaleDateString('es-MX',{day:'numeric',month:'long'})}.`,
        from_pet_id: selected.pet_id,
        data: JSON.stringify({ cert_id: cert.id }), read: false,
      })
    }

    // Generar PDF
    generateCertPDF(cert)

    await fetchLumiRecords(selected.pet_id)
    setShowCert(false)
    setCertForm({ weight:'', temperature:'', condition:'apto', observations:'', valid_days:'10' })
    setPointsMsg('Certificado de salud emitido correctamente')
    setTimeout(() => setPointsMsg(null), 4000)
    setSaving(false)
  }

  const generateCertPDF = (cert) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 20
    const pet = selected.pets
    const owner = selected.profiles

    // Borde exterior elegante
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(10, 10, W - 20, 277)
    doc.rect(12, 12, W - 24, 273)

    // Header
    doc.setFillColor(248, 245, 255)
    doc.rect(12, 12, W - 24, 40, 'F')

    // Logo / nombre clínica
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(107, 33, 168)
    doc.text(clinic.name || 'CLINICA VETERINARIA', M + 2, 30)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    if (clinic.address) doc.text(clinic.address, M + 2, 37)
    if (clinic.phone)   doc.text(`Tel: ${clinic.phone}`, M + 2, 42)

    // Título certificado
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(50, 50, 50)
    doc.text('CERTIFICADO DE SALUD ANIMAL', W/2, 62, { align: 'center' })

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text('Para uso en viajes y tramites oficiales', W/2, 68, { align: 'center' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(M, 72, W - M, 72)

    let y = 80

    // ID certificado
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`No. de certificado: ${cert.id.slice(0,8).toUpperCase()}`, W - M, y, { align: 'right' })
    doc.text(`Fecha de emision: ${new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}`, W - M, y + 5, { align: 'right' })
    doc.text(`Valido hasta: ${new Date(cert.valid_until+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}`, W - M, y + 10, { align: 'right' })

    // Datos mascota
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(107, 33, 168)
    doc.text('DATOS DE LA MASCOTA', M, y)
    y += 6

    doc.setFillColor(250, 248, 255)
    doc.rect(M, y, W - (M*2), 28, 'F')
    doc.setDrawColor(220, 210, 240)
    doc.rect(M, y, W - (M*2), 28)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30, 30, 30)
    doc.text(pet?.name || '—', M + 4, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    y += 6
    const edad = pet?.birthdate ? `${Math.floor((Date.now()-new Date(pet.birthdate))/(1000*60*60*24*365.25))} años` : '—'
    doc.text(`Especie: ${pet?.pet_type || '—'}`, M + 4, y)
    doc.text(`Raza: ${pet?.breed || '—'}`, M + 40, y)
    doc.text(`Genero: ${pet?.gender || '—'}`, M + 90, y)
    doc.text(`Edad: ${edad}`, M + 130, y)
    y += 6
    if (pet?.lumi_id) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(107, 33, 168)
      doc.text(`ID Lumi: ${pet.lumi_id}`, M + 4, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
    }
    if (certForm.weight)      doc.text(`Peso: ${certForm.weight} kg`, M + 60, y)
    if (certForm.temperature) doc.text(`Temp: ${certForm.temperature} C`, M + 100, y)
    y += 14

    // Dueño
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(107, 33, 168)
    doc.text('DATOS DEL PROPIETARIO', M, y)
    y += 6

    doc.setFillColor(250, 248, 255)
    doc.rect(M, y, W - (M*2), 18, 'F')
    doc.setDrawColor(220, 210, 240)
    doc.rect(M, y, W - (M*2), 18)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text(`Nombre: ${owner?.name || '—'}`, M + 4, y)
    if (owner?.phone) doc.text(`Tel: ${owner.phone}`, M + 90, y)
    y += 6
    if (owner?.email) doc.text(`Email: ${owner.email}`, M + 4, y)
    y += 16

    // Dictamen
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(107, 33, 168)
    doc.text('DICTAMEN DE SALUD', M, y)
    y += 6

    const condColor = cert.condition === 'apto' ? [22, 163, 74] : [220, 38, 38]
    doc.setFillColor(...condColor, 15)
    doc.rect(M, y, W - (M*2), 16, 'F')
    doc.setDrawColor(...condColor)
    doc.rect(M, y, W - (M*2), 16)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...condColor)
    const condLabel = cert.condition === 'apto' ? 'APTO PARA VIAJAR' : cert.condition === 'condicionado' ? 'APTO CON CONDICIONES' : 'NO APTO'
    doc.text(condLabel, W/2, y + 2, { align: 'center' })
    y += 18

    if (cert.observations) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      doc.text('Observaciones:', M, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(cert.observations, W - (M*2) - 4)
      doc.text(lines, M, y)
      y += lines.length * 5 + 6
    }

    // Vacunas
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(107, 33, 168)
    doc.text('VACUNAS REGISTRADAS', M, y)
    y += 6

    if (vaccines.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text('Sin vacunas registradas', M, y)
      y += 8
    } else {
      vaccines.slice(0, 5).forEach((v, idx) => {
        if (idx % 2 === 0) { doc.setFillColor(250, 248, 255) } else { doc.setFillColor(255, 255, 255) }
        doc.rect(M, y - 3, W - (M*2), 12, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(40, 40, 40)
        doc.text(v.name || '—', M + 2, y + 3)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        const applied = v.applied_date ? new Date(v.applied_date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}) : '—'
        doc.text(`Aplicada: ${applied}`, M + 60, y + 3)
        if (v.registered_by === 'vet') {
          doc.setTextColor(22, 163, 74)
          doc.setFont('helvetica', 'bold')
          doc.text('Verificado', W - M - 2, y + 3, { align: 'right' })
        }
        y += 12
      })
    }

    y += 8

    // Firma
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(M, y + 20, M + 70, y + 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text(clinic.nombre_vet ? `Dr. ${clinic.nombre_vet}` : 'Medico Veterinario', M, y + 25)
    if (clinic.cedula) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(`Cedula Profesional: ${clinic.cedula}`, M, y + 30)
    }
    doc.setFont('helvetica', 'normal')
    doc.text(clinic.name || '', M, y + 35)

    // Footer
    doc.setFillColor(248, 245, 255)
    doc.rect(12, 267, W - 24, 18, 'F')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.text('Documento generado por Lumi — La luz de tu mascota | lumi-app-indol.vercel.app', W/2, 274, { align: 'center' })
    doc.text('Los requisitos de viaje pueden variar. Verifique con autoridades competentes antes de viajar.', W/2, 279, { align: 'center' })

    doc.save(`Certificado_Salud_${pet?.name || 'mascota'}_${new Date().toISOString().slice(0,10)}.pdf`)
  }

  const calcAge = (bd) => {
    if (!bd) return null
    const y = Math.floor((Date.now() - new Date(bd)) / (1000*60*60*24*365.25))
    return y > 0 ? `${y} años` : 'Cachorro'
  }

  const allPatients = [
    ...lumiPatients.map(p => ({ ...p, _type:'lumi', _name: p.pets?.name, _owner: p.profiles?.name })),
    ...regularPatients.map(p => ({ ...p, _type:'regular', _name: p.pet_name, _owner: p.owner_name })),
  ].sort((a,b) => (b.last_visit||'2000-01-01').localeCompare(a.last_visit||'2000-01-01'))

  const formatLumiId = (raw) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (clean.length <= 3) return clean
    if (clean.length <= 7) return clean.slice(0,3) + '-' + clean.slice(3)
    return clean.slice(0,3) + '-' + clean.slice(3,7) + '-' + clean.slice(7,13)
  }

  const searchNorm = search.toLowerCase().replace(/[^a-z0-9]/g, '')
  const filteredAll = allPatients.filter(p => {
    const name   = p._name?.toLowerCase() || ''
    const owner  = p._owner?.toLowerCase() || ''
    const phone  = (p.profiles?.phone || p.owner_phone || '').replace(/\D/g, '')
    const lumiId = (p.pets?.lumi_id || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const searchQ = search.toLowerCase()
    const match = name.includes(searchQ) || owner.includes(searchQ) || phone.includes(searchNorm) || lumiId.includes(searchNorm) || (p.profiles?.email || p.owner_email || '').toLowerCase().includes(searchQ)
    if (tab === 'todos') return match
    return match && p._type === (tab === 'lumi' ? 'lumi' : 'regular')
  })

  const filteredInv = inventory.filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase()))
  const petName    = selectedType === 'lumi' ? selected?.pets?.name      : selected?.pet_name
  const ownerName  = selectedType === 'lumi' ? selected?.profiles?.name  : selected?.owner_name
  const ownerPhone = selectedType === 'lumi' ? selected?.profiles?.phone : selected?.owner_phone
  const ownerEmail = selectedType === 'lumi' ? selected?.profiles?.email : selected?.owner_email

  return (
    <div style={{ display:'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap:20 }}>

      {/* LISTA */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <p style={{ fontSize:20, fontWeight:800, margin:0 }}>Pacientes <span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>({allPatients.length})</span></p>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><i className="ti ti-plus" /> Nuevo</button>
        </div>

        {pointsMsg && <div style={{ background:'#DCFCE7', border:'1px solid #16A34A', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#15803D', fontWeight:600 }}>{pointsMsg}</div>}

        {(!clinic.cedula || !clinic.nombre_vet) && (
          <div style={{ background:'#FEF3C7', border:'1px solid #F59E0B', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400E' }}>
            <i className="ti ti-alert-triangle" style={{ marginRight:6 }} />
            <strong>Completa tu cedula profesional</strong> en Ajustes para emitir certificados con validez oficial.
          </div>
        )}

        <div style={{ display:'flex', marginBottom:14, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          {[{key:'todos',label:`Todos (${allPatients.length})`},{key:'lumi',label:`Lumi (${lumiPatients.length})`},{key:'regular',label:`Regular (${regularPatients.length})`}].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }}
              style={{ flex:1, padding:'9px 0', fontSize:12, fontWeight:700, border:'none', cursor:'pointer', background: tab===t.key ? '#6B21A8' : 'white', color: tab===t.key ? 'white' : 'var(--text-secondary)' }}>
              {t.label}
            </button>
          ))}
        </div>

        <input className="input" style={{ marginBottom:12 }} value={search}
          onChange={e => {
            const val = e.target.value
            if (/^[Ll]/.test(val) && !/[\s]/.test(val)) setSearch(formatLumiId(val))
            else setSearch(val)
          }}
          placeholder="Nombre, telefono o ID Lumi..." />

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filteredAll.map(p => {
            const isL = p._type === 'lumi'
            const isSel = selected?.id === p.id && selectedType === p._type
            return (
              <div key={`${p._type}-${p.id}`} onClick={() => isL ? selectLumi(p) : selectRegular(p)}
                style={{ padding:'12px 14px', background:'white', borderRadius:12, border:`1.5px solid ${isSel?'var(--purple)':'var(--border)'}`, cursor:'pointer', display:'flex', alignItems:'center', gap:10, boxShadow:'var(--shadow)' }}>
                <div style={{ width:44, height:44, borderRadius:12, background: isL?'var(--purple-light)':'#F1F5F9', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {isL && p.pets?.photo_url ? <img src={p.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <i className="ti ti-paw" style={{ color:isL?'var(--purple)':'#64748B', fontSize:20 }} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <p style={{ fontSize:14, fontWeight:700, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p._name}</p>
                    <span style={{ fontSize:10, background:isL?'#EDE9FE':'#F1F5F9', color:isL?'#6B21A8':'#64748B', borderRadius:6, padding:'1px 6px', fontWeight:700, flexShrink:0 }}>{isL?'LUMI':'REGULAR'}</span>
                  </div>
                  <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0 }}>{isL?`${p.pets?.breed} · ${calcAge(p.pets?.birthdate)}`:`${p.species} · ${p.breed}`}</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>Dueno: {p._owner||'—'}</p>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  {p.last_visit && <p style={{ fontSize:10, color:'var(--text-muted)', margin:'0 0 2px' }}>{new Date(p.last_visit+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</p>}
                  {p.visit_count > 0 && <span style={{ fontSize:10, background:isL?'#EDE9FE':'#F1F5F9', color:isL?'#6B21A8':'#64748B', borderRadius:6, padding:'1px 6px', fontWeight:700 }}>{p.visit_count} visitas</span>}
                </div>
              </div>
            )
          })}
          {filteredAll.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)' }}>
              <i className="ti ti-paw" style={{ fontSize:36, display:'block', marginBottom:8 }} />
              <p style={{ fontSize:13, margin:'0 0 12px' }}>Sin pacientes</p>
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Agregar primero</button>
            </div>
          )}
        </div>
      </div>

      {/* EXPEDIENTE */}
      {selected && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', background:selectedType==='lumi'?'var(--purple-light)':'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {selectedType==='lumi' && selected.pets?.photo_url ? <img src={selected.pets.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <i className="ti ti-paw" style={{ fontSize:24, color:selectedType==='lumi'?'var(--purple)':'#64748B' }} />}
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <p style={{ fontSize:18, fontWeight:800, margin:'0 0 2px' }}>{petName}</p>
                  <span style={{ fontSize:11, background:selectedType==='lumi'?'#EDE9FE':'#F1F5F9', color:selectedType==='lumi'?'#6B21A8':'#64748B', borderRadius:6, padding:'2px 8px', fontWeight:700 }}>{selectedType==='lumi'?'LUMI':'REGULAR'}</span>
                </div>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>
                  {selectedType==='lumi'?`${selected.pets?.pet_type} · ${selected.pets?.breed} · ${selected.pets?.gender} · ${calcAge(selected.pets?.birthdate)}`:`${selected.species} · ${selected.breed} · ${selected.gender}`}
                </p>
              </div>
            </div>
            <button className="btn btn-icon" style={{ background:'var(--bg)' }} onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
          </div>

          {(clinic.nombre_vet || clinic.cedula) && (
            <div style={{ background:'rgba(107,33,168,0.05)', border:'1px solid rgba(107,33,168,0.15)', borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
              <i className="ti ti-certificate" style={{ fontSize:18, color:'#6B21A8' }} />
              <div>
                {clinic.nombre_vet && <p style={{ fontSize:12, fontWeight:700, color:'#6B21A8', margin:0 }}>{clinic.nombre_vet}</p>}
                {clinic.cedula && <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Cedula: {clinic.cedula}</p>}
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowVisit(true); setVisitType('servicio'); setCartItems([]); setServiceDesc(''); setServicePrice('') }}><i className="ti ti-plus" /> + Visita</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowRecord(true)}><i className="ti ti-file-plus" /> Consulta</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowAppt(true); setApptForm(f=>({...f, lumi_code:selectedType==='lumi'?(selected.pets?.lumi_id||''):''})) }}><i className="ti ti-calendar-plus" /> Agendar cita</button>
            {selectedType === 'lumi' && (<>
              <button className="btn btn-secondary btn-sm" style={{ color:'var(--purple)', borderColor:'var(--purple)' }} onClick={() => { setShowCarnet(true); setCarnetStep('code'); setCarnetCode(''); setCarnetError('') }}>
                <i className="ti ti-certificate" /> Actualizar carnet
              </button>
              <button className="btn btn-secondary btn-sm" style={{ color:'#0EA5E9', borderColor:'#0EA5E9' }} onClick={() => setShowCert(true)}>
                <i className="ti ti-file-certificate" /> Certificado de salud
              </button>
            </>)}
          </div>

          <div className="card" style={{ marginBottom:14 }}>
            <p style={{ fontSize:12, fontWeight:700, margin:'0 0 8px', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Dueno</p>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:13 }}><i className="ti ti-user" style={{ color:'var(--purple)' }} /> {ownerName||'—'}</span>
              <span style={{ fontSize:13 }}><i className="ti ti-phone" style={{ color:'var(--purple)' }} /> {ownerPhone||'—'}</span>
              {ownerEmail && <span style={{ fontSize:13 }}><i className="ti ti-mail" style={{ color:'var(--purple)' }} /> {ownerEmail}</span>}
            </div>
            {selectedType==='lumi' && <div style={{ marginTop:10, padding:'7px 12px', background:'#EDE9FE', borderRadius:8, fontSize:12, color:'#6B21A8', fontWeight:600 }}>{selected.pets?.lumi_id} · Consulta otorgara +15 puntos</div>}
          </div>

          {/* Certificados emitidos */}
          {selectedType==='lumi' && certificates.length > 0 && (
            <div className="card" style={{ marginBottom:14, border:'1px solid #BAE6FD' }}>
              <p style={{ fontSize:13, fontWeight:800, margin:'0 0 12px', color:'#0369A1' }}>Certificados de Salud emitidos</p>
              {certificates.map(c => {
                const vigente = new Date(c.valid_until) >= new Date()
                return (
                  <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: vigente?'#F0F9FF':'#F8F8F8', borderRadius:8, marginBottom:6, border:`1px solid ${vigente?'#BAE6FD':'#E5E7EB'}` }}>
                    <div>
                      <p style={{ fontSize:12, fontWeight:700, color: vigente?'#0369A1':'var(--text-muted)', margin:0 }}>
                        {c.condition === 'apto' ? 'APTO PARA VIAJAR' : c.condition === 'condicionado' ? 'APTO CON CONDICIONES' : 'NO APTO'}
                      </p>
                      <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>
                        Emitido: {new Date(c.issued_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})} · 
                        Valido hasta: {new Date(c.valid_until+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}
                      </p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:10, fontWeight:700, background:vigente?'#DCFCE7':'#FEE2E2', color:vigente?'#16A34A':'#DC2626', borderRadius:10, padding:'2px 8px' }}>{vigente?'Vigente':'Vencido'}</span>
                      <button className="btn btn-secondary btn-sm" onClick={() => generateCertPDF(c)} style={{ fontSize:11 }}>
                        <i className="ti ti-download" /> PDF
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {selectedType==='lumi' && (
            <div className="card" style={{ marginBottom:14 }}>
              <p style={{ fontSize:13, fontWeight:800, margin:'0 0 12px' }}>Carnet de vacunas</p>
              {vaccines.length === 0 ? <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'12px 0' }}>Sin vacunas registradas</p> : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {vaccines.map(v => (
                    <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'8px 12px', background:'var(--bg)', borderRadius:8 }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:700, margin:'0 0 2px' }}>{v.name}</p>
                        {v.vet_nombre && <p style={{ fontSize:11, color:'var(--purple)', margin:'0 0 2px', fontWeight:600 }}>Dr. {v.vet_nombre} {v.vet_cedula?`· Ced. ${v.vet_cedula}`:''}</p>}
                        {v.notes && <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{v.notes}</p>}
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontSize:11, color:'var(--text-secondary)', margin:'0 0 2px' }}>{v.applied_date?new Date(v.applied_date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}):'—'}</p>
                        {v.next_date && <p style={{ fontSize:11, color:'var(--purple)', fontWeight:600, margin:0 }}>Refuerzo: {new Date(v.next_date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <p style={{ fontSize:15, fontWeight:800, margin:'0 0 16px' }}>Historial de visitas</p>
            {records.length === 0 ? <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Sin consultas registradas</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {records.map(r => (
                  <div key={r.id} style={{ padding:'14px', background:'var(--bg)', borderRadius:12, borderLeft:`3px solid ${r.type==='servicio'?'#D97706':r.type==='producto'?'#16A34A':'var(--purple)'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <p style={{ fontSize:13, fontWeight:700, margin:0 }}>{new Date(r.date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</p>
                      <div style={{ display:'flex', gap:8 }}>
                        {r.type && r.type!=='consulta' && <span className="badge badge-amber" style={{ textTransform:'capitalize' }}>{r.type}</span>}
                        {r.weight && <span className="badge badge-gray">{r.weight} kg</span>}
                        {r.price > 0 && <span className="badge badge-green">${r.price}</span>}
                      </div>
                    </div>
                    {r.vet_nombre && <p style={{ fontSize:11, color:'var(--purple)', fontWeight:600, margin:'0 0 6px' }}>Dr. {r.vet_nombre} {r.vet_cedula?`· Ced. ${r.vet_cedula}`:''}</p>}
                    {r.description && <p style={{ fontSize:13, margin:'0 0 4px', color:'var(--text-secondary)' }}>{r.description}</p>}
                    {r.diagnosis   && <p style={{ fontSize:13, margin:'0 0 4px' }}><strong>Diagnostico:</strong> {r.diagnosis}</p>}
                    {r.treatment   && <p style={{ fontSize:13, margin:'0 0 4px' }}><strong>Tratamiento:</strong> {r.treatment}</p>}
                    {r.notes       && <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>{r.notes}</p>}
                    {r.next_visit  && <p style={{ fontSize:12, color:'var(--purple)', margin:'6px 0 0', fontWeight:600 }}>Proxima visita: {new Date(r.next_visit+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long'})}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL VISITA */}
      {showVisit && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowVisit(false)}>
          <div className="modal" style={{ maxWidth:560 }}>
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 16px' }}>+ Visita — {petName}</p>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {['servicio','producto'].map(t => (
                <button key={t} onClick={() => setVisitType(t)} style={{ flex:1, padding:'10px', borderRadius:8, border:`2px solid ${visitType===t?'#6B21A8':'var(--border)'}`, background:visitType===t?'#EDE9FE':'white', cursor:'pointer', fontWeight:700, fontSize:13, color:visitType===t?'#6B21A8':'var(--text-secondary)' }}>
                  {t==='servicio'?'Servicio':'Producto del inventario'}
                </button>
              ))}
            </div>
            {visitType==='servicio' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label className="label">Descripcion *</label><input className="input" value={serviceDesc} onChange={e => setServiceDesc(e.target.value)} placeholder="Consulta, bano, vacuna..." /></div>
                <div><label className="label">Precio</label><input className="input" type="number" value={servicePrice} onChange={e => setServicePrice(e.target.value)} placeholder="0.00" /></div>
              </div>
            )}
            {visitType==='producto' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input className="input" value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Buscar producto..." />
                <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                  {filteredInv.map(item => (
                    <div key={item.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg)', borderRadius:8 }}>
                      <div><p style={{ fontSize:13, fontWeight:600, margin:'0 0 2px' }}>{item.name}</p><p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{item.unit} · Stock: {item.stock} · ${item.sale_price||0}</p></div>
                      <button className="btn btn-primary btn-sm" onClick={() => addToCart(item)}>+ Agregar</button>
                    </div>
                  ))}
                </div>
                {cartItems.length > 0 && (
                  <div style={{ border:'1px solid var(--border)', borderRadius:10, padding:12 }}>
                    {cartItems.map(c => (
                      <div key={c.inventory_id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <p style={{ fontSize:13, flex:1, margin:0 }}>{c.name}</p>
                        <button onClick={() => updateQty(c.inventory_id,c.qty-1)} style={{ width:24,height:24,borderRadius:6,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontWeight:700 }}>−</button>
                        <span style={{ fontSize:13,fontWeight:700,minWidth:20,textAlign:'center' }}>{c.qty}</span>
                        <button onClick={() => updateQty(c.inventory_id,c.qty+1)} style={{ width:24,height:24,borderRadius:6,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontWeight:700 }}>+</button>
                        <p style={{ fontSize:13,fontWeight:700,color:'var(--purple)',margin:0,minWidth:60,textAlign:'right' }}>${(c.qty*c.unit_price).toFixed(2)}</p>
                      </div>
                    ))}
                    <div style={{ borderTop:'1px solid var(--border)',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between' }}>
                      <p style={{ fontSize:13,fontWeight:700,margin:0 }}>Total</p>
                      <p style={{ fontSize:15,fontWeight:900,color:'var(--purple)',margin:0 }}>${cartTotal.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button className="btn btn-secondary" onClick={() => setShowVisit(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveVisit} disabled={visitType==='servicio'?!serviceDesc:cartItems.length===0} style={{ flex:2, justifyContent:'center' }}>
                Registrar visita {visitType==='producto'&&cartItems.length>0?`· $${cartTotal.toFixed(2)}`:''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CITA */}
      {showAppt && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowAppt(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 6px' }}>Agendar cita</p>
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 20px' }}>{petName} · {ownerName}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {selectedType==='lumi' && <div><label className="label">Codigo Lumi</label><input className="input" value={apptForm.lumi_code} readOnly style={{ fontFamily:'monospace', letterSpacing:'1px', background:'#F5F3FF', color:'#6B21A8', fontWeight:600 }} /></div>}
              <div className="grid-2">
                <div><label className="label">Fecha *</label><input className="input" type="date" value={apptForm.date} onChange={e => setApptForm(f=>({...f,date:e.target.value}))} /></div>
                <div><label className="label">Hora *</label><select className="input" value={apptForm.time} onChange={e => setApptForm(f=>({...f,time:e.target.value}))}>{HOURS.map(h=><option key={h}>{h}</option>)}</select></div>
              </div>
              <div><label className="label">Estado</label><select className="input" value={apptForm.status} onChange={e => setApptForm(f=>({...f,status:e.target.value}))}><option value="confirmed">Confirmada</option><option value="pending">Pendiente</option></select></div>
              <div><label className="label">Motivo</label><input className="input" value={apptForm.notes} onChange={e => setApptForm(f=>({...f,notes:e.target.value}))} placeholder="Consulta, vacuna, revision..." /></div>
              <div><label className="label">Precio (opcional)</label><input className="input" type="number" value={apptForm.price} onChange={e => setApptForm(f=>({...f,price:e.target.value}))} placeholder="0.00" /></div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowAppt(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveAppt} style={{ flex:2, justifyContent:'center' }}>Guardar cita</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONSULTA */}
      {showRecord && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowRecord(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 20px' }}>Nueva consulta — {petName}</p>
            {selectedType==='lumi' && <div style={{ background:'#EDE9FE', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:12, color:'#6B21A8', fontWeight:600 }}>Paciente Lumi — se otorgaran +15 puntos al guardar</div>}
            {(clinic.nombre_vet||clinic.cedula) && (
              <div style={{ background:'rgba(107,33,168,0.05)', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:12, color:'#6B21A8' }}>
                <i className="ti ti-certificate" style={{ marginRight:6 }} />{clinic.nombre_vet} {clinic.cedula?`· Ced. ${clinic.cedula}`:''}
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="grid-2">
                <div><label className="label">Peso (kg)</label><input className="input" type="number" step="0.1" value={recordForm.weight} onChange={e => setRecordForm(f=>({...f,weight:e.target.value}))} placeholder="3.5" /></div>
                <div><label className="label">Temperatura (C)</label><input className="input" type="number" step="0.1" value={recordForm.temperature} onChange={e => setRecordForm(f=>({...f,temperature:e.target.value}))} placeholder="38.5" /></div>
              </div>
              <div><label className="label">Diagnostico</label><input className="input" value={recordForm.diagnosis} onChange={e => setRecordForm(f=>({...f,diagnosis:e.target.value}))} placeholder="Diagnostico principal..." /></div>
              <div><label className="label">Tratamiento</label><input className="input" value={recordForm.treatment} onChange={e => setRecordForm(f=>({...f,treatment:e.target.value}))} placeholder="Medicamentos, procedimientos..." /></div>
              <div><label className="label">Notas SOAP</label><textarea className="input" rows={3} value={recordForm.notes} onChange={e => setRecordForm(f=>({...f,notes:e.target.value}))} placeholder="Observaciones adicionales..." style={{ resize:'vertical' }} /></div>
              <div><label className="label">Proxima visita</label><input className="input" type="date" value={recordForm.next_visit} onChange={e => setRecordForm(f=>({...f,next_visit:e.target.value}))} /></div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowRecord(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveRecord} style={{ flex:2, justifyContent:'center' }}>Guardar consulta {selectedType==='lumi'?'(+15 pts)':''}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CARNET */}
      {showCarnet && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowCarnet(false)}>
          <div className="modal">
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 6px' }}>Actualizar carnet digital</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 20px' }}>{petName} · {selected?.pets?.lumi_id}</p>
            {carnetStep==='code' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ background:'#FEF3C7', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#92400E' }}>
                  <strong>Como obtener el codigo:</strong> Lumi App → Carnet → Autorizar veterinario
                </div>
                <div>
                  <label className="label">Codigo de autorizacion</label>
                  <input className="input" value={carnetCode} onChange={e => { setCarnetCode(e.target.value.toUpperCase()); setCarnetError('') }} placeholder="Codigo del dueno" style={{ letterSpacing:'2px', fontFamily:'monospace', textAlign:'center', fontSize:16 }} />
                  {carnetError && <p style={{ fontSize:12, color:'var(--red)', margin:'4px 0 0' }}>{carnetError}</p>}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowCarnet(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={verifyCarnetCode} disabled={!carnetCode.trim()} style={{ flex:2, justifyContent:'center' }}>Verificar codigo</button>
                </div>
              </div>
            )}
            {carnetStep==='form' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'#DCFCE7', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#15803D', fontWeight:600 }}>Codigo verificado</div>
                {(clinic.nombre_vet||clinic.cedula) && (
                  <div style={{ background:'rgba(107,33,168,0.05)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#6B21A8' }}>
                    <i className="ti ti-certificate" style={{ marginRight:6 }} />{clinic.nombre_vet} {clinic.cedula?`· Ced. ${clinic.cedula}`:''}
                  </div>
                )}
                <div><label className="label">Nombre de la vacuna *</label><input className="input" value={vaccineForm.name} onChange={e => setVaccineForm(f=>({...f,name:e.target.value}))} placeholder="Rabia, Moquillo, Parvovirus..." /></div>
                <div className="grid-2">
                  <div><label className="label">Fecha de aplicacion *</label><input className="input" type="date" value={vaccineForm.date} onChange={e => setVaccineForm(f=>({...f,date:e.target.value}))} /></div>
                  <div><label className="label">Fecha de refuerzo</label><input className="input" type="date" value={vaccineForm.next_date} onChange={e => setVaccineForm(f=>({...f,next_date:e.target.value}))} /></div>
                </div>
                <div><label className="label">Notas</label><input className="input" value={vaccineForm.notes} onChange={e => setVaccineForm(f=>({...f,notes:e.target.value}))} placeholder="Laboratorio, lote, dosis..." /></div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" onClick={() => setCarnetStep('code')} style={{ flex:1, justifyContent:'center' }}>Atras</button>
                  <button className="btn btn-primary" onClick={saveVaccine} disabled={!vaccineForm.name||!vaccineForm.date} style={{ flex:2, justifyContent:'center' }}>Guardar en carnet</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CERTIFICADO DE SALUD */}
      {showCert && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowCert(false)}>
          <div className="modal" style={{ maxWidth:500 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#E0F2FE', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="ti ti-file-certificate" style={{ fontSize:20, color:'#0369A1' }} />
              </div>
              <div>
                <p style={{ fontSize:16, fontWeight:800, margin:0 }}>Certificado de Salud</p>
                <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{petName} · {selected?.pets?.lumi_id}</p>
              </div>
            </div>

            {(!clinic.cedula || !clinic.nombre_vet) && (
              <div style={{ background:'#FEF3C7', border:'1px solid #F59E0B', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#92400E' }}>
                Completa tu cedula profesional en Ajustes para que el certificado tenga validez oficial.
              </div>
            )}

            {(clinic.nombre_vet || clinic.cedula) && (
              <div style={{ background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <i className="ti ti-certificate" style={{ fontSize:16, color:'#0369A1' }} />
                <div>
                  <p style={{ fontSize:12, fontWeight:700, color:'#0369A1', margin:0 }}>Dr. {clinic.nombre_vet}</p>
                  {clinic.cedula && <p style={{ fontSize:11, color:'#0369A1', margin:0, opacity:0.7 }}>Cedula: {clinic.cedula} · {clinic.name}</p>}
                </div>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="grid-2">
                <div><label className="label">Peso (kg)</label><input className="input" type="number" step="0.1" value={certForm.weight} onChange={e => setCertForm(f=>({...f,weight:e.target.value}))} placeholder="3.5" /></div>
                <div><label className="label">Temperatura (C)</label><input className="input" type="number" step="0.1" value={certForm.temperature} onChange={e => setCertForm(f=>({...f,temperature:e.target.value}))} placeholder="38.5" /></div>
              </div>

              <div>
                <label className="label">Dictamen *</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                  {[{v:'apto',l:'Apto para viajar',c:'#16A34A'},{v:'condicionado',l:'Apto con condiciones',c:'#D97706'},{v:'no_apto',l:'No apto',c:'#DC2626'}].map(o => (
                    <button key={o.v} onClick={() => setCertForm(f=>({...f,condition:o.v}))}
                      style={{ padding:'8px 4px', borderRadius:8, border:`2px solid ${certForm.condition===o.v?o.c:'var(--border)'}`, background:certForm.condition===o.v?`${o.c}10`:'white', cursor:'pointer', fontSize:11, fontWeight:700, color:certForm.condition===o.v?o.c:'var(--text-secondary)' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Observaciones</label>
                <textarea className="input" rows={3} value={certForm.observations} onChange={e => setCertForm(f=>({...f,observations:e.target.value}))} placeholder="Estado general, condiciones especiales..." style={{ resize:'vertical' }} />
              </div>

              <div>
                <label className="label">Valido por (dias)</label>
                <div style={{ display:'flex', gap:8 }}>
                  {['7','10','30'].map(d => (
                    <button key={d} onClick={() => setCertForm(f=>({...f,valid_days:d}))}
                      style={{ flex:1, padding:'8px', borderRadius:8, border:`2px solid ${certForm.valid_days===d?'#0369A1':'var(--border)'}`, background:certForm.valid_days===d?'#E0F2FE':'white', cursor:'pointer', fontSize:12, fontWeight:700, color:certForm.valid_days===d?'#0369A1':'var(--text-secondary)' }}>
                      {d} dias
                    </button>
                  ))}
                </div>
                {certForm.valid_days === '10' && (
                  <p style={{ fontSize:11, color:'#0369A1', margin:'4px 0 0' }}>Recomendado para viajes internacionales (10 dias antes del viaje)</p>
                )}
              </div>

              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button className="btn btn-secondary" onClick={() => setShowCert(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveCertificate} disabled={saving}
                  style={{ flex:2, justifyContent:'center', background:'#0369A1', borderColor:'#0369A1' }}>
                  <i className="ti ti-file-download" style={{ fontSize:15 }} />
                  {saving ? 'Generando...' : 'Emitir certificado + PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PACIENTE */}
      {showNew && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowNew(false)}>
          <div className="modal" style={{ maxWidth:540 }}>
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 16px' }}>Nuevo paciente</p>
            <div style={{ display:'flex', marginBottom:20, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              <button onClick={() => setTab('lumi')} style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', background:tab==='lumi'?'#6B21A8':'white', color:tab==='lumi'?'white':'var(--text-secondary)' }}>Paciente Lumi</button>
              <button onClick={() => setTab('regular')} style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', background:tab==='regular'?'#6B21A8':'white', color:tab==='regular'?'white':'var(--text-secondary)' }}>Paciente Regular</button>
            </div>
            {tab==='lumi' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>Ingresa el codigo Lumi (ej: <strong>LMI-2026-L1RD62</strong>)</p>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="input" value={lumiCode} onChange={e => { setLumiCode(e.target.value.toUpperCase()); setLumiError(''); setLumiSearch(null) }} placeholder="LMI-2026-XXXXXX" style={{ flex:1, fontFamily:'monospace', letterSpacing:'1px' }} onKeyDown={e => e.key==='Enter'&&searchLumiCode()} />
                  <button className="btn btn-primary" onClick={searchLumiCode} disabled={lumiLoading||!lumiCode.trim()}>{lumiLoading?'...':'Buscar'}</button>
                </div>
                {lumiError && <p style={{ fontSize:13, color:'var(--red)', margin:0 }}>{lumiError}</p>}
                {lumiSearch && (
                  <div style={{ background:'#F5F3FF', border:'1.5px solid #6B21A8', borderRadius:12, padding:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:52, height:52, borderRadius:12, overflow:'hidden', background:'var(--purple-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {lumiSearch.pet.photo_url?<img src={lumiSearch.pet.photo_url} style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<i className="ti ti-paw" style={{ color:'var(--purple)',fontSize:22 }}/>}
                      </div>
                      <div>
                        <p style={{ fontSize:16, fontWeight:800, margin:'0 0 2px' }}>{lumiSearch.pet.name}</p>
                        <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0 }}>{lumiSearch.pet.pet_type} · {lumiSearch.pet.breed}</p>
                        <p style={{ fontSize:12, color:'var(--purple)', fontWeight:600, margin:'2px 0 0' }}>Dueno: {lumiSearch.pet.profiles?.name}</p>
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={registerLumiPatient} style={{ width:'100%', justifyContent:'center' }}>Registrar en mi clinica</button>
                  </div>
                )}
                <button className="btn btn-secondary" onClick={() => setShowNew(false)} style={{ justifyContent:'center' }}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
// v2
