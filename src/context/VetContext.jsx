import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const VetContext = createContext({})

export function VetProvider({ children }) {
  const { user } = useAuth()
  const [clinic, setClinic] = useState(null)
  const [plan, setPlan] = useState('basico')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    fetchClinic()
  }, [user])

  const fetchClinic = async () => {
    const { data, error } = await supabase
      .from('vet_clinics')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!error && data) {
      setClinic(data)
      setPlan(data.plan || 'basico')
    }
    setLoading(false)
  }

  const hasPro = plan === 'pro' || plan === 'plus'
  const hasPlus = plan === 'plus'

  return (
    <VetContext.Provider value={{ clinic, plan, hasPro, hasPlus, loading, fetchClinic }}>
      {children}
    </VetContext.Provider>
  )
}

export const useVet = () => useContext(VetContext)
