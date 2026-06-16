import { useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { Toaster, useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogOut, BookOpen } from 'lucide-react'
import Trimestres from './Trimestres.jsx'
import Salas from './Salas.jsx'
import Alunos from './Alunos.jsx'
import Chamada from './Chamada.jsx'

const TABS = [
  { id: 'trimestres', label: 'Trimestres' },
  { id: 'salas', label: 'Salas' },
  { id: 'alunos', label: 'Alunos' },
  { id: 'chamada', label: 'Chamada' },
]

export default function AdminLayout() {
  const [senha, setSenha] = useState(() => sessionStorage.getItem('ebd_admin_senha') || '')
  const [senhaInput, setSenhaInput] = useState('')
  const [db, setDb] = useState(null)
  const [tab, setTab] = useState('trimestres')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const api = useCallback(async (action, data = {}) => {
    const res = await adminApi(action, data, senha)
    if (res.db) setDb(res.db)
    return res
  }, [senha])

  async function login() {
    setLoading(true)
    setLoginError('')
    try {
      const res = await adminApi('load', {}, senhaInput)
      sessionStorage.setItem('ebd_admin_senha', senhaInput)
      setSenha(senhaInput)
      setDb(res)
    } catch (e) {
      setLoginError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    sessionStorage.removeItem('ebd_admin_senha')
    setSenha('')
    setDb(null)
    setSenhaInput('')
  }

  if (!db) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
              <BookOpen size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">EBD Elimar</h1>
            <p className="text-gray-500 text-sm mt-1">Painel Administrativo</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Senha</label>
              <Input
                type="password"
                placeholder="Digite a senha"
                value={senhaInput}
                onChange={e => setSenhaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                autoFocus
              />
              {loginError && <p className="text-red-600 text-xs mt-1.5">{loginError}</p>}
            </div>
            <Button onClick={login} disabled={loading} className="w-full">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
        </div>
        <Toaster />
      </div>
    )
  }

  const tabProps = { db, setDb, api, toast }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-blue-600" />
            <span className="font-semibold text-gray-900">EBD Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
            <LogOut size={15} />
            Sair
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'trimestres' && <Trimestres {...tabProps} />}
        {tab === 'salas' && <Salas {...tabProps} />}
        {tab === 'alunos' && <Alunos {...tabProps} />}
        {tab === 'chamada' && <Chamada {...tabProps} />}
      </main>

      <Toaster />
    </div>
  )
}
