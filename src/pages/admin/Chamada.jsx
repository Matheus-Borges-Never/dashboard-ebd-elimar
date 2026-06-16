import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Save, CheckSquare, Square, CheckCircle, Circle, Users } from 'lucide-react'

function getSundays(inicio, fim) {
  const sundays = []
  const d = new Date(inicio + 'T12:00:00Z')
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1)
  const end = new Date(fim + 'T12:00:00Z')
  const today = new Date().toISOString().split('T')[0]
  while (d <= end) {
    const iso = d.toISOString().split('T')[0]
    if (iso <= today) sundays.push(iso)
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return sundays.reverse()
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function Chamada({ db, api, toast }) {
  const triAtivo = (db.trimestres || []).find(t => t.ativo) || db.trimestres?.[0]
  const [triId, setTriId] = useState(triAtivo?.id || '')
  const [salaId, setSalaId] = useState('')
  const [data, setData] = useState('')
  const [presencas, setPresencas] = useState({})
  const [saving, setSaving] = useState(false)

  const trimestre = (db.trimestres || []).find(t => t.id === triId)
  const salas = (db.salas || []).filter(s => s.trimestre_id === triId)
  const sundays = useMemo(() => trimestre ? getSundays(trimestre.inicio, trimestre.fim) : [], [trimestre])
  const alunos = useMemo(() =>
    (db.alunos || [])
      .filter(a => a.sala_id === salaId)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [db.alunos, salaId]
  )

  // Estatísticas por data (para a lista de domingos)
  const statsPorData = useMemo(() => {
    if (!salaId) return {}
    const alunoIds = new Set(alunos.map(a => a.id))
    const stats = {}
    sundays.forEach(d => {
      const registros = (db.presencas || []).filter(p => alunoIds.has(p.aluno_id) && p.data === d)
      stats[d] = {
        registrada: registros.length > 0,
        presentes: registros.filter(p => p.presente).length,
      }
    })
    return stats
  }, [salaId, alunos, sundays, db.presencas])

  // Carrega presenças ao trocar de data/sala
  useEffect(() => {
    if (!salaId || !data) return
    const map = {}
    alunos.forEach(a => {
      const p = (db.presencas || []).find(x => x.aluno_id === a.id && x.data === data)
      map[a.id] = p?.presente || false
    })
    setPresencas(map)
  }, [salaId, data, alunos, db.presencas])

  function toggle(alunoId) {
    setPresencas(prev => ({ ...prev, [alunoId]: !prev[alunoId] }))
  }

  function marcarTodos(val) {
    const map = {}
    alunos.forEach(a => { map[a.id] = val })
    setPresencas(prev => ({ ...prev, ...map }))
  }

  async function salvar() {
    if (!salaId || !data) return
    setSaving(true)
    try {
      const lote = alunos.map(a => ({ aluno_id: a.id, data, presente: presencas[a.id] || false }))
      await api('savePresencaLote', { presencas: lote })
      const total = lote.filter(p => p.presente).length
      toast({ message: `✓ Chamada salva! ${total} de ${alunos.length} presentes.` })
      try { new BroadcastChannel('ebd-updates').postMessage('refresh') } catch {}
    } catch (e) {
      toast({ message: 'Erro ao salvar: ' + e.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const totalPresentes = alunos.filter(a => presencas[a.id]).length

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">Chamada</h2>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Trimestre</label>
          <Select value={triId} onChange={e => { setTriId(e.target.value); setSalaId(''); setData('') }} className="min-w-48">
            {(db.trimestres || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Sala</label>
          <Select value={salaId} onChange={e => { setSalaId(e.target.value); setData('') }} className="min-w-48">
            <option value="">— Selecione —</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </div>
      </div>

      {salaId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* Lista de domingos */}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Aulas</p>
            {sundays.map(s => {
              const stats = statsPorData[s] || { registrada: false, presentes: 0 }
              const selected = data === s
              return (
                <button
                  key={s}
                  onClick={() => setData(s)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {stats.registrada
                      ? <CheckCircle size={15} className="text-green-500 shrink-0" />
                      : <Circle size={15} className="text-gray-300 shrink-0" />
                    }
                    <span className="text-sm font-medium">{fmtDate(s)}</span>
                  </div>
                  {stats.registrada && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users size={12} />
                      {stats.presentes}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Lista de alunos */}
          {data && alunos.length > 0 && (
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{totalPresentes}</span> / {alunos.length} presentes
                  </span>
                  <Badge variant={totalPresentes === alunos.length ? 'success' : 'secondary'}>
                    {alunos.length > 0 ? Math.round((totalPresentes / alunos.length) * 100) : 0}%
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => marcarTodos(true)}>
                    <CheckSquare size={14} /> Todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => marcarTodos(false)}>
                    <Square size={14} /> Nenhum
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {alunos.map(a => {
                  const presente = presencas[a.id] || false
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        presente
                          ? 'border-green-400 bg-green-50 text-green-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium text-sm">{a.nome}</span>
                      <span className={`text-xs font-semibold ${presente ? 'text-green-600' : 'text-gray-400'}`}>
                        {presente ? 'PRESENTE' : 'AUSENTE'}
                      </span>
                    </button>
                  )
                })}
              </div>

              <Button onClick={salvar} disabled={saving} className="w-full sm:w-fit">
                <Save size={15} />
                {saving ? 'Salvando...' : 'Salvar Chamada'}
              </Button>
            </div>
          )}

          {data && alunos.length === 0 && (
            <p className="text-sm text-gray-500 lg:col-span-2">Nenhum aluno nesta sala.</p>
          )}

          {!data && (
            <p className="text-sm text-gray-400 lg:col-span-2 pt-2">← Selecione uma aula para fazer a chamada.</p>
          )}
        </div>
      )}
    </div>
  )
}
