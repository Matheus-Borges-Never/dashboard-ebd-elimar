const SB_URL = () => process.env.SUPABASE_URL;
const SB_KEY = () => process.env.SUPABASE_SERVICE_KEY;

async function sb(path, method = 'GET', body = null, extraHeaders = {}) {
  const opts = {
    method,
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export async function readDB() {
  const [trimestres, salas, alunos, presencas] = await Promise.all([
    sb('trimestres?select=*'),
    sb('salas?select=*'),
    sb('alunos?select=*'),
    sb('presencas?select=*&limit=50000'),
  ]);
  return {
    trimestres: trimestres || [],
    salas: salas || [],
    alunos: alunos || [],
    presencas: presencas || [],
  };
}

export async function upsert(table, rows, onConflict = 'id') {
  if (!rows || !rows.length) return;
  return sb(`${table}?on_conflict=${onConflict}`, 'POST', rows, {
    Prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

export async function insert(table, rows) {
  if (!rows || !rows.length) return;
  return sb(table, 'POST', rows, { Prefer: 'return=representation' });
}

export async function patch(table, filter, data) {
  return sb(`${table}?${filter}`, 'PATCH', data);
}

export async function del(table, filter) {
  return sb(`${table}?${filter}`, 'DELETE');
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
