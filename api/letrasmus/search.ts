// Lista de artistas gospel e brasileiros conhecidos
const GOSPEL_ARTISTS = [
  'valesca-mayssa',
  'valesca',
  'cassiane',
  'aline-barros',
  'bruna-karla',
  'anderson-freire',
  'fernandinho',
  'damares',
  'gabriela-rocha',
  'priscilla-alcantara',
  'thalles-roberto',
  'israel-salazar',
  'kemuel',
  'santa-geracao',
  'preto-no-branco',
  'renascer-praise',
  'sorin',
  'david-quinlan',
  'eli-soares',
  'eyshila',
  'shirley-carvalhaes',
  'marisa-monte',
  'fonseca',
  'vencedores-por-cristo'
];

// Função para converter texto em slug
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

// Busca exata no Letras.mus.br usando o texto digitado pelo usuário
export default async function handler(req: any, res: any) {
  let { q } = req.query;
  
  // Se q vier como array, pega o primeiro elemento
  if (Array.isArray(q)) {
    q = q[0];
  }
  
  // Converte para string se necessário
  q = String(q).trim();
  
  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  try {
    const results: { title: string; artist: string; url?: string }[] = [];
    const musicSlug = toSlug(q);
    
    // Tenta com cada artista gospel conhecido
    for (const artist of GOSPEL_ARTISTS) {
      const url = `https://www.letras.mus.br/${artist}/${musicSlug}/`;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MaestraBot/1.0)'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          // Verifica se a página conta com a música (contém a letra)
          if (html.includes('class="cnt-letra')) {
            // Extrai título e artista da página
            const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
            const artistMatch = html.match(/<span[^>]*class="artist"[^>]*>([^<]+)<\/span>/) || 
                               html.match(/<a[^>]*href="\/([^/"]+)\/"[^>]*>([^<]+)<\/a>/);
            
            const title = titleMatch ? titleMatch[1].trim() : q;
            const artistName = artistMatch ? (artistMatch[2] || artistMatch[1]) : artist.replace(/-/g, ' ');
            
            results.push({
              title,
              artist: artistName,
              url
            });
          }
        }
      } catch (err) {
        // Continue tentando outros artistas
      }
    }

    // Se encontrou direto, retorna
    if (results.length > 0) {
      return res.status(200).json({ results });
    }

    // Fallback: tenta busca geral na página de pesquisa
    const searchUrl = `https://www.letras.mus.br/pesquisa.html?q=${encodeURIComponent(q)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MaestraBot/1.0)'
      }
    });
    const html = await response.text();

    // Extrai resultados da página
    const allResults: { title: string; artist: string }[] = [];
    const regex = /<a[^>]+class="song-name"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>\s*<span[^>]+class="artist"[^>]*>(.*?)<\/span>/g;
    let match;
    const qLower = q.toLowerCase();
    
    while ((match = regex.exec(html)) !== null) {
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const artist = match[3].replace(/<[^>]+>/g, '').trim();
      allResults.push({ title, artist });
    }

    // Filtra por título que contenha o termo
    let filtered = allResults.filter(r =>
      r.title.toLowerCase().includes(qLower)
    );

    // Se não achar, tenta artista
    if (filtered.length === 0) {
      filtered = allResults.filter(r =>
        r.artist.toLowerCase().includes(qLower)
      );
    }

    filtered = filtered.slice(0, 10);
    return res.status(200).json({ results: filtered });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar no Letras.mus.br', details: err.message });
  }
}
