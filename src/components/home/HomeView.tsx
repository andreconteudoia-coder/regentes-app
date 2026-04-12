import React from 'react';
import { Search, Mic2, BookOpen, Music, ChevronRight, FileText } from 'lucide-react';
import { Card } from '../ui/card';

import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from '../../types';

interface HomeViewProps {
setView: (view: 'home' | 'editor' | 'library' | 'setlists' | 'conductor' | 'warmup' | 'notes' | 'commitments') => void;  
setEditorMode: (mode: 'search' | 'tools') => void;
setCurrentSong: (song: any) => void;
  songs: any[];
}

export const HomeView: React.FC<HomeViewProps & { user?: User; subscription?: any }> = ({
  setView,
  setEditorMode,
  setCurrentSong,
  songs,
  user,
  subscription,
}) => {


  // Estado para anotação rápida no card
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date|null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedNote, setSavedNote] = useState<string|null>(null);
  const [savedDate, setSavedDate] = useState<Date|null>(null);

  // Buscar anotação salva ao escolher data
  useEffect(() => {
    if (!user || !selectedDate) return;
    const fetchNote = async () => {
      setLoading(true);
      const dateStr = selectedDate.toISOString().slice(0, 10);
      const ref = doc(db, `users/${user.uid}/notes/${dateStr}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setNote(snap.data().text || '');
        setSavedNote(snap.data().text || '');
        setSavedDate(selectedDate);
      } else {
        setNote('');
        setSavedNote(null);
        setSavedDate(null);
      }
      setLoading(false);
    };
    fetchNote();
  }, [selectedDate, user]);

  // Salvar anotação
  const saveNote = async () => {
    if (!user || !selectedDate) return;
    setLoading(true);
    const dateStr = selectedDate.toISOString().slice(0, 10);
    const ref = doc(db, `users/${user.uid}/notes/${dateStr}`);
    await setDoc(ref, { text: note, date: dateStr });
    setSavedNote(note);
    setSavedDate(selectedDate);
    setShowCalendar(false);
    setLoading(false);
  };

  // Reset fluxo para novo compromisso
  const handleAddNew = () => {
    setShowCalendar(true);
    setSelectedDate(null);
    setNote('');
    setSavedNote(null);
    setSavedDate(null);
  };


  // Card de assinatura
  const planoLabel = subscription?.plan === 'yearly' ? 'Anual' : 'Mensal';
  const vencimento = subscription?.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : null;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold tracking-tight text-white font-maestra">
          Regentify
        </h1>
        <p className="text-[#909296] text-lg max-w-lg mx-auto">Organize, conduza e evolua sua regência</p>
      </div>

      {/* Card de Plano de Assinatura */}
      {subscription?.status === 'active' && (
        <div className="flex justify-center">
          <div className="bg-bg-card border border-primary/30 rounded-2xl px-6 py-4 mb-4 flex flex-col items-center shadow-feminine min-w-[260px]">
            <span className="text-xs uppercase tracking-widest text-primary font-bold mb-1">Assinatura ativa</span>
            <div className="text-lg font-bold text-white mb-1">Plano: {planoLabel}</div>
            {vencimento && <div className="text-sm text-[#909296]">Vencimento: <b>{vencimento}</b></div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Compromissos */}
        <Card
          onClick={() => setView('commitments')}
          className="flex flex-col items-center text-center gap-6 py-12 border-blue-400/20 bg-blue-400/5 cursor-pointer hover:bg-blue-400/10 transition-colors min-h-[350px] justify-center relative"
        >
          <div className="w-20 h-20 rounded-2xl bg-blue-400 flex items-center justify-center text-black shadow-lg shadow-blue-400/30 mb-2">
            <span style={{ fontSize: 36, fontWeight: 'bold' }}>📅</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-blue-200 font-maestra">Compromissos</h3>
            <p className="text-sm text-blue-100 mt-2">Gerencie seus compromissos e lembretes importantes.</p>
          </div>
        </Card>

        <Card 
          onClick={() => { 
            setEditorMode('search');
            setView('editor'); 
            setCurrentSong({ id: crypto.randomUUID(), title: '', artist: '', content: '', key: 'C' }); 
          }} 
          className="flex flex-col items-center text-center gap-6 py-12 border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-feminine flex items-center justify-center text-white shadow-lg shadow-primary/30">
            <Search size={36} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white font-maestra">Buscar Letra</h3>
            <p className="text-sm text-[#909296] mt-2">Busque letras online e organize automaticamente para o seu coral.</p>
          </div>
        </Card>

        {/* Card: Kit do Regente */}
        <Card 
          onClick={() => { 
            setView('conductor'); 
          }} 
          className="flex flex-col items-center text-center gap-6 py-12 border-accent/20 bg-accent/5 cursor-pointer hover:bg-accent/10 transition-colors"
        >
          <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/30">
            <Mic2 size={36} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white font-maestra">Kit do Regente</h3>
            <p className="text-sm text-[#909296] mt-2">Metrônomo e Diapasão para auxiliar nos seus ensaios.</p>
          </div>
        </Card>

        {/* Card: Repertórios */}
        <Card 
          onClick={() => setView('setlists')} 
          className="flex flex-col items-center text-center gap-6 py-12 border-emerald-500/20 bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10 transition-colors"
        >
          <div className="w-20 h-20 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
            <FileText size={36} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white font-maestra">Repertórios</h3>
            <p className="text-sm text-[#909296] mt-2">Monte listas de ensaio e gere PDFs com várias músicas.</p>
          </div>
        </Card>

        {/* Card: Minha Biblioteca */}
        <Card 
          onClick={() => setView('library')} 
          className="flex flex-col items-center text-center gap-6 py-12 cursor-pointer hover:bg-white/5 transition-colors"
        >
          <div className="w-20 h-20 rounded-2xl bg-[#2C2E33] flex items-center justify-center text-primary">
            <BookOpen size={36} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white font-maestra">Minha Biblioteca</h3>
            <p className="text-sm text-[#909296] mt-2">Acesse seu repertório salvo e prepare seus ensaios.</p>
          </div>
        </Card>

        {/* Card: Aquecimento Vocal */}
        <Card 
          onClick={() => setView('warmup')} 
          className="flex flex-col items-center text-center gap-6 py-12 border-orange-500/20 bg-orange-500/5 cursor-pointer hover:bg-orange-500/10 transition-colors"
        >
          <div className="w-20 h-20 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
            <Mic2 size={36} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white font-maestra">Aquecimento Vocal</h3>
            <p className="text-sm text-[#909296] mt-2">Exercícios e dicas para preparar a voz do seu coral.</p>
          </div>
        </Card>
      </div>

      {songs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white font-maestra">Músicas Recentes</h2>
            <button onClick={() => setView('library')} className="text-primary text-sm font-bold hover:underline">Ver tudo</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {songs.slice(0, 4).map(song => (
              <Card key={song.id} onClick={() => { setCurrentSong(song); setView('editor'); }} className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Music size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{song.title}</h4>
                    <p className="text-xs text-[#909296]">{song.artist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight size={18} className="text-[#5C5F66]" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
