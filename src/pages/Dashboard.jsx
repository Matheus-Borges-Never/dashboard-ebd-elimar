import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchData } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Users, BookOpen, TrendingUp, RefreshCw, Calendar } from 'lucide-react'

const SALA_COLORS = ['#7c6fcd', '#c9a84c', '#e07b8a', '#6baed6', '#6dbf9c', '#e0936a']
const TABS = ['Visão Geral', 'Por Sala', 'Evolução', 'Ranking']
const EXCL = new Set(['ranking', 'relatorio', 'meta', '__corpDocente'])

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const [tab, setTab] = useState(0)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchData,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    try {
      const bc = new BroadcastChannel('ebd-updates')
      bc.onmessage = () => queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      return () => bc.close()
    } catch {}
  }, [queryClient])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm uppercase tracking-widest">Carregando dados...</p>
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-3">Nenhum dado disponível.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} /> Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const meta = data.meta || {}
  const relatorio = Array.isArray(data.relatorio) ? data.relatorio : []
  const ranking = Array.isArray(data.ranking) ? data.ranking : []

  // Salas de alunos (sem professores)
  const salasNaoProf = Object.entries(data)
    .filter(([k, v]) => !EXCL.has(k) && typeof v === 'object' && v !== null && !Array.isArray(v) && !/professor|coordena/i.test(k))

  // Corpo docente (sala de professores/coordenação)
  const profEntry = Object.entries(data)
    .find(([k, v]) => !EXCL.has(k) && typeof v === 'object' && v !== null && !Array.isArray(v) && /professor|coordena/i.test(k))
  const profNome = profEntry?.[0] ?? null
  const profSala = profEntry?.[1] ?? null

  const barData = [...relatorio].sort((a, b) => (b.freq_pct || 0) - (a.freq_pct || 0))
  const barDataComProf = profSala
    ? [...barData, { sala: profNome, freq_pct: Number(profSala.freq_pct ?? 0) }]
    : barData
  const totalAlunos = relatorio.reduce((s, r) => s + (r.alunos_ref || 0), 0)
  const mediaFreq = barData.length ? barData.reduce((s, r) => s + (r.freq_pct || 0), 0) / barData.length : 0
  const pctProgress = meta.totalDomingos > 0 ? (meta.domingosPassed / meta.totalDomingos) * 100 : 0

  const todasSalas = profEntry ? [...salasNaoProf, profEntry] : salasNaoProf

  const lineData = (() => {
    if (!todasSalas.length) return []
    const [, first] = todasSalas[0]
    if (!Array.isArray(first?.datas)) return []
    return first.datas.map((dt, i) => {
      const point = { aula: dt }
      todasSalas.forEach(([nome, s]) => {
        point[nome] = Array.isArray(s?.totais_por_aula) ? s.totais_por_aula[i] : 0
      })
      return point
    })
  })()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-blue-600" />
            <div>
              <span className="font-bold text-gray-900 text-sm">EBD Recanto Elimar</span>
              {meta.trimestre && <span className="ml-2 text-xs text-gray-400">{meta.trimestre}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">{meta.domingosPassed ?? 0}/{meta.totalDomingos ?? 13} aulas</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw size={14} /></Button>
            <a href="/admin" className="text-xs text-blue-600 hover:underline">Admin</a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto scrollbar-none">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                tab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* ── VISÃO GERAL ── */}
        {tab === 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { title: 'Freq. Geral', value: `${mediaFreq.toFixed(0)}%`, sub: 'Média das salas', Icon: TrendingUp },
                { title: 'Alunos Ref.', value: totalAlunos, sub: 'Matriculados', Icon: Users },
                { title: 'Último Dom.', value: meta.totalPresentesUltimoDom ?? '—', sub: meta.ultimoDomingo ? `Presentes em ${meta.ultimoDomingo}` : 'Sem dados', Icon: Calendar },
                { title: 'Corp. Docente', value: meta.corpDocente != null ? `${Number(meta.corpDocente).toFixed(0)}%` : '—', sub: 'Frequência', Icon: BookOpen },
              ].map(({ title, value, sub, Icon }) => (
                <Card key={title} className="px-5 py-4">
                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mt-1">{sub}</p>
                </Card>
              ))}
            </div>

            <Card className="px-6 py-5">
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-3">Progresso do Trimestre</p>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pctProgress}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-semibold text-amber-500 uppercase">Aula 1</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase">
                  {meta.domingosPassed} de {meta.totalDomingos} aulas ({Math.round(pctProgress)}%)
                </span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase">Aula {meta.totalDomingos}</span>
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-4">Frequência por Sala (%)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barDataComProf} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="sala" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
                  <Tooltip formatter={v => `${Number(v).toFixed(1)}%`} />
                  <Bar dataKey="freq_pct" radius={[6, 6, 0, 0]}>
                    {barDataComProf.map((entry, i) => (
                      <Cell key={i} fill={/professor|coordena/i.test(entry.sala) ? '#64748b' : SALA_COLORS[i % SALA_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ── POR SALA ── */}
        {tab === 1 && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {salasNaoProf.map(([nome, s]) => {
                const alunos = Array.isArray(s?.alunos) ? [...s.alunos].sort((a, b) => (b.pts || 0) - (a.pts || 0)) : []
                return (
                  <Card key={nome} className="p-5">
                    <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{nome}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{Number(s?.freq_pct ?? 0).toFixed(2)}%</p>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-4">· {alunos.length} alunos</p>
                    <div className="flex flex-col gap-0.5">
                      {alunos.map(a => (
                        <div key={a.nome} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          <span className="text-sm text-gray-700 uppercase font-medium">{a.nome}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-0.5">
                              {Array.isArray(a.presencas) && a.presencas.map((p, j) => (
                                <div key={j} className={`w-2.5 h-2.5 rounded-full ${p ? 'bg-amber-400' : 'bg-gray-200'}`} />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-gray-500 min-w-[40px] text-right">{a.pts} PTS</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Corpo Docente */}
            {profSala && (() => {
              const alunos = Array.isArray(profSala?.alunos) ? [...profSala.alunos].sort((a, b) => (b.pts || 0) - (a.pts || 0)) : []
              return (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-3">Corpo Docente / Coordenação</p>
                  <Card className="p-5 border-slate-300">
                    <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">{profNome}</p>
                    <p className="text-3xl font-bold text-slate-700 mt-1">{Number(profSala.freq_pct ?? 0).toFixed(2)}%</p>
                    <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase mb-4">· {alunos.length} membros</p>
                    <div className="flex flex-col gap-0.5">
                      {alunos.map(a => (
                        <div key={a.nome} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                          <span className="text-sm text-slate-600 uppercase font-medium">{a.nome}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-0.5">
                              {Array.isArray(a.presencas) && a.presencas.map((p, j) => (
                                <div key={j} className={`w-2.5 h-2.5 rounded-full ${p ? 'bg-slate-500' : 'bg-gray-200'}`} />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-slate-400 min-w-[40px] text-right">{a.pts} PTS</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── EVOLUÇÃO ── */}
        {tab === 2 && (
          <div className="flex flex-col gap-5">
            {/* Tabela numérica presença por sala */}
            {(() => {
              const refSala = todasSalas[0]?.[1]
              const datas = Array.isArray(refSala?.datas) ? refSala.datas : []
              if (!datas.length) return null
              const totalGeral = datas.map((_, di) =>
                todasSalas.reduce((s, [, sala]) => s + (Array.isArray(sala?.totais_por_aula) ? (sala.totais_por_aula[di] || 0) : 0), 0)
              )
              const totalGeralSum = totalGeral.reduce((a, b) => a + b, 0)
              return (
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Presença por Sala — Aula a Aula</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw size={14} /></Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-4 text-gray-400 font-semibold uppercase min-w-32">Sala</th>
                          {datas.map((d, i) => (
                            <th key={d} className="text-center px-2 py-1 text-gray-400 font-semibold min-w-12">
                              <div>{d}</div>
                              <div className="text-gray-300 font-normal">Aula {i + 1}</div>
                            </th>
                          ))}
                          <th className="text-center px-2 py-2 text-gray-400 font-semibold uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todasSalas.map(([nome, s], si) => {
                          const totais = Array.isArray(s?.totais_por_aula) ? s.totais_por_aula : []
                          const maxVal = totais.length ? Math.max(...totais) : 0
                          const sum = totais.reduce((a, b) => a + b, 0)
                          const isProf = /professor|coordena/i.test(nome)
                          return (
                            <tr key={nome} className={`border-b border-gray-50 ${isProf ? 'bg-slate-50' : ''}`}>
                              <td className="py-3 pr-4 font-semibold uppercase">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isProf ? '#64748b' : SALA_COLORS[si % SALA_COLORS.length] }} />
                                  <span className={isProf ? 'text-slate-500' : 'text-gray-700'}>{nome}</span>
                                </div>
                              </td>
                              {datas.map((_, di) => {
                                const val = totais[di] ?? 0
                                const isMax = val === maxVal && maxVal > 0
                                return (
                                  <td key={di} className={`text-center px-2 py-3 font-bold ${isMax ? 'text-amber-500' : isProf ? 'text-slate-500' : 'text-gray-600'}`}>
                                    {val || <span className="text-gray-200">–</span>}
                                  </td>
                                )
                              })}
                              <td className={`text-center px-2 py-3 font-bold ${isProf ? 'text-slate-600' : 'text-gray-800'}`}>{sum}</td>
                            </tr>
                          )
                        })}
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td className="py-3 pr-4 text-gray-500 font-semibold uppercase">Total Geral</td>
                          {totalGeral.map((t, i) => {
                            const maxTG = Math.max(...totalGeral)
                            return (
                              <td key={i} className={`text-center px-2 py-3 font-bold ${t === maxTG && maxTG > 0 ? 'text-amber-500' : 'text-gray-600'}`}>{t}</td>
                            )
                          })}
                          <td className="text-center px-2 py-3 font-bold text-gray-800">{totalGeralSum}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-gray-300 mt-3 italic">✦ Valores em dourado indicam o maior número de presentes daquela sala ao longo das aulas.</p>
                </Card>
              )
            })()}

            {/* Gráfico de barras — Total de presentes por domingo */}
            {(() => {
              const refSala = todasSalas[0]?.[1]
              const datas = Array.isArray(refSala?.datas) ? refSala.datas : []
              if (!datas.length) return null
              const chartData = datas.map((d, di) => ({
                data: d,
                total: todasSalas.reduce((s, [, sala]) => s + (Array.isArray(sala?.totais_por_aula) ? (sala.totais_por_aula[di] || 0) : 0), 0),
              }))
              return (
                <Card className="p-5">
                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-4">Total de Presentes por Domingo</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="data" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <Tooltip formatter={v => [`${v} presentes`, 'Total']} />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]} label={{ position: 'inside', fill: '#fff', fontSize: 12, fontWeight: 700 }}>
                        {chartData.map((entry, i) => {
                          const maxTotal = Math.max(...chartData.map(d => d.total))
                          return <Cell key={i} fill={entry.total === maxTotal ? '#f59e0b' : '#7c6fcd'} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )
            })()}
          </div>
        )}

        {/* ── RANKING ── */}
        {tab === 3 && (
          <div className="flex flex-col gap-5">
            {/* Pódio */}
            {ranking.length >= 2 && (
              <div className="flex items-end justify-center gap-6 py-4">
                {[ranking[1], ranking[0], ranking[2]].filter(Boolean).map((sala, idx) => {
                  const originalIdx = ranking.indexOf(sala)
                  const heights = ['h-24', 'h-32', 'h-20']
                  const medals = ['🥇', '🥈', '🥉']
                  const bgColors = ['bg-amber-50 border-amber-300', 'bg-gray-100 border-gray-300', 'bg-orange-50 border-orange-200']
                  const heightClass = idx === 0 ? heights[0] : idx === 1 ? heights[1] : heights[2]
                  return (
                    <div key={sala.sala} className="flex flex-col items-center gap-2">
                      <p className="text-sm font-bold text-gray-500 uppercase">{Number(sala.freq || 0).toFixed(0)}%</p>
                      <p className="text-xs font-semibold text-gray-600 uppercase text-center">{sala.sala}</p>
                      <div className={`w-28 rounded-t-xl flex items-center justify-center border-t border-x ${bgColors[originalIdx] || 'bg-gray-50 border-gray-200'} ${heightClass}`}>
                        <span className="text-4xl">{medals[originalIdx] || `${originalIdx + 1}º`}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tabela */}
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Ranking Geral</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Pos.', 'Sala', 'Frequência', 'Alunos Ref.', 'Média/Aula'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.sala} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'
                        }`}>{i + 1}º</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 uppercase">{r.sala}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 min-w-[56px]">{Number(r.freq || 0).toFixed(2)}%</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${r.freq || 0}%`, background: SALA_COLORS[i % SALA_COLORS.length] }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{r.alunos_ref ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{r.media_por_aula ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Líderes */}
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase text-center">
              Líder de cada sala · Todos os empatados são exibidos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {todasSalas.map(([nome, s]) => {
                const alunos = Array.isArray(s?.alunos) ? [...s.alunos].sort((a, b) => (b.pts || 0) - (a.pts || 0)) : []
                const maxPts = alunos[0]?.pts ?? 0
                const leaders = maxPts > 0 ? alunos.filter(a => a.pts === maxPts) : []
                return (
                  <Card key={nome} className="p-5">
                    <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">{nome}</p>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-300 uppercase mb-3">
                      Líderes — {maxPts} de {Array.isArray(s?.datas) ? s.datas.length : 0} presenças
                    </p>
                    <div className="flex flex-col gap-2">
                      {leaders.map(a => (
                        <div key={a.nome} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400">✦</span>
                            <span className="text-sm font-bold text-gray-800 uppercase">{a.nome}</span>
                          </div>
                          <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{a.pts} PTS</span>
                        </div>
                      ))}
                      {leaders.length === 0 && <p className="text-xs text-gray-300 uppercase">Sem dados</p>}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
