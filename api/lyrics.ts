// Consolidated lyrics API endpoint for all providers
import type { NextApiRequest, NextApiResponse } from "next";

const GOSPEL_ARTISTS = [
  'valesca-mayssa','valesca','cassiane','aline-barros','bruna-karla','anderson-freire','fernandinho','damares','gabriela-rocha','priscilla-alcantara','thalles-roberto','israel-salazar','kemuel','santa-geracao','preto-no-branco','renascer-praise','sorin','david-quinlan','eli-soares','eyshila','shirley-carvalhaes','marisa-monte','fonseca','vencedores-por-cristo'
];

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { provider, action, q, artist, title, mus, art, limit } = req.query;
  try {
    if (!provider) {
      return res.status(400).json({ error: 'Missing provider param' });
    }
    // Letrasmus
    if (provider === 'letrasmus') {
      if (action === 'search') {
        // letrasmus search
        let query = Array.isArray(q) ? q[0] : q;
        query = String(query || '').trim();
        if (!query) return res.status(400).json({ error: 'Missing query parameter q' });
        const results: { title: string; artist: string; url?: string }[] = [];
        const musicSlug = toSlug(query);
        for (const artist of GOSPEL_ARTISTS) {
          const url = `https://www.letras.mus.br/${artist}/${musicSlug}/`;
          try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaestraBot/1.0)' } });
            if (response.ok) {
              const html = await response.text();
              if (html.includes('class="cnt-letra')) {
                results.push({ title: musicSlug, artist, url });
              }
            }
          } catch {}
        }
        return res.status(200).json(results);
      } else if (artist && title) {
        // letrasmus get lyrics
        const url = `https://www.letras.mus.br/${encodeURIComponent(artist as string)}/${encodeURIComponent(title as string)}`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaestraBot/1.0)' } });
        const html = await response.text();
        const match = html.match(/<div class="cnt-letra p402_premium">([\s\S]*?)<\/div>/);
        if (!match) return res.status(404).json({ error: 'Letra não encontrada' });
        let lyricsHtml = match[1];
        let lyrics = lyricsHtml.replace(/<br\s*\/?>(?!\n)/gi, '\n').replace(/<[^>]+>/g, '').trim();
        return res.status(200).json({ lyrics });
      }
    }
    // LRCLIB
    if (provider === 'lrclib') {
      if (action === 'search') {
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q as string || '')}`;
        const response = await fetch(url, { headers: { 'User-Agent': 'MaestraCoral/1.0.0 (https://maestracoral.app)' } });
        if (!response.ok) return res.status(response.status).json({ error: 'Search failed on LRCLIB' });
        const data = await response.json();
        return res.status(200).json(data);
      } else if (artist && title) {
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist as string || '')}&track_name=${encodeURIComponent(title as string || '')}`;
        const response = await fetch(url, { headers: { 'User-Agent': 'MaestraCoral/1.0.0 (https://maestracoral.app)' } });
        if (!response.ok) return res.status(response.status).json({ error: 'Lyrics not found on LRCLIB' });
        const data = await response.json();
        return res.status(200).json(data);
      }
    }
    // Lyrics.ovh
    if (provider === 'lyrics-ovh') {
      if (action === 'suggest') {
        const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(q as string || '')}`;
        const response = await fetch(url);
        if (!response.ok) return res.status(response.status).json({ error: 'Suggestions not found' });
        const data = await response.json();
        return res.status(200).json(data);
      } else if (artist && title) {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist as string)}/${encodeURIComponent(title as string)}`;
        const response = await fetch(url);
        if (!response.ok) return res.status(response.status).json({ error: 'Lyrics not found' });
        const data = await response.json();
        return res.status(200).json(data);
      }
    }
    // Vagalume
    if (provider === 'vagalume') {
      if (action === 'search') {
        const query = (q as string || '').trim();
        let artistParam = '', songParam = '';
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
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
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
        return res.status(404).json({ error: 'Letra não encontrada no Vagalume', type: 'notfound' });
      } else if (action === 'artmus') {
        const query = (q as string || '').trim();
        const endpoints = [
          `https://api.vagalume.com.br/search.artmus?q=${encodeURIComponent(query)}&limit=${limit || 5}`,
          `https://www.vagalume.com.br/api/search.artmus?q=${encodeURIComponent(query)}&limit=${limit || 5}`
        ];
        for (const url of endpoints) {
          try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
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
        return res.status(404).json({ error: 'Nenhum artista ou música encontrado no Vagalume', type: 'notfound' });
      } else if (art && mus) {
        // lyrics by artist/song
        const artistStr = (art as string || '').trim();
        const songStr = (mus as string || '').trim();
        const endpoints = [
          `https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artistStr)}&mus=${encodeURIComponent(songStr)}&apikey=6670601bde9753e4945b783bdf36c9d1`,
          `https://www.vagalume.com.br/api/search.php?art=${encodeURIComponent(artistStr)}&mus=${encodeURIComponent(songStr)}`
        ];
        for (const url of endpoints) {
          try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
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
        return res.status(404).json({ error: 'Letra não encontrada no Vagalume', type: 'notfound' });
      }
    }
    return res.status(400).json({ error: 'Invalid provider/action or missing params' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal error', details: error.message });
  }
}
