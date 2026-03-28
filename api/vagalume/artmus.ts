import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q, limit } = req.query;
  const query = (q as string || '').trim();
  const endpoints = [
    `https://api.vagalume.com.br/search.artmus?q=${encodeURIComponent(query)}&limit=${limit || 5}`,
    `https://www.vagalume.com.br/api/search.artmus?q=${encodeURIComponent(query)}&limit=${limit || 5}`
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && !data.error) {
          return res.status(200).json(data);
        }
      } else {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          if (data && !data.error) {
            return res.status(200).json(data);
          }
        } catch {}
      }
    } catch {}
  }
  res.status(404).json({ error: 'Nenhum artista ou música encontrado no Vagalume', type: 'notfound' });
}
