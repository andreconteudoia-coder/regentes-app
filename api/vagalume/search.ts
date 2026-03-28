import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q } = req.query;
  const query = (q as string || '').trim();
  let artistParam = '';
  let songParam = '';
  const separators = [' - ', ' – ', ' — ', ' by ', ' de '];
  for (const sep of separators) {
    if (query.includes(sep)) {
      const parts = query.split(sep).map(s => s.trim());
      if (sep === ' by ' || sep === ' de ') {
        [songParam, artistParam] = parts;
      } else {
        [artistParam, songParam] = parts;
      }
      break;
    }
  }
  const endpoints = [];
  if (artistParam && songParam) {
    endpoints.push(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artistParam)}&mus=${encodeURIComponent(songParam)}&apikey=6670601bde9753e4945b783bdf36c9d1`);
    endpoints.push(`https://www.vagalume.com.br/api/search.php?art=${encodeURIComponent(artistParam)}&mus=${encodeURIComponent(songParam)}`);
  }
  endpoints.push(`https://api.vagalume.com.br/search.php?q=${encodeURIComponent(query)}&apikey=6670601bde9753e4945b783bdf36c9d1`);
  endpoints.push(`https://www.vagalume.com.br/api/search.php?q=${encodeURIComponent(query)}`);
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
  res.status(404).json({ error: 'Música não encontrada no Vagalume', type: 'notfound' });
}
