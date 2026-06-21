import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

const SALA_COLORS = ['#c9a84c', '#7c6fcd', '#e07b8a', '#6baed6', '#6dbf9c', '#e0936a']
const TOTAL_SLIDES = 6

// Label customizado: só mostra % para corpo docente
function BarLabelSuspense({ x, y, width, index, data }) {
  const entry = data?.[index]
  if (!entry || !/professor|coordena/i.test(entry.sala)) return null
  return (
    <text x={x + width / 2} y={y - 10} textAnchor="middle" fill="#94a3b8" fontSize={18} fontWeight={700}>
      {Number(entry.freq_pct).toFixed(1)}%
    </text>
  )
}

function SlideWrapper({ children, title, subtitle, slide, total, onPrev, onNext, onExit }) {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#0f172a', color: '#f1f5f9' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-12 pt-8 pb-2 shrink-0">
        <div>
          {title && <h1 className="text-3xl font-bold tracking-wide text-white">{title}</h1>}
          {subtitle && <p className="text-base text-slate-400 mt-1 uppercase tracking-widest">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-6">
          <span className="text-slate-500 text-sm">{slide + 1} / {total}</span>
          <button onClick={onExit} className="text-slate-500 hover:text-white text-sm border border-slate-700 px-3 py-1 rounded transition-colors">
            Sair (ESC)
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 px-12 py-4">
        {children}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-6 pb-6 shrink-0">
        <button
          onClick={onPrev}
          disabled={slide === 0}
          className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-20 transition-colors text-lg"
        >
          ←
        </button>
        <div className="flex gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-amber-400' : 'w-1.5 bg-slate-700'}`} />
          ))}
        </div>
        <button
          onClick={onNext}
          disabled={slide === total - 1}
          className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-20 transition-colors text-lg"
        >
          →
        </button>
      </div>
    </div>
  )
}

// Slide 1 — Visão Geral
function Slide1({ meta, relatorio }) {
  const totalAlunos = relatorio.reduce((s, r) => s + (r.alunos_ref || 0), 0)
  const mediaFreq = relatorio.length ? relatorio.reduce((s, r) => s + (r.freq_pct || 0), 0) / relatorio.length : 0
  const pct = meta.totalDomingos > 0 ? (meta.domingosPassed / meta.totalDomingos) * 100 : 0

  const cards = [
    { label: 'Frequência Geral', value: `${mediaFreq.toFixed(1)}%`, sub: 'Média das salas' },
    { label: 'Alunos Matriculados', value: totalAlunos, sub: 'Total de alunos' },
    { label: 'Último Domingo', value: meta.totalPresentesUltimoDom ?? '—', sub: meta.ultimoDomingo ? `Presentes em ${meta.ultimoDomingo}` : '—' },
    { label: 'Corpo Docente', value: meta.corpDocente != null ? `${Number(meta.corpDocente).toFixed(1)}%` : '—', sub: 'Frequência dos professores' },
  ]

  return (
    <div className="h-full flex flex-col justify-center gap-10">
      <div className="grid grid-cols-4 gap-6">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border border-slate-700 bg-slate-800/50 px-8 py-8 flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{c.label}</p>
            <p className="text-6xl font-bold text-white">{c.value}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 px-8 py-6">
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-4">Progresso do Trimestre — {meta.trimestre}</p>
        <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between mt-3">
          <span className="text-sm text-amber-400 font-semibold">Aula 1</span>
          <span className="text-sm text-slate-400">{meta.domingosPassed} de {meta.totalDomingos} aulas concluídas ({Math.round(pct)}%)</span>
          <span className="text-sm text-slate-500">Aula {meta.totalDomingos}</span>
        </div>
      </div>
    </div>
  )
}

