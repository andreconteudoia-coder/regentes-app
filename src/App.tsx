/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';

import { User, Song, Setlist, FirestoreErrorInfo } from './types';
import jsPDF from 'jspdf';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { formatLyrics, plainTextToHtml } from './lib/lyrics';
import { cn } from './lib/utils';
import Fuse from 'fuse.js';
import { suggestHymnsByTheme } from './lib/themes';
import { motion } from 'motion/react';
import { Music, Sun, Moon, LogOut, Loader2 } from 'lucide-react';
import { LoginView } from './components/auth/LoginView';
import { HomeView } from './components/home/HomeView';
import { EditorView } from './components/editor/EditorView';
import { LibraryView } from './components/library/LibraryView';
import { SetlistView } from './components/setlist/SetlistView';
import { ConductorKitCard } from './components/editor/ConductorKitCard';
import { WarmupView } from './components/warmup/WarmupView';
import { PresentationView } from './components/presentation/PresentationView';

// Define View type
type View = 'home' | 'editor' | 'library' | 'setlists' | 'conductor' | 'warmup' | 'presentation';

// OperationType as an object for value usage
const OperationType = {
  GET: 'GET',
  WRITE: 'WRITE',
  DELETE: 'DELETE',
} as const;
type OperationType = typeof OperationType[keyof typeof OperationType];


