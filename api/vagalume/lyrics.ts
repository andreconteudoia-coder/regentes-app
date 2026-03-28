import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { art, mus } = req.query;
  const artist = (art as string || '').trim();
  const song = (mus as string || '').trim();
  const endpoints = [
    `https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(song)}&apikey=6670601bde9753e4945b783bdf36c9d1`,
    `https://www.vagalume.com.br/api/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(song)}`
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
        if (data && data.type !== 'notfound') {
          return res.status(200).json(data);
        }
      } else {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          if (data && data.type !== 'notfound') {
            return res.status(200).json(data);
          }
        } catch {}
      }
    } catch {}
  }
  res.status(404).json({ error: 'Letra não encontrada no Vagalume', type: 'notfound' });
}
