import { list } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const { blobs } = await list({ prefix: 'ebd-data.json' });
    if (!blobs || blobs.length === 0) {
      return res.status(404).json({ error: 'Nenhuma planilha carregada ainda.' });
    }

    const blob = blobs[0];
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
