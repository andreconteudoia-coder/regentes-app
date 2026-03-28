const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_MAP: Record<string, number> = {};
NOTES.forEach((note, i) => { NOTE_MAP[note] = i; });
NOTES_FLAT.forEach((note, i) => { NOTE_MAP[note] = i; });

// Common chord regex
const CHORD_REGEX = /([A-G][#b]?(m|maj|min|dim|aug|sus|add|M)?\d?(\/[A-G][#b]?)?)/g;

export function transposeChord(chord: string, semitones: number): string {
  return chord.replace(/([A-G][#b]?)/g, (note) => {
    const index = NOTE_MAP[note];
    if (index === undefined) return note;
    let newIndex = (index + semitones) % 12;
    if (newIndex < 0) newIndex += 12;
    return NOTES[newIndex];
  });
}

export function getSemitones(fromKey: string, toKey: string): number {
  const fromIndex = NOTE_MAP[fromKey];
  const toIndex = NOTE_MAP[toKey];
  if (fromIndex === undefined || toIndex === undefined) return 0;
  return toIndex - fromIndex;
}

export function transposeText(text: string, fromKey: string, toKey: string): string {
  const semitones = getSemitones(fromKey, toKey);
  if (semitones === 0) return text;

  return text.split('\n').map(line => {
    // Check if the line is mostly chords
    const words = line.trim().split(/\s+/);
    const chordMatches = line.match(CHORD_REGEX);
    
    // Heuristic: if more than 50% of "words" are chords, or it's a very short line with chords
    if (chordMatches && (chordMatches.length / words.length > 0.5 || (words.length <= 3 && chordMatches.length > 0))) {
      return line.replace(CHORD_REGEX, (chord) => transposeChord(chord, semitones));
    }
    
    // Also handle inline chords like [G] or (G) if they exist
    return line.replace(/\[([A-G][#b]?[^\]]*)\]/g, (_, chord) => `[${transposeChord(chord, semitones)}]`);
  }).join('\n');
}

export const ALL_KEYS = NOTES;
