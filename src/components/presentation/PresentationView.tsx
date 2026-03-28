import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Minimize2, Pause, Play, Plus, Minus, Type, Youtube, X, Music } from 'lucide-react';
import { cn } from '../../lib/utils';
import { get } from 'idb-keyval';

interface PresentationViewProps {
  currentSong: any;
  setIsPresenting: (isPresenting: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (autoScroll: boolean) => void;
  scrollSpeed: number;
  setScrollSpeed: (speed: number) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  highlightVoice: string | null;
  setHighlightVoice: (voice: string | null) => void;
}

const getYouTubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const PresentationView: React.FC<PresentationViewProps> = ({
  currentSong,
  setIsPresenting,
  autoScroll,
  setAutoScroll,
  scrollSpeed,
  setScrollSpeed,
  fontSize,
  setFontSize,
  highlightVoice,
  setHighlightVoice,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showOfflinePlayer, setShowOfflinePlayer] = useState(false);
  const [offlineAudioUrl, setOfflineAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;
    if (autoScroll && scrollRef.current) {
      interval = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += 1;
        }
      }, 50 / scrollSpeed);
    }
    return () => clearInterval(interval);
  }, [autoScroll, scrollSpeed]);

  useEffect(() => {
    const loadOfflineAudio = async () => {
      if (currentSong.offlineAudioName && currentSong.id) {
        try {
          const file = await get(`audio_${currentSong.id}`);
          if (file) {
            const url = URL.createObjectURL(file);
            setOfflineAudioUrl(url);
          }
        } catch (error) {
          console.error('Failed to load offline audio:', error);
        }
      }
    };
    loadOfflineAudio();

    return () => {
      if (offlineAudioUrl) {
        URL.revokeObjectURL(offlineAudioUrl);
      }
    };
  }, [currentSong.id, currentSong.offlineAudioName]);

  const youtubeLink = (currentSong.links || []).find((l: any) => l.url.includes('youtube.com') || l.url.includes('youtu.be'));
  const youtubeId = youtubeLink ? getYouTubeId(youtubeLink.url) : null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col"
    >
      {/* Top Bar - Song Info & Close */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsPresenting(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-white font-bold text-xl">{currentSong.title}</h2>
            <p className="text-white/60 text-sm">{currentSong.artist}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {youtubeId && (
            <button 
              onClick={() => { setShowPlayer(!showPlayer); setShowOfflinePlayer(false); }} 
              className={cn(
                "p-2 rounded-full transition-colors flex items-center gap-2 px-4",
                showPlayer ? "bg-red-500 text-white" : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              <Youtube size={20} />
              <span className="text-sm font-bold">{showPlayer ? "Ocultar YouTube" : "YouTube"}</span>
            </button>
          )}
          {offlineAudioUrl && (
            <button 
              onClick={() => { setShowOfflinePlayer(!showOfflinePlayer); setShowPlayer(false); }} 
              className={cn(
                "p-2 rounded-full transition-colors flex items-center gap-2 px-4",
                showOfflinePlayer ? "bg-primary text-white" : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              <Music size={20} />
              <span className="text-sm font-bold">{showOfflinePlayer ? "Ocultar Áudio" : "Áudio Offline"}</span>
            </button>
          )}
          <button onClick={() => setIsPresenting(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors">
            <Minimize2 size={24} />
          </button>
        </div>
      </div>

      {/* Floating YouTube Player */}
      {showPlayer && youtubeId && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute top-24 right-6 z-30 bg-black border border-white/20 rounded-xl overflow-hidden shadow-2xl"
          style={{ width: '320px', height: '180px' }}
        >
          <button 
            onClick={() => setShowPlayer(false)}
            className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/80 text-white rounded-full z-40 transition-colors"
          >
            <X size={16} />
          </button>
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </motion.div>
      )}

      {/* Floating Offline Audio Player */}
      {showOfflinePlayer && offlineAudioUrl && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute top-24 right-6 z-30 bg-[#1A1B1E] border border-white/20 rounded-xl overflow-hidden shadow-2xl p-4 flex flex-col gap-4"
          style={{ width: '320px' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Music size={20} />
              <span className="font-bold text-sm truncate">{currentSong.offlineAudioName}</span>
            </div>
            <button 
              onClick={() => setShowOfflinePlayer(false)}
              className="p-1 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <audio 
            key={offlineAudioUrl || 'empty'}
            controls 
            autoPlay 
            src={offlineAudioUrl || undefined} 
            className="w-full h-10"
          />
        </motion.div>
      )}

      {/* Floating Controls Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[#1A1B1E]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl"
        >
          {/* Toggle Play/Pause */}
          <button 
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
              autoScroll ? "bg-primary text-white shadow-feminine" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            )}
            title={autoScroll ? "Pausar Rolagem" : "Iniciar Rolagem"}
          >
            {autoScroll ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </button>

          <div className="h-8 w-px bg-white/10 mx-1" />

          {/* Speed Controls */}
          <div className="flex items-center gap-1 px-2">
            <button onClick={() => setScrollSpeed(Math.max(0.1, scrollSpeed - 0.1))} className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Minus size={18} />
            </button>
            <div className="w-16 text-center">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block">Veloc.</span>
              <span className="text-sm font-bold text-white">{(scrollSpeed * 10).toFixed(0)}%</span>
            </div>
            <button onClick={() => setScrollSpeed(Math.min(2, scrollSpeed + 0.1))} className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Plus size={18} />
            </button>
          </div>

          <div className="h-8 w-px bg-white/10 mx-1" />

          {/* Font Size Controls */}
          <div className="flex items-center gap-1 px-2">
            <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Type size={16} />
            </button>
            <div className="w-12 text-center">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block">Tam.</span>
              <span className="text-sm font-bold text-white">{fontSize}</span>
            </div>
            <button onClick={() => setFontSize(Math.min(72, fontSize + 2))} className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Type size={22} />
            </button>
          </div>

          <div className="h-8 w-px bg-white/10 mx-1" />

          {/* Voice Highlighting */}
          <div className="flex items-center gap-1 p-1 bg-black/20 rounded-xl">
            {['S', 'A', 'T', 'B'].map(voice => (
              <button
                key={voice}
                onClick={() => setHighlightVoice(highlightVoice === voice ? null : voice)}
                className={cn(
                  "w-10 h-10 rounded-lg text-sm font-bold transition-all duration-200",
                  highlightVoice === voice 
                    ? "bg-primary text-white shadow-lg scale-110" 
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                {voice}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Lyrics Content Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-smooth px-6 py-32 md:px-20 lg:px-40"
      >
        <div 
          className="max-w-4xl mx-auto space-y-12 text-center"
          style={{ fontSize: `${fontSize}px` }}
        >
          <div 
            className="prose prose-invert prose-2xl mx-auto"
            dangerouslySetInnerHTML={{ __html: currentSong.content || '' }}
          />
        </div>
      </div>
    </motion.div>
  );
};
