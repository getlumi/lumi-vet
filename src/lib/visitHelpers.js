import { supabase } from './supabase'

// ─── FECHA LOCAL (Cancún) ─────────────────────────────────────────────────────
export const localToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun' }).format(new Date())

// ─── FORMATEAR CÓDIGO LUMI (LMI-2026-XXXXXX) ─────────────────────────────────
// Acepta cualquier formato (con/sin guiones, minúsculas) y lo normaliza.
export const formatLumiId = (raw) => {
  const clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 3) return clean
  if (clean.length <= 7) return clean.slice(0, 3) + '-' + clean.slice(3)
  return clean.slice(0, 3) + '-' + clean.slice(3, 7) + '-' + clean.slice(7, 13)
}

// ─── BUSCAR MASCOTA POR CÓDIGO LUMI ──────────────────────────────────────────
// Retorna { pet, error }. pet incluye profiles del dueño.
export const searchPetByLumiCode = async (code) => {
  const formatted = formatLumiId(code)
  if (!formatted) return { pet: null, error: 'Ingresa un código Lumi' }

  const { data: pet, error } = await supabase
    .from('pets')
    .select('*, profiles(id,name,phone,email)')
    .eq('lumi_id', formatted)
    .single()

  if (error || !pet) {
    return { pet: null, error: 'No se encontró ninguna mascota con ese código' }
  }
  return { pet, error: null }
}

// ─── PUNTOS POR VISITA (10 primera vez en esta clínica, 5 si ya tiene visitas) ─
export const getVisitPoints = async (clinicId, petId) => {
  const { count, error } = await supabase
    .from('vet_records')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('pet_id', petId)

  if (error) {
    console.error('[getVisitPoints] error:', error.message)
    return 5 // valor seguro por defecto
  }
  return (count || 0) === 0 ? 10 : 5
}

// ─── ASEGURAR REGISTRO DEL PACIENTE EN ESTA CLÍNICA ───────────────────────────
// Si el pet no está en vet_patients de esta clínica, lo crea.
// Retorna { vetPatient, error }.
export const ensurePatientRegistered = async (clinicId, pet, ownerId) => {
  const { data: existing, error: existErr } = await supabase
    .from('vet_patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('pet_id', pet.id)
    .maybeSingle()

  if (existErr) return { vetPatient: null, error: existErr.message }
  if (existing) return { vetPatient: existing, error: null }

  const { data: created, error: insErr } = await supabase
    .from('vet_patients')
    .insert({ clinic_id: clinicId, pet_id: pet.id, owner_id: ownerId })
    .select()
    .single()

  if (insErr) return { vetPatient: null, error: insErr.message }
  return { vetPatient: created, error: null }
}

// ─── OTORGAR PUNTOS (wrapper RPC con 5 params, evita ambigüedad de overload) ──
export const grantVisitPoints = async ({ clinicId, ownerId, petId, recordId, points }) => {
  if (!ownerId || !petId) return { error: null } // sin dueño no hay puntos que otorgar
  const { error } = await supabase.rpc('grant_visit_points', {
    p_clinic_id: clinicId,
    p_owner_id: ownerId,
    p_pet_id: petId,
    p_record_id: recordId,
    p_points: points,
  })
  if (error) console.error('[grantVisitPoints] error:', error.message)
  return { error }
}

// ─── ACTUALIZAR last_visit / visit_count DEL PACIENTE ────────────────────────
export const touchPatientVisit = async (vetPatientId, currentVisitCount) => {
  await supabase
    .from('vet_patients')
    .update({ last_visit: localToday(), visit_count: (currentVisitCount || 0) + 1 })
    .eq('id', vetPatientId)
}
