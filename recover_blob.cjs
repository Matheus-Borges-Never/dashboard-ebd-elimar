// Recupera ebd-db.json do Vercel Blob e salva localmente
// Uso: BLOB_TOKEN=verxxxxx node recover_blob.cjs
const https = require('https');
const fs = require('fs');

const token = process.env.BLOB_TOKEN;
if (!token) {
  console.error('Defina a variável BLOB_TOKEN com o valor do BLOB_READ_WRITE_TOKEN do Vercel.');
  process.exit(1);
}

async function fetchJson(url, options = {}) {
  const { default: fetch } = await import('node-fetch').catch(() => {
    // node 18+ tem fetch nativo
    return { default: globalThis.fetch };
  });
  const res = await fetch(url, options);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`Resposta não-JSON: ${text.slice(0, 300)}`); }
}

async function main() {
  console.log('Listando blobs...');
  const listUrl = `https://blob.vercel-storage.com?prefix=ebd-db.json&limit=10`;
  const list = await fetchJson(listUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!list.blobs || list.blobs.length === 0) {
    console.error('Nenhum blob encontrado com prefixo ebd-db.json');
    process.exit(1);
  }

  const blob = list.blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  console.log(`Encontrado: ${blob.url} (${blob.uploadedAt})`);

  const data = await fetchJson(`${blob.url}?t=${Date.now()}`);
  const out = 'ebd-db-backup.json';
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');

  console.log(`\nDados salvos em ${out}`);
  console.log(`  Trimestres: ${data.trimestres?.length ?? 0}`);
  console.log(`  Salas:      ${data.salas?.length ?? 0}`);
  console.log(`  Alunos:     ${data.alunos?.length ?? 0}`);
  console.log(`  Presenças:  ${data.presencas?.length ?? 0}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
