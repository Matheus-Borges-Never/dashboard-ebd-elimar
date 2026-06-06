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
  const names = wb.SheetNames.map(s => s.trim().toUpperCase());
  const idx = names.findIndex(n => n.includes(sheetSearch.toUpperCase()));
  if (idx === -1) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[idx]], { header: 1, defval: null });
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
  const ranking = [];
  for (const row of rows) {
    const sala = String(row[0] || '').trim();
    if (salaNames.includes(sala) && row[1] !== null && row[1] !== undefined) {
      ranking.push({ sala, freq: Math.round(Number(row[1]) * 10000) / 100, pos: String(row[2] || '').trim() });
    }
  }

  const relatorio = [];
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]||'').trim() === 'SALAS' && String(rows[i][1]||'').includes('ALUNOS')) {
      headerIdx = i; break;
    }
  }
  if (headerIdx !== -1) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const sala = String(row[0]||'').trim();
      if (!sala || sala === 'NaN' || sala === 'nan') continue;
      const alunos_ref = Number(row[1]) || 0;
      const freq_pct   = row[4] !== null ? Math.round(Number(row[4]) * 10000) / 100 : 0;
      const ultimo     = Number(row[5]) || 0;
      if (alunos_ref > 0) relatorio.push({ sala, alunos_ref, freq_pct, ultimo_domingo: ultimo });
    }
  }
  return { ranking, relatorio };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN não configurado nas variáveis de ambiente da Vercel.' });
  }

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

      const salaKeys = ['ADOLESCENTES','JOVENS','IRMÃOS','IRMÃS','PROFESSORES'];
      for (const key of salaKeys) {
        const rows = parseSheet(wb, key);
        const parsed = parseSala(rows);
        if (parsed) data[key] = parsed;
      }

      const rankRows = parseSheet(wb, 'RANKING');
      const { ranking, relatorio } = parseRanking(rankRows);
      data.ranking = ranking;
      data.relatorio = relatorio;
      data.meta = { geradoEm: new Date().toISOString() };

      const json = JSON.stringify(data);

      // Passa o token explicitamente para evitar problema de env var não carregada
      await put('ebd-data.json', json, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        token,
      });

      return res.status(200).json({ ok: true, message: 'Planilha processada com sucesso!' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Erro ao processar planilha: ' + e.message });
    }
  });
}
