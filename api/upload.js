import { put } from '@vercel/blob';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import XLSX from 'xlsx';

export const config = { api: { bodyParser: false } };

const SENHA = '0705';

function toDateStr(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return String(d.d).padStart(2,'0') + '/' + String(d.m).padStart(2,'0');
  }
  return null;
}

function parseSheet(wb, sheetSearch) {
  const search = sheetSearch.trim().toUpperCase();
  const match = wb.SheetNames.find(s => s.trim().toUpperCase() === search)
    || wb.SheetNames.find(s => s.trim().toUpperCase().includes(search));
  if (!match) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[match], { header: 1, defval: null });
}

function parseSala(rows) {
  if (!rows) return null;

  // --- 1. Acha a linha de cabeçalho e a coluna do nome ---
  let headerRow = -1;
  let nomeCol   = -1;
  for (let i = 0; i < rows.length; i++) {
    for (let c = 0; c < rows[i].length; c++) {
      const v = String(rows[i][c] || '').trim();
      if (v === 'ALUNOS' || v === 'PROF/COORD.') {
        headerRow = i;
        nomeCol   = c;
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow === -1) return null;

  // --- 2. Datas: colunas após nomeCol até a última com data válida ---
  const datas = [];
  const dateStartCol = nomeCol + 1;
  for (let c = dateStartCol; c < rows[headerRow].length; c++) {
    const d = toDateStr(rows[headerRow][c]);
    if (d) datas.push({ col: c, label: d });
  }

  // --- 3. Coluna de pts: última coluna com "TOTAL" no cabeçalho, ou última com número no 1º aluno ---
  let ptsCol = -1;
  // Procura "TOTAL DE PONTOS" ou "TOTAL" na linha do header estendendo mais 2 linhas acima
  for (let i = Math.max(0, headerRow - 2); i <= headerRow; i++) {
    for (let c = rows[i].length - 1; c >= 0; c--) {
      const v = String(rows[i][c] || '').trim().toUpperCase();
      if (v.includes('TOTAL')) { ptsCol = c; break; }
    }
    if (ptsCol >= 0) break;
  }
  // Fallback: última célula numérica na primeira linha de aluno
  if (ptsCol === -1) {
    for (let i = headerRow + 1; i < Math.min(headerRow + 5, rows.length); i++) {
      const nome = String(rows[i][nomeCol] || '').trim();
      if (!nome) continue;
      for (let c = rows[i].length - 1; c > nomeCol; c--) {
        if (rows[i][c] !== null && !isNaN(Number(rows[i][c])) && Number(rows[i][c]) > 0) {
          ptsCol = c; break;
        }
      }
      if (ptsCol >= 0) break;
    }
  }

  const dataCols = datas.map(d => d.col);
  const dateLabels = datas.map(d => d.label);

  // --- 4. Lê alunos ---
  const alunos = [];
  let totais  = [];
  let freq_pct = null;
  const skipNames = new Set(['TOTAL','AULAS','FREQUÊNCIA MÉDIA %','FREQUÊNCIA MÉDIA Nº','FREQUÊNCIA MEDIA %','FREQUÊNCIA MEDIA Nº']);

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row  = rows[i];
    const nome = String(row[nomeCol] || '').trim();
    if (!nome) continue;

    if (nome === 'TOTAL') {
      totais = dataCols.map(c => {
        const v = row[c];
        return (v !== null && !isNaN(Number(v))) ? Number(v) : 0;
      });
      continue;
    }
    if (nome.toUpperCase().includes('FREQUÊNCIA MÉDIA %') || nome.toUpperCase().includes('FREQUENCIA MEDIA %')) {
      const v = row[nomeCol + 1] ?? row[dateStartCol];
      if (v !== null && !isNaN(Number(v))) freq_pct = Math.round(Number(v) * 10000) / 100;
      continue;
    }
    if (skipNames.has(nome) || nome.toUpperCase().startsWith('FREQUÊNCIA') || nome.toUpperCase().startsWith('FREQUENCIA')) {
      continue;
    }

    // É um aluno
    const pts_raw = ptsCol >= 0 ? row[ptsCol] : null;
    if (pts_raw === null || pts_raw === undefined) continue;
    const pts = parseInt(pts_raw);
    if (isNaN(pts)) continue;

    const presencas = dataCols.map(c => (Number(row[c]) === 1 ? 1 : 0));
    alunos.push({ nome, pts, presencas });
  }

  return { datas: dateLabels, alunos, totais_por_aula: totais, freq_pct };
}

function parseRanking(rows) {
  if (!rows) return { ranking: [], relatorio: [] };

  const salaNames = ['ADOLESCENTES','JOVENS','IRMÃOS','IRMÃS'];

  // Bloco 1 — ranking parcial
  let rankHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const c0 = String(rows[i][0]||'').trim().toUpperCase();
    const c1 = String(rows[i][1]||'').trim().toUpperCase();
    const c2 = String(rows[i][2]||'').trim().toUpperCase();
    if (c0 === 'SALAS' && c1.includes('FREQUÊNCIA') && c2.includes('POSIÇÃO')) {
      rankHeaderIdx = i; break;
    }
  }
  const ranking = [];
  if (rankHeaderIdx !== -1) {
    for (let i = rankHeaderIdx + 1; i < rows.length; i++) {
      const sala = String(rows[i][0]||'').trim();
      if (!sala || sala === 'TOTAL') continue;
      if (!salaNames.includes(sala)) continue;
      const freq = rows[i][1];
      const pos  = rows[i][2];
      if (freq !== null && freq !== undefined) {
        ranking.push({ sala, freq: Math.round(Number(freq) * 10000) / 100, pos: String(pos||'').trim() });
      }
    }
  }

  // Bloco 2 — relatório detalhado
  let relHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const c0 = String(rows[i][0]||'').trim().toUpperCase();
    const c1 = String(rows[i][1]||'').trim().toUpperCase();
    if (c0 === 'SALAS' && c1.includes('ALUNOS')) { relHeaderIdx = i; break; }
  }
  const relatorio = [];
  if (relHeaderIdx !== -1) {
    const header    = rows[relHeaderIdx].map(c => String(c||'').trim().toUpperCase());
    const colAlunos  = header.findIndex(h => h.includes('ALUNOS'));
    const colFreqPct = header.findIndex(h => h.includes('(%)') || h.includes('FREQUÊNCIA (%)'));
    const colUltimo  = header.findIndex(h => h.includes('ÚLTIMO') || h.includes('ULTIMO'));
    for (let i = relHeaderIdx + 1; i < rows.length; i++) {
      const sala = String(rows[i][0]||'').trim();
      if (!sala || sala === 'TOTAL' || sala.startsWith(' ')) continue;
      const alunos_ref   = colAlunos  >= 0 ? (Number(rows[i][colAlunos])  || 0) : 0;
      const freq_pct_raw = colFreqPct >= 0 ? rows[i][colFreqPct] : null;
      const freq_pct     = freq_pct_raw !== null ? Math.round(Number(freq_pct_raw) * 10000) / 100 : null;
      const ultimo       = colUltimo  >= 0 ? (Number(rows[i][colUltimo]) || 0) : 0;
      if (alunos_ref > 0) relatorio.push({ sala, alunos_ref, freq_pct, ultimo_domingo: ultimo });
    }
  }

  return { ranking, relatorio };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN não configurado.' });

  const form = new IncomingForm({ keepExtensions: true, maxFileSize: 10 * 1024 * 1024 });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Erro ao processar upload: ' + err.message });

    const senha = Array.isArray(fields.senha) ? fields.senha[0] : fields.senha;
    if (senha !== SENHA) return res.status(401).json({ error: 'Senha incorreta.' });

    const file = Array.isArray(files.planilha) ? files.planilha[0] : files.planilha;
    if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    try {
      const buffer = fs.readFileSync(file.filepath);
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });

      const data = {};
      const debug = {};

      for (const key of ['ADOLESCENTES','JOVENS','IRMÃOS','IRMÃS','PROFESSORES']) {
        const rows   = parseSheet(wb, key);
        const parsed = parseSala(rows);
        if (parsed) {
          data[key]  = parsed;
          debug[key] = { alunos: parsed.alunos.length, datas: parsed.datas.length, freq_pct: parsed.freq_pct };
        } else {
          debug[key] = 'NÃO ENCONTRADA';
        }
      }

      const rankRows = parseSheet(wb, 'RANKING');
      const { ranking, relatorio } = parseRanking(rankRows);
      data.ranking   = ranking;
      data.relatorio = relatorio;
      data.meta      = { geradoEm: new Date().toISOString() };

      await put('ebd-data.json', JSON.stringify(data), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        token,
        allowOverwrite: true,
      });

      return res.status(200).json({ ok: true, debug });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Erro ao processar planilha: ' + e.message });
    }
  });
}
