/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { getSubscription } from './lib/subscription';
import { ExpirationBanner } from './components/ui/ExpirationBanner';
import { PlanScreen } from './components/auth/PlanScreen';

import { User, Song, Setlist, FirestoreErrorInfo } from './types';
import jsPDF from 'jspdf';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { formatLyrics, plainTextToHtml } from './lib/lyrics';
import { cn } from './lib/utils';
import Fuse from 'fuse.js';
import { suggestHymnsByTheme } from './lib/themes';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Sun, Moon, LogOut, Loader2 } from 'lucide-react';
import { LoginView } from './components/auth/LoginView';
import { HomeView } from './components/home/HomeView';
import { NotesView } from './components/home/NotesView';
import { CommitmentsView } from './components/home/CommitmentsView';
import { EditorView } from './components/editor/EditorView';
import { LibraryView } from './components/library/LibraryView';
import { SetlistView } from './components/setlist/SetlistView';
import { ConductorKitCard } from './components/editor/ConductorKitCard';
import { WarmupView } from './components/warmup/WarmupView';
import { PresentationView } from './components/presentation/PresentationView';

export type View =
  | 'home'
  | 'editor'
  | 'library'
  | 'setlists'
  | 'conductor'
  | 'warmup'
  | 'presentation'
  | 'notes'
  | 'commitments';

const OperationType = {
  GET: 'GET',
  WRITE: 'WRITE',
  DELETE: 'DELETE',
} as const;

type OperationType = typeof OperationType[keyof typeof OperationType];

