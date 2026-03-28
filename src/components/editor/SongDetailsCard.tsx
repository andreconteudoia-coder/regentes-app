import React, { useRef } from 'react';
import { Card } from '../ui/card';
import ReactQuill from 'react-quill-new';
import { Link as LinkIcon, Plus, Trash2, Mic2, Upload, Music } from 'lucide-react';
import { Button } from '../ui/button';
import { set, del } from 'idb-keyval';

interface SongDetailsCardProps {
  currentSong: {
    id: string;
    title: string;
    artist: string;
    content: string;
    category?: string;
    conductorNotes?: string;
    links?: { label: string; url: string }[];
    vocalParts?: string[];
    offlineAudioName?: string;
  };
  setCurrentSong: (song: any) => void;
  editorRef: React.RefObject<any>;
}

const VOCAL_PARTS = ['Soprano', 'Contralto', 'Tenor', 'Baixo', 'Solista'];

const Quill = ReactQuill as any;

export const SongDetailsCard: React.FC<SongDetailsCardProps> = ({
  currentSong,
  setCurrentSong,
  editorRef,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddLink = () => {
    const links = currentSong.links || [];
    setCurrentSong({
      ...currentSong,
      links: [...links, { label: '', url: '' }]
    });
  };

  const handleUpdateLink = (index: number, field: 'label' | 'url', value: string) => {
    const links = [...(currentSong.links || [])];
    links[index] = { ...links[index], [field]: value };
    setCurrentSong({ ...currentSong, links });
  };

  const handleRemoveLink = (index: number) => {
    const links = (currentSong.links || []).filter((_, i) => i !== index);
    setCurrentSong({ ...currentSong, links });
  };

  const toggleVocalPart = (part: string) => {
    const parts = currentSong.vocalParts || [];
    if (parts.includes(part)) {
      setCurrentSong({ ...currentSong, vocalParts: parts.filter(p => p !== part) });
    } else {
      setCurrentSong({ ...currentSong, vocalParts: [...parts, part] });
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Ensure we have an ID to save against
      const songId = currentSong.id || crypto.randomUUID();
      
      // Save the file to IndexedDB using the song ID as the key
      await set(`audio_${songId}`, file);
      setCurrentSong({ ...currentSong, id: songId, offlineAudioName: file.name });
      alert('Áudio offline salvo com sucesso neste dispositivo!');
    } catch (error) {
      console.error('Error saving audio:', error);
      alert('Erro ao salvar o áudio offline.');
    }
  };

  const handleRemoveAudio = async () => {
    try {
      await del(`audio_${currentSong.id}`);
      setCurrentSong({ ...currentSong, offlineAudioName: null });
    } catch (error) {
      console.error('Error removing audio:', error);
    }
  };

  return (
    <Card className="space-y-6 border-primary/20 bg-primary/5 p-4 sm:p-6 shadow-feminine">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold">Título</label>
          <input 
            type="text" 
            value={currentSong.title}
            onChange={e => setCurrentSong({...currentSong, title: e.target.value})}
            placeholder="Ex: Quão Grande é o Meu Deus"
            className="w-full bg-bg-card border border-white/5 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold">Artista / Ministério</label>
          <input 
            type="text" 
            value={currentSong.artist}
            onChange={e => setCurrentSong({...currentSong, artist: e.target.value})}
            placeholder="Ex: Soraya Moraes"
            className="w-full bg-bg-card border border-white/5 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold">Categoria / Hinário</label>
          <select 
            value={currentSong.category || 'Hinos'}
            onChange={e => setCurrentSong({...currentSong, category: e.target.value})}
            className="w-full bg-bg-card border border-white/5 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
          >
            <option value="Hinos">Hinos</option>
            <option value="Corinhos">Corinhos</option>
            <option value="Natal">Natal</option>
            <option value="Páscoa">Páscoa</option>
            <option value="Adoração">Adoração</option>
            <option value="Outros">Outros</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold">Notas do Regente</label>
          <input 
            type="text" 
            value={currentSong.conductorNotes || ''}
            onChange={e => setCurrentSong({...currentSong, conductorNotes: e.target.value})}
            placeholder="Ex: Atenção ao compasso 12..."
            className="w-full bg-bg-card border border-white/5 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold flex items-center gap-2">
          <Mic2 size={14} /> Vozes Ativas
        </label>
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
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold flex items-center gap-2">
            <LinkIcon size={14} /> Links de Ensaio (YouTube/Drive)
          </label>
          <Button variant="ghost" size="sm" icon={Plus} onClick={handleAddLink}>Adicionar</Button>
        </div>
        <div className="space-y-2">
          {(currentSong.links || []).map((link, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input 
                type="text" 
                value={link.label}
                onChange={e => handleUpdateLink(index, 'label', e.target.value)}
                placeholder="Título (Ex: Soprano)"
                className="flex-1 bg-bg-card border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              />
              <input 
                type="text" 
                value={link.url}
                onChange={e => handleUpdateLink(index, 'url', e.target.value)}
                placeholder="URL (YouTube/Drive)"
                className="flex-[2] bg-bg-card border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              />
              <button 
                onClick={() => handleRemoveLink(index)}
                className="p-1.5 text-[#5C5F66] hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold flex items-center gap-2">
          <Music size={14} /> Áudio Offline (Neste Dispositivo)
        </label>
        <div className="flex items-center gap-4 bg-bg-card border border-white/5 rounded-lg p-3">
          <input 
            type="file" 
            accept="audio/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleAudioUpload}
          />
          {currentSong.offlineAudioName ? (
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Music size={16} />
                <span className="truncate max-w-[200px] sm:max-w-xs">{currentSong.offlineAudioName}</span>
              </div>
              <button 
                onClick={handleRemoveAudio}
                className="p-1.5 text-[#5C5F66] hover:text-red-500 transition-colors"
                title="Remover áudio offline"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm text-[#909296]">Nenhum áudio salvo neste dispositivo.</span>
              <Button 
                variant="ghost" 
                size="sm" 
                icon={Upload} 
                onClick={() => fileInputRef.current?.click()}
              >
                Selecionar MP3
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-[#5C5F66]">O arquivo de áudio fica salvo apenas no navegador deste dispositivo para uso sem internet.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-[#5C5F66] font-semibold">Letra</label>
        
        {/* Visual display of Title and Artist */}
        {(currentSong.title || currentSong.artist) && (
          <div className="mb-4 p-4 bg-[#1A1B1E] rounded-lg border border-white/5">
            <h2 className="text-2xl font-bold text-primary">{currentSong.title || 'Sem Título'}</h2>
            <p className="text-lg text-[#909296]">{currentSong.artist || 'Artista Desconhecido'}</p>
          </div>
        )}

        <div className="bg-bg-card border border-white/5 rounded-lg overflow-hidden">
          <Quill 
            ref={editorRef}
            theme="snow"
            value={currentSong.content}
            onChange={(content: string) => setCurrentSong((prev: any) => ({...prev, content}))}
            placeholder="Cole aqui a letra da música..."
            modules={{
              toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'color': [] }, { 'background': [] }],
                ['clean']
              ],
            }}
          />
        </div>
      </div>
    </Card>
  );
};
