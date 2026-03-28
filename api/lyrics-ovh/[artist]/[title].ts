import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { artist, title } = req.query;
  const artistParam = req.query.artist || req.query['artist'] || (req as any).query['artist'] || (req as any).query[0];
  const titleParam = req.query.title || req.query['title'] || (req as any).query['title'] || (req as any).query[1];
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistParam as string)}/${encodeURIComponent(titleParam as string)}`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Lyrics not found' });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch from Lyrics.ovh' });
  }
}
