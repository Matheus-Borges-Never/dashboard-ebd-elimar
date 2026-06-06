import { list } from '@vercel/blob';

async function fetchBlob(token, key) {
  const { blobs } = await list({ prefix: key, token });
  if (!blobs || blobs.length === 0) return null;
  const blob = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  const res = await fetch(blob.url);
  return res.json();
}

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
    const max = alunos.length * sundays.length;
    const freq_pct = max > 0 ? Math.round((total / max) * 10000) / 100 : 0;

    result[sala.nome] = {
      datas: sundays.map(fmtDate),
      alunos: alunosData,
      totais_por_aula,
      freq_pct,
    };

    ranking.push({ sala: sala.nome, freq: freq_pct });
    relatorio.push({
      sala: sala.nome,
      alunos_ref: alunos.length,
      freq_pct,
      ultimo_domingo: totais_por_aula[totais_por_aula.length - 1] ?? 0,
    });
  }

  ranking.sort((a, b) => b.freq - a.freq);
  ranking.forEach((r, i) => { r.pos = `${i + 1}º`; });

  return {
    ...result,
    ranking,
    relatorio,
    meta: {
      geradoEm: new Date().toISOString(),
      trimestre: trimestre.nome,
      totalDomingos: allSundays.length,
      domingosPassed: sundays.length,
    },
  };
}

export default async function handler(req, res) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN não configurado.' });

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // New structured DB
    const db = await fetchBlob(token, 'ebd-db.json');
    if (db && db.trimestres && db.trimestres.length > 0) {
      const computed = computeFromDB(db);
      if (computed) return res.status(200).json(computed);
    }

    // Fallback: legacy spreadsheet upload
    const legacy = await fetchBlob(token, 'ebd-data.json');
    if (legacy) return res.status(200).json(legacy);

    return res.status(404).json({ error: 'Nenhuma planilha carregada ainda.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao buscar dados: ' + e.message });
  }
}