async function fetchLyricsFree(q: string): Promise<any> {
  const qLower = q.toLowerCase().trim();
  const results: Array<{ title: string; artist: string; source: string; extra?: any }> = [];

  const toSlug = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

  const separators = [' - ', ' – ', ' — ', ' by ', ' de '];
  for (const sep of separators) {
    if (q.includes(sep)) {
      const parts = q.split(sep).map((s) => s.trim()).filter(Boolean);
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
          // ignore
        }
      }
      break;
    }
  }

  try {
    const lrRes = await fetch(`/api/lrclib/search?q=${encodeURIComponent(q)}`);
    if (lrRes.ok) {
      const data = await lrRes.json();
      const items = data.results || data.data || data.items || data;
      if (Array.isArray(items) && items.length) {
        items.forEach((it: any) => {
          const title = it.title || it.name || it.trackName || it.music || '';
          const artist = it.artistName || (it.artist && (it.artist.name || it.artist)) || it.author || '';
          if (title) {
            results.push({
              title: String(title).trim(),
              artist: String(artist).trim(),
              source: 'LRCLIB',
              extra: it,
            });
          }
        });
      }
    }
  } catch (e) {}

  try {
    const letrasRes = await fetch(`/api/letrasmus/search?q=${encodeURIComponent(q)}`);
    if (letrasRes.ok) {
      const data = await letrasRes.json();
      if (data?.results?.length > 0) {
        data.results.forEach((r: any) =>
          results.push({ title: r.title, artist: r.artist, source: 'Letras.mus.br' })
        );
      }
    }
  } catch (e) {}

  try {
    const vagalumeRes = await fetch(`/api/vagalume/search?q=${encodeURIComponent(q)}`);
    if (vagalumeRes.ok) {
      const data = await vagalumeRes.json();
      if (data?.results?.length > 0) {
        data.results.forEach((r: any) =>
          results.push({ title: r.title, artist: r.artist, source: 'Vagalume' })
        );
      }
    }
  } catch (e) {}

  try {
    const ovhRes = await fetch(`/api/lyrics-ovh/suggest?q=${encodeURIComponent(q)}`);
    if (ovhRes.ok) {
      const data = await ovhRes.json();
      const items = data.data || data.results || [];
      if (Array.isArray(items) && items.length) {
        items.slice(0, 5).forEach((r: any) =>
          results.push({
            title: r.title,
            artist: (r.artist && (r.artist.name || r.artist)) || '',
            source: 'Lyrics.ovh',
          })
        );
      }
    }
  } catch (e) {}

  if (results.length === 0) return { results: [] };

  try {
    const fuse = new Fuse(results, {
      keys: ['title', 'artist'],
      threshold: 0.4,
      ignoreLocation: true,
    });

    const fuseRes = fuse.search(q);
    const ranked = fuseRes.map((r) => ({ ...r.item, score: r.score }));

    ranked.sort((a, b) => {
      const aExact =
        a.title.toLowerCase() === qLower ? 1 : a.title.toLowerCase().includes(qLower) ? 0.5 : 0;
      const bExact =
        b.title.toLowerCase() === qLower ? 1 : b.title.toLowerCase().includes(qLower) ? 0.5 : 0;

      if (aExact !== bExact) return bExact - aExact;

      const aScore = typeof a.score === 'number' ? a.score : 1;
      const bScore = typeof b.score === 'number' ? b.score : 1;
      return aScore - bScore;
    });

    return {
      results: ranked.slice(0, 10).map((r) => ({
        title: r.title,
        artist: r.artist,
        source: r.source,
      })),
    };
  } catch (e) {
    const seen = new Set<string>();
    const dedup: any[] = [];

    results
      .filter((r) => r.source === 'LRCLIB')
      .concat(results.filter((r) => r.source !== 'LRCLIB'))
      .forEach((r) => {
        const key = `${r.title}|${r.artist}`.toLowerCase();
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
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Subscription = {
  email: string;
  plan: 'monthly' | 'yearly';
  expiresAt: string;
  status: 'active' | 'inactive';
};

function isSubscriptionValid(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status !== 'active') return false;
  if (new Date(sub.expiresAt) < new Date()) return false;
  return true;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [currentSong, setCurrentSong] = useState<Partial<Song>>({
    title: '',
    artist: '',
    content: '',
    sections: [],
  });

  const [isPresenting, setIsPresenting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [fontSize, setFontSize] = useState(48);
  const [highlightVoice, setHighlightVoice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [pdfConfig, setPdfConfig] = useState({
    columns: 'auto' as 'auto' | '1' | '2',
    fontSize: 10,
  });

  const editorRef = useRef<any>(null);

  const [librarySearch, setLibrarySearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editorMode, setEditorMode] = useState<'search' | 'tools'>('search');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser?.email) {
        const sub = await getSubscription(currentUser.email);
        setSubscription(sub as Subscription);
      } else {
        setSubscription(null);
      }

      setSubscriptionChecked(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    if (!user) {
      setSongs([]);
      setSetlists([]);
      return;
    }

    const songsRef = collection(db, `users/${user.uid}/songs`);
    const qSongs = query(songsRef, orderBy('updatedAt', 'desc'));

    const unsubscribeSongs = onSnapshot(
      qSongs,
      (snapshot) => {
        const loadedSongs: Song[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
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
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/songs`);
      }
    );

    const setlistsRef = collection(db, `users/${user.uid}/setlists`);
    const qSetlists = query(setlistsRef, orderBy('updatedAt', 'desc'));

    const unsubscribeSetlists = onSnapshot(
      qSetlists,
      (snapshot) => {
        const loadedSetlists: Setlist[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedSetlists.push({
            id: data.id,
            title: data.title,
            date: data.date || '',
            songIds: data.songIds || [],
            updatedAt: data.updatedAt,
          } as Setlist);
        });
        setSetlists(loadedSetlists);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/setlists`);
      }
    );

    return () => {
      unsubscribeSongs();
      unsubscribeSetlists();
    };
  }, [user]);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
      song.artist.toLowerCase().includes(librarySearch.toLowerCase())
  );

  const saveSetlists = async (newSetlists: Setlist[]) => {
    if (!user) return;

    const newIds = new Set(newSetlists.map((s) => s.id));

    const addedOrUpdated = newSetlists.filter((s) => {
      const old = setlists.find((oldS) => oldS.id === s.id);
      return !old || old.updatedAt !== s.updatedAt;
    });

    const deleted = setlists.filter((s) => !newIds.has(s.id));

    try {
      for (const s of addedOrUpdated) {
        const docRef = doc(db, `users/${user.uid}/setlists/${s.id}`);
        await setDoc(docRef, {
          id: s.id,
          title: s.title,
          date: s.date || '',
          songIds: s.songIds || [],
          updatedAt: s.updatedAt || Date.now(),
          userId: user.uid,
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
      userId: user.uid,
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
      const docPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const margin = 20;
      const pageWidth = docPdf.internal.pageSize.getWidth();
      const pageHeight = docPdf.internal.pageSize.getHeight();

      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(22);
      docPdf.setTextColor(200, 0, 0);
      docPdf.text(currentSong.title || 'Sem Título', margin, margin + 10);

      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(12);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text(currentSong.artist || 'Artista Desconhecido', margin, margin + 18);

      docPdf.setDrawColor(220, 220, 220);
      docPdf.line(margin, margin + 22, pageWidth - margin, margin + 22);

      const decodeHtml = (html: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
      };

      let content = currentSong.content || '';
      try {
        content = decodeHtml(content);
      } catch (e) {}

      content = content.replace(/&nbsp;/g, ' ');
      content = content.replace(/\u00A0/g, ' ').replace(/\s{2,}/g, ' ');

      const extractLinesWithFormatting = (html: string) => {
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

        text = text.replace(/<(?!b\b|\/b\b|i\b|\/i\b|span\b|\/span\b)[^>]*>/gi, '');
        return text.split('\n');
      };

      const lines = extractLinesWithFormatting(content);

      let localFontSize = pdfConfig.fontSize;
      let useColumns = false;

      if (pdfConfig.columns === '2') {
        useColumns = true;
      } else if (pdfConfig.columns === 'auto') {
        useColumns = lines.length > 45;
      }

      const headerBase = 30;
      const footerBase = 20;
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
          const isHeader =
            (plainTextLine.startsWith('[') && plainTextLine.endsWith(']')) ||
            /^(refrão|coro|verso|ponte|intro|final|chorus|verse|bridge|outro|refrão\s*\d+|coro\s*\d+|verso\s*\d+|ponte\s*\d+|chorus\s*\d+|verse\s*\d+|bridge\s*\d+)/i.test(
              plainTextLine
            );

          const base = isHeader ? fs + 2 : fs;
          const lh = base * lineFactor + 1;
          total += lh + (isHeader ? 2 : 0);
        }
        return total;
      };

      for (const cols of useColumns ? [2, 1] : [1, 2]) {
        for (let m = initialMargin; m >= minMargin; m -= 2) {
          const availableH = pageHeight - m - headerBase - footerBase;
          for (let fs = pdfConfig.fontSize; fs >= minFontSize; fs -= 1) {
            for (const lineFactor of [0.6, 0.55, 0.5]) {
              const totalH = estimateTotalHeight(fs, lineFactor);
              const perColH = cols === 2 ? totalH / 2 : totalH;
              if (perColH <= availableH) {
                localFontSize = fs;
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

      const usedMargin = finalMargin;
      docPdf.setFontSize(localFontSize);

      let y = usedMargin + headerBase;
      let x = usedMargin;
      const gutter = 12;
      const colWidth = (pageWidth - usedMargin * 2 - gutter) / 2;

      function hexToRgb(color: string): number[] | null {
        if (color.startsWith('#')) {
          let hex = color.replace('#', '');
          if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
          if (hex.length !== 6) return null;
          const num = parseInt(hex, 16);
          return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        } else if (color.startsWith('rgb')) {
          const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
        }
        return null;
      }

      const renderFormattedText = (
        text: string,
        startX: number,
        startY: number,
        baseFont: string,
        baseColor: number[]
      ) => {
        const parts = text.split(/(<\/?b>|<\/?i>|<span[^>]*>|<\/span>)/i);
        let currentX = startX;
        let isBold = baseFont === 'bold';
        let isItalic = baseFont === 'italic';
        let color = baseColor;
        const colorStack: number[][] = [];
        const boldStack: boolean[] = [];

        parts.forEach((part) => {
          if (!part) return;

          const lowerPart = part.toLowerCase();

          if (lowerPart === '<b>') {
            boldStack.push(isBold);
            isBold = true;
          } else if (lowerPart === '</b>') {
            isBold = boldStack.pop() || false;
          } else if (lowerPart === '<i>') {
            isItalic = true;
          } else if (lowerPart === '</i>') {
            isItalic = false;
          } else if (lowerPart.startsWith('<span')) {
            const dv = part.match(/data-voice=["']?([^"'\s>]+)["']?/i);
            if (dv?.[1]) {
              colorStack.push(color);
              boldStack.push(isBold);
              color = [236, 64, 122];
              isBold = true;
            } else if (lowerPart.includes('color:')) {
              const match = part.match(/color:([^;"'>]+)/i);
              if (match) {
                colorStack.push(color);
                boldStack.push(isBold);
                color = hexToRgb(match[1].trim()) || color;
              }
            } else {
              colorStack.push(color);
              boldStack.push(isBold);
            }
          } else if (lowerPart === '</span>') {
            color = colorStack.pop() || baseColor;
            isBold = boldStack.pop() || (baseFont === 'bold');
          } else {
            let fontStyle = 'normal';
            if (isBold && isItalic) fontStyle = 'bolditalic';
            else if (isBold) fontStyle = 'bold';
            else if (isItalic) fontStyle = 'italic';

            docPdf.setFont('helvetica', fontStyle);
            docPdf.setTextColor(color[0], color[1], color[2]);
            docPdf.text(part, currentX, startY);
            currentX += docPdf.getTextWidth(part);
          }
        });

        docPdf.setFont('helvetica', baseFont);
        docPdf.setTextColor(baseColor[0], baseColor[1], baseColor[2]);
      };

      lines.forEach((line: string) => {
        const cleanLine = line.trim();
        if (!cleanLine && line !== '') return;

        const plainTextLine = cleanLine.replace(/<[^>]*>?/gm, '').trim();

        const isHeader =
          (plainTextLine.startsWith('[') && plainTextLine.endsWith(']')) ||
          /^(refrão|coro|verso|ponte|intro|final|chorus|verse|bridge|outro|refrão\s*\d+|coro\s*\d+|verso\s*\d+|ponte\s*\d+|chorus\s*\d+|verse\s*\d+|bridge\s*\d+)/i.test(
            plainTextLine
          );

        if (isHeader) {
          docPdf.setFont('helvetica', 'bold');
          docPdf.setFontSize(localFontSize + 2);
          docPdf.setTextColor(51, 154, 240);
          y += 4;
        } else {
          docPdf.setFont('helvetica', 'normal');
          docPdf.setFontSize(localFontSize);
          docPdf.setTextColor(0, 0, 0);
        }

        if (y > pageHeight - usedMargin - 10) {
          if (useColumns && x === usedMargin) {
            x = usedMargin + colWidth + gutter;
            y = usedMargin + headerBase;
          } else {
            docPdf.addPage();
            y = usedMargin + headerBase;
            x = usedMargin;
          }
        }

        const voiceMatch = plainTextLine.match(/^\[([SATB])\]/i);
        if (voiceMatch) {
          const part = voiceMatch[1].toUpperCase();
          docPdf.setFont('helvetica', 'bold');
          docPdf.setTextColor(51, 154, 240);
          docPdf.text(`${part}: `, x, y);

          const partWidth = docPdf.getTextWidth(`${part}: `);
          const restFormatted = cleanLine.replace(/^.*?\[[SATB]\].*?\s*/i, '');
          renderFormattedText(restFormatted, x + partWidth, y, 'normal', [0, 0, 0]);
        } else {
          renderFormattedText(
            cleanLine,
            x,
            y,
            isHeader ? 'bold' : 'normal',
            isHeader ? [51, 154, 240] : [0, 0, 0]
          );
        }

        y += (isHeader ? localFontSize + 2 : localFontSize) * 0.6 + 1;
        if (isHeader) y += 2;
      });

      const totalPages = docPdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        docPdf.setPage(i);
        docPdf.setFontSize(8);
        docPdf.setTextColor(150, 150, 150);
        docPdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, {
          align: 'center',
        });
      }

      docPdf.save(`${currentSong.title || 'musica'}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Verifique se o conteúdo da música é válido.');
    }
  };

  const handleQuickSearch = async (q: string) => {
    if (!q.trim()) return;

    setIsSearching(true);
    setShowResults(false);

    const separators = [' - ', ' – ', ' — ', ' by ', ' de '];
    let guessedArtist = '';
    let guessedTitle = '';

    for (const sep of separators) {
      if (q.includes(sep)) {
        const parts = q.split(sep).map((s) => s.trim());
        if (sep === ' by ' || sep === ' de ') {
          [guessedTitle, guessedArtist] = parts;
        } else {
          [guessedArtist, guessedTitle] = parts;
        }
        break;
      }
    }

    if (guessedArtist || guessedTitle) {
      setCurrentSong((prev) => ({
        ...prev,
        title: guessedTitle || prev.title,
        artist: guessedArtist || prev.artist,
      }));
    }

    try {
      const res: any = await fetchLyricsFree(q);

      if (res.results) {
        setSearchResults(res.results);
        setShowResults(true);
      } else if (res.content) {
        const content = plainTextToHtml(res.content);
        setCurrentSong((prev) => ({
          ...prev,
          title: res.title || prev.title,
          artist: res.artist || prev.artist,
          content,
        }));
        setSearchQuery('');
      }
    } catch (err: any) {
      alert(err.message || 'Música não encontrada. Tente digitar o nome da música ou Artista - Música');
    } finally {
      setIsSearching(false);
    }
  };

  const handleThemeSuggest = (themeName: string) => {
    if (!themeName) return;

    const suggestions = suggestHymnsByTheme(themeName, songs, 10);
    if (suggestions?.length) {
      setSearchResults(
        suggestions.map((s) => ({
          title: s.title,
          artist: s.artist,
          source: s.source || 'Biblioteca',
        }))
      );
      setShowResults(true);
      setSearchQuery(themeName);
    } else {
      setSearchResults([]);
      setShowResults(false);
      alert('Nenhum hino encontrado para este tema na sua biblioteca.');
    }
  };

  const handleSelectResult = async (result: any) => {
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
              artist: lyricsData.art.name,
            };
          }
        }
        return null;
      };

      const fetchFromLyricsOvh = async () => {
        const response = await fetch(
          `/api/lyrics-ovh/${encodeURIComponent(result.artist)}/${encodeURIComponent(result.title)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.lyrics) {
            return { lyrics: data.lyrics, title: result.title, artist: result.artist };
          }
        }
        return null;
      };

      const fetchFromLrclib = async () => {
        const response = await fetch(
          `/api/lrclib?artist=${encodeURIComponent(result.artist)}&title=${encodeURIComponent(result.title)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.plainLyrics) {
            return {
              lyrics: data.plainLyrics,
              title: data.name || data.trackName || result.title,
              artist: data.artistName || result.artist,
            };
          }
        }
        return null;
      };

      if (result.source === 'Vagalume') {
        const data = await fetchFromVagalume();
        if (data) {
          lyrics = data.lyrics;
          title = data.title || title;
          artist = data.artist || artist;
        } else {
          const fallbackData = await fetchFromLrclib();
          if (fallbackData) {
            lyrics = fallbackData.lyrics;
            title = fallbackData.title || title;
            artist = fallbackData.artist || artist;
          } else {
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
          const fallbackData = await fetchFromVagalume();
          if (fallbackData) {
            lyrics = fallbackData.lyrics;
            title = fallbackData.title || title;
            artist = fallbackData.artist || artist;
          } else {
            const ovhData = await fetchFromLyricsOvh();
            if (ovhData) {
              lyrics = ovhData.lyrics;
              title = ovhData.title || title;
              artist = ovhData.artist || artist;
            }
          }
        }
      } else {
        const data = await fetchFromLyricsOvh();
        if (data) {
          lyrics = data.lyrics;
          title = data.title || title;
          artist = data.artist || artist;
        } else {
          const fallbackData = await fetchFromLrclib();
          if (fallbackData) {
            lyrics = fallbackData.lyrics;
            title = fallbackData.title || title;
            artist = fallbackData.artist || artist;
          } else {
            const vagalumeData = await fetchFromVagalume();
            if (vagalumeData) {
              lyrics = vagalumeData.lyrics;
              title = vagalumeData.title || title;
              artist = vagalumeData.artist || artist;
            }
          }
        }
      }

      const finalTitle = title || result.title || 'Sem Título';
      const finalArtist = artist || result.artist || 'Artista Desconhecido';

      setCurrentSong((prev) => ({
        ...prev,
        title: finalTitle,
        artist: finalArtist,
        content: lyrics ? plainTextToHtml(lyrics) : prev.content || '',
        key: prev.key || 'C',
      }));

      setSearchQuery('');

      if (!lyrics) {
        alert(
          'A letra não foi encontrada nas bases gratuitas, mas o título e artista foram preenchidos. Você pode colar a letra manualmente.'
        );
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar letra.');
    } finally {
      setIsSearching(false);
    }
  };

  if (loading || !subscriptionChecked) {
    return <div className="flex items-center justify-center min-h-screen text-white">Carregando...</div>;
  }

  if (!user) {
    return <LoginView onSuccess={() => setView('home')} />;
  }

  const ADMIN_EMAIL = 'andredesenvolvedorti@gmail.com';

  if (user.email === ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-[#141517] text-[#C1C2C5] font-sans selection:bg-primary/30">
        <div className="bg-green-900 text-green-200 px-4 py-2 text-center">
          Acesso total de administrador
        </div>

        {subscription?.expiresAt && <ExpirationBanner expiresAt={subscription.expiresAt} />}

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
                <span className="font-bold text-white text-xl tracking-tight font-maestra">
                  Regentify
                </span>
              </div>

              <div className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => setView('home')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    view === 'home' ? 'bg-[#2C2E33] text-white' : 'hover:bg-[#2C2E33] text-[#909296]'
                  )}
                >
                  Início
                </button>
                <button
                  onClick={() => setView('library')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    view === 'library'
                      ? 'bg-[#2C2E33] text-white'
                      : 'hover:bg-[#2C2E33] text-[#909296]'
                  )}
                >
                  Biblioteca
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 text-[#909296] hover:text-white transition-colors"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button
                onClick={() => signOut(auth)}
                className="p-2 text-[#909296] hover:text-white transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-12">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <HomeView
                  setView={setView}
                  setEditorMode={setEditorMode}
                  setCurrentSong={setCurrentSong}
                  songs={songs}
                  user={user}
                  subscription={subscription}
                />
              </motion.div>
            )}

            {view === 'notes' && (
              <motion.div
                key="notes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <NotesView setView={setView} />
              </motion.div>
            )}

            {view === 'commitments' && (
              <motion.div
                key="commitments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <CommitmentsView setView={setView} />
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
          </AnimatePresence>
        </main>

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
                Sua ferramenta definitiva para regência e preparação vocal. Feito para regentes, por regentes.
              </p>
            </div>

            <div className="flex gap-12">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#5C5F66]">
                  Ferramentas
                </h4>
                <ul className="text-sm space-y-2">
                  <li>
                    <button
                      onClick={() => setView('editor')}
                      className="hover:text-primary transition-colors"
                    >
                      Editor
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setView('editor')}
                      className="hover:text-primary transition-colors"
                    >
                      Formatador
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setView('library')}
                      className="hover:text-primary transition-colors"
                    >
                      Biblioteca
                    </button>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#5C5F66]">
                  Suporte
                </h4>
                <ul className="text-sm space-y-2">
                  <li>
                    <button
                      onClick={() => setShowHelp(true)}
                      className="hover:text-primary transition-colors"
                    >
                      Ajuda
                    </button>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Privacidade
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-[#2C2E33] text-center text-[10px] text-[#5C5F66] uppercase tracking-widest font-bold">
            © 2026 Regentify • Todos os direitos reservados
          </div>
        </footer>

        {showHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowHelp(false)} />
            <div className="relative bg-bg-card rounded-lg p-6 w-full max-w-md text-left shadow-xl border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Ajuda & Suporte</h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-sm text-[#909296] hover:text-white"
                >
                  Fechar
                </button>
              </div>

              <p className="mb-4 text-sm">Para suporte rápido, envie uma mensagem para:</p>

              <a
                href="https://wa.me/5511966740577"
                target="_blank"
                rel="noreferrer"
                className="text-primary font-bold"
              >
                WhatsApp: (11) 96674-0577
              </a>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => window.open('https://wa.me/5511966740577', '_blank')}
                  className="bg-[#25D366] text-white px-4 py-2 rounded-lg"
                >
                  Abrir no WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isSubscriptionValid(subscription)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <span className="font-bold text-white text-2xl tracking-tight font-maestra mb-4">
          Regentify
        </span>
        <h2 className="text-2xl font-bold text-white">Você não possui assinatura ativa</h2>
        <p className="text-gray-400">Faça a compra de um plano para liberar o acesso.</p>
        <PlanScreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141517] text-[#C1C2C5] font-sans selection:bg-primary/30">
      {subscription?.expiresAt && <ExpirationBanner expiresAt={subscription.expiresAt} />}

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
              <span className="font-bold text-white text-xl tracking-tight font-maestra">
                Regentify
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => setView('home')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  view === 'home' ? 'bg-[#2C2E33] text-white' : 'hover:bg-[#2C2E33] text-[#909296]'
                )}
              >
                Início
              </button>

              <button
                onClick={() => setView('library')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  view === 'library'
                    ? 'bg-[#2C2E33] text-white'
                    : 'hover:bg-[#2C2E33] text-[#909296]'
                )}
              >
                Biblioteca
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-[#909296] hover:text-white transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
              onClick={() => signOut(auth)}
              className="p-2 text-[#909296] hover:text-white transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <HomeView
                setView={setView}
                setEditorMode={setEditorMode}
                setCurrentSong={setCurrentSong}
                songs={songs}
                user={user}
              />
            </motion.div>
          )}

          {view === 'notes' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <NotesView setView={setView} />
            </motion.div>
          )}

          {view === 'commitments' && (
            <motion.div
              key="commitments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <CommitmentsView setView={setView} />
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
        </AnimatePresence>
      </main>

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
              Sua ferramenta definitiva para regência e preparação vocal. Feito para regentes, por regentes.
            </p>
          </div>

          <div className="flex gap-12">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#5C5F66]">
                Ferramentas
              </h4>
              <ul className="text-sm space-y-2">
                <li>
                  <button
                    onClick={() => setView('editor')}
                    className="hover:text-primary transition-colors"
                  >
                    Editor
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setView('editor')}
                    className="hover:text-primary transition-colors"
                  >
                    Formatador
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setView('library')}
                    className="hover:text-primary transition-colors"
                  >
                    Biblioteca
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#5C5F66]">
                Suporte
              </h4>
              <ul className="text-sm space-y-2">
                <li>
                  <button
                    onClick={() => setShowHelp(true)}
                    className="hover:text-primary transition-colors"
                  >
                    Ajuda
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Privacidade
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-[#2C2E33] text-center text-[10px] text-[#5C5F66] uppercase tracking-widest font-bold">
          © 2026 Regentify • Todos os direitos reservados
        </div>
      </footer>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowHelp(false)} />
          <div className="relative bg-bg-card rounded-lg p-6 w-full max-w-md text-left shadow-xl border border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Ajuda & Suporte</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-sm text-[#909296] hover:text-white"
              >
                Fechar
              </button>
            </div>

            <p className="mb-4 text-sm">Para suporte rápido, envie uma mensagem para:</p>

            <a
              href="https://wa.me/5511966740577"
              target="_blank"
              rel="noreferrer"
              className="text-primary font-bold"
            >
              WhatsApp: (11) 96674-0577
            </a>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => window.open('https://wa.me/5511966740577', '_blank')}
                className="bg-[#25D366] text-white px-4 py-2 rounded-lg"
              >
                Abrir no WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}