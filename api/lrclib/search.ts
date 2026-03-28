import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q } = req.query;
  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q as string || '')}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MaestraCoral/1.0.0 (https://maestracoral.app)'
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Search failed on LRCLIB' });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search on LRCLIB' });
  }
}
