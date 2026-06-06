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
  if (val instanceof Date) {
    return String(val.getDate()).padStart(2,'0') + '/' + String(val.getMonth()+1).padStart(2,'0');
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
  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const v = String(rows[i][1] || '').trim();
    if (v === 'ALUNOS' || v === 'PROF/COORD.') { headerRow = i; break; }
  }
  if (headerRow === -1) return null;

  const datas = [];
  for (let c = 2; c <= 14; c++) {
    const d = toDateStr(rows[headerRow][c]);
    if (d) datas.push(d);
  }

  const alunos = [];
  let totais = [];
  let freq_pct = null;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    const nome = String(row[1] || '').trim();
    if (!nome || ['TOTAL','AULAS','FREQUÊNCIA MÉDIA %','FREQUÊNCIA MÉDIA Nº'].includes(nome)) {
      if (nome === 'TOTAL') {
        totais = [];
        for (let c = 2; c < 2 + datas.length; c++) {
          const v = row[c];
          totais.push((v !== null && v !== undefined && !isNaN(Number(v))) ? Number(v) : 0);
        }
      }
      if (nome === 'FREQUÊNCIA MÉDIA %') {
        const v = row[2];
        if (v !== null && !isNaN(Number(v))) freq_pct = Math.round(Number(v) * 10000) / 100;
      }
      continue;
    }
    const pts_raw = row[15];
    if (pts_raw === null || pts_raw === undefined) continue;
    const pts = parseInt(pts_raw);
    if (isNaN(pts)) continue;
    const presencas = [];
    for (let c = 2; c < 2 + datas.length; c++) {
      presencas.push(Number(row[c]) === 1 ? 1 : 0);
    }
    alunos.push({ nome, pts, presencas });
  }

  return { datas, alunos, totais_por_aula: totais, freq_pct };
}

function parseRanking(rows) {
  if (!rows) return { ranking: [], relatorio: [] };

  const salaNames = ['ADOLESCENTES','JOVENS','IRMÃOS','IRMÃS'];

  // --- Bloco 1: ranking parcial (cabeçalho: SALAS | FREQUÊNCIA (%) ATUAL | POSIÇÃO) ---
  // Localiza a linha de cabeçalho deste bloco
  let rankHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const c0 = String(rows[i][0]||'').trim().toUpperCase();
    const c1 = String(rows[i][1]||'').trim().toUpperCase();
    const c2 = String(rows[i][2]||'').trim().toUpperCase();
    if (c0 === 'SALAS' && c1.includes('FREQUÊNCIA') && c2.includes('POSIÇÃO')) {
      rankHeaderIdx = i;
      break;
    }
  }

  const ranking = [];
  if (rankHeaderIdx !== -1) {
    for (let i = rankHeaderIdx + 1; i < rows.length; i++) {
      const sala = String(rows[i][0]||'').trim();
      if (!sala || sala === 'TOTAL') break; // para ao chegar no total ou linha vazia
      if (!salaNames.includes(sala)) continue;
      const freq = rows[i][1];
      const pos  = rows[i][2];
      if (freq !== null && freq !== undefined) {
        ranking.push({
          sala,
          freq: Math.round(Number(freq) * 10000) / 100, // de decimal para %
          pos: String(pos || '').trim()
        });
      }
    }
  }

  // --- Bloco 2: relatório detalhado (cabeçalho: SALAS | Nº DE ALUNOS REFERENCIA | AULA | FREQUÊNCIA MÉDIA | FREQUÊNCIA (%) ATUAL | ÚLTIMO DOMINGO) ---
  let relHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const c0 = String(rows[i][0]||'').trim().toUpperCase();
    const c1 = String(rows[i][1]||'').trim().toUpperCase();
    if (c0 === 'SALAS' && c1.includes('ALUNOS')) {
      relHeaderIdx = i;
      break;
    }
  }

  const relatorio = [];
  if (relHeaderIdx !== -1) {
    // identifica qual coluna é cada campo pelo cabeçalho
    const header = rows[relHeaderIdx].map(c => String(c||'').trim().toUpperCase());
    const colAlunos  = header.findIndex(h => h.includes('ALUNOS'));
    const colFreqPct = header.findIndex(h => h.includes('FREQUÊNCIA (%)') || h.includes('FREQUÊNCIA(%)'));
    const colUltimo  = header.findIndex(h => h.includes('ÚLTIMO') || h.includes('ULTIMO'));

    for (let i = relHeaderIdx + 1; i < rows.length; i++) {
      const sala = String(rows[i][0]||'').trim();
      if (!sala || sala === 'TOTAL') continue;
      if (sala.startsWith(' ') || !sala) continue; // pula títulos de seção
      const alunos_ref   = colAlunos  !== -1 ? (Number(rows[i][colAlunos])  || 0) : 0;
      const freq_pct_raw = colFreqPct !== -1 ? rows[i][colFreqPct] : null;
      const freq_pct     = freq_pct_raw !== null ? Math.round(Number(freq_pct_raw) * 10000) / 100 : null;
      const ultimo       = colUltimo  !== -1 ? (Number(rows[i][colUltimo]) || 0) : 0;
      if (alunos_ref > 0) {
        relatorio.push({ sala, alunos_ref, freq_pct, ultimo_domingo: ultimo });
      }
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

      console.log('Abas encontradas:', wb.SheetNames);

      const data = {};
      for (const key of ['ADOLESCENTES','JOVENS','IRMÃOS','IRMÃS','PROFESSORES']) {
        const rows = parseSheet(wb, key);
        console.log(`Aba ${key}:`, rows ? `${rows.length} linhas` : 'NÃO ENCONTRADA');
        const parsed = parseSala(rows);
        if (parsed) {
          data[key] = parsed;
          console.log(`  → ${parsed.alunos.length} alunos, ${parsed.datas.length} datas, freq_pct=${parsed.freq_pct}`);
        }
      }

      const rankRows = parseSheet(wb, 'RANKING');
      const { ranking, relatorio } = parseRanking(rankRows);
      console.log('Ranking:', ranking);
      console.log('Relatorio:', relatorio);

      data.ranking  = ranking;
      data.relatorio = relatorio;
      data.meta = { geradoEm: new Date().toISOString() };

      await put('ebd-data.json', JSON.stringify(data), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        token,
        allowOverwrite: true,
      });

      return res.status(200).json({
        ok: true,
        salas: Object.keys(data).filter(k => !['ranking','relatorio','meta'].includes(k)),
        ranking: data.ranking.length,
        relatorio: data.relatorio.length,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Erro ao processar planilha: ' + e.message });
    }
  });
}
