// Função para limpar letras para WhatsApp e copiar
export function cleanLyricsForWhatsapp(lyricsHtml: string): string {
  if (!lyricsHtml) return '';
  return lyricsHtml
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>(\n)?/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '') // Remove qualquer tag HTML restante
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}
