import React, { useState } from 'react';
import { ArrowLeft, Plus, Search, BookOpen, ChevronRight, Trash2, Tag, Info, Link as LinkIcon } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface LibraryViewProps {
  setView: (view: 'home' | 'editor' | 'library') => void;
  setCurrentSong: (song: any) => void;
  librarySearch: string;
  setLibrarySearch: (search: string) => void;
  filteredSongs: any[];
  handleDeleteSong: (id: string) => void;
}

const CATEGORIES = ['Todos', 'Hinos', 'Corinhos', 'Natal', 'Páscoa', 'Adoração', 'Outros'];

export const LibraryView: React.FC<LibraryViewProps> = ({
  setView,
  setCurrentSong,
  librarySearch,
  setLibrarySearch,
  filteredSongs,
  handleDeleteSong,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const finalFilteredSongs = filteredSongs.filter(song => 
    selectedCategory === 'Todos' || song.category === selectedCategory
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => setView('home')} className="flex items-center gap-2 text-[#909296] hover:text-white transition-colors">
          <ArrowLeft size={20} />
          <span>Voltar</span>
        </button>
        <Button variant="primary" icon={Plus} onClick={() => { setView('editor'); setCurrentSong({ id: crypto.randomUUID(), title: '', artist: '', content: '', category: 'Hinos', conductorNotes: '' }); }}>Nova Música</Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 bg-bg-card border border-white/5 rounded-xl px-4 py-2 focus-within:border-primary transition-colors shadow-sm">
          <Search size={20} className="text-[#5C5F66]" />
          <input 
            type="text" 
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Pesquisar na biblioteca..."
            className="bg-transparent border-none focus:outline-none text-white w-full"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                selectedCategory === cat 
                ? 'bg-primary text-white' 
                : 'bg-[#2C2E33] text-[#909296] hover:bg-[#383A40]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {finalFilteredSongs.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-[#2C2E33] flex items-center justify-center mx-auto text-[#5C5F66]">
              <BookOpen size={40} />
            </div>
            <p className="text-[#909296]">Nenhuma música encontrada nesta categoria.</p>
          </div>
        ) : (
          finalFilteredSongs.map(song => (
            <Card key={song.id} className="group relative cursor-pointer hover:bg-white/5 transition-colors p-5">
              <div className="space-y-3" onClick={() => { setCurrentSong(song); setView('editor'); }}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-lg leading-tight group-hover:text-primary transition-colors">{song.title}</h3>
                    <p className="text-sm text-[#909296]">{song.artist}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                    <Tag size={10} />
                    {song.category || 'Hinos'}
                  </span>
                  {(song.vocalParts || []).map((part: string) => (
                    <span key={part} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2C2E33] text-[#909296] text-[10px] font-bold uppercase tracking-wider">
                      {part}
                    </span>
                  ))}
                </div>

                {song.links && song.links.length > 0 && (
                  <div className="flex gap-2">
                    {song.links.map((link: any, i: number) => (
                      <a 
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded bg-bg-card border border-white/5 text-primary hover:bg-primary/10 transition-colors"
                        title={link.label}
                      >
                        <LinkIcon size={12} />
                      </a>
                    ))}
                  </div>
                )}

                {song.conductorNotes && (
                  <div className="flex items-start gap-2 p-2 rounded bg-bg-card border border-white/5">
                    <Info size={12} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-[11px] text-[#C1C2C5] line-clamp-2 italic">
                      {song.conductorNotes}
                    </p>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-[#5C5F66] font-bold">
                  <span>{new Date(song.updatedAt).toLocaleDateString()}</span>
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteSong(song.id); }}
                className="absolute top-2 right-2 p-2 text-[#5C5F66] hover:text-[#C92A2A] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={16} />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
