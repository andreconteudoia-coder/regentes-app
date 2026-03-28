import React from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface SearchCardProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  handleQuickSearch: (query: string) => void;
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  searchResults: any[];
  handleSelectResult: (result: any) => void;
}

export const SearchCard: React.FC<SearchCardProps> = ({
  searchQuery,
  setSearchQuery,
  isSearching,
  handleQuickSearch,
  showResults,
  setShowResults,
  searchResults,
  handleSelectResult,
}) => {
  return (
    <Card className="space-y-6 border-primary/20 bg-primary/5 p-4 sm:p-6 shadow-feminine">
      <h3 className="font-bold text-white flex items-center gap-2 font-maestra">
        <Search size={18} className="text-primary" />
        Buscar Letra
      </h3>
      
      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wider text-primary font-bold font-maestra">Buscar Letra Online</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-3 bg-bg-card border border-primary/30 rounded-xl px-4 py-1 shadow-lg focus-within:border-primary transition-colors relative">
              <Search size={18} className="text-primary shrink-0" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nome da Música ou Artista - Música"
                className="bg-transparent border-none focus:outline-none text-white w-full py-3 text-base pr-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleQuickSearch(searchQuery);
                  }
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-[#5C5F66] hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Button 
              variant="primary" 
              loading={isSearching}
              className="sm:w-auto w-full py-3 h-auto rounded-xl shadow-lg"
              onClick={() => handleQuickSearch(searchQuery)}
            >
              Buscar
            </Button>
          </div>

          {showResults && searchResults.length > 0 && (
            <div className="bg-bg-card border border-primary/30 rounded-xl overflow-hidden mt-2 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xl">
              <div className="p-3 border-b border-white/5 bg-primary/10 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Resultados Encontrados</span>
                  <span className="text-[10px] text-[#909296]">Clique na versão correta para carregar a letra:</span>
                </div>
                <button onClick={() => setShowResults(false)} className="text-[#5C5F66] hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left p-4 hover:bg-primary/5 transition-all border-b border-white/5 last:border-0 group flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <div className="font-bold text-white group-hover:text-primary transition-colors">{result.title}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#909296] font-medium">{result.artist}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-[#5C5F66] border border-white/5 uppercase tracking-tighter">{result.source}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[#5C5F66] group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-1">
            <span className="text-[10px] text-primary font-bold uppercase tracking-tighter opacity-70">Dica: Se não encontrar, tente digitar "Artista - Música"</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
