import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Upload, Music, Download, Loader2, Settings2, PlayCircle, AlertCircle } from 'lucide-react';
import { processVoiceTrack } from '../../lib/audioUtils';

export const AudioToolsCard = () => {
  const [activeTab, setActiveTab] = useState<'player' | 'filter'>('player');
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  
  // Filter states
  const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [tracks, setTracks] = useState<{ name: string; url: string; type: string }[]>([]);
  
  // Player states
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const newFile = e.target.files[0];
      setFile(newFile);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(newFile));
      setStatus('idle');
      setTracks([]);
      setSpeed(1);
      setPitch(0);
      setActiveTab('player');
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      if (pitch !== 0) {
        // Changing pitch natively changes speed as well
        const rate = Math.pow(2, pitch / 12);
        audioRef.current.playbackRate = rate;
        (audioRef.current as any).preservesPitch = false;
      } else {
        // Just changing speed
        audioRef.current.playbackRate = speed;
        (audioRef.current as any).preservesPitch = true;
      }
    }
  }, [speed, pitch, audioUrl]);

  const handleProcess = async () => {
    if (!file) return;
    
    if (file.size === 0) {
      alert('O arquivo selecionado está vazio (0 bytes). Por favor, escolha um arquivo de áudio válido.');
      return;
    }

    setStatus('processing');
    setProgress(10);
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Alternative approach: fetch the array buffer via ObjectURL
      // This sometimes bypasses browser-specific file reading quirks
      const tempUrl = URL.createObjectURL(file);
      const response = await fetch(tempUrl);
      const arrayBuffer = await response.arrayBuffer();
      URL.revokeObjectURL(tempUrl);

      setProgress(30);
      
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        audioContext.decodeAudioData(
          arrayBuffer,
          (buffer) => resolve(buffer),
          (err) => reject(err || new Error('Unable to decode audio data'))
        );
      });
      
      setProgress(50);

      const voices: { type: 'S'|'A'|'T'|'B', name: string }[] = [
        { type: 'S', name: 'Soprano (Agudos)' },
        { type: 'A', name: 'Contralto (Médios-Agudos)' },
        { type: 'T', name: 'Tenor (Médios-Graves)' },
        { type: 'B', name: 'Baixo (Graves)' },
      ];

      const newTracks = [];
      let currentProgress = 50;

      for (const voice of voices) {
        const blob = await processVoiceTrack(audioBuffer, voice.type);
        const url = URL.createObjectURL(blob);
        newTracks.push({ name: voice.name, url, type: voice.type });
        currentProgress += 10;
        setProgress(currentProgress);
      }

      setTracks(newTracks);
      setProgress(100);
      setStatus('done');
    } catch (error: any) {
      console.error('Erro ao processar áudio:', error);
      alert(`Erro: O navegador não conseguiu decodificar este arquivo de áudio.\n\nIsso acontece quando o arquivo não é um MP3/WAV válido, está corrompido, ou o formato não é suportado pelo seu navegador.\n\nDica: Converta o arquivo para MP3 usando um conversor online e tente novamente.`);
      setStatus('idle');
    }
  };

  return (
    <Card className="p-6 bg-[#1A1B1E] border-[#2C2E33]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
          <Music size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Ferramentas de Áudio</h3>
          <p className="text-xs text-[#909296]">Player de ensaio e filtro de frequências.</p>
        </div>
      </div>

      {/* Upload Area */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-[#2C2E33] rounded-xl p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all mb-6"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="audio/*" 
          className="hidden" 
        />
        <Upload size={24} className="mx-auto text-[#5C5F66] mb-2" />
        <p className="text-sm font-medium text-white mb-1">
          {file ? file.name : 'Clique para enviar a música (MP3/WAV)'}
        </p>
      </div>

      {file && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-[#2C2E33]/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('player')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'player' ? 'bg-[#2C2E33] text-white shadow-sm' : 'text-[#909296] hover:text-white'}`}
            >
              <PlayCircle size={16} />
              Player de Ensaio
            </button>
            <button
              onClick={() => setActiveTab('filter')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'filter' ? 'bg-[#2C2E33] text-white shadow-sm' : 'text-[#909296] hover:text-white'}`}
            >
              <Settings2 size={16} />
              Filtro de Vozes
            </button>
          </div>

          {activeTab === 'player' && (
            <div className="space-y-6">
              <audio 
                ref={audioRef}
                src={audioUrl} 
                controls 
                className="w-full h-10 rounded-lg"
              />
              
              <div className="space-y-4 bg-[#2C2E33]/30 p-4 rounded-lg">
                {/* Speed Control */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#909296]">Velocidade</span>
                    <span className="text-white font-medium">{speed.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={speed}
                    onChange={(e) => {
                      setSpeed(parseFloat(e.target.value));
                      setPitch(0); // Reset pitch when changing speed
                    }}
                    className="w-full accent-accent"
                  />
                </div>

                {/* Pitch Control */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#909296]">Tom (Semitons)</span>
                    <span className="text-white font-medium">{pitch > 0 ? `+${pitch}` : pitch}</span>
                  </div>
                  <input 
                    type="range" 
                    min="-12" 
                    max="12" 
                    step="1" 
                    value={pitch}
                    onChange={(e) => {
                      setPitch(parseInt(e.target.value));
                      setSpeed(1); // Reset speed when changing pitch
                    }}
                    className="w-full accent-accent"
                  />
                  {pitch !== 0 && (
                    <div className="flex items-start gap-2 text-xs text-amber-500/80 bg-amber-500/10 p-2 rounded mt-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <p>Nota: Mudar o tom nativamente no navegador também altera a velocidade da música.</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setSpeed(1); setPitch(0); }}>
                    Resetar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'filter' && (
            <div className="space-y-4">
              {status === 'idle' && (
                <Button variant="primary" className="w-full" onClick={handleProcess}>
                  Gerar Faixas Filtradas
                </Button>
              )}

              {status === 'processing' && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-accent" />
                      Processando...
                    </span>
                    <span className="text-accent font-medium">{progress}%</span>
                  </div>
                  <div className="h-2 bg-[#2C2E33] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {status === 'done' && (
                <div className="space-y-3">
                  {tracks.map((track, idx) => (
                    <div key={idx} className="bg-[#2C2E33] rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                          {track.name}
                        </span>
                        <a 
                          href={track.url} 
                          download={`${file.name.replace(/\.[^/.]+$/, "")}_${track.name.split(' ')[0]}.wav`}
                          className="text-xs flex items-center gap-1 text-accent hover:text-accent/80"
                        >
                          <Download size={14} />
                          WAV
                        </a>
                      </div>
                      <audio controls src={track.url} className="w-full h-8" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
};
