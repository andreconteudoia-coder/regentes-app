/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { 
  Music, 
  Type, 
  Presentation, 
  Save, 
  Trash2, 
  ChevronRight, 
  ArrowLeft, 
  Copy, 
  Download, 
  Maximize2, 
  Minimize2, 
  Settings,
  Plus,
  Search,
  BookOpen,
  Home as HomeIcon,
  Moon,
  Sun,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  X,
  Volume2,
  Music2,
  Mic2,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import Fuse from 'fuse.js';
import { cn } from './lib/utils';
import { formatLyrics, SongSection, serializeSections, plainTextToHtml } from './lib/lyrics';

// --- Components ---
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { HomeView } from './components/home/HomeView';
import { EditorView } from './components/editor/EditorView';
import { LibraryView } from './components/library/LibraryView';
import { PresentationView } from './components/presentation/PresentationView';
import { SetlistView } from './components/setlist/SetlistView';
import { ConductorKitCard } from './components/editor/ConductorKitCard';
import { WarmupView } from './components/warmup/WarmupView';
import { LoginView } from './components/auth/LoginView';

// --- Services ---

async function fetchLyricsFree(query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) throw new Error('Digite o nome da música');

  const results: any[] = [];
  const seen = new Set();

  const addResult = (title: string, artist: string, source: string) => {
    const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ title, artist, source });
    }
  };

  // Busca em paralelo para ser mais rápido e abrangente
  try {
    const [vagalumeRes, lyricsOvhRes, lrclibRes] = await Promise.allSettled([
      fetch(`/api/vagalume/artmus?q=${encodeURIComponent(cleanQuery)}&limit=10`),
      fetch(`/api/lyrics-ovh/suggest?q=${encodeURIComponent(cleanQuery)}`),
      fetch(`/api/lrclib/search?q=${encodeURIComponent(cleanQuery)}`)
    ]);

    if (vagalumeRes.status === 'fulfilled' && vagalumeRes.value.ok) {
      const searchData = await vagalumeRes.value.json();
      if (searchData.mus && searchData.mus.length > 0) {
        searchData.mus.forEach((m: any) => {
          addResult(m.name, m.art ? m.art.name : 'Artista Desconhecido', 'Vagalume');
        });
      }
    }

    if (lyricsOvhRes.status === 'fulfilled' && lyricsOvhRes.value.ok) {
      const suggestData = await lyricsOvhRes.value.json();
      if (suggestData.data && suggestData.data.length > 0) {
        suggestData.data.forEach((item: any) => {
          addResult(item.title, item.artist.name, 'Lyrics.ovh');
        });
      }
    }

    if (lrclibRes.status === 'fulfilled' && lrclibRes.value.ok) {
      const searchData = await lrclibRes.value.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        searchData.slice(0, 10).forEach((item: any) => {
          // Apenas adiciona se tiver letra (plainLyrics)
          if (item.plainLyrics) {
            addResult(item.name || item.trackName, item.artistName, 'LRCLIB');
          }
        });
      }
    }
  } catch (e) {
    console.error("Parallel suggest failed", e);
  }

  // Se encontramos resultados, retornamos a lista para o usuário escolher
  if (results.length > 0) {
    return { results };
  }

  // Se nada funcionou, avisa o usuário
  throw new Error('Música não encontrada. Tente digitar: Artista - Nome da Música para maior precisão.');
}

// --- Types ---

interface SongLink {
  label: string;
  url: string;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  content: string;
  sections: SongSection[];
  category?: string;
  conductorNotes?: string;
  links?: SongLink[];
  vocalParts?: string[];
  offlineAudioName?: string;
  updatedAt: number;
}

interface Setlist {
  id: string;
  title: string;
  date: string;
  songIds: string[];
  updatedAt: number;
}

