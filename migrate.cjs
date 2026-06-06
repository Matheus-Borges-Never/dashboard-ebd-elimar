/**
 * Migração: popula o DB com dados da planilha MARATONA ELIMAR
 * Uso: node migrate.cjs [caminho-da-planilha]
 * Env: API_URL (ex: https://seu-projeto.vercel.app), SENHA (padrão: 0705)
 */
const XLSX = require('xlsx');
const https = require('https');
const http = require('http');

const API_URL = (process.env.API_URL || 'https://dashboard-ebd-elimar.vercel.app').replace(/\/$/, '');
const SENHA = process.env.SENHA || '0705';
const FILE = process.argv[2] || 'C:\\Users\\mathe\\Downloads\\MARATONA ELIMAR 2\xBA TRI-26.xlsx';

let _seq = 1;
function uid() { return 'id' + (_seq++); }

function xlDateToISO(serial) {
  if (typeof serial !== 'number' || serial < 40000) return null;
  // Excel epoch offset: days since 1970-01-01 = serial - 25569
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

function parseSalaSheet(rows) {
  let headerRow = -1, nomeCol = -1;
  for (let i = 0; i < rows.length; i++) {
    for (let c = 0; c < (rows[i]?.length || 0); c++) {
      const v = String(rows[i][c] || '').trim();
      if (v === 'ALUNOS' || v === 'PROF/COORD.') { headerRow = i; nomeCol = c; break; }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) return null;

  // Date columns (Excel serial numbers)
  const dataCols = [];
  for (let c = nomeCol + 1; c < (rows[headerRow]?.length || 0); c++) {
    const v = rows[headerRow][c];
    const iso = xlDateToISO(v);
    if (iso) dataCols.push({ col: c, iso });
  }

  const SKIP = new Set(['TOTAL', 'AULAS']);
  const SKIP_PREFIX = ['FREQUÊNCIA', 'FREQUENCIA'];

  const alunos = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const nome = String(row[nomeCol] || '').trim();
    if (!nome) continue;
    const up = nome.toUpperCase();
    if (SKIP.has(up) || SKIP_PREFIX.some(p => up.startsWith(p))) continue;

    const presencas = [];
    for (const { col, iso } of dataCols) {
      const val = row[col];
      // Only store records for dates with actual data (0 or 1), skip null (future dates)
      if (val !== null && val !== undefined) {
        presencas.push({ data: iso, presente: Number(val) === 1 });
      }
    }
    if (presencas.length > 0) {
      alunos.push({ nome, presencas });
    }
  }

  return { dataCols: dataCols.map(d => d.iso), alunos };
}

async function postJSON(url, body) {
  const str = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(str) },
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(str);
    req.end();
  });
}

async function main() {
  console.log('Lendo:', FILE);
  const wb = XLSX.readFile(FILE, { cellDates: false });

  const SKIP_SHEETS = new Set(['RANKING']);
  const parsedSalas = [];
  const allDates = new Set();

  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEETS.has(sheetName.trim().toUpperCase())) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
    const parsed = parseSalaSheet(rows);
    if (!parsed) { console.log(`  [SKIP] ${sheetName}`); continue; }
    const nome = sheetName.trim().toUpperCase();
    parsed.dataCols.forEach(d => allDates.add(d));
    parsedSalas.push({ nome, ...parsed });
    console.log(`  [OK]   ${nome}: ${parsed.alunos.length} alunos, ${parsed.dataCols.length} datas`);
  }

  const sortedDates = [...allDates].sort();
  const inicio = sortedDates[0];
  // Trimestre = 13 domingos
  const fimDate = new Date(inicio + 'T12:00:00Z');
  fimDate.setUTCDate(fimDate.getUTCDate() + 84); // 12 * 7
  const fim = fimDate.toISOString().split('T')[0];

  const triId = uid();
  const db = {
    trimestres: [{ id: triId, nome: '2\xBA Trimestre 2026', inicio, fim, ativo: true }],
    salas: [], alunos: [], presencas: [],
  };

  for (const { nome, alunos } of parsedSalas) {
    const salaId = uid();
    db.salas.push({ id: salaId, nome, trimestre_id: triId });
    for (const { nome: nomeAluno, presencas } of alunos) {
      const alunoId = uid();
      db.alunos.push({ id: alunoId, nome: nomeAluno, sala_id: salaId });
      presencas.forEach(p => db.presencas.push({ aluno_id: alunoId, data: p.data, presente: p.presente }));
    }
  }

  console.log(`\nTrimestre: ${db.trimestres[0].nome} (${inicio} → ${fim})`);
  console.log(`Salas: ${db.salas.length} | Alunos: ${db.alunos.length} | Presenças: ${db.presencas.length}`);
  console.log(`\nEnviando para ${API_URL}/api/admin ...`);

  const res = await postJSON(`${API_URL}/api/admin`, { senha: SENHA, action: 'bulkImport', db });
  if (res.status === 200) {
    console.log('\n✓ Importado com sucesso! Dashboard atualizado.');
  } else {
    console.error('\n✗ Erro:', res.status, JSON.stringify(res.data));
  }
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
