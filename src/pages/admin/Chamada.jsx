import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Save } from 'lucide-react'

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
  return sundays
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function Chamada({ db, api, toast }) {
  const triAtivo = (db.trimestres || []).find(t => t.ativo) || db.trimestres?.[0]
  const [triId, setTriId] = useState(triAtivo?.id || '')
  const [salaId, setSalaId] = useState('')
  const [grid, setGrid] = useState({}) // { `${alunoId}_${data}`: bool }
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

  // Recarrega o grid sempre que sala ou dados do DB mudam
  useEffect(() => {
    if (!salaId || sundays.length === 0) return
    const map = {}
    alunos.forEach(a => {
      sundays.forEach(d => {
        const p = (db.presencas || []).find(x => x.aluno_id === a.id && x.data === d)
        map[`${a.id}_${d}`] = p?.presente || false
      })
    })
    setGrid(map)
  }, [salaId, triId, alunos, sundays, db.presencas])

  function toggle(alunoId, data) {
    setGrid(prev => ({ ...prev, [`${alunoId}_${data}`]: !prev[`${alunoId}_${data}`] }))
  }

  function marcarColuna(data, val) {
    setGrid(prev => {
      const next = { ...prev }
      alunos.forEach(a => { next[`${a.id}_${data}`] = val })
      return next
    })
  }

  async function salvar() {
    if (!salaId) return
    setSaving(true)
    try {
      const lote = []
      alunos.forEach(a => {
        sundays.forEach(d => {
          lote.push({ aluno_id: a.id, data: d, presente: grid[`${a.id}_${d}`] || false })
        })
      })
      await api('savePresencaLote', { presencas: lote })
      toast({ message: `✓ Chamada salva! ${lote.filter(p => p.presente).length} presenças gravadas.` })
      try { new BroadcastChannel('ebd-updates').postMessage('refresh') } catch {}
    } catch (e) {
      toast({ message: 'Erro ao salvar: ' + e.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Totais por coluna
  const totalPorData = useMemo(() =>
    sundays.map(d => alunos.filter(a => grid[`${a.id}_${d}`]).length),
    [grid, alunos, sundays]
  )

  const totalGeral = totalPorData.reduce((s, v) => s + v, 0)
  const possivel = alunos.length * sundays.length
  const freqPct = possivel > 0 ? ((totalGeral / possivel) * 100).toFixed(1) : '0.0'

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">Chamada</h2>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Trimestre</label>
          <Select
            value={triId}
            onChange={e => { setTriId(e.target.value); setSalaId('') }}
            className="min-w-48"
          >
            {(db.trimestres || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Sala</label>
          <Select
            value={salaId}
            onChange={e => setSalaId(e.target.value)}
            className="min-w-48"
          >
            <option value="">— Selecione —</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </div>
      </div>

      {/* Grid */}
      {salaId && alunos.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum aluno nesta sala.</p>
      )}

      {salaId && alunos.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{totalGeral}</span> presenças de{' '}
              <span className="font-semibold text-gray-900">{possivel}</span> possíveis
            </span>
            <Badge variant={Number(freqPct) >= 75 ? 'success' : Number(freqPct) >= 50 ? 'warning' : 'destructive'}>
              {freqPct}%
            </Badge>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-44 border-r border-gray-200">
                      Aluno
                    </th>
                    {sundays.map((d, i) => (
                      <th key={d} className="px-2 py-2 text-center min-w-14">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-gray-500">{fmtDate(d)}</span>
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => marcarColuna(d, true)}
                              className="text-[10px] text-green-600 hover:text-green-800 font-medium leading-none"
                              title="Marcar todos presentes"
                            >✓</button>
                            <span className="text-gray-300 text-[10px]">/</span>
                            <button
                              onClick={() => marcarColuna(d, false)}
                              className="text-[10px] text-red-400 hover:text-red-600 font-medium leading-none"
                              title="Marcar todos ausentes"
                            >✗</button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-12">
                      Pts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((a, ri) => {
                    const pts = sundays.filter(d => grid[`${a.id}_${d}`]).length
                    return (
                      <tr
                        key={a.id}
                        className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                      >
                        <td className={`sticky left-0 z-10 px-4 py-2.5 font-medium text-gray-800 border-r border-gray-200 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          {a.nome}
                        </td>
                        {sundays.map(d => {
                          const presente = grid[`${a.id}_${d}`] || false
                          return (
                            <td key={d} className="text-center px-1 py-1.5">
                              <button
                                onClick={() => toggle(a.id, d)}
                                className={`w-7 h-7 rounded-md border-2 flex items-center justify-center mx-auto transition-all ${
                                  presente
                                    ? 'border-green-500 bg-green-500 text-white'
                                    : 'border-gray-200 bg-white text-gray-300 hover:border-gray-400'
                                }`}
                              >
                                {presente ? '✓' : ''}
                              </button>
                            </td>
                          )
                        })}
                        <td className="text-center px-2 py-2 font-bold text-gray-900">{pts}</td>
                      </tr>
                    )
                  })}

                  {/* Linha de totais */}
                  <tr className="border-t-2 border-gray-300 bg-gray-50">
                    <td className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">
                      Total
                    </td>
                    {totalPorData.map((t, i) => (
                      <td key={i} className="text-center px-1 py-2.5 text-sm font-bold text-gray-700">
                        {t}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Button onClick={salvar} disabled={saving} className="w-full sm:w-fit">
            <Save size={15} />
            {saving ? 'Salvando...' : 'Salvar Chamada'}
          </Button>
        </>
      )}
    </div>
  )
}
