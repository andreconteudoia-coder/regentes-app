import React from 'react';
import { cleanLyricsForWhatsapp } from '../../lib/cleanText';
import { ArrowLeft, Presentation, Save, Copy, Download, Share2 } from 'lucide-react';
import { Button } from '../ui/button';
import { SearchCard } from './SearchCard';
import { SongDetailsCard } from './SongDetailsCard';
import { FormattingCard } from './FormattingCard';
import { AudioToolsCard } from './AudioToolsCard';

interface EditorViewProps {
  mode: 'search' | 'tools';
  setView: (view: 'home' | 'editor' | 'library') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  handleQuickSearch: (query: string) => void;
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  searchResults: any[];
  handleSelectResult: (result: any) => void;
  currentSong: any;
  setCurrentSong: (song: any) => void;
  editorRef: React.RefObject<any>;
  pdfConfig: any;
  setPdfConfig: (config: any) => void;
  handleSaveSong: () => void;
  generatePDF: () => void;
  setIsPresenting: (isPresenting: boolean) => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  mode,
  setView,
  searchQuery,
  setSearchQuery,
  isSearching,
  handleQuickSearch,
  showResults,
  setShowResults,
  searchResults,
  handleSelectResult,
  currentSong,
  setCurrentSong,
  editorRef,
  pdfConfig,
  setPdfConfig,
  handleSaveSong,
  generatePDF,
  setIsPresenting,
}) => {

  const handleShareWhatsApp = () => {
    if (!currentSong.title) {
      alert('A música precisa ter um título para ser compartilhada.');
      return;
    }

    let text = `*${currentSong.title}*\n`;
    if (currentSong.artist) {
      text += `_${currentSong.artist}_\n`;
    }
    
    // Add YouTube links if available
    const youtubeLinks = (currentSong.links || []).filter((l: any) => l.url.includes('youtube.com') || l.url.includes('youtu.be'));
    if (youtubeLinks.length > 0) {
      text += `\n🎧 *Áudio de Referência:*\n`;
      youtubeLinks.forEach((l: any) => {
        text += `${l.label ? l.label + ': ' : ''}${l.url}\n`;
      });
    }


    // Add lyrics (strip HTML tags and clean)
    if (currentSong.content) {
      const plainText = cleanLyricsForWhatsapp(currentSong.content);
      text += `\n📝 *Letra:*\n${plainText}`;
    }

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => setView('home')} className="flex items-center gap-2 text-[#909296] hover:text-white transition-colors">
          <ArrowLeft size={20} />
          <span>Voltar</span>
        </button>
        {mode === 'search' && (
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 sm:px-4" icon={Presentation} onClick={() => setIsPresenting(true)}>
              <span className="hidden sm:inline">Apresentar</span>
            </Button>
            <Button variant="primary" className="px-3 sm:px-4" icon={Save} onClick={handleSaveSong}>
              <span className="hidden sm:inline">Salvar</span>
            </Button>
          </div>
        )}
      </div>

      {mode === 'search' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SearchCard 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isSearching={isSearching}
              handleQuickSearch={handleQuickSearch}
              showResults={showResults}
              setShowResults={setShowResults}
              searchResults={searchResults}
              handleSelectResult={handleSelectResult}
            />

            <SongDetailsCard 
              currentSong={currentSong}
              setCurrentSong={setCurrentSong}
              editorRef={editorRef}
            />
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <Button variant="secondary" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-none" icon={Share2} onClick={handleShareWhatsApp}>
                Enviar pro WhatsApp
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" icon={Copy} onClick={() => {
                  const plainText = currentSong.content ? cleanLyricsForWhatsapp(currentSong.content) : '';
                  navigator.clipboard.writeText(plainText);
                  alert('Copiado para a área de transferência!');
                }}>Copiar</Button>
                <Button variant="ghost" className="flex-1" icon={Download} onClick={generatePDF}>PDF</Button>
              </div>
            </div>

            <FormattingCard 
              pdfConfig={pdfConfig}
              setPdfConfig={setPdfConfig}
            />
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <AudioToolsCard />
        </div>
      )}
    </div>
  );
};
