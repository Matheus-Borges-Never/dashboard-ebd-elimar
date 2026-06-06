import { list } from '@vercel/blob';

export default async function handler(req, res) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN não configurado.' });
  }

  try {
    const { blobs } = await list({ prefix: 'ebd-data.json', token });

    if (!blobs || blobs.length === 0) {
      return res.status(404).json({ error: 'Nenhuma planilha carregada ainda.' });
    }

    // pega o mais recente
    const blob = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    const response = await fetch(blob.url);
    const data = await response.json();

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao buscar dados: ' + e.message });
  }
}
