// Endpoint para buscar letra completa no Letras.mus.br
export default async function handler(req: any, res: any) {
  const { artist, title } = req.query;
  if (!artist || !title) {
    return res.status(400).json({ error: 'Missing artist or title' });
  }

  try {
    // Monta URL do Letras.mus.br
    const url = `https://www.letras.mus.br/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MaestraBot/1.0)'
      }
    });
    const html = await response.text();

    // Extrai letra da página
    const match = html.match(/<div class="cnt-letra p402_premium">([\s\S]*?)<\/div>/);
    if (!match) {
      return res.status(404).json({ error: 'Letra não encontrada' });
    }
    let lyricsHtml = match[1];
    // Remove tags HTML, preservando quebras de linha
    let lyrics = lyricsHtml.replace(/<br\s*\/?>(?!\n)/gi, '\n').replace(/<[^>]+>/g, '').trim();

    return res.status(200).json({ lyrics });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar letra no Letras.mus.br', details: err.message });
  }
}
