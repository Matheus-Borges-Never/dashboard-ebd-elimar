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

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function StatCard({ title, value, sub, icon: Icon }) {
  return (
    <Card className="relative overflow-hidden">
      <button
        className="absolute top-2 right-2 p-1 text-gray-300 hover:text-gray-500 transition-colors"
        aria-label="expandir"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </button>
      <div className="px-5 pt-5 pb-4">
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{title}</p>
        <p className="text-4xl font-bold text-gray-900 mt-1">{value}</p>
        {sub && <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mt-1">{sub}</p>}
      </div>
      {Icon && (
        <div className="absolute bottom-3 right-4 text-gray-100">
          <Icon size={48} strokeWidth={1} />
        </div>
      )}
    </Card>
  )
}

function FreqBar({ pct, color = '#2563eb' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function ExpandIcon() {
  return (
    <button className="p-1 text-gray-300 hover:text-gray-500 transition-colors" aria-label="expandir">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </button>
  )
}

export default function Dashboard() {
  const [tab, setTab] = useState(0)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchData,
    refetchInterval: 10_000,
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
  const salas = Object.entries(data).filter(([k]) => !['ranking', 'relatorio', 'meta', '__corpDocente'].includes(k))
  const salasNaoProf = salas.filter(([n]) => !/professor|coordena/i.test(n))
  const barData = (data.relatorio || []).sort((a, b) => b.freq_pct - a.freq_pct)
  const totalAlunos = (data.relatorio || []).reduce((s, r) => s + r.alunos_ref, 0)
  const mediaFreq = barData.length ? barData.reduce((s, r) => s + r.freq_pct, 0) / barData.length : 0

  const lineData = (() => {
    if (!salasNaoProf.length) return []
    const first = salasNaoProf[0]?.[1]
    if (!first) return []
    return first.datas.map((dt, i) => {
      const point = { aula: dt }
      salasNaoProf.forEach(([nome, s]) => { point[nome] = s.totais_por_aula[i] })
      return point
    })
  })()

  const pctProgress = meta.totalDomingos > 0
    ? (meta.domingosPassed / meta.totalDomingos) * 100
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-blue-600" />
            <div>
              <span className="font-bold text-gray-900 uppercase text-sm">EBD Recanto Elimar</span>
              {meta.trimestre && (
                <span className="ml-2 text-xs text-gray-400 uppercase tracking-wide">{meta.trimestre}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide hidden sm:block">
              {meta.domingosPassed ?? 0}/{meta.totalDomingos ?? 13} aulas
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} />
            </Button>
            <a href="/admin" className="text-xs text-blue-600 hover:underline">Admin</a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* ── TAB 0: VISÃO GERAL ── */}
        {tab === 0 && (
          <div className="flex flex-col gap-4">
            {/* 4 stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                title="Freq. Geral"
                value={`${mediaFreq.toFixed(0)}%`}
                sub="Média das salas"
                icon={TrendingUp}
              />
              <StatCard
                title="Alunos Ref."
                value={totalAlunos}
                sub="Matriculados"
                icon={Users}
              />
              <StatCard
                title="Último Dom."
                value={meta.totalPresentesUltimoDom ?? '—'}
                sub={meta.ultimoDomingo ? `Presentes em ${meta.ultimoDomingo}` : 'Sem dados'}
                icon={Calendar}
              />
              <StatCard
                title="Corp. Docente"
                value={meta.corpDocente != null ? `${meta.corpDocente.toFixed(0)}%` : '—'}
                sub="Maior frequência"
                icon={BookOpen}
              />
            </div>

            {/* Progresso do trimestre */}
            <Card className="px-6 py-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Progresso do Trimestre</p>
                <ExpandIcon />
              </div>
              <div className="mt-3 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${pctProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-semibold tracking-widest text-amber-500 uppercase">
                  Aula 1
                </span>
                <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                  {meta.domingosPassed} de {meta.totalDomingos} aulas ({Math.round(pctProgress)}%)
                </span>
                <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                  Aula {meta.totalDomingos}
                </span>
              </div>
            </Card>

            {/* Gráfico de barras */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Frequência por Sala (%)</p>
                <ExpandIcon />
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="sala" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
                  <Tooltip formatter={v => `${v.toFixed(1)}%`} />
                  <Bar dataKey="freq_pct" radius={[6, 6, 0, 0]} label={{ position: 'center', fill: '#fff', fontSize: 12, fontWeight: 600, formatter: v => `${v.toFixed(0)}%` }}>
                    {barData.map((_, i) => <Cell key={i} fill={SALA_COLORS[i % SALA_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ── TAB 1: POR SALA ── */}
        {tab === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {salasNaoProf.map(([nome, s], ci) => (
              <Card key={nome} className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{nome}</p>
                  <ExpandIcon />
                </div>
                <p className="text-3xl font-bold text-gray-900">{s.freq_pct.toFixed(2)}%</p>
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-4">
                  · {s.alunos.length} alunos ref.
                </p>
                <div className="flex flex-col gap-1">
                  {[...s.alunos].sort((a, b) => b.pts - a.pts).map(a => (
                    <div key={a.nome} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700 uppercase font-medium">{a.nome}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-0.5">
                          {a.presencas.map((p, j) => (
                            <div
                              key={j}
                              className={`w-2.5 h-2.5 rounded-full ${p ? 'bg-amber-400' : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-gray-500 min-w-[40px] text-right">{a.pts} PTS</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── TAB 2: EVOLUÇÃO ── */}
        {tab === 2 && (
          <div className="flex flex-col gap-5">
            {/* Gráfico de linha */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Presença por Sala — Aula a Aula</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw size={14} />
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="aula" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip />
                  <Legend />
                  {salasNaoProf.map(([nome], i) => (
                    <Line
                      key={nome}
                      type="monotone"
                      dataKey={nome}
                      stroke={SALA_COLORS[i % SALA_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Tabelas por sala */}
            {salasNaoProf.map(([nome, s]) => {
              const maxVal = Math.max(...s.totais_por_aula)
              return (
                <Card key={nome} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{nome}</p>
                      <p className="text-xl font-bold text-gray-900">{s.freq_pct.toFixed(2)}%</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left py-1 pr-3 text-gray-400 font-semibold uppercase tracking-wide min-w-32">Aluno</th>
                          {s.datas.map(d => (
                            <th key={d} className="text-center px-1 py-1 text-gray-400 font-semibold uppercase">{d}</th>
                          ))}
                          <th className="text-center px-1 py-1 text-gray-400 font-semibold uppercase">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...s.alunos].sort((a, b) => b.pts - a.pts).map(a => (
                          <tr key={a.nome} className="border-t border-gray-50">
                            <td className="py-1.5 pr-3 text-gray-700 uppercase font-medium">{a.nome}</td>
                            {a.presencas.map((p, i) => (
                              <td key={i} className="text-center px-1 py-1.5">
                                <span className={p ? 'text-green-500 font-bold' : 'text-gray-200'}>
                                  {p ? '✓' : '–'}
                                </span>
                              </td>
                            ))}
                            <td className="text-center px-1 py-1.5 font-bold text-gray-800">{a.pts}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-200">
                          <td className="py-1.5 pr-3 text-gray-400 font-semibold uppercase">Total</td>
                          {s.totais_por_aula.map((t, i) => (
                            <td
                              key={i}
                              className={`text-center px-1 py-1.5 font-bold ${
                                t === maxVal && maxVal > 0 ? 'text-amber-500' : 'text-gray-500'
                              }`}
                            >
                              {t}
                            </td>
                          ))}
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── TAB 3: RANKING ── */}
        {tab === 3 && (
          <div className="flex flex-col gap-5">
            {/* Pódio top 3 */}
            {(() => {
              const r = data.ranking || []
              const [first, second, third] = r
              const podiumOrder = [second, first, third].filter(Boolean)
              const podiumPos = [second ? 2 : null, first ? 1 : null, third ? 3 : null]
              return (
                <div className="flex items-end justify-center gap-6 py-4">
                  {podiumOrder.map((sala, idx) => {
                    const pos = [second, first, third].indexOf(sala) + 1
                    const isFst = pos === 1
                    const heights = ['h-24', 'h-32', 'h-20']
                    const heightIdx = [second, first, third].findIndex(s => s === sala)
                    const medals = ['🥇', '🥈', '🥉']
                    const medalIdx = r.indexOf(sala)
                    const bgColors = [
                      'bg-gray-100 border-gray-300',
                      'bg-amber-50 border-amber-300',
                      'bg-orange-50 border-orange-200',
                    ]
                    return (
                      <div key={sala.sala} className="flex flex-col items-center gap-2">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{sala.freq.toFixed(0)}%</p>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide text-center">{sala.sala}</p>
                        <div
                          className={`w-28 rounded-t-xl flex items-center justify-center border-t border-x ${bgColors[medalIdx]} ${heights[heightIdx]}`}
                        >
                          <span className="text-4xl">{medals[medalIdx]}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Tabela ranking */}
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Ranking Geral</p>
                <ExpandIcon />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Pos.</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Sala</th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Frequência</th>
                    <th className="text-center px-3 py-3 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Alunos Ref.</th>
                    <th className="text-center px-3 py-3 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Média/Aula</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.ranking || []).map((r, i) => (
                    <tr key={r.sala} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-amber-100 text-amber-700' :
                          i === 1 ? 'bg-gray-100 text-gray-500' :
                          i === 2 ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-50 text-gray-400'
                        }`}>
                          {i === 0 ? '1º' : i === 1 ? '2º' : i === 2 ? '3º' : `${i + 1}º`}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-800 uppercase text-sm">{r.sala}</td>
                      <td className="px-3 py-3 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 min-w-[52px]">{r.freq.toFixed(2)}%</span>
                          <FreqBar pct={r.freq} color={SALA_COLORS[i % SALA_COLORS.length]} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700 font-medium">{r.alunos_ref}</td>
                      <td className="px-3 py-3 text-center text-gray-700 font-medium">{r.media_por_aula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Líderes por sala */}
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase text-center">
              Líder de cada sala · Todos os empatados são exibidos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {salasNaoProf.map(([nome, s], ci) => {
                const sorted = [...s.alunos].sort((a, b) => b.pts - a.pts)
                const maxPts = sorted[0]?.pts ?? 0
                const leaders = sorted.filter(a => a.pts === maxPts && maxPts > 0)
                return (
                  <Card key={nome} className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{nome}</p>
                      <ExpandIcon />
                    </div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-300 uppercase mb-3">
                      Líderes — {maxPts} de {s.datas.length} presenças
                    </p>
                    <div className="flex flex-col gap-2">
                      {leaders.map((a, i) => (
                        <div key={a.nome} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400">✦</span>
                            <span className="text-sm font-bold text-gray-800 uppercase">{a.nome}</span>
                          </div>
                          <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                            {a.pts} PTS
                          </span>
                        </div>
                      ))}
                      {leaders.length === 0 && (
                        <p className="text-xs text-gray-300 uppercase">Sem dados</p>
                      )}
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
