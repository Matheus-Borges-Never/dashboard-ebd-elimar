import { readDB, writeDB, uid } from './_db.js';

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

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN não configurado.' });

  let body;
  try { body = await parseBody(req); } catch { return res.status(400).json({ error: 'JSON inválido.' }); }

  if (body.senha !== SENHA) return res.status(401).json({ error: 'Senha incorreta.' });

  const { action } = body;

  try {
    const db = await readDB(token);

    // ── LOAD ──
    if (action === 'load') {
      return res.status(200).json(db);
    }

    // ── TRIMESTRES ──
    if (action === 'saveTrimestre') {
      const { id, nome, inicio, fim } = body;
      if (!nome || !inicio || !fim) return res.status(400).json({ error: 'Campos obrigatórios: nome, inicio, fim.' });
      if (id) {
        const idx = db.trimestres.findIndex(t => t.id === id);
        if (idx < 0) return res.status(404).json({ error: 'Trimestre não encontrado.' });
        db.trimestres[idx] = { ...db.trimestres[idx], nome, inicio, fim };
      } else {
        const isFirst = db.trimestres.length === 0;
        db.trimestres.push({ id: uid(), nome, inicio, fim, ativo: isFirst });
      }
      await writeDB(token, db);
      return res.status(200).json({ ok: true, db });
    }

    if (action === 'setTrimestreAtivo') {
      const { id } = body;
      db.trimestres.forEach(t => { t.ativo = t.id === id; });
      await writeDB(token, db);
      return res.status(200).json({ ok: true, db });
    }

    if (action === 'deleteTrimestre') {
      const { id } = body;
      const salaIds = db.salas.filter(s => s.trimestre_id === id).map(s => s.id);
      const alunoIds = db.alunos.filter(a => salaIds.includes(a.sala_id)).map(a => a.id);
      db.trimestres = db.trimestres.filter(t => t.id !== id);
      db.salas = db.salas.filter(s => !salaIds.includes(s.id));
      db.alunos = db.alunos.filter(a => !alunoIds.includes(a.id));
      db.presencas = (db.presencas || []).filter(p => !alunoIds.includes(p.aluno_id));
      // If deleted trimestre was active, activate the last remaining one
      if (!db.trimestres.some(t => t.ativo) && db.trimestres.length > 0) {
        db.trimestres[db.trimestres.length - 1].ativo = true;
      }
      await writeDB(token, db);
      return res.status(200).json({ ok: true, db });
    }

    // ── SALAS ──
    if (action === 'saveSala') {
      const { id, nome, trimestre_id } = body;
      if (!nome || !trimestre_id) return res.status(400).json({ error: 'Campos obrigatórios: nome, trimestre_id.' });
      if (id) {
        const idx = db.salas.findIndex(s => s.id === id);
        if (idx < 0) return res.status(404).json({ error: 'Sala não encontrada.' });
        db.salas[idx] = { ...db.salas[idx], nome, trimestre_id };
      } else {
        db.salas.push({ id: uid(), nome, trimestre_id });
      }
      await writeDB(token, db);
      return res.status(200).json({ ok: true, db });
    }

    if (action === 'deleteSala') {
      const { id } = body;
      const alunoIds = db.alunos.filter(a => a.sala_id === id).map(a => a.id);
      db.salas = db.salas.filter(s => s.id !== id);
      db.alunos = db.alunos.filter(a => a.sala_id !== id);
      db.presencas = (db.presencas || []).filter(p => !alunoIds.includes(p.aluno_id));
      await writeDB(token, db);
      return res.status(200).json({ ok: true, db });
    }

    // ── ALUNOS ──
    if (action === 'saveAluno') {
      const { id, nome, sala_id } = body;
      if (!nome || !sala_id) return res.status(400).json({ error: 'Campos obrigatórios: nome, sala_id.' });
      if (id) {
        const idx = db.alunos.findIndex(a => a.id === id);
        if (idx < 0) return res.status(404).json({ error: 'Aluno não encontrado.' });
        db.alunos[idx] = { ...db.alunos[idx], nome, sala_id };
      } else {
        db.alunos.push({ id: uid(), nome, sala_id });
      }
      await writeDB(token, db);
      return res.status(200).json({ ok: true, db });
    }

    if (action === 'deleteAluno') {
      const { id } = body;
      db.alunos = db.alunos.filter(a => a.id !== id);
      db.presencas = (db.presencas || []).filter(p => p.aluno_id !== id);
      await writeDB(token, db);
      return res.status(200).json({ ok: true, db });
    }

    // ── PRESENÇAS ──
    if (action === 'savePresencaLote') {
      const { presencas } = body; // [{ aluno_id, data, presente }]
      if (!Array.isArray(presencas)) return res.status(400).json({ error: 'presencas deve ser um array.' });
      db.presencas = db.presencas || [];
      for (const p of presencas) {
        const idx = db.presencas.findIndex(x => x.aluno_id === p.aluno_id && x.data === p.data);
        if (idx >= 0) db.presencas[idx].presente = !!p.presente;
        else db.presencas.push({ aluno_id: p.aluno_id, data: p.data, presente: !!p.presente });
      }
      await writeDB(token, db);
      return res.status(200).json({ ok: true, db });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
