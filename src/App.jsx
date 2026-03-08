import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase, getSession, signIn, signOut } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import FormBuilder from './pages/FormBuilder'
import FormResponses from './pages/FormResponses'
import PublicForm from './pages/PublicForm'
import { LayoutGrid, LogOut, Plus } from 'lucide-react'

// ─── Auth Context ────────────────────────────────
const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// ─── Toast System ────────────────────────────────
const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  
  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast-enter px-4 py-3 rounded-lg text-sm font-medium shadow-lg
              ${t.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : ''}
              ${t.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
              ${t.type === 'info' ? 'bg-amber-50 text-amber-700 border border-amber-200' : ''}
            `}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Login Page ──────────────────────────────────
function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#ffffff' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <img src="/askli-icon.png" alt="Askli" style={{ width: 'clamp(120px, 15vw, 200px)', height: 'clamp(120px, 15vw, 200px)' }} className="object-contain" />
            <span style={{ fontFamily: 'Cinzel, serif', color: '#03ABFA', fontSize: 'clamp(36px, 5vw, 65px)', lineHeight: '1', letterSpacing: '0.04em' }} className="font-bold">ASKLI</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-3 bg-white border border-raven-200 rounded-lg text-raven-50 placeholder:text-raven-500 font-body text-sm"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-3 bg-white border border-raven-200 rounded-lg text-raven-50 placeholder:text-raven-500 font-body text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-white font-semibold rounded-lg transition-smooth text-sm disabled:opacity-50"
            style={{ backgroundColor: '#03ABFA' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Admin Layout ────────────────────────────────
function AdminLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between" style={{ padding: '0 16px' }}>
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-4 hover:opacity-80 transition-smooth">
            <img src="/askli-icon.png" alt="Askli" style={{ width: 'clamp(150px, 12vw, 200px)', height: 'clamp(150px, 12vw, 200px)' }} className="object-contain" />
            <span style={{ fontFamily: 'Cinzel, serif', color: '#03ABFA', fontSize: 'clamp(36px, 3.8vw, 65px)', lineHeight: '1', letterSpacing: '0.04em' }} className="font-bold">ASKLI</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard?templates=1')}
              className="flex items-center gap-1.5 px-5 py-2.5 text-white text-sm font-semibold rounded-full transition-smooth hover:opacity-90"
              style={{ backgroundColor: '#03ABFA' }}
            >
              <Plus className="w-4 h-4" />
              New Form
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className={`p-2 rounded-lg transition-smooth ${
                location.pathname === '/dashboard'
                  ? 'text-[#03ABFA]'
                  : 'text-gray-400 hover:text-[#03ABFA]'
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-smooth"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Cyan gradient separator line */}
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #03ABFA 0%, #5BC8FC 50%, #03ABFA 100%)' }} />
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}

// ─── Protected Route ─────────────────────────────
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#03ABFA] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <AdminLayout>{children}</AdminLayout>
}

// ─── App ─────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSession().then(s => {
      setSession(s)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      <ToastProvider>
        <Routes>
          {/* Public form route */}
          <Route path="/f/:slug" element={<PublicForm />} />

          {/* Auth */}
          <Route path="/login" element={
            session ? <Navigate to="/dashboard" replace /> : <LoginPage />
          } />

          {/* Admin routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/forms/new" element={
            <ProtectedRoute><FormBuilder /></ProtectedRoute>
          } />
          <Route path="/forms/:id/edit" element={
            <ProtectedRoute><FormBuilder /></ProtectedRoute>
          } />
          <Route path="/forms/:id/responses" element={
            <ProtectedRoute><FormResponses /></ProtectedRoute>
          } />

          {/* Default */}
          <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </ToastProvider>
    </AuthContext.Provider>
  )
}
