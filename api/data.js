import { readDB } from './_db.js';

function getSundays(inicio, fim) {
  const sundays = [];
  const d = new Date(inicio + 'T12:00:00Z');
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  const end = new Date(fim + 'T12:00:00Z');
  while (d <= end) {
    sundays.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return sundays;
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function computeFromDB(db) {
  const trimestre = db.trimestres.find(t => t.ativo) || db.trimestres[db.trimestres.length - 1];
  if (!trimestre) return null;

  const allSundays = getSundays(trimestre.inicio, trimestre.fim);
  const today = new Date().toISOString().split('T')[0];
  const sundays = allSundays.filter(s => s <= today);

  const result = {};
  const presencas = db.presencas || [];
  const salasSorted = [...(db.salas || []).filter(s => s.trimestre_id === trimestre.id)];

  const ranking = [];
  const relatorio = [];

  for (const sala of salasSorted) {
    const alunos = (db.alunos || []).filter(a => a.sala_id === sala.id);
    const alunoIds = new Set(alunos.map(a => a.id));

    const recordedDates = new Set(
      presencas.filter(p => alunoIds.has(p.aluno_id) && sundays.includes(p.data)).map(p => p.data)
    );
    const aulasRealizadas = sundays.filter(d => recordedDates.has(d)).length;

    const alunosData = alunos.map(aluno => {
      const pArr = sundays.map(d => {
        const p = presencas.find(x => x.aluno_id === aluno.id && x.data === d);
        return p && p.presente ? 1 : 0;
      });
      return { nome: aluno.nome, pts: pArr.reduce((a, b) => a + b, 0), presencas: pArr };
    });

    const totais_por_aula = sundays.map((_, i) =>
      alunosData.reduce((sum, a) => sum + a.presencas[i], 0)
    );

    const total = alunosData.reduce((s, a) => s + a.pts, 0);
    const max = alunos.length * aulasRealizadas;
    const freq_pct = max > 0 ? Math.round((total / max) * 10000) / 100 : 0;

    result[sala.nome] = {
      datas: sundays.map(fmtDate),
      alunos: alunosData,
      totais_por_aula,
      freq_pct,
    };

    const isProfessores = /professor|coordena/i.test(sala.nome);
    const media_por_aula = parseFloat((alunos.length * freq_pct / 100).toFixed(1));
    const ultimo_domingo = totais_por_aula[totais_por_aula.length - 1] ?? 0;

    if (!isProfessores) {
      // Ranking: só entram alunos com mais de 23% de presença nas aulas realizadas
      const alunosRanking = aulasRealizadas > 0
        ? alunosData.filter(a => (a.pts / aulasRealizadas) > 0.23)
        : [];
      const totalRanking = alunosRanking.reduce((s, a) => s + a.pts, 0);
      const maxRanking = alunosRanking.length * aulasRealizadas;
      const freqRanking = maxRanking > 0 ? Math.round((totalRanking / maxRanking) * 10000) / 100 : 0;
      const mediaRanking = parseFloat((alunosRanking.length * freqRanking / 100).toFixed(1));

      ranking.push({ sala: sala.nome, freq: freqRanking, alunos_ref: alunosRanking.length, media_por_aula: mediaRanking });
      relatorio.push({ sala: sala.nome, alunos_ref: alunos.length, freq_pct, ultimo_domingo, media_por_aula });
    } else {
      result.__corpDocente = freq_pct;
    }
  }

  ranking.sort((a, b) => b.freq - a.freq);
  ranking.forEach((r, i) => { r.pos = `${i + 1}º`; });

  const lastSunday = sundays[sundays.length - 1];
  const totalPresentesUltimoDom = relatorio.reduce((s, r) => s + r.ultimo_domingo, 0);

  return {
    ...result,
    ranking,
    relatorio,
    meta: {
      geradoEm: new Date().toISOString(),
      trimestre: trimestre.nome,
      totalDomingos: allSundays.length,
      domingosPassed: sundays.length,
      ultimoDomingo: lastSunday ? fmtDate(lastSunday) : null,
      totalPresentesUltimoDom,
      corpDocente: result.__corpDocente ?? null,
    },
  };
}

export default async function handler(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY não configuradas.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const db = await readDB();
    if (db.trimestres.length > 0) {
      const computed = computeFromDB(db);
      if (computed) return res.status(200).json(computed);
    }
    return res.status(404).json({ error: 'Nenhum trimestre cadastrado ainda.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao buscar dados: ' + e.message });
  }
}
