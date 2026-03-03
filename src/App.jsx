import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase, getSession, signIn, signOut } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import FormBuilder from './pages/FormBuilder'
import FormResponses from './pages/FormResponses'
import PublicForm from './pages/PublicForm'
import { LayoutGrid, LogOut, Plus, Feather } from 'lucide-react'

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
            className={`toast-enter px-4 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm
              ${t.type === 'error' ? 'bg-red-900/90 text-red-100 border border-red-700/50' : ''}
              ${t.type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-700/50' : ''}
              ${t.type === 'info' ? 'bg-raven-800/90 text-raven-100 border border-raven-700/50' : ''}
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
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #08080d 70%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Feather className="w-8 h-8 text-raven-300" />
          </div>
          <h1 className="font-display text-3xl font-bold text-raven-50 tracking-tight">RavenForms</h1>
          <p className="text-raven-300/60 text-sm mt-1 font-body">Your forms. Your data. Your rules.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-200 text-sm px-4 py-3 rounded-lg">
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
              className="w-full px-4 py-3 bg-raven-850 border border-raven-800/60 rounded-lg text-raven-50 placeholder:text-raven-300/40 font-body text-sm"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-3 bg-raven-850 border border-raven-800/60 rounded-lg text-raven-50 placeholder:text-raven-300/40 font-body text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-raven-300 hover:bg-raven-200 text-raven-950 font-semibold rounded-lg transition-smooth text-sm disabled:opacity-50"
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
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f0f1a 0%, #08080d 60%)' }}>
      {/* Header */}
      <header className="border-b border-raven-800/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:opacity-80 transition-smooth">
            <Feather className="w-5 h-5 text-raven-300" />
            <span className="font-display text-lg font-bold text-raven-50">RavenForms</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/forms/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-raven-300 hover:bg-raven-200 text-raven-950 text-sm font-semibold rounded-lg transition-smooth"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Form</span>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className={`p-2 rounded-lg transition-smooth ${
                location.pathname === '/dashboard'
                  ? 'bg-raven-800/60 text-raven-300'
                  : 'text-raven-300/50 hover:text-raven-300 hover:bg-raven-800/30'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 text-raven-300/50 hover:text-red-400 rounded-lg transition-smooth hover:bg-raven-800/30"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
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
        <div className="w-6 h-6 border-2 border-raven-300 border-t-transparent rounded-full animate-spin" />
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
