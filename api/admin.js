import { readDB, upsert, patch, del, uid } from './_db.js';

const SENHA = process.env.ADMIN_SENHA || '0705';

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY não configuradas.' });
  }

  let body;
  try { body = await parseBody(req); } catch { return res.status(400).json({ error: 'JSON inválido.' }); }

  if (body.senha !== SENHA) return res.status(401).json({ error: 'Senha incorreta.' });

  const { action } = body;

  try {
    // ── LOAD ──
    if (action === 'load') {
      const db = await readDB();
      return res.status(200).json(db);
    }

    // ── TRIMESTRES ──
    if (action === 'saveTrimestre') {
      const { id, nome, inicio, fim } = body;
      if (!nome || !inicio || !fim) return res.status(400).json({ error: 'Campos obrigatórios: nome, inicio, fim.' });
      if (id) {
        await upsert('trimestres', [{ id, nome, inicio, fim }]);
      } else {
        const db = await readDB();
        const isFirst = db.trimestres.length === 0;
        await upsert('trimestres', [{ id: uid(), nome, inicio, fim, ativo: isFirst }]);
      }
      const db = await readDB();
      return res.status(200).json({ ok: true, db });
    }

    if (action === 'setTrimestreAtivo') {
      const { id } = body;
      await patch('trimestres', 'id=neq.' + id, { ativo: false });
      await patch('trimestres', 'id=eq.' + id, { ativo: true });
      const db = await readDB();
      return res.status(200).json({ ok: true, db });
    }

    if (action === 'deleteTrimestre') {
      const { id } = body;
      await del('trimestres', 'id=eq.' + id);
      // Cascade handles salas, alunos, presencas
      // Activate last trimestre if none active
      const db = await readDB();
      if (db.trimestres.length > 0 && !db.trimestres.some(t => t.ativo)) {
        const last = db.trimestres[db.trimestres.length - 1];
        await patch('trimestres', 'id=eq.' + last.id, { ativo: true });
        return res.status(200).json({ ok: true, db: await readDB() });
      }
      return res.status(200).json({ ok: true, db });
    }

    // ── SALAS ──
    if (action === 'saveSala') {
      const { id, nome, trimestre_id } = body;
      if (!nome || !trimestre_id) return res.status(400).json({ error: 'Campos obrigatórios: nome, trimestre_id.' });
      await upsert('salas', [{ id: id || uid(), nome, trimestre_id }]);
      const db = await readDB();
      return res.status(200).json({ ok: true, db });
    }

    if (action === 'deleteSala') {
      const { id } = body;
      await del('salas', 'id=eq.' + id);
      const db = await readDB();
      return res.status(200).json({ ok: true, db });
    }

    // ── ALUNOS ──
    if (action === 'saveAluno') {
      const { id, nome, sala_id } = body;
      if (!nome || !sala_id) return res.status(400).json({ error: 'Campos obrigatórios: nome, sala_id.' });
      await upsert('alunos', [{ id: id || uid(), nome, sala_id }]);
      const db = await readDB();
      return res.status(200).json({ ok: true, db });
    }

    if (action === 'deleteAluno') {
      const { id } = body;
      await del('alunos', 'id=eq.' + id);
      const db = await readDB();
      return res.status(200).json({ ok: true, db });
    }

    // ── PRESENÇAS ──
    if (action === 'savePresencaLote') {
      const { presencas } = body;
      if (!Array.isArray(presencas)) return res.status(400).json({ error: 'presencas deve ser um array.' });
      if (presencas.length > 0) {
        await upsert('presencas', presencas.map(p => ({
          aluno_id: p.aluno_id,
          data: p.data,
          presente: !!p.presente,
        })), 'aluno_id,data');
      }
      return res.status(200).json({ ok: true });
    }

    // ── BULK IMPORT ──
    if (action === 'bulkImport') {
      const { db: importDb } = body;
      if (!importDb || !Array.isArray(importDb.trimestres)) {
        return res.status(400).json({ error: 'db inválido.' });
      }
      // Delete all existing data (cascade from trimestres)
      await del('trimestres', 'id=not.is.null');
      // Insert in FK order
      if (importDb.trimestres.length) await upsert('trimestres', importDb.trimestres);
      if (importDb.salas?.length) await upsert('salas', importDb.salas);
      if (importDb.alunos?.length) await upsert('alunos', importDb.alunos);
      if (importDb.presencas?.length) await upsert('presencas', importDb.presencas, 'aluno_id,data');
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
