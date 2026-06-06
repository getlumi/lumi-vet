import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'

const localToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(new Date())

export default function Patients({ clinic, openNew, plan, can, onNavigateAppointment }) {
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
  const [showVisit, setShowVisit]           = useState(openNew === 'walkin')
  const [walkinMode, setWalkinMode]         = useState(openNew === 'walkin')
  const [showCarnet, setShowCarnet]         = useState(false)
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
  const [vetServices, setVetServices]       = useState([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [invSearch, setInvSearch]           = useState('')

  const [recordForm, setRecordForm]         = useState({ diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:'' })
  const [newForm, setNewForm]               = useState({ owner_name:'', owner_phone:'', owner_email:'', pet_name:'', pet_type:'perro', breed:'', weight:'', gender:'macho', notes:'' })

  const [certForm, setCertForm] = useState({
    weight: '', temperature: '', condition: 'apto',
    observations: '', valid_days: '10', firma_pin: ''
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

    const { data: svcs } = await supabase
      .from('vet_services')
      .select('id,name,price,category,is_bath_service,price_small,price_medium,price_large,small_max_kg,medium_max_kg,large_max_kg,extra_1_name,extra_1_price,extra_2_name,extra_2_price,extra_3_name,extra_3_price')
      .eq('clinic_id', clinic.id).eq('is_active', true).order('name')
    setVetServices(svcs || [])
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
        date: localToday(),
        vet_nombre: clinic.nombre_vet || null, vet_cedula: clinic.cedula || null,
        ...recordForm,
        weight: recordForm.weight ? parseFloat(recordForm.weight) : null,
        temperature: recordForm.temperature ? parseFloat(recordForm.temperature) : null,
      }).select().single()
      await supabase.from('vet_patients').update({ last_visit: localToday() }).eq('id', selected.id)
      if (record && selected.pets?.lumi_id && selected.owner_id) {
        await supabase.rpc('grant_visit_points', { p_clinic_id: clinic.id, p_owner_id: selected.owner_id, p_pet_id: selected.pet_id, p_record_id: record.id })
        setPointsMsg(`+15 puntos otorgados a ${selected.profiles?.name || 'el dueño'} 🎉`)
        setTimeout(() => setPointsMsg(null), 4000)
      }
      await fetchLumiRecords(selected.pet_id)
    } else {
      await supabase.from('vet_regular_records').insert({
        clinic_id: clinic.id, regular_patient_id: selected.id,
        date: localToday(),
        ...recordForm,
        weight: recordForm.weight ? parseFloat(recordForm.weight) : null,
        temperature: recordForm.temperature ? parseFloat(recordForm.temperature) : null,
      })
      await supabase.from('vet_regular_patients').update({ last_visit: localToday() }).eq('id', selected.id)
      await fetchRegularRecords(selected.id)
    }
    setShowRecord(false)
    setRecordForm({ diagnosis:'', treatment:'', notes:'', weight:'', temperature:'', next_visit:'' })
  }

  const saveVisit = async () => {
    const today = localToday()
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

  const saveCertificate = async () => {
    if (clinic.firma_pin) {
      if (!certForm.firma_pin) { alert('Ingresa tu PIN de firma para autorizar el certificado'); return }
      if (certForm.firma_pin !== clinic.firma_pin) { alert('PIN incorrecto. Verifica tu PIN de firma en Ajustes.'); return }
    }
    setSaving(true)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + parseInt(certForm.valid_days || 10))
    const firmaVerificada = !!(clinic.firma_pin && certForm.firma_pin === clinic.firma_pin)
    const { data: cert, error } = await supabase.from('health_certificates').insert({
      pet_id: selected.pet_id, clinic_id: clinic.id,
      vet_nombre: clinic.nombre_vet || null, vet_cedula: clinic.cedula || null,
      clinic_name: clinic.name, clinic_logo_url: clinic.logo_url || null,
      weight: certForm.weight ? parseFloat(certForm.weight) : null,
      temperature: certForm.temperature ? parseFloat(certForm.temperature) : null,
      condition: certForm.condition, observations: certForm.observations || null,
      valid_until: validUntil.toISOString().slice(0,10), firma_verificada: firmaVerificada,
    }).select().single()
    if (error) { console.error(error); setSaving(false); return }
    const codigoVerificacion = cert.id.replace(/-/g,'').slice(0,8).toUpperCase()
    await supabase.from('health_certificates').update({ codigo_verificacion: codigoVerificacion }).eq('id', cert.id)
    const certConCodigo = { ...cert, codigo_verificacion: codigoVerificacion, firma_verificada: firmaVerificada }
    if (selected.owner_id) {
      await supabase.from('notifications').insert({
        user_id: selected.owner_id, type: 'health_certificate',
        title: 'Certificado de salud emitido',
        body: `${clinic.name} emitio un certificado de salud para ${selected.pets?.name}. Valido hasta el ${validUntil.toLocaleDateString('es-MX',{day:'numeric',month:'long'})}.`,
        from_pet_id: selected.pet_id, data: JSON.stringify({ cert_id: cert.id }), read: false,
      })
    }
    await generateCertPDF(certConCodigo)
    await fetchLumiRecords(selected.pet_id)
    setShowCert(false)
    setCertForm({ weight:'', temperature:'', condition:'apto', observations:'', valid_days:'10', firma_pin:'' })
    setPointsMsg('Certificado de salud emitido correctamente')
    setTimeout(() => setPointsMsg(null), 4000)
    setSaving(false)
  }

  const generateCertPDF = async (cert) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, M = 18
    const pet = selected.pets
    const owner = selected.profiles

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
    if (vaccines.length === 0) {
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
      doc.text('✓ Firmado digitalmente · Lumi Vet', M+3, y+25)
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
      } catch(e) {}
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

  const calcAge = (bd) => {
    if (!bd) return null
    const y = Math.floor((Date.now()-new Date(bd))/(1000*60*60*24*365.25))
    return y > 0 ? `${y} años` : 'Cachorro'
  }

  const canSeeRegular = can?.seeRegularPatients ?? true
  const allPatients = [
    ...lumiPatients.map(p => ({ ...p, _type:'lumi', _name: p.pets?.name, _owner: p.profiles?.name })),
    ...(canSeeRegular ? regularPatients.map(p => ({ ...p, _type:'regular', _name: p.pet_name, _owner: p.owner_name })) : []),
  ].sort((a,b) => (b.last_visit||'2000-01-01').localeCompare(a.last_visit||'2000-01-01'))

  const formatLumiId = (raw) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (clean.length <= 3) return clean
    if (clean.length <= 7) return clean.slice(0,3)+'-'+clean.slice(3)
    return clean.slice(0,3)+'-'+clean.slice(3,7)+'-'+clean.slice(7,13)
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

        {canSeeRegular && (
          <div style={{ display:'flex', marginBottom:14, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            {[{key:'todos',label:`Todos (${allPatients.length})`},{key:'lumi',label:`Lumi (${lumiPatients.length})`},{key:'regular',label:`Regular (${regularPatients.length})`}].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }}
                style={{ flex:1, padding:'9px 0', fontSize:12, fontWeight:700, border:'none', cursor:'pointer', background: tab===t.key?'#6B21A8':'white', color: tab===t.key?'white':'var(--text-secondary)' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

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

          {/* Acciones — sin "Agendar cita" */}
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowVisit(true); setVisitType('servicio'); setCartItems([]); setServiceDesc(''); setServicePrice(''); setSelectedServiceId('') }}>
              <i className="ti ti-plus" /> + Visita
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowRecord(true)}>
              <i className="ti ti-file-plus" /> Consulta
            </button>
            {selectedType === 'lumi' && (<>
              <button className="btn btn-secondary btn-sm" style={{ color:'var(--purple)', borderColor:'var(--purple)' }}
                onClick={() => { setShowCarnet(true); setCarnetStep('code'); setCarnetCode(''); setCarnetError('') }}>
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

          {selectedType==='lumi' && certificates.length > 0 && (
            <div className="card" style={{ marginBottom:14, border:'1px solid #BAE6FD' }}>
              <p style={{ fontSize:13, fontWeight:800, margin:'0 0 12px', color:'#0369A1' }}>Certificados de Salud emitidos</p>
              {certificates.map(c => {
                const vigente = new Date(c.valid_until) >= new Date()
                return (
                  <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: vigente?'#F0F9FF':'#F8F8F8', borderRadius:8, marginBottom:6, border:`1px solid ${vigente?'#BAE6FD':'#E5E7EB'}` }}>
                    <div>
                      <p style={{ fontSize:12, fontWeight:700, color: vigente?'#0369A1':'var(--text-muted)', margin:0 }}>
                        {c.condition==='apto'?'APTO PARA VIAJAR':c.condition==='condicionado'?'APTO CON CONDICIONES':'NO APTO'}
                      </p>
                      <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>
                        Emitido: {new Date(c.issued_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})} · Valido hasta: {new Date(c.valid_until+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}
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
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && (setShowVisit(false), setWalkinMode(false))}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:17, fontWeight:800, margin:0 }}>
                  {walkinMode ? '🚪 Mostrador' : `+ Visita — ${petName}`}
                </p>
                {walkinMode && !selected && (
                  <p style={{ fontSize:12, color:'var(--text-muted)', margin:'4px 0 0' }}>
                    Selecciona al paciente Lumi de la lista para registrar su visita
                  </p>
                )}
              </div>
            </div>
            {/* Si viene de walkin y no hay paciente, mostrar aviso */}
            {walkinMode && !selected && (
              <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 14px', marginBottom:16 }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#92400E', margin:'0 0 4px' }}>
                  <i className="ti ti-info-circle" style={{ marginRight:6 }} />Selecciona primero al paciente
                </p>
                <p style={{ fontSize:12, color:'#92400E', margin:0 }}>
                  Busca al paciente Lumi en la lista de la izquierda y da click en "+ Visita"
                </p>
                <button onClick={() => { setShowVisit(false); setWalkinMode(false) }}
                  style={{ marginTop:10, background:'#D97706', border:'none', borderRadius:8, padding:'8px 16px', color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  Ir a buscar paciente
                </button>
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {['servicio','producto'].map(t => (
                <button key={t} onClick={() => setVisitType(t)} style={{ flex:1, padding:'10px', borderRadius:8, border:`2px solid ${visitType===t?'#6B21A8':'var(--border)'}`, background:visitType===t?'#EDE9FE':'white', cursor:'pointer', fontWeight:700, fontSize:13, color:visitType===t?'#6B21A8':'var(--text-secondary)' }}>
                  {t==='servicio'?'Servicio':'Producto del inventario'}
                </button>
              ))}
            </div>
            {visitType==='servicio' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label className="label">Servicio</label>
                  <select className="input" value={selectedServiceId} onChange={e => {
                    const id = e.target.value
                    setSelectedServiceId(id)
                    if (!id) { setServiceDesc(''); setServicePrice(''); return }
                    const svc = vetServices.find(s => s.id === id)
                    if (!svc) return
                    setServiceDesc(svc.name)
                    setServicePrice(svc.price ? String(svc.price) : '')
                  }}>
                    <option value="">— Seleccionar servicio —</option>
                    {vetServices.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.is_bath_service?' 🛁':''}{s.price?` — $${s.price}`:''}
                      </option>
                    ))}
                  </select>
                </div>
                <div><label className="label">Descripción / Notas</label><input className="input" value={serviceDesc} onChange={e => setServiceDesc(e.target.value)} placeholder="Consulta, baño, vacuna..." /></div>
                <div><label className="label">Precio</label><input className="input" type="text" inputMode="numeric" value={servicePrice} onChange={e => setServicePrice(e.target.value)} placeholder="0.00" /></div>
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
              </div>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button className="btn btn-secondary" onClick={() => setShowCert(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveCertificate} disabled={saving}
                  style={{ flex:2, justifyContent:'center', background:'#0369A1', borderColor:'#0369A1' }}>
                  <i className="ti ti-file-download" style={{ fontSize:15 }} />
                  {saving ? 'Generando...' : 'Emitir certificado + PDF'}
                </button>
              </div>
              {clinic.firma_pin && (
                <div style={{ marginTop:4, background:'rgba(14,165,233,0.06)', border:'1px solid rgba(14,165,233,0.2)', borderRadius:10, padding:'12px 14px' }}>
                  <p style={{ fontSize:12, fontWeight:700, color:'#0369A1', margin:'0 0 8px' }}>
                    <i className="ti ti-shield-check" style={{ marginRight:6 }} />PIN de firma digital — requerido para certificar
                  </p>
                  <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder="Ingresa tu PIN de firma"
                    value={certForm.firma_pin} onChange={e => setCertForm(f=>({...f,firma_pin:e.target.value.replace(/\D/g,'')}))}
                    style={{ letterSpacing:'4px', fontSize:16, textAlign:'center' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PACIENTE */}
      {showNew && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowNew(false)}>
          <div className="modal" style={{ maxWidth:540 }}>
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 16px' }}>Nuevo paciente</p>
            {canSeeRegular && (
              <div style={{ display:'flex', marginBottom:20, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                <button onClick={() => setTab('lumi')} style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', background:tab==='lumi'?'#6B21A8':'white', color:tab==='lumi'?'white':'var(--text-secondary)' }}>Paciente Lumi</button>
                <button onClick={() => setTab('regular')} style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', background:tab==='regular'?'#6B21A8':'white', color:tab==='regular'?'white':'var(--text-secondary)' }}>Paciente Regular</button>
              </div>
            )}
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
            {tab==='regular' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="grid-2">
                  <div><label className="label">Nombre del dueño *</label><input className="input" value={newForm.owner_name} onChange={e => setNewForm(f=>({...f,owner_name:e.target.value}))} placeholder="Juan García" /></div>
                  <div><label className="label">Teléfono</label><input className="input" type="tel" value={newForm.owner_phone} onChange={e => setNewForm(f=>({...f,owner_phone:e.target.value}))} placeholder="999 123 4567" /></div>
                </div>
                <div><label className="label">Email</label><input className="input" type="email" value={newForm.owner_email} onChange={e => setNewForm(f=>({...f,owner_email:e.target.value}))} placeholder="correo@ejemplo.com" /></div>
                <div className="grid-2">
                  <div><label className="label">Nombre mascota *</label><input className="input" value={newForm.pet_name} onChange={e => setNewForm(f=>({...f,pet_name:e.target.value}))} placeholder="Max" /></div>
                  <div><label className="label">Especie</label>
                    <select className="input" value={newForm.pet_type} onChange={e => setNewForm(f=>({...f,pet_type:e.target.value}))}>
                      <option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option>
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div><label className="label">Raza</label><input className="input" value={newForm.breed} onChange={e => setNewForm(f=>({...f,breed:e.target.value}))} placeholder="Labrador..." /></div>
                  <div><label className="label">Género</label>
                    <select className="input" value={newForm.gender} onChange={e => setNewForm(f=>({...f,gender:e.target.value}))}>
                      <option value="macho">Macho</option><option value="hembra">Hembra</option>
                    </select>
                  </div>
                </div>
                <div><label className="label">Peso (kg)</label><input className="input" type="number" step="0.1" value={newForm.weight} onChange={e => setNewForm(f=>({...f,weight:e.target.value}))} placeholder="3.5" /></div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowNew(false)} style={{ flex:1, justifyContent:'center' }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={saveNewPatient} disabled={!newForm.owner_name.trim()||!newForm.pet_name.trim()||saving} style={{ flex:2, justifyContent:'center' }}>
                    {saving?'Guardando...':'Registrar paciente'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
