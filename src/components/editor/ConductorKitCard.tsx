import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Play, Pause, Music, Mic2, ArrowLeft } from 'lucide-react';

export const ConductorKitCard = ({ setView }: { setView: (v: any) => void }) => {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState(4);
  const [beat, setBeat] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);

  // Metronome Logic
  useEffect(() => {
    if (isPlaying) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
      currentBeatRef.current = 0;
      setBeat(0);
      scheduler();
    } else {
      if (timerIDRef.current !== null) {
        window.clearTimeout(timerIDRef.current);
        timerIDRef.current = null;
      }
    }
    return () => {
      if (timerIDRef.current !== null) {
        window.clearTimeout(timerIDRef.current);
      }
    };
  }, [isPlaying, bpm, timeSignature]);

  const scheduleNote = (beatNumber: number, time: number) => {
    if (!audioContextRef.current) return;
    
    // Update UI beat (approximate)
    setTimeout(() => {
      setBeat(beatNumber);
    }, (time - audioContextRef.current.currentTime) * 1000);

    const osc = audioContextRef.current.createOscillator();
    const envelope = audioContextRef.current.createGain();

    osc.connect(envelope);
    envelope.connect(audioContextRef.current.destination);

    if (beatNumber === 0) {
      osc.frequency.value = 880.0; // Higher pitch for first beat
    } else {
      osc.frequency.value = 440.0; // Lower pitch for other beats
    }

    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    osc.start(time);
    osc.stop(time + 0.03);
  };

  const scheduler = () => {
    if (!audioContextRef.current) return;
    
    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + 0.1) {
      scheduleNote(currentBeatRef.current, nextNoteTimeRef.current);
      
      // Advance to next note
      const secondsPerBeat = 60.0 / bpm;
      nextNoteTimeRef.current += secondsPerBeat;
      currentBeatRef.current = (currentBeatRef.current + 1) % timeSignature;
    }
    timerIDRef.current = window.setTimeout(scheduler, 25.0);
  };

  // Pitch Pipe Logic
  const playPitch = (frequency: number) => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = frequency;
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 2);
    osc.stop(ctx.currentTime + 2);
  };

  const notes = [
    { name: 'C', freq: 261.63 },
    { name: 'C#', freq: 277.18 },
    { name: 'D', freq: 293.66 },
    { name: 'D#', freq: 311.13 },
    { name: 'E', freq: 329.63 },
    { name: 'F', freq: 349.23 },
    { name: 'F#', freq: 369.99 },
    { name: 'G', freq: 392.00 },
    { name: 'G#', freq: 415.30 },
    { name: 'A', freq: 440.00 },
    { name: 'A#', freq: 466.16 },
    { name: 'B', freq: 493.88 },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView('home')} className="p-2 text-[#909296] hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white font-maestra">Kit do Regente</h2>
          <p className="text-sm text-[#909296]">Metrônomo e Diapasão para ensaios</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metronome */}
        <Card className="p-6 bg-[#1A1B1E] border-[#2C2E33] flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-4">
            <Mic2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-white mb-6">Metrônomo</h3>
          
          <div className="text-6xl font-bold text-white mb-2 font-maestra">
            {bpm}
          </div>
          <p className="text-sm text-[#909296] mb-8 uppercase tracking-widest">BPM</p>

          <input 
            type="range" 
            min="40" 
            max="240" 
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="w-full accent-primary mb-8"
          />

          <div className="flex gap-4 mb-8">
            {[2, 3, 4, 6].map(ts => (
              <button
                key={ts}
                onClick={() => setTimeSignature(ts)}
                className={`w-10 h-10 rounded-lg font-bold transition-colors ${timeSignature === ts ? 'bg-[#2C2E33] text-white' : 'text-[#5C5F66] hover:text-white hover:bg-[#2C2E33]/50'}`}
              >
                {ts}/4
              </button>
            ))}
          </div>

          <div className="flex gap-2 justify-center mb-8">
            {Array.from({ length: timeSignature }).map((_, i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full transition-colors ${isPlaying && beat === i ? 'bg-primary shadow-[0_0_10px_rgba(51,154,240,0.5)]' : 'bg-[#2C2E33]'}`}
              />
            ))}
          </div>

          <Button 
            variant={isPlaying ? 'secondary' : 'primary'} 
            className="w-full py-6 text-lg"
            onClick={() => setIsPlaying(!isPlaying)}
            icon={isPlaying ? Pause : Play}
          >
            {isPlaying ? 'Parar' : 'Iniciar'}
          </Button>
        </Card>

        {/* Pitch Pipe */}
        <Card className="p-6 bg-[#1A1B1E] border-[#2C2E33] flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent mb-4">
            <Music size={24} />
          </div>
          <h3 className="text-lg font-bold text-white mb-6">Diapasão</h3>
          
          <div className="grid grid-cols-3 gap-3 w-full">
            {notes.map(note => (
              <button
                key={note.name}
                onClick={() => playPitch(note.freq)}
                className="py-4 bg-[#2C2E33] hover:bg-accent hover:text-white text-[#C1C2C5] rounded-xl font-bold text-lg transition-all active:scale-95"
              >
                {note.name}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
