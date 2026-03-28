import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q } = req.query;
  try {
    const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(q as string || '')}`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Suggestions not found' });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suggestions from Lyrics.ovh' });
  }
}
