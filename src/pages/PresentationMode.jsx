import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

const SALA_COLORS = ['#7c6fcd', '#c9a84c', '#e07b8a', '#6baed6', '#6dbf9c', '#e0936a']

function SlideWrapper({ children, slide, total, label, onPrev, onNext, onExit }) {
  return (
    <div className="w-full h-full flex flex-col bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-14 pt-8 pb-0 shrink-0">
        <span className="text-sm font-semibold text-gray-300 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-5">
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-7 bg-blue-500' : 'w-1.5 bg-gray-200'}`} />
            ))}
          </div>
          <span className="text-sm text-gray-300">{slide + 1}/{total}</span>
          <button onClick={onExit} className="text-xs text-gray-300 hover:text-gray-500 border border-gray-200 px-3 py-1 rounded-lg transition-colors">
            ESC
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 px-14 py-6">
        {children}
      </div>

      {/* Nav arrows */}
      <div className="flex items-center justify-between px-14 pb-7 shrink-0">
        <button onClick={onPrev} disabled={slide === 0}
          className="flex items-center gap-2 text-gray-300 hover:text-gray-600 disabled:opacity-0 transition-colors text-lg font-semibold">
          ← Anterior
        </button>
        <button onClick={onNext} disabled={slide === total - 1}
          className="flex items-center gap-2 text-gray-300 hover:text-gray-600 disabled:opacity-0 transition-colors text-lg font-semibold">
          Próximo →
        </button>
      </div>
    </div>
  )
}

