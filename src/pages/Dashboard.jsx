import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchData } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/toast'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Users, BookOpen, TrendingUp, RefreshCw, Trophy, Star } from 'lucide-react'

const SALA_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']
const TABS = ['Visão Geral', 'Por Sala', 'Evolução', 'Ranking']

function StatCard({ title, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon size={22} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function FreqBadge({ pct }) {
  const variant = pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'destructive'
  return <Badge variant={variant}>{pct.toFixed(1)}%</Badge>
}

export default function Dashboard() {
  const [tab, setTab] = useState(0)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchData,
    refetchInterval: 10_000,
  })

  // BroadcastChannel para atualizações instantâneas
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('ebd-updates')
      bc.onmessage = () => queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      return () => bc.close()
    } catch {}
  }, [queryClient])

  const salas = data
    ? Object.entries(data).filter(([k]) => !['ranking', 'relatorio', 'meta'].includes(k))
    : []

  const salaNames = salas.map(([k]) => k)

  // Dados para gráfico de barras (freq% por sala)
  const barData = salas
    .filter(([n]) => !/professor|coordena/i.test(n))
    .map(([nome, s]) => ({ nome, freq: s.freq_pct }))
    .sort((a, b) => b.freq - a.freq)

  // Dados para gráfico de linha (evolução por aula)
  const lineData = (() => {
    if (!data) return []
    const first = salas[0]?.[1]
    if (!first) return []
    return first.datas.map((dt, i) => {
      const point = { aula: dt }
      salas
        .filter(([n]) => !/professor|coordena/i.test(n))
        .forEach(([nome, s]) => { point[nome] = s.totais_por_aula[i] })
      return point
    })
  })()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando dados...</p>
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
  const totalAlunos = salas.reduce((s, [, d]) => s + d.alunos.length, 0)
  const mediaFreq = barData.length ? barData.reduce((s, d) => s + d.freq, 0) / barData.length : 0

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
                <span className="ml-2 text-xs text-gray-500 uppercase">{meta.trimestre}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 uppercase hidden sm:block">
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
                tab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* TAB 0: VISÃO GERAL */}
        {tab === 0 && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard title="Total de Alunos" value={totalAlunos} icon={Users} color="blue" />
              <StatCard title="Aulas Realizadas" value={meta.domingosPassed ?? 0} sub={`de ${meta.totalDomingos ?? 13} total`} icon={BookOpen} color="green" />
              <StatCard title="Freq. Média" value={`${mediaFreq.toFixed(1)}%`} icon={TrendingUp} color="amber" />
              <StatCard title="Salas Ativas" value={barData.length} icon={Star} color="purple" />
            </div>

            {/* Ranking rápido */}
            <Card>
              <CardHeader><CardTitle>Ranking de Frequência</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {(data.ranking || []).map((r, i) => (
                    <div key={r.sala} className="flex items-center gap-3">
                      <span className={`w-6 text-center text-sm font-bold ${i === 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800 uppercase">{r.sala}</span>
                          <FreqBadge pct={r.freq} />
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${r.freq}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de barras */}
            <Card>
              <CardHeader><CardTitle>Frequência por Sala (%)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} unit="%" />
                    <Tooltip formatter={v => `${v.toFixed(1)}%`} />
                    <Bar dataKey="freq" radius={[6, 6, 0, 0]}>
                      {barData.map((_, i) => <Cell key={i} fill={SALA_COLORS[i % SALA_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 1: POR SALA */}
        {tab === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {salas.map(([nome, s], ci) => (
              <Card key={nome}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{nome}</CardTitle>
                    <FreqBadge pct={s.freq_pct} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1">
                    {[...s.alunos]
                      .sort((a, b) => b.pts - a.pts)
                      .map((a, i) => (
                        <div key={a.nome} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                            <span className="text-sm text-gray-800 uppercase">{a.nome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{a.pts} pts</span>
                            <div className="flex gap-0.5">
                              {a.presencas.map((p, j) => (
                                <div
                                  key={j}
                                  className={`w-2.5 h-2.5 rounded-full ${p ? 'bg-green-500' : 'bg-gray-200'}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 2: EVOLUÇÃO */}
        {tab === 2 && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw size={14} /> Atualizar
              </Button>
            </div>

            {/* Gráfico de linha */}
            <Card>
              <CardHeader><CardTitle>Presença por Sala — Aula a Aula</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="aula" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip />
                    <Legend />
                    {salas
                      .filter(([n]) => !/professor|coordena/i.test(n))
                      .map(([nome], i) => (
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
              </CardContent>
            </Card>

            {/* Tabela de evolução */}
            {salas.filter(([n]) => !/professor|coordena/i.test(n)).map(([nome, s]) => {
              const maxVal = Math.max(...s.totais_por_aula)
              return (
                <Card key={nome}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{nome}</CardTitle>
                      <FreqBadge pct={s.freq_pct} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="text-left py-1 pr-3 text-gray-500 font-medium uppercase min-w-32">Aluno</th>
                            {s.datas.map(d => (
                              <th key={d} className="text-center px-1 py-1 text-gray-500 font-medium">{d}</th>
                            ))}
                            <th className="text-center px-1 py-1 text-gray-500 font-medium">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...s.alunos].sort((a, b) => b.pts - a.pts).map(a => (
                            <tr key={a.nome} className="border-t border-gray-50">
                              <td className="py-1.5 pr-3 text-gray-800 uppercase font-medium">{a.nome}</td>
                              {a.presencas.map((p, i) => (
                                <td key={i} className="text-center px-1 py-1.5">
                                  <span className={`${p ? 'text-green-600 font-semibold' : 'text-gray-300'}`}>
                                    {p ? '✓' : '–'}
                                  </span>
                                </td>
                              ))}
                              <td className="text-center px-1 py-1.5 font-bold text-gray-900">{a.pts}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-200">
                            <td className="py-1.5 pr-3 text-gray-500 font-semibold uppercase">Total</td>
                            {s.totais_por_aula.map((t, i) => (
                              <td
                                key={i}
                                className={`text-center px-1 py-1.5 font-bold ${
                                  t === maxVal && maxVal > 0 ? 'text-amber-600' : 'text-gray-700'
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
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* TAB 3: RANKING */}
        {tab === 3 && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader><CardTitle>Ranking Geral — Frequência por Sala</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {(data.ranking || []).map((r, i) => (
                    <div key={r.sala} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-gray-200 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-white text-gray-500 border'
                      }`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 uppercase text-sm">{r.sala}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${r.freq}%`,
                                background: SALA_COLORS[i % SALA_COLORS.length],
                              }}
                            />
                          </div>
                          <FreqBadge pct={r.freq} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top alunos por sala */}
            {salas
              .filter(([n]) => !/professor|coordena/i.test(n))
              .map(([nome, s]) => {
                const top = [...s.alunos].sort((a, b) => b.pts - a.pts).slice(0, 3)
                return (
                  <Card key={nome}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{nome} — Destaques</CardTitle>
                        <FreqBadge pct={s.freq_pct} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-2">
                        {top.map((a, i) => (
                          <div key={a.nome} className="flex items-center gap-3">
                            <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                            <span className="flex-1 text-sm font-medium text-gray-800 uppercase">{a.nome}</span>
                            <Badge variant="secondary">{a.pts} pts</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        )}
      </main>

      <Toaster />
    </div>
  )
}
