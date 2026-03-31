import React, { useRef, useState } from 'react';
import { Card } from '../ui/card';
import { Mic2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

interface VoiceToolsCardProps {
  currentSong: any;
  setCurrentSong: (song: any) => void;
  editorRef: React.RefObject<any>;
}

const VOCAL_PARTS = ['Soprano', 'Contralto', 'Tenor', 'Baixo', 'Solista'];

export const VoiceToolsCard: React.FC<VoiceToolsCardProps> = ({ currentSong, setCurrentSong, editorRef }) => {
  const [selectedVoice, setSelectedVoice] = useState<string | 'Todos'>('Todos');
  const [highlightInEditor, setHighlightInEditor] = useState(false);
  const highlightSnapshotRef = useRef<string | null>(null);

  const voiceColors: Record<string, string> = {
    'Soprano': '#FFD7D7',
    'Contralto': '#D7F0FF',
    'Tenor': '#E8F5D7',
    'Baixo': '#F3E1FF',
    'Solista': '#FFF3CC'
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  const parseHtmlLines = (html: string) => {
    const tmp2 = document.createElement('div');
    tmp2.innerHTML = html || '';
    tmp2.querySelectorAll('br').forEach(b => {
      const marker = document.createElement('span');
      marker.textContent = '\n';
      b.parentNode?.replaceChild(marker, b);
    });
    const textWithBreaks = tmp2.innerHTML.replace(/<\s*\/p\s*>/gi, '\n').replace(/<\s*p[^>]*>/gi, '');
    const linesHtml = textWithBreaks.split(/\n/).map(s => s.trim()).filter(Boolean);
    return linesHtml.map(l => {
      const div = document.createElement('div');
      div.innerHTML = l;
      const voices = ((): string[] => {
        const text = (div.textContent || div.innerText || '').trim();
        const detected: string[] = [];
        const mapShort = (ch: string) => ({S: 'Soprano', A: 'Contralto', T: 'Tenor', B: 'Baixo'} as any)[ch];
        const patterns: Array<{re: RegExp, map?: (m: RegExpMatchArray) => string[]}> = [
          { re: /^\s*\[\s*([SATB]{1,4})\s*\]/i, map: (m) => m[1].split('').map(ch => mapShort(ch)) },
          { re: /^\s*\[\s*(soprano|contralto|tenor|baixo|solista)\s*\]/i, map: (m) => [m[1]] },
          { re: /^\s*([SATB]):/i, map: (m) => mapShort(m[1]) ? [mapShort(m[1])] : [] },
          { re: /^\s*\((S|A|T|B)\)/i, map: (m) => mapShort(m[1]) ? [mapShort(m[1])] : [] },
          { re: /^\s*(soprano|contralto|tenor|baixo|solista)\s*:/i, map: (m) => [m[1]] }
        ];
        for (const p of patterns) {
          const m = text.match(p.re);
          if (m) {
            if (p.map) {
              const mapped = p.map(m as RegExpMatchArray) as any;
              if (Array.isArray(mapped)) mapped.forEach((v: string) => v && detected.push(capitalize(String(v))));
              else if (mapped) detected.push(capitalize(String(mapped)));
            }
            break;
          }
        }
        return Array.from(new Set(detected));
      })();
      return { html: l, text: div.textContent || div.innerText || '', voices };
    });
  };

  const toggleVocalPart = (part: string) => {
    const parts = currentSong.vocalParts || [];
    if (parts.includes(part)) {
      setCurrentSong({ ...currentSong, vocalParts: parts.filter((p: string) => p !== part) });
    } else {
      setCurrentSong({ ...currentSong, vocalParts: [...parts, part] });
    }
  };

  return (
    <Card className="space-y-4 border-primary/20 bg-primary/5 p-4 sm:p-6 shadow-feminine">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold flex items-center gap-2">
          <Mic2 size={14} /> Vozes Ativas
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {VOCAL_PARTS.map(part => (
          <button
            key={part}
            onClick={() => toggleVocalPart(part)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              (currentSong.vocalParts || []).includes(part)
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'bg-[#2C2E33] text-[#909296] hover:bg-[#383A40]'
            }`}
          >
            {part}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <label className="text-xs text-[#909296]">Mostrar:</label>
        <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value as any)} className="bg-bg-card border border-white/5 rounded px-2 py-1 text-sm">
          <option value="Todos">Todos</option>
          {VOCAL_PARTS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <p className="text-xs text-[#6B6E73] ml-4">(Preview mostra apenas linhas detectadas para a voz selecionada)</p>

        <div className="ml-4">
          <label className="text-xs text-[#909296] mr-2">Destacar no editor</label>
          <input type="checkbox" checked={highlightInEditor} onChange={async (e) => {
            const next = e.target.checked;
            if (next) {
              highlightSnapshotRef.current = currentSong.content || '';
              try {
                const parsed = parseHtmlLines(currentSong.content || '');
                const pieces = parsed.map((p) => {
                  if (p.voices && p.voices.length) {
                    const color = voiceColors[p.voices[0]] || '#FFFFE0';
                    return `<span style=\"background-color:${color};display:block;padding:2px 4px;border-radius:4px;\">${p.html}</span>`;
                  }
                  return `<div>${p.html}</div>`;
                });
                const newHtml = pieces.join('<br/>');
                setCurrentSong({ ...currentSong, content: newHtml });
                setHighlightInEditor(true);
              } catch (err) {
                console.error('Erro ao aplicar destaque:', err);
              }
            } else {
              if (highlightSnapshotRef.current) {
                setCurrentSong({ ...currentSong, content: highlightSnapshotRef.current });
              }
              highlightSnapshotRef.current = null;
              setHighlightInEditor(false);
            }
          }} />
        </div>
      </div>

      <div className="mt-3 p-3 bg-[#0F1112] border border-white/5 rounded-lg text-sm text-white">
        <div className="mb-2 text-xs text-[#909296]">Pré-visualização {selectedVoice !== 'Todos' ? <>(— apenas linhas detectadas como <span className="font-bold">{selectedVoice}</span>)</> : ''}</div>
        <div className="prose max-w-none text-sm" style={{whiteSpace: 'pre-wrap'}}>
          {(() => {
            try {
              const parsed = parseHtmlLines(currentSong.content || '');
              const lines = selectedVoice === 'Todos' ? parsed : parsed.filter((p: any) => p.voices.includes(selectedVoice));
              if (!lines.length) return <div className="text-[#909296]">Nenhuma linha detectada para esta voz.</div>;
              return lines.map((f: any, i: number) => {
                const voice = (f.voices && f.voices[0]) || null;
                const bg = voice ? voiceColors[voice] : 'transparent';
                return (
                  <div key={i} className="py-0.5" style={{backgroundColor: bg, padding: voice ? '2px 6px' : undefined, borderRadius: voice ? 6 : undefined}} dangerouslySetInnerHTML={{__html: f.html}} />
                );
              });
            } catch (e) {
              return <div className="text-[#909296]">Erro ao gerar pré-visualização.</div>;
            }
          })()}
        </div>
      </div>
    </Card>
  );
};
