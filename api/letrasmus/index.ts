// Placeholder para /api/letrasmus caso precise de rota raiz
export default function handler(req: any, res: any) {
  res.status(404).json({ error: 'Use /api/letrasmus/search ou /api/letrasmus/[artist]/[title]' });
}
