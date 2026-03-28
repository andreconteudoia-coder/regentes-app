import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowLeft, Plus, Trash2, FileText, Download, Music, GripVertical, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { plainTextToHtml } from '../../lib/lyrics';

interface SetlistViewProps {
  setView: (v: any) => void;
  setlists: any[];
  saveSetlists: (setlists: any[]) => void;
  songs: any[];
}

export const SetlistView = ({ setView, setlists, saveSetlists, songs }: SetlistViewProps) => {
  const [activeSetlist, setActiveSetlist] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    const newSetlist = {
      id: crypto.randomUUID(),
      title: newTitle,
      date: new Date().toISOString().split('T')[0],
      songIds: [],
      updatedAt: Date.now()
    };
    saveSetlists([newSetlist, ...setlists]);
    setNewTitle('');
    setIsCreating(false);
    setActiveSetlist(newSetlist);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este repertório?')) {
      saveSetlists(setlists.filter(s => s.id !== id));
      if (activeSetlist?.id === id) setActiveSetlist(null);
    }
  };

  const handleAddSong = (songId: string) => {
    if (!activeSetlist) return;
    if (activeSetlist.songIds.includes(songId)) return;
    
    const updated = {
      ...activeSetlist,
      songIds: [...activeSetlist.songIds, songId],
      updatedAt: Date.now()
    };
    
    saveSetlists(setlists.map(s => s.id === updated.id ? updated : s));
    setActiveSetlist(updated);
  };

  const handleRemoveSong = (songId: string) => {
    if (!activeSetlist) return;
    
    const updated = {
      ...activeSetlist,
      songIds: activeSetlist.songIds.filter((id: string) => id !== songId),
      updatedAt: Date.now()
    };
    
    saveSetlists(setlists.map(s => s.id === updated.id ? updated : s));
    setActiveSetlist(updated);
  };

  const generateSetlistPDF = () => {
    if (!activeSetlist || activeSetlist.songIds.length === 0) return;
    
    try {
      const doc = new jsPDF();
      const margin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Cover Page
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(51, 154, 240);
      doc.text('Repertório', pageWidth / 2, pageHeight / 3, { align: 'center' });
      
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(activeSetlist.title, pageWidth / 2, pageHeight / 3 + 15, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      const dateStr = new Date(activeSetlist.date).toLocaleDateString('pt-BR');
      doc.text(`Data: ${dateStr}`, pageWidth / 2, pageHeight / 3 + 30, { align: 'center' });
      
      // Index
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Índice', margin, margin + 10);
      
      let y = margin + 25;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      
      const setlistSongs = activeSetlist.songIds
        .map((id: string) => songs.find(s => s.id === id))
        .filter(Boolean);
        
      setlistSongs.forEach((song: any, index: number) => {
        doc.text(`${index + 1}. ${song.title} - ${song.artist}`, margin, y);
        y += 10;
      });
      
      // Songs
      setlistSongs.forEach((song: any) => {
        doc.addPage();
        
        // Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text(song.title || 'Sem Título', margin, margin + 10);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(song.artist || 'Artista Desconhecido', margin, margin + 18);
        
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, margin + 22, pageWidth - margin, margin + 22);
        
        // Content
        const content = song.content || '';
        const decodeHtml = (html: string) => {
          const txt = document.createElement('textarea');
          txt.innerHTML = html;
          return txt.value;
        };

        const stripHtmlButKeepFormatting = (html: string) => {
          let text = html.replace(/<\/p>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<div>/g, '\n');
          text = text.replace(/<strong[^>]*>/gi, '<b>').replace(/<\/strong>/gi, '</b>');
          text = text.replace(/<em[^>]*>/gi, '<i>').replace(/<\/em>/gi, '</i>');
          text = text.replace(/<(?!b\b|\/b\b|i\b|\/i\b)[^>]*>/gi, '');
          return decodeHtml(text);
        };

        const cleanContent = stripHtmlButKeepFormatting(content);
        const lines = cleanContent.split('\n');
        
        let fontSize = 11;
        doc.setFontSize(fontSize);
        let currentY = margin + 30;
        let currentX = margin;
        
        const renderFormattedText = (text: string, startX: number, startY: number, baseFont: string, baseColor: number[]) => {
          const parts = text.split(/(<\/?b>|<\/?i>)/i);
          let cx = startX;
          let isBold = baseFont === 'bold';
          let isItalic = baseFont === 'italic';
          
          parts.forEach(part => {
            if (!part) return;
            const lowerPart = part.toLowerCase();
            if (lowerPart === '<b>') isBold = true;
            else if (lowerPart === '</b>') isBold = false;
            else if (lowerPart === '<i>') isItalic = true;
            else if (lowerPart === '</i>') isItalic = false;
            else {
              let fontStyle = 'normal';
              if (isBold && isItalic) fontStyle = 'bolditalic';
              else if (isBold) fontStyle = 'bold';
              else if (isItalic) fontStyle = 'italic';
              
              doc.setFont('helvetica', fontStyle);
              doc.setTextColor(baseColor[0], baseColor[1], baseColor[2]);
              doc.text(part, cx, startY);
              cx += doc.getTextWidth(part);
            }
          });
          doc.setFont('helvetica', baseFont);
          doc.setTextColor(baseColor[0], baseColor[1], baseColor[2]);
        };
        
        lines.forEach((line: string) => {
          const cleanLine = line.trim();
          if (!cleanLine && line !== '') return;
          
          const plainTextLine = cleanLine.replace(/<[^>]*>?/gm, '').trim();
          const isHeader = (plainTextLine.startsWith('[') && plainTextLine.endsWith(']')) || 
                          /^(refrão|coro|verso|ponte|intro|final|chorus|verse|bridge|outro)/i.test(plainTextLine);
          
          if (isHeader) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fontSize + 2);
            doc.setTextColor(51, 154, 240);
            currentY += 4;
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fontSize);
            doc.setTextColor(0, 0, 0);
          }
          
          if (currentY > pageHeight - margin) {
            doc.addPage();
            currentY = margin + 15;
            currentX = margin;
          }
          
          const voiceMatch = plainTextLine.match(/^\[([SATB])\]/i);
          if (voiceMatch) {
            const part = voiceMatch[1].toUpperCase();
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(51, 154, 240);
            doc.text(`${part}: `, currentX, currentY);
            const partWidth = doc.getTextWidth(`${part}: `);
            
            const restFormatted = cleanLine.replace(/^.*?\[[SATB]\].*?\s*/i, '');
            renderFormattedText(restFormatted, currentX + partWidth, currentY, 'normal', [0, 0, 0]);
          } else {
            renderFormattedText(cleanLine, currentX, currentY, isHeader ? 'bold' : 'normal', isHeader ? [51, 154, 240] : [0, 0, 0]);
          }

          currentY += (isHeader ? fontSize + 2 : fontSize) * 0.6 + 1;
          if (isHeader) currentY += 2;
        });
      });
      
      doc.save(`Repertorio_${activeSetlist.title.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF do repertório:', error);
      alert('Erro ao gerar PDF.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView('home')} className="p-2 text-[#909296] hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white font-maestra">Repertórios</h2>
          <p className="text-sm text-[#909296]">Crie listas de ensaio e gere PDFs únicos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar: List of Setlists */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Meus Repertórios</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(true)} icon={Plus}>Novo</Button>
          </div>

          {isCreating && (
            <Card className="p-4 bg-[#1A1B1E] border-primary/50">
              <input
                type="text"
                placeholder="Nome do Repertório..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-[#2C2E33] border border-[#373A40] rounded-lg py-2 px-3 text-sm text-white mb-3 focus:outline-none focus:border-primary"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>Cancelar</Button>
                <Button variant="primary" size="sm" onClick={handleCreate}>Salvar</Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {setlists.map(setlist => (
              <Card 
                key={setlist.id} 
                onClick={() => setActiveSetlist(setlist)}
                className={`p-4 cursor-pointer transition-colors ${activeSetlist?.id === setlist.id ? 'bg-primary/10 border-primary/50' : 'bg-[#1A1B1E] border-[#2C2E33] hover:bg-[#2C2E33]/50'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white">{setlist.title}</h4>
                    <p className="text-xs text-[#5C5F66] mt-1">{new Date(setlist.date).toLocaleDateString('pt-BR')} • {setlist.songIds.length} músicas</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(setlist.id); }}
                    className="text-[#5C5F66] hover:text-red-400 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
            {setlists.length === 0 && !isCreating && (
              <div className="text-center py-8 text-[#5C5F66] border-2 border-dashed border-[#2C2E33] rounded-xl">
                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum repertório criado</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content: Active Setlist Details */}
        <div className="lg:col-span-2">
          {activeSetlist ? (
            <Card className="p-6 bg-[#1A1B1E] border-[#2C2E33] min-h-[500px]">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#2C2E33]">
                <div>
                  <h3 className="text-2xl font-bold text-white">{activeSetlist.title}</h3>
                  <p className="text-sm text-[#909296]">{new Date(activeSetlist.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <Button 
                  variant="primary" 
                  icon={Download} 
                  onClick={generateSetlistPDF}
                  disabled={activeSetlist.songIds.length === 0}
                >
                  Gerar PDF Único
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Songs in Setlist */}
                <div>
                  <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-primary" />
                    Músicas no Repertório
                  </h4>
                  <div className="space-y-2">
                    {activeSetlist.songIds.map((id: string, index: number) => {
                      const song = songs.find(s => s.id === id);
                      if (!song) return null;
                      return (
                        <div key={`${id}-${index}`} className="flex items-center justify-between bg-[#2C2E33] p-3 rounded-lg group">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-[#5C5F66] w-4">{index + 1}.</span>
                            <div>
                              <p className="text-sm font-bold text-white">{song.title}</p>
                              <p className="text-xs text-[#909296]">{song.artist}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveSong(id)}
                            className="text-[#5C5F66] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })}
                    {activeSetlist.songIds.length === 0 && (
                      <p className="text-sm text-[#5C5F66] italic">Adicione músicas da sua biblioteca ao lado.</p>
                    )}
                  </div>
                </div>

                {/* Library Selection */}
                <div>
                  <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Music size={18} className="text-accent" />
                    Sua Biblioteca
                  </h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {songs.map(song => {
                      const isAdded = activeSetlist.songIds.includes(song.id);
                      return (
                        <div 
                          key={song.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isAdded ? 'bg-primary/5 border-primary/20' : 'bg-[#1A1B1E] border-[#2C2E33] hover:border-[#5C5F66]'}`}
                        >
                          <div className="truncate pr-4">
                            <p className="text-sm font-bold text-white truncate">{song.title}</p>
                            <p className="text-xs text-[#909296] truncate">{song.artist}</p>
                          </div>
                          <Button 
                            variant={isAdded ? "ghost" : "secondary"} 
                            size="sm" 
                            onClick={() => isAdded ? handleRemoveSong(song.id) : handleAddSong(song.id)}
                            className={isAdded ? "text-primary hover:text-red-400" : ""}
                          >
                            {isAdded ? 'Remover' : 'Adicionar'}
                          </Button>
                        </div>
                      );
                    })}
                    {songs.length === 0 && (
                      <p className="text-sm text-[#5C5F66] italic">Sua biblioteca está vazia. Busque músicas primeiro.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center border-2 border-dashed border-[#2C2E33] rounded-xl p-8">
              <FileText size={48} className="text-[#2C2E33] mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Selecione um Repertório</h3>
              <p className="text-[#909296] max-w-sm">
                Crie ou selecione um repertório na lista ao lado para adicionar músicas e gerar um PDF unificado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