// Slide 2 — Frequência por sala (SEM % dos alunos — suspense)
function Slide2({ barDataComProf }) {
  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-slate-500 uppercase tracking-widest mb-2">Quem será o campeão?</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barDataComProf} margin={{ top: 30, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="sala" tick={{ fontSize: 16, fill: '#94a3b8', fontWeight: 600 }} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
              formatter={(v, name, props) => {
                const isProf = /professor|coordena/i.test(props?.payload?.sala || '')
                return isProf ? [`${Number(v).toFixed(1)}%`, 'Frequência'] : ['???', 'Frequência']
              }}
            />
            <Bar dataKey="freq_pct" radius={[10, 10, 0, 0]} isAnimationActive={false}>
              <LabelList content={(props) => <BarLabelSuspense {...props} data={barDataComProf} />} />
              {barDataComProf.map((entry, i) => (
                <Cell key={i} fill={/professor|coordena/i.test(entry.sala) ? '#475569' : SALA_COLORS[i % SALA_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Slide 3 — Líderes por sala (SEM %)
function Slide3({ todasSalas }) {
  return (
    <div className="h-full flex flex-col justify-center">
      <div className="grid grid-cols-3 gap-5 auto-rows-fr">
        {todasSalas.map(([nome, s], i) => {
          const isProf = /professor|coordena/i.test(nome)
          const alunos = Array.isArray(s?.alunos) ? [...s.alunos].sort((a, b) => (b.pts || 0) - (a.pts || 0)) : []
          const maxPts = alunos[0]?.pts ?? 0
          const leaders = maxPts > 0 ? alunos.filter(a => a.pts === maxPts) : []
          const color = isProf ? '#64748b' : SALA_COLORS[i % SALA_COLORS.length]
          return (
            <div key={nome} className="rounded-2xl border bg-slate-800/50 p-6 flex flex-col gap-3" style={{ borderColor: color + '55' }}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{nome}</p>
              </div>
              <p className="text-xs text-slate-600 uppercase tracking-wider">{maxPts} presenças</p>
              <div className="flex flex-col gap-2 mt-1">
                {leaders.map(a => (
                  <div key={a.nome} className="flex items-center gap-3">
                    <span style={{ color }}>✦</span>
                    <span className="text-xl font-bold text-white uppercase">{a.nome}</span>
                  </div>
                ))}
                {leaders.length === 0 && <p className="text-slate-600 text-sm">Sem dados</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Slide 4 — Ranking com pódio e %
function Slide4({ ranking }) {
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean)
  const podiumHeights = [160, 210, 130]
  const medals = ['🥈', '🥇', '🥉']
  const podiumColors = ['#94a3b8', '#f59e0b', '#cd7c3a']

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Pódio */}
      <div className="flex items-end justify-center gap-8 shrink-0" style={{ paddingTop: 8 }}>
        {podium.map((sala, idx) => {
          const originalIdx = ranking.indexOf(sala)
          return (
            <div key={sala.sala} className="flex flex-col items-center gap-2">
              <p className="text-2xl font-bold" style={{ color: podiumColors[idx] }}>{Number(sala.freq || 0).toFixed(1)}%</p>
              <p className="text-base font-bold text-white uppercase text-center max-w-32">{sala.sala}</p>
              <div
                className="w-36 rounded-t-2xl flex items-center justify-center border-t border-x border-slate-600"
                style={{ height: podiumHeights[idx], background: podiumColors[idx] + '22' }}
              >
                <span className="text-5xl">{medals[idx]}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-700 bg-slate-800/40">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              {['Pos.', 'Sala', 'Frequência', 'Alunos Ref.', 'Média/Aula'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold tracking-widest text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.sala} className="border-b border-slate-800">
                <td className="px-6 py-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-600/40 text-slate-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'
                  }`}>{i + 1}º</div>
                </td>
                <td className="px-6 py-3 text-lg font-bold text-white uppercase">{r.sala}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-amber-400">{Number(r.freq || 0).toFixed(2)}%</span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${r.freq || 0}%` }} />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-center text-slate-300 text-base">{r.alunos_ref ?? '—'}</td>
                <td className="px-6 py-3 text-center text-slate-300 text-base">{r.media_por_aula ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Slide 5 — Tabela aula a aula
function Slide5({ todasSalas }) {
  const refSala = todasSalas[0]?.[1]
  const datas = Array.isArray(refSala?.datas) ? refSala.datas : []
  const totalGeral = datas.map((_, di) =>
    todasSalas.reduce((s, [, sala]) => s + (Array.isArray(sala?.totais_por_aula) ? (sala.totais_por_aula[di] || 0) : 0), 0)
  )

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 pr-6 text-slate-500 font-semibold uppercase tracking-widest min-w-36">Sala</th>
            {datas.map((d, i) => (
              <th key={d} className="text-center px-3 py-2 text-slate-500 font-semibold min-w-14">
                <div className="text-white">{d}</div>
                <div className="text-slate-600 font-normal text-xs">Aula {i + 1}</div>
              </th>
            ))}
            <th className="text-center px-3 py-2 text-slate-500 font-semibold uppercase tracking-widest">Total</th>
          </tr>
        </thead>
        <tbody>
          {todasSalas.map(([nome, s], si) => {
            const isProf = /professor|coordena/i.test(nome)
            const totais = Array.isArray(s?.totais_por_aula) ? s.totais_por_aula : []
            const maxVal = totais.length ? Math.max(...totais) : 0
            const sum = totais.reduce((a, b) => a + b, 0)
            const color = isProf ? '#64748b' : SALA_COLORS[si % SALA_COLORS.length]
            return (
              <tr key={nome} className={`border-b border-slate-800/60 ${isProf ? 'bg-slate-800/30' : ''}`}>
                <td className="py-4 pr-6 font-bold uppercase">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span style={{ color }}>{nome}</span>
                  </div>
                </td>
                {datas.map((_, di) => {
                  const val = totais[di] ?? 0
                  const isMax = val === maxVal && maxVal > 0
                  return (
                    <td key={di} className="text-center px-3 py-4">
                      <span className={`text-lg font-bold ${isMax ? 'text-amber-400' : val === 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                        {val || '–'}
                      </span>
                    </td>
                  )
                })}
                <td className="text-center px-3 py-4 text-xl font-bold text-white">{sum}</td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-slate-600">
            <td className="py-4 pr-6 text-slate-400 font-bold uppercase tracking-wider">Total Geral</td>
            {totalGeral.map((t, i) => {
              const maxTG = Math.max(...totalGeral)
              return (
                <td key={i} className={`text-center px-3 py-4 text-lg font-bold ${t === maxTG && maxTG > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{t}</td>
              )
            })}
            <td className="text-center px-3 py-4 text-xl font-bold text-amber-400">{totalGeral.reduce((a, b) => a + b, 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Slide 6 — Total por domingo
function Slide6({ todasSalas }) {
  const refSala = todasSalas[0]?.[1]
  const datas = Array.isArray(refSala?.datas) ? refSala.datas : []
  const chartData = datas.map((d, di) => ({
    data: d,
    total: todasSalas.reduce((s, [, sala]) => s + (Array.isArray(sala?.totais_por_aula) ? (sala.totais_por_aula[di] || 0) : 0), 0),
  }))
  const maxTotal = Math.max(...chartData.map(d => d.total))

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 40, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="data" tick={{ fontSize: 16, fill: '#94a3b8', fontWeight: 600 }} />
            <YAxis tick={{ fontSize: 14, fill: '#475569' }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
              formatter={v => [`${v} presentes`, 'Total']}
            />
            <Bar dataKey="total" radius={[10, 10, 0, 0]} isAnimationActive={false}
              label={{ position: 'inside', fill: '#fff', fontSize: 18, fontWeight: 700 }}>
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

const SLIDE_TITLES = [
  { title: 'Visão Geral', subtitle: null },
  { title: 'Frequência por Sala', subtitle: null },
  { title: 'Líderes de Cada Sala', subtitle: null },
  { title: 'Ranking Final', subtitle: null },
  { title: 'Presença Aula a Aula', subtitle: null },
  { title: 'Total de Presentes por Domingo', subtitle: null },
]

export default function PresentationMode({ data, meta, relatorio, ranking, salasNaoProf, todasSalas, barDataComProf, onExit }) {
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { document.exitFullscreen?.().catch(() => {}) }
  }, [])

  const prev = useCallback(() => setSlide(s => Math.max(s - 1, 0)), [])
  const next = useCallback(() => setSlide(s => Math.min(s + 1, TOTAL_SLIDES - 1)), [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev()
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onExit])

  const slideProps = { title: SLIDE_TITLES[slide].title, subtitle: SLIDE_TITLES[slide].subtitle, slide, total: TOTAL_SLIDES, onPrev: prev, onNext: next, onExit }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <SlideWrapper {...slideProps}>
        {slide === 0 && <Slide1 meta={meta} relatorio={relatorio} />}
        {slide === 1 && <Slide2 barDataComProf={barDataComProf} />}
        {slide === 2 && <Slide3 todasSalas={todasSalas} />}
        {slide === 3 && <Slide4 ranking={ranking} />}
        {slide === 4 && <Slide5 todasSalas={todasSalas} />}
        {slide === 5 && <Slide6 todasSalas={todasSalas} />}
      </SlideWrapper>
    </div>
  )
}