// Slide 1 — Visão Geral
function SlideVisaoGeral({ meta, relatorio }) {
  const totalAlunos = relatorio.reduce((s, r) => s + (r.alunos_ref || 0), 0)
  const mediaFreq = relatorio.length ? relatorio.reduce((s, r) => s + (r.freq_pct || 0), 0) / relatorio.length : 0
  const pct = meta.totalDomingos > 0 ? (meta.domingosPassed / meta.totalDomingos) * 100 : 0

  return (
    <div className="h-full flex flex-col justify-center gap-10">
      <h1 className="text-6xl font-black text-gray-900 tracking-tight">{meta.trimestre}</h1>

      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Frequência Geral', value: `${mediaFreq.toFixed(1)}%`, color: 'text-blue-600' },
          { label: 'Alunos Matriculados', value: totalAlunos, color: 'text-gray-900' },
          { label: `Presentes em ${meta.ultimoDomingo ?? '—'}`, value: meta.totalPresentesUltimoDom ?? '—', color: 'text-green-600' },
          { label: 'Corpo Docente', value: meta.corpDocente != null ? `${Number(meta.corpDocente).toFixed(1)}%` : '—', color: 'text-slate-600' },
        ].map(c => (
          <div key={c.label} className="rounded-3xl border-2 border-gray-100 bg-gray-50 px-8 py-8 flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-7xl font-black ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border-2 border-gray-100 bg-gray-50 px-10 py-7">
        <div className="flex justify-between mb-4">
          <span className="text-base font-semibold text-gray-400 uppercase tracking-widest">Progresso do Trimestre</span>
          <span className="text-base font-bold text-blue-600">{meta.domingosPassed} de {meta.totalDomingos} aulas · {Math.round(pct)}%</span>
        </div>
        <div className="h-5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// Slide 2 — Líderes
function SlideLideres({ todasSalas }) {
  return (
    <div className="h-full flex flex-col">
      <h1 className="text-6xl font-black text-gray-900 mb-8">Líderes de Cada Sala</h1>
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-5">
        {todasSalas.map(([nome, s], i) => {
          const isProf = /professor|coordena/i.test(nome)
          const alunos = Array.isArray(s?.alunos) ? [...s.alunos].sort((a, b) => (b.pts || 0) - (a.pts || 0)) : []
          const maxPts = alunos[0]?.pts ?? 0
          const leaders = maxPts > 0 ? alunos.filter(a => a.pts === maxPts) : []
          const color = isProf ? '#64748b' : SALA_COLORS[i % SALA_COLORS.length]
          return (
            <div key={nome} className="rounded-3xl border-2 bg-white p-7 flex flex-col gap-3" style={{ borderColor: color + '55' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ background: color }} />
                <p className="text-base font-bold text-gray-400 uppercase tracking-widest">{nome}</p>
              </div>
              <p className="text-sm text-gray-300 uppercase tracking-wider">{maxPts} presenças</p>
              <div className="flex flex-col gap-3 mt-2">
                {leaders.map(a => (
                  <div key={a.nome} className="flex items-center gap-3">
                    <span className="text-2xl" style={{ color }}>✦</span>
                    <span className="text-3xl font-black text-gray-900 uppercase leading-tight">{a.nome}</span>
                  </div>
                ))}
                {leaders.length === 0 && <p className="text-xl text-gray-300">Sem dados</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Slide 3 — Ranking
function SlideRanking({ ranking }) {
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean)
  const heights = [190, 250, 150]
  const medals = ['🥈', '🥇', '🥉']
  const colors = ['#94a3b8', '#f59e0b', '#cd7c3a']

  return (
    <div className="h-full flex flex-col gap-5">
      <h1 className="text-6xl font-black text-gray-900 shrink-0">Ranking Final</h1>

      <div className="flex-1 min-h-0 flex gap-8">
        {/* Pódio */}
        <div className="flex items-end justify-center gap-6 shrink-0" style={{ width: 420 }}>
          {podium.map((sala, idx) => (
            <div key={sala.sala} className="flex flex-col items-center gap-2">
              <p className="text-3xl font-black" style={{ color: colors[idx] }}>{Number(sala.freq || 0).toFixed(1)}%</p>
              <p className="text-base font-bold text-gray-600 uppercase text-center max-w-28 leading-tight">{sala.sala}</p>
              <div className="w-28 rounded-t-2xl flex items-center justify-center border-t-4 border-x-4"
                style={{ height: heights[idx], borderColor: colors[idx], background: colors[idx] + '18' }}>
                <span className="text-6xl">{medals[idx]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tabela */}
        <div className="flex-1 min-h-0 overflow-auto rounded-3xl border-2 border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-100 bg-gray-50">
                {['Pos.', 'Sala', 'Frequência', 'Alunos', 'Média/Aula'].map(h => (
                  <th key={h} className="px-5 py-4 text-left text-sm font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.sala} className="border-b border-gray-50">
                  <td className="px-5 py-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black ${
                      i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-100 text-orange-500' : 'bg-gray-50 text-gray-400'
                    }`}>{i + 1}º</div>
                  </td>
                  <td className="px-5 py-4 text-2xl font-black text-gray-900 uppercase">{r.sala}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-black text-blue-600">{Number(r.freq || 0).toFixed(1)}%</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.freq || 0}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xl font-bold text-gray-600 text-center">{r.alunos_ref ?? '—'}</td>
                  <td className="px-5 py-4 text-xl font-bold text-gray-600 text-center">{r.media_por_aula ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Slide 4 — Frequência por sala (com %)
function SlideFrequencia({ barDataComProf }) {
  return (
    <div className="h-full flex flex-col">
      <h1 className="text-6xl font-black text-gray-900 mb-4 shrink-0">Frequência por Sala</h1>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barDataComProf} margin={{ top: 50, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="sala" tick={{ fontSize: 18, fill: '#6b7280', fontWeight: 700 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 16, fill: '#9ca3af' }} unit="%" />
            <Tooltip formatter={v => [`${Number(v).toFixed(1)}%`, 'Frequência']} />
            <Bar dataKey="freq_pct" radius={[12, 12, 0, 0]} isAnimationActive={false}
              label={{ position: 'top', fill: '#374151', fontSize: 22, fontWeight: 800, formatter: v => `${Number(v).toFixed(1)}%` }}>
              {barDataComProf.map((entry, i) => (
                <Cell key={i} fill={/professor|coordena/i.test(entry.sala) ? '#94a3b8' : SALA_COLORS[i % SALA_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Slide por sala individual — top 10
function SlidePorSala({ nome, s, color }) {
  const alunos = Array.isArray(s?.alunos)
    ? [...s.alunos].sort((a, b) => (b.pts || 0) - (a.pts || 0)).slice(0, 10)
    : []
  const datas = Array.isArray(s?.datas) ? s.datas : []
  const maxPts = datas.length

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-end gap-5 shrink-0">
        <h1 className="text-6xl font-black text-gray-900 uppercase">{nome}</h1>
        <span className="text-4xl font-black mb-1" style={{ color }}>{Number(s?.freq_pct ?? 0).toFixed(1)}%</span>
        <span className="text-xl text-gray-400 mb-2">de frequência</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-100">
              <th className="text-left py-3 pr-6 text-sm font-bold text-gray-400 uppercase tracking-widest w-12">#</th>
              <th className="text-left py-3 pr-6 text-sm font-bold text-gray-400 uppercase tracking-widest">Aluno</th>
              <th className="text-center py-3 px-4 text-sm font-bold text-gray-400 uppercase tracking-widest">Presenças</th>
              <th className="text-left py-3 pl-4 text-sm font-bold text-gray-400 uppercase tracking-widest">Aulas</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((a, i) => {
              const pct = maxPts > 0 ? (a.pts / maxPts) * 100 : 0
              return (
                <tr key={a.nome} className="border-b border-gray-50">
                  <td className="py-3 pr-6">
                    <span className={`text-xl font-black ${i === 0 ? 'text-amber-500' : 'text-gray-300'}`}>{i + 1}º</span>
                  </td>
                  <td className="py-3 pr-6">
                    <span className="text-3xl font-black text-gray-900 uppercase">{a.nome}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-3xl font-black" style={{ color }}>{a.pts}</span>
                    <span className="text-lg text-gray-300 ml-1">/ {maxPts}</span>
                  </td>
                  <td className="py-3 pl-4" style={{ minWidth: 200 }}>
                    <div className="flex gap-1 flex-wrap">
                      {Array.isArray(a.presencas) && a.presencas.map((p, j) => (
                        <div key={j} className="w-4 h-4 rounded-full" style={{ background: p ? color : '#e5e7eb' }} />
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Slide — Tabela aula a aula
function SlideTabela({ todasSalas }) {
  const refSala = todasSalas[0]?.[1]
  const datas = Array.isArray(refSala?.datas) ? refSala.datas : []
  const totalGeral = datas.map((_, di) =>
    todasSalas.reduce((s, [, sala]) => s + (Array.isArray(sala?.totais_por_aula) ? (sala.totais_por_aula[di] || 0) : 0), 0)
  )

  return (
    <div className="h-full flex flex-col gap-4">
      <h1 className="text-6xl font-black text-gray-900 shrink-0">Presença Aula a Aula</h1>
      <div className="flex-1 min-h-0 overflow-auto rounded-3xl border-2 border-gray-100">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-100 bg-gray-50">
              <th className="text-left py-4 px-6 text-sm font-bold text-gray-400 uppercase tracking-widest min-w-36">Sala</th>
              {datas.map((d, i) => (
                <th key={d} className="text-center py-3 px-3 min-w-16">
                  <div className="text-base font-bold text-gray-700">{d}</div>
                  <div className="text-xs text-gray-400">Aula {i + 1}</div>
                </th>
              ))}
              <th className="text-center py-4 px-4 text-sm font-bold text-gray-400 uppercase tracking-widest">Total</th>
            </tr>
          </thead>
          <tbody>
            {todasSalas.map(([nome, s], si) => {
              const isProf = /professor|coordena/i.test(nome)
              const totais = Array.isArray(s?.totais_por_aula) ? s.totais_por_aula : []
              const maxVal = totais.length ? Math.max(...totais) : 0
              const sum = totais.reduce((a, b) => a + b, 0)
              const color = isProf ? '#94a3b8' : SALA_COLORS[si % SALA_COLORS.length]
              return (
                <tr key={nome} className={`border-b border-gray-50 ${isProf ? 'bg-slate-50' : ''}`}>
                  <td className="py-4 px-6 font-black text-lg uppercase">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                      <span style={{ color }}>{nome}</span>
                    </div>
                  </td>
                  {datas.map((_, di) => {
                    const val = totais[di] ?? 0
                    const isMax = val === maxVal && maxVal > 0
                    return (
                      <td key={di} className="text-center px-3 py-4">
                        <span className={`text-2xl font-black ${isMax ? 'text-amber-500' : val === 0 ? 'text-gray-200' : 'text-gray-700'}`}>
                          {val || '–'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="text-center px-4 py-4 text-2xl font-black text-gray-900">{sum}</td>
                </tr>
              )
            })}
            <tr className="border-t-4 border-gray-200 bg-gray-50">
              <td className="py-4 px-6 text-base font-black text-gray-500 uppercase tracking-wider">Total Geral</td>
              {totalGeral.map((t, i) => {
                const maxTG = Math.max(...totalGeral)
                return (
                  <td key={i} className={`text-center px-3 py-4 text-2xl font-black ${t === maxTG && maxTG > 0 ? 'text-amber-500' : 'text-gray-500'}`}>{t}</td>
                )
              })}
              <td className="text-center px-4 py-4 text-2xl font-black text-blue-600">{totalGeral.reduce((a, b) => a + b, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-300 shrink-0">✦ Valores em âmbar indicam o maior número de presentes daquela sala.</p>
    </div>
  )
}

// Slide — Total por domingo
function SlideTotalDomingo({ todasSalas }) {
  const refSala = todasSalas[0]?.[1]
  const datas = Array.isArray(refSala?.datas) ? refSala.datas : []
  const chartData = datas.map((d, di) => ({
    data: d,
    total: todasSalas.reduce((s, [, sala]) => s + (Array.isArray(sala?.totais_por_aula) ? (sala.totais_por_aula[di] || 0) : 0), 0),
  }))
  const maxTotal = Math.max(...chartData.map(d => d.total))

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-6xl font-black text-gray-900 mb-4 shrink-0">Total de Presentes por Domingo</h1>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 50, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="data" tick={{ fontSize: 18, fill: '#6b7280', fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 16, fill: '#9ca3af' }} />
            <Tooltip formatter={v => [`${v} presentes`, 'Total']} />
            <Bar dataKey="total" radius={[12, 12, 0, 0]} isAnimationActive={false}
              label={{ position: 'inside', fill: '#fff', fontSize: 24, fontWeight: 800 }}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.total === maxTotal ? '#f59e0b' : '#7c6fcd'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function PresentationMode({ meta, relatorio, ranking, todasSalas, barDataComProf, onExit }) {
  // Montar lista de slides dinamicamente
  const salasSlides = todasSalas.map(([nome, s], i) => ({
    type: 'sala',
    nome,
    s,
    color: /professor|coordena/i.test(nome) ? '#94a3b8' : SALA_COLORS[i % SALA_COLORS.length],
  }))

  const slides = [
    { type: 'visao', label: 'Visão Geral' },
    { type: 'lideres', label: 'Líderes' },
    { type: 'ranking', label: 'Ranking Final' },
    { type: 'frequencia', label: 'Frequência por Sala' },
    ...salasSlides.map(s => ({ ...s, label: s.nome })),
    { type: 'tabela', label: 'Aula a Aula' },
    { type: 'total', label: 'Total por Domingo' },
  ]

  const [slide, setSlide] = useState(0)
  const total = slides.length

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { document.exitFullscreen?.().catch(() => {}) }
  }, [])

  const prev = useCallback(() => setSlide(s => Math.max(s - 1, 0)), [])
  const next = useCallback(() => setSlide(s => Math.min(s + 1, total - 1)), [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev()
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onExit])

  const current = slides[slide]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff' }}>
      <SlideWrapper slide={slide} total={total} label={current.label} onPrev={prev} onNext={next} onExit={onExit}>
        {current.type === 'visao' && <SlideVisaoGeral meta={meta} relatorio={relatorio} />}
        {current.type === 'lideres' && <SlideLideres todasSalas={todasSalas} />}
        {current.type === 'ranking' && <SlideRanking ranking={ranking} />}
        {current.type === 'frequencia' && <SlideFrequencia barDataComProf={barDataComProf} />}
        {current.type === 'sala' && <SlidePorSala nome={current.nome} s={current.s} color={current.color} />}
        {current.type === 'tabela' && <SlideTabela todasSalas={todasSalas} />}
        {current.type === 'total' && <SlideTotalDomingo todasSalas={todasSalas} />}
      </SlideWrapper>
    </div>
  )
}
