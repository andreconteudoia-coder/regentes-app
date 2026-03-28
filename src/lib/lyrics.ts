export interface SongSection {
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'unknown';
  content: string[];
  label?: string;
}

const TYPE_LABELS: Record<SongSection['type'], string> = {
  chorus: 'REFRÃO',
  bridge: 'PONTE',
  intro: 'INTRO',
  outro: 'FINAL',
  verse: 'VERSO',
  unknown: 'VERSO'
};

export function plainTextToHtml(text: string): string {
  if (!text) return '';
  // If it already looks like HTML, return as is
  if (text.includes('<p>') || text.includes('<br>') || text.includes('<div>')) return text;
  
  return text
    .split(/\r?\n/)
    .map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>')
    .join('');
}

export function formatLyrics(text: string): SongSection[] {
  // If it looks like HTML (from ReactQuill), we need to handle it differently
  const isHtml = text.includes('<p>') || text.includes('<br>');
  
  let rawLines: string[] = [];
  
  if (isHtml) {
    // Simple way to get lines from Quill HTML:
    // Replace </p> with a newline and then strip all other tags
    const withNewlines = text.replace(/<\/p>/g, '\n').replace(/<br\s*\/?>/g, '\n');
    // Create a temporary div to decode HTML entities and strip tags
    // Since we are in a browser environment, we can use DOMParser or a simple regex
    // But we want to keep the formatting for the content, so we only strip for identification
    rawLines = withNewlines.split('\n');
  } else {
    rawLines = text.replace(/\r\n/g, '\n').split('\n');
  }

  const sections: SongSection[] = [];
  let currentSection: SongSection | null = null;

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>?/gm, '');
  };

  const identifyType = (line: string): { type: SongSection['type']; label?: string } | null => {
    const cleanLine = stripHtml(line);
    const trimmed = cleanLine.trim();
    const l = trimmed.toLowerCase();
    if (!l) return null;
    
    // If the line is too long, it's definitely lyrics/chords, not a header
    if (l.length > 40) return null;

    // Remove common decorators like [], (), :, -
    const clean = l.replace(/[\[\]\(\):\-]/g, '').trim();
    
    let type: SongSection['type'] | null = null;
    let label = trimmed.replace(/[\[\]]/g, '');

    // Chorus / Refrão
    if (/^(refrão|chorus|coro|refrão\d+|chorus\d+|coro\d+)$/i.test(clean)) type = 'chorus';
    // Bridge / Ponte
    if (/^(ponte|bridge|ponte\d+|bridge\d+)$/i.test(clean)) type = 'bridge';
    // Intro / Introdução
    if (/^(intro|introdução|introducao|prelude|prelúdio|preludio)$/i.test(clean)) type = 'intro';
    // Outro / Final
    if (/^(outro|final|coda|ending|conclusão|conclusao)$/i.test(clean)) type = 'outro';
    // Verse / Verso
    if (/^(verso|verse|strophe|estrofe|verso\s*\d+|verse\s*\d+|estrofe\s*\d+)$/i.test(clean)) type = 'verse';
    
    // Numbered verse (e.g., "1.", "2)", "1 -")
    if (/^\d+[\.\)\-]?$/.test(clean)) type = 'verse';
    
    // Check if the original line was wrapped in brackets, which is a strong signal
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const bracketContent = trimmed.slice(1, -1).toLowerCase();
      // Ignore single-letter voice part tags (S, A, T, B, etc.)
      if (bracketContent.length === 1 && 'satbmhc'.includes(bracketContent)) return null;
      
      if (bracketContent.includes('refrão') || bracketContent.includes('chorus') || bracketContent.includes('coro')) type = 'chorus';
      else if (bracketContent.includes('ponte') || bracketContent.includes('bridge')) type = 'bridge';
      else if (bracketContent.includes('intro')) type = 'intro';
      else if (bracketContent.includes('final') || bracketContent.includes('outro')) type = 'outro';
      else if (bracketContent.includes('verso') || bracketContent.includes('verse')) type = 'verse';
      else if (!type) type = 'unknown'; // Keep it as a section if it has brackets
    }

    if (type) return { type, label };
    return null;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const cleanLine = stripHtml(line);
    const trimmed = cleanLine.trim();

    if (!trimmed) {
      currentSection = null;
      continue;
    }

    const identified = identifyType(line);
    if (identified) {
      currentSection = { type: identified.type, content: [], label: identified.label };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      currentSection = { type: 'verse', content: [] };
      sections.push(currentSection);
    }

    // We keep the original line (with HTML) for the content
    currentSection.content.push(line.trimEnd());
  }

  // Post-process to detect repeated sections and mark them as chorus
  const sectionContents = sections.map(s => s.content.join('\n').trim().toLowerCase());
  const contentCounts: Record<string, number> = {};
  
  // Normalização para comparação (remove pontuação básica e espaços extras)
  const normalize = (text: string) => text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();
  const normalizedContents = sectionContents.map(normalize);

  normalizedContents.forEach(content => {
    if (content.length > 15) { // Aumentado para 15 para evitar falsos positivos curtos
      contentCounts[content] = (contentCounts[content] || 0) + 1;
    }
  });

  sections.forEach((s, idx) => {
    const content = normalizedContents[idx];
    // Se este conteúdo se repete e é atualmente um 'verse' ou 'unknown', promove a 'chorus'
    if (contentCounts[content] > 1 && (s.type === 'verse' || s.type === 'unknown')) {
      s.type = 'chorus';
    }
  });

  // Post-process to add numbers to verses/choruses if there are multiple
  const counts: Record<string, number> = {};
  sections.forEach(s => {
    counts[s.type] = (counts[s.type] || 0) + 1;
  });

  const currentCounts: Record<string, number> = {};
  sections.forEach(s => {
    currentCounts[s.type] = (currentCounts[s.type] || 0) + 1;
    if (counts[s.type] > 1 && (s.type === 'verse' || s.type === 'chorus')) {
      if (!s.label || !/\d/.test(s.label)) {
        s.label = `${TYPE_LABELS[s.type]} ${currentCounts[s.type]}`;
      }
    } else if (!s.label) {
      s.label = TYPE_LABELS[s.type];
    }
  });

  return sections.filter(s => s.content.length > 0);
}

export function serializeSections(sections: SongSection[]): string {
  return sections.map(s => {
    const header = `[${(s.label || TYPE_LABELS[s.type]).toUpperCase()}]\n`;
    
    const cleanedContent = s.content.filter((line, index, array) => {
      if (line.trim()) return true;
      return index > 0 && index < array.length - 1 && array[index - 1].trim() !== '';
    });

    return header + cleanedContent.join('\n');
  }).join('\n\n');
}
