import React, { useState, useRef } from 'react';
import { Mic2, Play, Square, Info, Music, ChevronRight } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface WarmupExercise {
  id: string;
  title: string;
  description: string;
  benefit: string;
  instructions: string[];
  playPattern: (ctx: AudioContext, time: number) => number; // Returns duration
}

const playNote = (ctx: AudioContext, freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', isStaccato = false) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  
  const attack = 0.05;
  const release = isStaccato ? 0.05 : 0.2;
  const actualDuration = isStaccato ? duration * 0.5 : duration;
  
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3, startTime + attack);
  gain.gain.setValueAtTime(0.3, startTime + actualDuration - release);
  gain.gain.linearRampToValueAtTime(0, startTime + actualDuration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(startTime);
  osc.stop(startTime + actualDuration);
};

// Frequencies for C4 to C5
const notes = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.00,
  A4: 440.00,
  B4: 493.88,
  C5: 523.25
};

const WARMUP_EXERCISES: WarmupExercise[] = [
  {
    id: '1',
    title: 'Vibração de Lábios (Brrr)',
    description: 'Excelente para relaxar a musculatura e conectar a respiração.',
    benefit: 'Relaxamento e Conexão Respiratória',
    instructions: [
      'Mantenha os lábios relaxados.',
      'Sopre o ar fazendo-os vibrar suavemente.',
      'Faça escalas ascendentes e descendentes.',
      'Não force a garganta.'
    ],
    playPattern: (ctx, t) => {
      const seq = [notes.C4, notes.D4, notes.E4, notes.F4, notes.G4, notes.F4, notes.E4, notes.D4, notes.C4];
      seq.forEach((freq, i) => playNote(ctx, freq, t + i * 0.4, 0.4, 'triangle'));
      return seq.length * 0.4;
    }
  },
  {
    id: '2',
    title: 'Som Nasal (Hummm)',
    description: 'Foca na ressonância e no brilho da voz sem esforço.',
    benefit: 'Ressonância e Projeção',
    instructions: [
      'Boca fechada, dentes levemente afastados.',
      'Sinta a vibração no nariz e nos lábios.',
      'Mantenha o som leve e constante.',
      'Imagine o som saindo pela testa.'
    ],
    playPattern: (ctx, t) => {
      const seq = [notes.C4, notes.E4, notes.G4, notes.C5, notes.G4, notes.E4, notes.C4];
      seq.forEach((freq, i) => playNote(ctx, freq, t + i * 0.6, 0.6, 'sine'));
      return seq.length * 0.6;
    }
  },
  {
    id: '3',
    title: 'Escala com Vogais A-E-I-O-U',
    description: 'Trabalha a articulação e a uniformidade do timbre.',
    benefit: 'Articulação e Timbre',
    instructions: [
      'Cante uma nota sustentada trocando as vogais.',
      'Mantenha a mesma posição de boca para todas.',
      'Foque na clareza de cada vogal.',
      'Articule bem sem tensionar a mandíbula.'
    ],
    playPattern: (ctx, t) => {
      // 5 notes, one for each vowel
      const seq = [notes.C4, notes.D4, notes.E4, notes.F4, notes.G4];
      seq.forEach((freq, i) => playNote(ctx, freq, t + i * 0.8, 0.8, 'triangle'));
      return seq.length * 0.8;
    }
  },
  {
    id: '4',
    title: 'Staccato (Ha-Ha-Ha)',
    description: 'Ativa o diafragma e a agilidade vocal.',
    benefit: 'Apoio Diafragmático',
    instructions: [
      'Emita sons curtos e precisos.',
      'Sinta o movimento na região abdominal.',
      'Mantenha a garganta aberta e relaxada.',
      'Aumente a velocidade gradualmente.'
    ],
    playPattern: (ctx, t) => {
      const seq = [notes.C4, notes.E4, notes.G4, notes.C5, notes.C5, notes.G4, notes.E4, notes.C4];
      seq.forEach((freq, i) => playNote(ctx, freq, t + i * 0.3, 0.3, 'square', true));
      return seq.length * 0.3;
    }
  }
];

interface WarmupViewProps {
  setView: (view: any) => void;
}

export const WarmupView: React.FC<WarmupViewProps> = ({ setView }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopAudio = () => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPlayingId(null);
  };

  const playExercise = (exercise: WarmupExercise) => {
    if (playingId === exercise.id) {
      stopAudio();
      return;
    }

    stopAudio();
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    setPlayingId(exercise.id);

    const duration = exercise.playPattern(ctx, ctx.currentTime);
    
    timerRef.current = window.setTimeout(() => {
      setPlayingId(null);
    }, duration * 1000);
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return stopAudio;
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-white font-maestra">Aquecimento Vocal</h2>
          <p className="text-[#909296]">Prepare sua voz e a do seu coral para o ensaio.</p>
        </div>
        <Button variant="ghost" onClick={() => setView('home')}>
          Voltar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {WARMUP_EXERCISES.map((ex) => (
          <Card key={ex.id} className="p-6 space-y-4 border-[#2C2E33] bg-[#1A1B1E]/50">
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Mic2 size={24} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded">
                {ex.benefit}
              </span>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white font-maestra">{ex.title}</h3>
              <p className="text-sm text-[#909296] leading-relaxed">{ex.description}</p>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#5C5F66] flex items-center gap-2">
                <Info size={14} /> Instruções
              </h4>
              <ul className="space-y-2">
                {ex.instructions.map((inst, i) => (
                  <li key={i} className="text-xs text-[#C1C2C5] flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    {inst}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 flex gap-2">
              <Button 
                className="flex-1 text-xs" 
                variant={playingId === ex.id ? "primary" : "secondary"}
                onClick={() => playExercise(ex)}
              >
                {playingId === ex.id ? (
                  <><Square size={14} className="mr-2" /> Parar Exemplo</>
                ) : (
                  <><Play size={14} className="mr-2" /> Ouvir Exemplo</>
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-8 border-primary/20 bg-primary/5 text-center space-y-4">
        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary mx-auto">
          <Music size={24} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white font-maestra">Dica da Maestra</h3>
          <p className="text-sm text-[#909296] max-w-md mx-auto">
            O aquecimento não deve cansar a voz, mas sim despertá-la. Comece sempre com sons suaves e na região média da sua tessitura.
          </p>
        </div>
      </Card>
    </div>
  );
};
