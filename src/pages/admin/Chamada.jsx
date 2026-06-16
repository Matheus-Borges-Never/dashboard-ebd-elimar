import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Save, CheckSquare, Square } from 'lucide-react'

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

      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Trimestre</label>
            <Select value={triId} onChange={e => { setTriId(e.target.value); setSalaId(''); setData('') }}>
              {(db.trimestres || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Sala</label>
            <Select value={salaId} onChange={e => { setSalaId(e.target.value); setData('') }}>
              <option value="">— Selecione —</option>
              {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Domingo</label>
            <Select value={data} onChange={e => setData(e.target.value)} disabled={!salaId}>
              <option value="">— Selecione —</option>
              {sundays.map(s => <option key={s} value={s}>{fmtDate(s)}</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      {salaId && data && alunos.length > 0 && (
        <>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        </>
      )}

      {salaId && data && alunos.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum aluno nesta sala.</p>
      )}
    </div>
  )
}
