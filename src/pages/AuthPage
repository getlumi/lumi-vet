import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState('login')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(error.message)
      }
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1A0A2E,#3B0764)', padding:20 }}>
      <div style={{ background:'white', borderRadius:24, padding:40, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#6B21A8,#C026D3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <i className="ti ti-paw" style={{ fontSize:26, color:'white' }} />
          </div>
          <p style={{ fontSize:22, fontWeight:800, color:'#1A0A2E', margin:'0 0 4px' }}>Lumi Vet</p>
          <p style={{ fontSize:13, color:'#6B7280', margin:0 }}>Panel de gestión veterinaria</p>
        </div>

        <div style={{ display:'flex', gap:0, marginBottom:24, background:'#F3F4F6', borderRadius:10, padding:4 }}>
          {['login','signup'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', fontWeight:700, fontSize:13, cursor:'pointer', background: mode === m ? 'white' : 'transparent', color: mode === m ? '#6B21A8' : '#6B7280', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
              {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="label">Correo electrónico</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="veterinario@email.com" />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          {error && <p style={{ fontSize:13, color:'#EF4444', background:'#FEE2E2', borderRadius:8, padding:'8px 12px' }}>{error}</p>}
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'12px' }}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar al panel' : 'Crear cuenta'}
          </button>
        </div>

        <p style={{ fontSize:12, color:'#9CA3AF', textAlign:'center', marginTop:20 }}>
          ¿Eres dueño de mascota? <a href="https://lumi-app-indol.vercel.app" style={{ color:'#6B21A8', fontWeight:700 }}>Ir a Lumi App</a>
        </p>
      </div>
    </div>
  )
}