// Busca sugestões de letras usando Vagalume e Lyrics.ovh
// Busca sugestões de letras usando Letras.mus.br, Vagalume e Lyrics.ovh
async function fetchLyricsFree(q: string): Promise<any> {
  const qLower = q.toLowerCase().trim();
  const results: Array<{ title: string; artist: string; source: string; extra?: any }> = [];

  // Helper: create slug from text
  const toSlug = (text: string) => text
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  // If user provided artist (e.g. "title - artist"), try direct letras.mus.br URL first
  const separators = [' - ', ' – ', ' — ', ' by ', ' de '];
  for (const sep of separators) {
    if (q.includes(sep)) {
      const parts = q.split(sep).map(s => s.trim()).filter(Boolean);
      let guessedArtist = '';
      let guessedTitle = '';
      if (parts.length >= 2) {
        if (sep === ' by ' || sep === ' de ') {
          guessedTitle = parts[0];
          guessedArtist = parts.slice(1).join(sep).trim();
        } else {
          guessedArtist = parts[0];
          guessedTitle = parts.slice(1).join(sep).trim();
        }
      }

      if (guessedArtist && guessedTitle) {
        try {
          const artistSlug = toSlug(guessedArtist);
          const musicSlug = toSlug(guessedTitle);
          const res = await fetch(`/api/letrasmus/${artistSlug}/${musicSlug}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.lyrics) {
              return { content: data.lyrics, title: guessedTitle, artist: guessedArtist };
            }
          }
        } catch (e) {
          // ignore and fallthrough to other providers
        }
      }
      break;
    }
  }

  // 1. Try LRCLIB first (more accurate for gospel/BR)
  try {
    const lrRes = await fetch(`/api/lrclib/search?q=${encodeURIComponent(q)}`);
    if (lrRes.ok) {
      const data = await lrRes.json();
      const items = data.results || data.data || data.items || data;
      if (Array.isArray(items) && items.length) {
        items.forEach((it: any) => {
          // Try to extract title/artist from possible shapes
          const title = it.title || it.name || it.trackName || it.music || '';
          const artist = it.artistName || (it.artist && (it.artist.name || it.artist)) || it.author || '';
          if (title) results.push({ title: String(title).trim(), artist: String(artist).trim(), source: 'LRCLIB', extra: it });
        });
      }
    }
  } catch (e) {}

  // 2. Then Letras.mus.br search
  try {
    const letrasRes = await fetch(`/api/letrasmus/search?q=${encodeURIComponent(q)}`);
    if (letrasRes.ok) {
      const data = await letrasRes.json();
      if (data && data.results && data.results.length > 0) {
        data.results.forEach((r: any) => results.push({ title: r.title, artist: r.artist, source: 'Letras.mus.br' }));
      }
    }
  } catch (e) {}

  // 3. Vagalume next
  try {
    const vagalumeRes = await fetch(`/api/vagalume/search?q=${encodeURIComponent(q)}`);
    if (vagalumeRes.ok) {
      const data = await vagalumeRes.json();
      if (data && data.results && data.results.length > 0) {
        data.results.forEach((r: any) => results.push({ title: r.title, artist: r.artist, source: 'Vagalume' }));
      }
    }
  } catch (e) {}

  // 4. Finally, Lyrics.ovh but limited and deprioritized
  try {
    const ovhRes = await fetch(`/api/lyrics-ovh/suggest?q=${encodeURIComponent(q)}`);
    if (ovhRes.ok) {
      const data = await ovhRes.json();
      const items = data.data || data.results || [];
      if (Array.isArray(items) && items.length) {
        items.slice(0, 5).forEach((r: any) => results.push({ title: r.title, artist: r.artist && (r.artist.name || r.artist) || '', source: 'Lyrics.ovh' }));
      }
    }
  } catch (e) {}

  if (results.length === 0) return { results: [] };

  // Use Fuse.js to rank results by title+artist
  try {
    const fuse = new Fuse(results, { keys: ['title', 'artist'], threshold: 0.4, ignoreLocation: true });
    const fuseRes = fuse.search(q);
    let ranked = fuseRes.map(r => ({ ...(r.item), score: r.score }));

    // Prefer exact title matches (case-insensitive) above fuzzy scores
    ranked.sort((a, b) => {
      const aExact = a.title.toLowerCase() === qLower ? 1 : (a.title.toLowerCase().includes(qLower) ? 0.5 : 0);
      const bExact = b.title.toLowerCase() === qLower ? 1 : (b.title.toLowerCase().includes(qLower) ? 0.5 : 0);
      if (aExact !== bExact) return bExact - aExact;
      const aScore = typeof a.score === 'number' ? a.score : 1;
      const bScore = typeof b.score === 'number' ? b.score : 1;
      return aScore - bScore;
    });

    // Map back and limit to 10
    const out = ranked.slice(0, 10).map(r => ({ title: r.title, artist: r.artist, source: r.source }));
    return { results: out };
  } catch (e) {
    // If Fuse fails, return deduped results with LRCLIB items first
    const seen = new Set<string>();
    const dedup: any[] = [];
    // LRCLIB first
    results.filter(r => r.source === 'LRCLIB').concat(results.filter(r => r.source !== 'LRCLIB')).forEach(r => {
      const key = (r.title + '|' + r.artist).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push({ title: r.title, artist: r.artist, source: r.source });
      }
    });
    return { results: dedup.slice(0, 10) };
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
      // Title in red
      doc.setTextColor(200, 0, 0);
      doc.text(currentSong.title || 'Sem Título', margin, margin + 10);
      
      // Artist in black and bold
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(currentSong.artist || 'Artista Desconhecido', margin, margin + 18);
      
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, margin + 22, pageWidth - margin, margin + 22);
      
      // Content (decode HTML entities and normalize spaces)
      // Better HTML stripping and entity decoding
      const decodeHtml = (html: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
      };

      let content = currentSong.content || '';
      // First decode HTML entities (so &nbsp; -> non-breaking space)
      try {
        content = decodeHtml(content);
      } catch (e) {
        // If decode fails for any reason, keep original
      }
      // Replace any remaining literal &nbsp; with normal spaces
      content = content.replace(/&nbsp;/g, ' ');
      // Normalize multiple consecutive spaces to a single space
      content = content.replace(/\u00A0/g, ' ').replace(/\s{2,}/g, ' ');


      // Extrai linhas mantendo tags <b>, <i>, <span style="color:..."> e quebra de linha
      const extractLinesWithFormatting = (html: string) => {
        // Normaliza para <span style="color:...">, <b>, <i>, <br>, <p>
        let text = html
          .replace(/<strong[^>]*>/gi, '<b>')
          .replace(/<\/strong>/gi, '</b>')
          .replace(/<em[^>]*>/gi, '<i>')
          .replace(/<\/em>/gi, '</i>')
          .replace(/<div>/g, '')
          .replace(/<\/div>/g, '')
          .replace(/<p>/g, '')
          .replace(/<\/p>/g, '\n')
          .replace(/<br\s*\/?>(?!\n)/gi, '\n');
        // Remove tags não suportadas, exceto <b>, <i>, <span style="color:...">
        text = text.replace(/<(?!b\b|\/b\b|i\b|\/i\b|span\b|\/span\b)[^>]*>/gi, '');
        return text.split('\n');
      };

      const lines = extractLinesWithFormatting(content);
      
      let fontSize = pdfConfig.fontSize;

      // Determine initial columns setting
      let useColumns = false;
      if (pdfConfig.columns === '2') {
        useColumns = true;
      } else if (pdfConfig.columns === 'auto') {
        useColumns = lines.length > 45;
      }

      // Auto-fit logic: try combinations of columns (1/2), reduce fontSize (down to minFontSize)
      // and reduce margins (down to minMargin) to force the hymn to fit on one A4 page.
      const headerBase = 30; // base header area
      const footerBase = 20; // base footer area
      const initialMargin = margin;
      const minFontSize = 6;
      const minMargin = 10;
      let fitted = false;
      let finalMargin = initialMargin;

      const estimateTotalHeight = (fs: number, lineFactor: number) => {
        let total = 0;
        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine && line !== '') continue;
          const plainTextLine = cleanLine.replace(/<[^>]*>?/gm, '').trim();
          const isHeader = (plainTextLine.startsWith('[') && plainTextLine.endsWith(']')) ||
                          /^(refrão|coro|verso|ponte|intro|final|chorus|verse|bridge|outro|refrão\s*\d+|coro\s*\d+|verso\s*\d+|ponte\s*\d+|chorus\s*\d+|verse\s*\d+|bridge\s*\d+)/i.test(plainTextLine);
          const base = isHeader ? (fs + 2) : fs;
          const lh = (base * lineFactor) + 1;
          total += lh + (isHeader ? 2 : 0);
        }
        return total;
      };

      // Try reducing margin and font size; also try 1 or 2 columns
      for (let cols of (useColumns ? [2,1] : [1,2])) {
        for (let m = initialMargin; m >= minMargin; m -= 2) {
          const availableH = pageHeight - m - headerBase - footerBase;
          for (let fs = pdfConfig.fontSize; fs >= minFontSize; fs -= 1) {
            // reduce line spacing factor slightly for aggressive fit
            for (const lineFactor of [0.6, 0.55, 0.5]) {
              const totalH = estimateTotalHeight(fs, lineFactor);
              const perColH = cols === 2 ? (totalH / 2) : totalH;
              if (perColH <= availableH) {
                fontSize = fs;
                useColumns = cols === 2;
                finalMargin = m;
                fitted = true;
                break;
              }
            }
            if (fitted) break;
          }
          if (fitted) break;
        }
        if (fitted) break;
      }

      // Apply chosen settings
      const usedMargin = finalMargin;
      doc.setFontSize(fontSize);
      let y = usedMargin + headerBase;
      let x = usedMargin;
      const colWidth = (pageWidth - (usedMargin * 3)) / 2;
      

      // Suporte a <b>, <i>, <span style="color:...">
      const renderFormattedText = (text: string, startX: number, startY: number, baseFont: string, baseColor: number[]) => {
        // Regex para dividir por tags de formatação e span de cor
        const parts = text.split(/(<\/?b>|<\/?i>|<span[^>]*style=["']color:[^"']+["'][^>]*>|<\/span>)/i);
        let currentX = startX;
        let isBold = baseFont === 'bold';
        let isItalic = baseFont === 'italic';
        let color = baseColor;
        const colorStack: number[][] = [];

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
          } else if (lowerPart.startsWith('<span') && lowerPart.includes('color:')) {
            // Extrai cor do style
            const match = lowerPart.match(/color:([^;"']+)/);
            if (match) {
              colorStack.push(color);
              color = hexToRgb(match[1].trim()) || color;
            }
          } else if (lowerPart === '</span>') {
            color = colorStack.pop() || baseColor;
          } else {
            let fontStyle = 'normal';
            if (isBold && isItalic) fontStyle = 'bolditalic';
            else if (isBold) fontStyle = 'bold';
            else if (isItalic) fontStyle = 'italic';

            doc.setFont('helvetica', fontStyle);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(part, currentX, startY);
            currentX += doc.getTextWidth(part);
          }
        });

        // Reset to base
        doc.setFont('helvetica', baseFont);
        doc.setTextColor(baseColor[0], baseColor[1], baseColor[2]);
      };

      // Função auxiliar para converter hex/rgb para array [r,g,b]
      function hexToRgb(color: string): number[] | null {
        // Suporta #rrggbb, #rgb, rgb(r,g,b)
        if (color.startsWith('#')) {
          let hex = color.replace('#', '');
          if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
          if (hex.length !== 6) return null;
          const num = parseInt(hex, 16);
          return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        } else if (color.startsWith('rgb')) {
          const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
        }
        return null;
      }
      
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
        
        if (y > pageHeight - usedMargin - 10) { // Leave space for footer
          if (useColumns && x === usedMargin) {
            x = usedMargin + colWidth + usedMargin;
            y = usedMargin + 30;
          } else {
            doc.addPage();
            y = usedMargin + 15;
            x = usedMargin;
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

  const handleThemeSuggest = (theme: string) => {
    if (!theme) return;
    const suggestions = suggestHymnsByTheme(theme, songs, 10);
    if (suggestions && suggestions.length) {
      setSearchResults(suggestions.map(s => ({ title: s.title, artist: s.artist, source: s.source || 'Biblioteca' })));
      setShowResults(true);
      setSearchQuery(theme);
    } else {
      setSearchResults([]);
      setShowResults(false);
      alert('Nenhum hino encontrado para este tema na sua biblioteca.');
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
              <span className="font-bold text-white text-xl tracking-tight font-maestra">Regentify</span>
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
                handleThemeSuggest={handleThemeSuggest}
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
              <span className="font-bold text-white tracking-tight font-maestra">Regentify</span>
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
                <li><a href="https://wa.me/5511966740577" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">WhatsApp: (11) 96674-0577</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-[#2C2E33] text-center text-[10px] text-[#5C5F66] uppercase tracking-widest font-bold">
          © 2026 Regentify • Todos os direitos reservados
        </div>
      </footer>

    </div>
  );
}
