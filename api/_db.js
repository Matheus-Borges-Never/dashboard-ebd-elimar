import { list, put } from '@vercel/blob';

const KEY = 'ebd-db.json';

export async function readDB(token) {
  const { blobs } = await list({ prefix: KEY, token });
  if (!blobs || blobs.length === 0) {
    return { trimestres: [], salas: [], alunos: [], presencas: [] };
  }
  const blob = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  // Cache-busting param prevents Vercel CDN from serving stale data after overwrites
  const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: 'no-store' });
  return res.json();
}

export async function writeDB(token, data) {
  data.meta = { atualizadoEm: new Date().toISOString() };
  await put(KEY, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    token,
    allowOverwrite: true,
  });
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