type View = 'home' | 'formatter' | 'transposer' | 'library' | 'editor' | 'setlists' | 'conductor' | 'warmup';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [currentSong, setCurrentSong] = useState<Partial<Song>>({
    title: '',
    artist: '',
    content: '',
    sections: []
  });
  const [isPresenting, setIsPresenting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [fontSize, setFontSize] = useState(48);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [pdfConfig, setPdfConfig] = useState({
    columns: 'auto' as 'auto' | '1' | '2',
    fontSize: 10
  });

  const editorRef = useRef<any>(null);

  const [librarySearch, setLibrarySearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const [editorMode, setEditorMode] = useState<'search' | 'tools'>('search');

  const filteredSongs = songs.filter(song => 
    song.title.toLowerCase().includes(librarySearch.toLowerCase()) || 
    song.artist.toLowerCase().includes(librarySearch.toLowerCase())
  );

  // Load songs and setlists from Firestore
  useEffect(() => {
    if (!user) {
      setSongs([]);
      setSetlists([]);
      return;
    }

    const songsRef = collection(db, `users/${user.uid}/songs`);
    const qSongs = query(songsRef, orderBy('updatedAt', 'desc'));
    
    const unsubscribeSongs = onSnapshot(qSongs, (snapshot) => {
      const loadedSongs: Song[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedSongs.push({
          id: data.id,
          title: data.title,
          artist: data.artist || '',
          content: data.content,
          sections: data.sections ? JSON.parse(data.sections) : [],
          category: data.category,
          conductorNotes: data.conductorNotes,
          links: data.links ? JSON.parse(data.links) : [],
          vocalParts: data.vocalParts || [],
          offlineAudioName: data.offlineAudioName,
          updatedAt: data.updatedAt,
        } as Song);
      });
      setSongs(loadedSongs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/songs`);
    });

    const setlistsRef = collection(db, `users/${user.uid}/setlists`);
    const qSetlists = query(setlistsRef, orderBy('updatedAt', 'desc'));
    
    const unsubscribeSetlists = onSnapshot(qSetlists, (snapshot) => {
      const loadedSetlists: Setlist[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedSetlists.push({
          id: data.id,
          title: data.title,
          date: data.date || '',
          songIds: data.songIds || [],
          updatedAt: data.updatedAt,
        } as Setlist);
      });
      setSetlists(loadedSetlists);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/setlists`);
    });

    return () => {
      unsubscribeSongs();
      unsubscribeSetlists();
    };
  }, [user]);

  const saveSetlists = async (newSetlists: Setlist[]) => {
    if (!user) return;
    
    const currentIds = new Set(setlists.map(s => s.id));
    const newIds = new Set(newSetlists.map(s => s.id));
    
    const addedOrUpdated = newSetlists.filter(s => {
      const old = setlists.find(oldS => oldS.id === s.id);
      return !old || old.updatedAt !== s.updatedAt;
    });
    
    const deleted = setlists.filter(s => !newIds.has(s.id));
    
    try {
      for (const s of addedOrUpdated) {
        const docRef = doc(db, `users/${user.uid}/setlists/${s.id}`);
        await setDoc(docRef, {
          id: s.id,
          title: s.title,
          date: s.date || '',
          songIds: s.songIds || [],
          updatedAt: s.updatedAt || Date.now(),
          userId: user.uid
        });
      }
      for (const s of deleted) {
        const docRef = doc(db, `users/${user.uid}/setlists/${s.id}`);
        await deleteDoc(docRef);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/setlists`);
    }
  };

  const handleSaveSong = async () => {
    if (!user) return;
    if (!currentSong.title || !currentSong.content) {
      alert(`Não é possível salvar: ${!currentSong.title ? 'Título' : 'Conteúdo'} está faltando.`);
      return;
    }
    
    const songId = currentSong.id || crypto.randomUUID();
    const songToSave = {
      id: songId,
      title: currentSong.title,
      artist: currentSong.artist || 'Artista Desconhecido',
      content: currentSong.content,
      sections: JSON.stringify(formatLyrics(currentSong.content)),
      category: currentSong.category || 'Hinos',
      conductorNotes: currentSong.conductorNotes || '',
      links: JSON.stringify(currentSong.links || []),
      vocalParts: currentSong.vocalParts || [],
      offlineAudioName: currentSong.offlineAudioName || null,
      updatedAt: Date.now(),
      userId: user.uid
    };

    try {
      const docRef = doc(db, `users/${user.uid}/songs/${songId}`);
      await setDoc(docRef, songToSave);
      setView('library');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/songs/${songId}`);
    }
  };

  const handleDeleteSong = async (id: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, `users/${user.uid}/songs/${id}`);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/songs/${id}`);
    }
  };

  const generatePDF = () => {
    try {
      // Explicitly set to A4 format (210mm x 297mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const margin = 20; // Slightly larger margin for A4
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(currentSong.title || 'Sem Título', margin, margin + 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(currentSong.artist || 'Artista Desconhecido', margin, margin + 18);
      
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, margin + 22, pageWidth - margin, margin + 22);
      
      // Content
      const content = currentSong.content || '';
      
      // Better HTML stripping and entity decoding
      const decodeHtml = (html: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
      };

      const stripHtmlButKeepFormatting = (html: string) => {
        // Replace <p> and <br> with newlines before stripping
        let text = html.replace(/<\/p>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<div>/g, '\n');
        // Replace strong with b, em with i
        text = text.replace(/<strong[^>]*>/gi, '<b>').replace(/<\/strong>/gi, '</b>');
        text = text.replace(/<em[^>]*>/gi, '<i>').replace(/<\/em>/gi, '</i>');
        // Strip all tags EXCEPT b and i
        text = text.replace(/<(?!b\b|\/b\b|i\b|\/i\b)[^>]*>/gi, '');
        // Decode entities
        return decodeHtml(text);
      };

      const cleanContent = stripHtmlButKeepFormatting(content);
      const lines = cleanContent.split('\n');
      
      let fontSize = pdfConfig.fontSize;
      
      // Determine columns
      let useColumns = false;
      if (pdfConfig.columns === '2') {
        useColumns = true;
      } else if (pdfConfig.columns === 'auto') {
        useColumns = lines.length > 45;
      }
      
      doc.setFontSize(fontSize);
      let y = margin + 30;
      let x = margin;
      const colWidth = (pageWidth - (margin * 3)) / 2;
      
      const renderFormattedText = (text: string, startX: number, startY: number, baseFont: string, baseColor: number[]) => {
        const parts = text.split(/(<\/?b>|<\/?i>)/i);
        let currentX = startX;
        let isBold = baseFont === 'bold';
        let isItalic = baseFont === 'italic';
        
        parts.forEach(part => {
          if (!part) return;
          const lowerPart = part.toLowerCase();
          if (lowerPart === '<b>') {
            isBold = true;
          } else if (lowerPart === '</b>') {
            isBold = false;
          } else if (lowerPart === '<i>') {
            isItalic = true;
          } else if (lowerPart === '</i>') {
            isItalic = false;
          } else {
            let fontStyle = 'normal';
            if (isBold && isItalic) fontStyle = 'bolditalic';
            else if (isBold) fontStyle = 'bold';
            else if (isItalic) fontStyle = 'italic';
            
            doc.setFont('helvetica', fontStyle);
            doc.setTextColor(baseColor[0], baseColor[1], baseColor[2]);
            doc.text(part, currentX, startY);
            currentX += doc.getTextWidth(part);
          }
        });
        
        // Reset to base
        doc.setFont('helvetica', baseFont);
        doc.setTextColor(baseColor[0], baseColor[1], baseColor[2]);
      };
      
      lines.forEach((line: string) => {
        const cleanLine = line.trim();
        if (!cleanLine && line !== '') return; // Skip empty lines that were just whitespace
        
        const plainTextLine = cleanLine.replace(/<[^>]*>?/gm, '').trim();
        
        const isHeader = (plainTextLine.startsWith('[') && plainTextLine.endsWith(']')) || 
                        /^(refrão|coro|verso|ponte|intro|final|chorus|verse|bridge|outro|refrão\s*\d+|coro\s*\d+|verso\s*\d+|ponte\s*\d+|chorus\s*\d+|verse\s*\d+|bridge\s*\d+)/i.test(plainTextLine);
        
        if (isHeader) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(fontSize + 2);
          doc.setTextColor(51, 154, 240);
          y += 4;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(0, 0, 0);
        }
        
        if (y > pageHeight - margin - 10) { // Leave space for footer
          if (useColumns && x === margin) {
            x = margin + colWidth + margin;
            y = margin + 30;
          } else {
            doc.addPage();
            y = margin + 15;
            x = margin;
          }
        }
        
        const voiceMatch = plainTextLine.match(/^\[([SATB])\]/i);
        if (voiceMatch) {
          const part = voiceMatch[1].toUpperCase();
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(51, 154, 240);
          doc.text(`${part}: `, x, y);
          const partWidth = doc.getTextWidth(`${part}: `);
          
          const restFormatted = cleanLine.replace(/^.*?\[[SATB]\].*?\s*/i, '');
          renderFormattedText(restFormatted, x + partWidth, y, 'normal', [0, 0, 0]);
        } else {
          renderFormattedText(cleanLine, x, y, isHeader ? 'bold' : 'normal', isHeader ? [51, 154, 240] : [0, 0, 0]);
        }

        y += (isHeader ? fontSize + 2 : fontSize) * 0.6 + 1;
        
        if (isHeader) y += 2;
      });

      // Add page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
      doc.save(`${currentSong.title || 'musica'}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Verifique se o conteúdo da música é válido.');
    }
  };

  // Auto-scroll logic
  useEffect(() => {
    let interval: any;
    if (autoScroll && isPresenting && scrollRef.current) {
      interval = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += scrollSpeed;
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [autoScroll, isPresenting, scrollSpeed]);

  const handleQuickSearch = async (q: string) => {
    if (!q.trim()) return;
    setIsSearching(true);
    setShowResults(false);
    
    // Tenta extrair título e artista da busca para pré-preencher
    const separators = [' - ', ' – ', ' — ', ' by ', ' de '];
    let guessedArtist = '';
    let guessedTitle = '';
    
    for (const sep of separators) {
      if (q.includes(sep)) {
        const parts = q.split(sep).map(s => s.trim());
        if (sep === ' by ' || sep === ' de ') {
          [guessedTitle, guessedArtist] = parts;
        } else {
          [guessedArtist, guessedTitle] = parts;
        }
        break;
      }
    }

    if (guessedArtist || guessedTitle) {
      setCurrentSong(prev => ({
        ...prev,
        title: guessedTitle || prev.title,
        artist: guessedArtist || prev.artist
      }));
    }

    try {
      const res: any = await fetchLyricsFree(q);
      if (res.results) {
        setSearchResults(res.results);
        setShowResults(true);
      } else if (res.content) {
        const content = plainTextToHtml(res.content);
        setCurrentSong(prev => ({ 
          ...prev, 
          title: res.title || prev.title,
          artist: res.artist || prev.artist,
          content 
        }));
        setSearchQuery(''); // Limpa após sucesso
      }
    } catch (err: any) {
      alert(err.message || 'Música não encontrada. Tente digitar o nome da música ou Artista - Música');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = async (result: any) => {
    console.log('handleSelectResult called with:', result);
    setIsSearching(true);
    setShowResults(false);
    try {
      let lyrics = '';
      let title = result.title || '';
      let artist = result.artist || '';

      const fetchFromVagalume = async () => {
        const lyricsUrl = `/api/vagalume/lyrics?art=${encodeURIComponent(result.artist)}&mus=${encodeURIComponent(result.title)}`;
        const lyricsRes = await fetch(lyricsUrl);
        if (lyricsRes.ok) {
          const lyricsData = await lyricsRes.json();
          if (lyricsData && (lyricsData.type === 'exact' || lyricsData.type === 'aprox')) {
            return {
              lyrics: lyricsData.mus[0].text,
              title: lyricsData.mus[0].name,
              artist: lyricsData.art.name
            };
          }
        }
        return null;
      };

      const fetchFromLyricsOvh = async () => {
        const response = await fetch(`/api/lyrics-ovh/${encodeURIComponent(result.artist)}/${encodeURIComponent(result.title)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.lyrics) {
            return { lyrics: data.lyrics, title: result.title, artist: result.artist };
          }
        }
        return null;
      };

      const fetchFromLrclib = async () => {
        const response = await fetch(`/api/lrclib?artist=${encodeURIComponent(result.artist)}&title=${encodeURIComponent(result.title)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.plainLyrics) {
            // User requested: Title = name, Artist = artistName
            return { lyrics: data.plainLyrics, title: data.name || data.trackName || result.title, artist: data.artistName || result.artist };
          }
        }
        return null;
      };

      // Try primary source first
      if (result.source === 'Vagalume') {
        const data = await fetchFromVagalume();
        if (data) {
          lyrics = data.lyrics;
          title = data.title || title;
          artist = data.artist || artist;
        } else {
          // Fallback to LRCLIB
          const fallbackData = await fetchFromLrclib();
          if (fallbackData) {
            lyrics = fallbackData.lyrics;
            title = fallbackData.title || title;
            artist = fallbackData.artist || artist;
          } else {
            // Fallback to Lyrics.ovh
            const ovhData = await fetchFromLyricsOvh();
            if (ovhData) {
              lyrics = ovhData.lyrics;
              title = ovhData.title || title;
              artist = ovhData.artist || artist;
            }
          }
        }
      } else if (result.source === 'LRCLIB') {
        const data = await fetchFromLrclib();
        if (data) {
          lyrics = data.lyrics;
          title = data.title || title;
          artist = data.artist || artist;
        } else {
          // Fallback to Vagalume
          const fallbackData = await fetchFromVagalume();
          if (fallbackData) {
            lyrics = fallbackData.lyrics;
            title = fallbackData.title || title;
            artist = fallbackData.artist || artist;
          } else {
            // Fallback to Lyrics.ovh
            const ovhData = await fetchFromLyricsOvh();
            if (ovhData) {
              lyrics = ovhData.lyrics;
              title = ovhData.title || title;
              artist = ovhData.artist || artist;
            }
          }
        }
      } else {
        // Primary source is Lyrics.ovh
        const data = await fetchFromLyricsOvh();
        if (data) {
          lyrics = data.lyrics;
          if (data.title) title = data.title;
          if (data.artist) artist = data.artist;
        } else {
          // Fallback to LRCLIB
          const fallbackData = await fetchFromLrclib();
          if (fallbackData) {
            lyrics = fallbackData.lyrics;
            if (fallbackData.title) title = fallbackData.title;
            if (fallbackData.artist) artist = fallbackData.artist;
          } else {
            // Fallback to Vagalume
            const vagalumeData = await fetchFromVagalume();
            if (vagalumeData) {
              lyrics = vagalumeData.lyrics;
              if (vagalumeData.title) title = vagalumeData.title;
              if (vagalumeData.artist) artist = vagalumeData.artist;
            }
          }
        }
      }

      // Always update title and artist, even if lyrics are not found
      
      // Force the use of the updated title and artist variables
      const finalTitle = title || result.title || 'Sem Título';
      const finalArtist = artist || result.artist || 'Artista Desconhecido';

      setCurrentSong(prev => ({
        ...prev,
        title: finalTitle,
        artist: finalArtist,
        content: lyrics ? plainTextToHtml(lyrics) : prev.content || '',
        key: prev.key || 'C'
      }));
      setSearchQuery('');

      if (!lyrics) {
        alert('A letra não foi encontrada nas bases gratuitas, mas o título e artista foram preenchidos. Você pode colar a letra manualmente.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar letra.');
    } finally {
      setIsSearching(false);
    }
  };

  const [highlightVoice, setHighlightVoice] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#141517] text-[#C1C2C5] font-sans selection:bg-primary/30">
      {/* Navigation */}
      <nav className="border-b border-[#2C2E33] bg-[#1A1B1E]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setView('home')}
            >
              <div className="w-8 h-8 bg-gradient-feminine rounded-lg flex items-center justify-center text-white group-hover:rotate-12 transition-transform shadow-lg shadow-primary/20">
                <Music size={20} />
              </div>
              <span className="font-bold text-white text-xl tracking-tight font-maestra">Maestra Coral</span>
            </div>
            
            {user && (
              <div className="hidden md:flex items-center gap-1">
                <button 
                  onClick={() => setView('home')}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", view === 'home' ? "bg-[#2C2E33] text-white" : "hover:bg-[#2C2E33] text-[#909296]")}
                >
                  Início
                </button>
                <button 
                  onClick={() => setView('library')}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", view === 'library' ? "bg-[#2C2E33] text-white" : "hover:bg-[#2C2E33] text-[#909296]")}
                >
                  Biblioteca
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-[#909296] hover:text-white transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {user && (
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-[#909296] hover:text-white transition-colors"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="animate-spin text-primary" size={40} />
          </div>
        ) : !user ? (
          <LoginView />
        ) : (
          <React.Fragment>
            {view === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <HomeView 
                  setView={(v) => setView(v)} 
                  setEditorMode={setEditorMode}
                  setCurrentSong={setCurrentSong} 
                  songs={songs} 
                />
              </motion.div>
            )}

          {view === 'editor' && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <EditorView 
                mode={editorMode}
                setView={setView}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isSearching={isSearching}
                handleQuickSearch={handleQuickSearch}
                showResults={showResults}
                setShowResults={setShowResults}
                searchResults={searchResults}
                handleSelectResult={handleSelectResult}
                currentSong={currentSong}
                setCurrentSong={setCurrentSong}
                editorRef={editorRef}
                pdfConfig={pdfConfig}
                setPdfConfig={setPdfConfig}
                handleSaveSong={handleSaveSong}
                generatePDF={generatePDF}
                setIsPresenting={setIsPresenting}
              />
            </motion.div>
          )}
          {view === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <LibraryView 
                setView={setView}
                setCurrentSong={setCurrentSong}
                librarySearch={librarySearch}
                setLibrarySearch={setLibrarySearch}
                filteredSongs={filteredSongs}
                handleDeleteSong={handleDeleteSong}
              />
            </motion.div>
          )}

          {view === 'setlists' && (
            <motion.div
              key="setlists"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <SetlistView 
                setView={setView}
                setlists={setlists}
                saveSetlists={saveSetlists}
                songs={songs}
              />
            </motion.div>
          )}

          {view === 'conductor' && (
            <motion.div
              key="conductor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ConductorKitCard setView={setView} />
            </motion.div>
          )}

          {view === 'warmup' && (
            <motion.div
              key="warmup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <WarmupView setView={setView} />
            </motion.div>
          )}
          </React.Fragment>
        )}
      </main>

      {/* Presentation Mode Overlay */}
        {isPresenting && (
          <PresentationView 
            currentSong={currentSong}
            setIsPresenting={setIsPresenting}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            scrollSpeed={scrollSpeed}
            setScrollSpeed={setScrollSpeed}
            fontSize={fontSize}
            setFontSize={setFontSize}
            highlightVoice={highlightVoice}
            setHighlightVoice={setHighlightVoice}
          />
        )}

      {/* Footer */}
      <footer className="border-t border-[#2C2E33] mt-20 py-12 bg-[#1A1B1E]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="w-6 h-6 bg-gradient-feminine rounded flex items-center justify-center text-white">
                <Music size={14} />
              </div>
              <span className="font-bold text-white tracking-tight font-maestra">Maestra Coral</span>
            </div>
            <p className="text-xs text-[#5C5F66] max-w-xs">
              Sua ferramenta definitiva para regência e preparação vocal. 
              Feito para regentes, por regentes.
            </p>
          </div>
          
          <div className="flex gap-12">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#5C5F66]">Ferramentas</h4>
              <ul className="text-sm space-y-2">
                <li><button onClick={() => setView('editor')} className="hover:text-primary transition-colors">Editor</button></li>
                <li><button onClick={() => setView('editor')} className="hover:text-primary transition-colors">Formatador</button></li>
                <li><button onClick={() => setView('library')} className="hover:text-primary transition-colors">Biblioteca</button></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#5C5F66]">Suporte</h4>
              <ul className="text-sm space-y-2">
                <li><a href="#" className="hover:text-primary transition-colors">Ajuda</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Privacidade</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-[#2C2E33] text-center text-[10px] text-[#5C5F66] uppercase tracking-widest font-bold">
          © 2026 Maestra Coral • Todos os direitos reservados
        </div>
      </footer>

    </div>
  );
}
