// Simple theme-to-hymn suggestion utility
import { Song } from '../types';

type Suggestion = { title: string; artist: string; source?: string; id?: string };

const THEME_KEYWORDS: Record<string, string[]> = {
  'santa ceia': ['ceia', 'santa ceia', 'comunhão', 'eucaristia'],
  'familia': ['família', 'familia', 'lar', 'casa', 'pais', 'filhos'],
  'hino de familias': ['família', 'familia', 'hino de familia', 'oração da família'],
  'louvor': ['louvor', 'adoração', 'glória', 'bendito'],
  'adoração': ['adoração', 'adoracao', 'santo', 'santificado'],
  'infantil': ['infantil', 'criança', 'crianças', 'kids', 'infância']
};

export function suggestHymnsByTheme(theme: string, songs: Song[], limit = 10): Suggestion[] {
  const key = theme.toLowerCase().trim();
  const keywords = THEME_KEYWORDS[key] || [key];

  // Score songs by occurrences of keywords in title, artist, category, sections or content
  const scored = songs.map(s => {
    const hay = `${s.title || ''} ${s.artist || ''} ${s.category || ''} ${(s.sections || []).join(' ')} ${s.content || ''}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const rx = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const m = hay.match(rx);
      if (m) score += m.length * 2; // boost
    }
    return { song: s, score };
  }).filter(x => x.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => ({ title: s.song.title || 'Sem título', artist: s.song.artist || 'Artista Desconhecido', id: s.song.id, source: 'Biblioteca' }));
}

export const KNOWN_THEMES = Object.keys(THEME_KEYWORDS);
