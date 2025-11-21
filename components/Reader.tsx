
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, ReadingSettings, THEMES, TOCItem, Highlight, HighlightColor, Bookmark } from '../types';
import { 
  updateBookProgress, updateBookPage, initSettings, saveSettings, 
  addHighlight, deleteHighlight, updateHighlightColor, updateHighlightNote, getBookHighlights,
  addBookmark, deleteBookmark, getBookBookmarks, logReadingSession, db 
} from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Settings, BrainCircuit, X, ChevronLeft, ChevronRight, 
  ZoomIn, ZoomOut, Menu, Edit, Trash2, Copy, Check, MessageSquare, StickyNote,
  Bookmark as BookmarkIcon, Clock, Star
} from 'lucide-react';

// Declare global PDFJS and Epub
declare global {
  interface Window {
    pdfjsLib: any;
    ePub: any;
  }
}

interface ReaderProps {
  book: Book;
  onClose: () => void;
  initialLocation?: { page?: number, cfi?: string };
  hasTabs?: boolean;
}

// Helper colors map for UI
const HIGHLIGHT_COLORS: {id: HighlightColor, hex: string, class: string}[] = [
  { id: 'yellow', hex: '#facc15', class: 'highlight-yellow' },
  { id: 'green', hex: '#4ade80', class: 'highlight-green' },
  { id: 'blue', hex: '#60a5fa', class: 'highlight-blue' },
  { id: 'purple', hex: '#c084fc', class: 'highlight-purple' },
  { id: 'red', hex: '#f87171', class: 'highlight-red' },
];

export const Reader: React.FC<ReaderProps> = ({ book, onClose, initialLocation, hasTabs = false }) => {
  const [settings, setSettings] = useState<ReadingSettings | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  
  // Data State
  const highlights = useLiveQuery(() => getBookHighlights(book.id), [book.id]);
  const bookmarks = useLiveQuery(() => getBookBookmarks(book.id), [book.id]);
  
  // Interactive State
  const [selectionMenu, setSelectionMenu] = useState<{x: number, y: number, text: string, range?: any, rects?: any, cfiRange?: string} | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Text Mode Refs
  const contentRef = useRef<HTMLDivElement>(null);
  
  // PDF Mode State & Refs
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPageNum, setPdfPageNum] = useState(initialLocation?.page || book.currentPage || 1);
  const [numPages, setNumPages] = useState(0);
  const [pdfRendering, setPdfRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  // EPUB Mode State & Refs
  const [epubRendition, setEpubRendition] = useState<any>(null);
  const [toc, setToc] = useState<TOCItem[]>([]);
  const epubContainerRef = useRef<HTMLDivElement>(null);
  const [epubReady, setEpubReady] = useState(false);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);
  
  // Controls timeout
  const controlsTimeoutRef = useRef<any>(null);

  // --- SESSION TRACKING STATE ---
  const sessionStartTime = useRef<number>(Date.now());
  const activeDuration = useRef<number>(0);
  const lastActivity = useRef<number>(Date.now());
  const isIdle = useRef<boolean>(false);
  const idleTimeout = useRef<any>(null);

  // Initialize Settings
  useEffect(() => {
    initSettings().then(setSettings);
  }, []);

  // Save Settings on change
  useEffect(() => {
    if (settings) {
      saveSettings(settings);
    }
  }, [settings]);

  // Reset local state when book changes
  useEffect(() => {
    setPdfPageNum(initialLocation?.page || book.currentPage || 1);
    setEpubReady(false);
    setPdfDoc(null);
    setPdfRendering(false);
    setEpubRendition(null);
  }, [book.id]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // --- SESSION & IDLE TRACKING ---
  const handleUserActivity = useCallback(() => {
    const now = Date.now();
    
    if (isIdle.current) {
      isIdle.current = false;
      lastActivity.current = now;
    }
    
    lastActivity.current = now;
    
    if (idleTimeout.current) clearTimeout(idleTimeout.current);
    // Set idle after 60 seconds of no interaction
    idleTimeout.current = setTimeout(() => {
       isIdle.current = true;
    }, 60000); 
  }, []);

  useEffect(() => {
     const interval = setInterval(() => {
        if (!isIdle.current) {
           activeDuration.current += 1000;
        }
     }, 1000);

     window.addEventListener('mousemove', handleUserActivity);
     window.addEventListener('keydown', handleUserActivity);
     window.addEventListener('click', handleUserActivity);
     window.addEventListener('scroll', handleUserActivity);
     window.addEventListener('touchstart', handleUserActivity);

     return () => {
        clearInterval(interval);
        if (idleTimeout.current) clearTimeout(idleTimeout.current);
        window.removeEventListener('mousemove', handleUserActivity);
        window.removeEventListener('keydown', handleUserActivity);
        window.removeEventListener('click', handleUserActivity);
        window.removeEventListener('scroll', handleUserActivity);
        window.removeEventListener('touchstart', handleUserActivity);
        
        if (activeDuration.current > 5000) { 
           logReadingSession(book.id, activeDuration.current);
        }
     };
  }, [book.id, handleUserActivity]);

  // --------------------------------------------------------------------------
  // BOOKMARKING LOGIC
  // --------------------------------------------------------------------------
  
  const getCurrentBookmark = () => {
    if (!bookmarks) return null;
    if (book.format === 'pdf') return bookmarks.find(b => b.page === pdfPageNum);
    return null;
  };

  const activeBookmark = getCurrentBookmark();

  const handleToggleBookmark = async (type: 'standard' | 'favorite' = 'standard') => {
    if (activeBookmark) {
      await deleteBookmark(activeBookmark.id);
      showToast("Bookmark removed");
    } else {
      let thumbnail: string | undefined;
      let textSnippet = "";
      let positionData: Partial<Bookmark> = {};

      if (book.format === 'pdf') {
         positionData = { page: pdfPageNum, percentage: (pdfPageNum / numPages) * 100 };
         textSnippet = `Page ${pdfPageNum}`;
         
         if (canvasRef.current) {
           try {
             const thumbCanvas = document.createElement('canvas');
             const ctx = thumbCanvas.getContext('2d');
             const srcCanvas = canvasRef.current;
             const scale = 0.2; 
             thumbCanvas.width = srcCanvas.width * scale;
             thumbCanvas.height = srcCanvas.height * scale;
             ctx?.drawImage(srcCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
             thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);
           } catch (e) {
             console.warn("Thumbnail generation failed", e);
           }
         }
      } 
      else if (book.format === 'epub' && epubRendition) {
         const loc = epubRendition.currentLocation();
         if (loc && loc.start) {
            positionData = { cfi: loc.start.cfi, percentage: loc.start.percentage * 100 };
            try {
               const range = await epubRendition.getRange(loc.start.cfi);
               textSnippet = range.toString().substring(0, 100) + "...";
            } catch (e) {
               textSnippet = `Chapter location ${Math.round(loc.start.percentage * 100)}%`;
            }
         }
      }
      else {
         textSnippet = "Text selection"; 
         positionData = { percentage: book.progress };
      }

      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        bookId: book.id,
        type,
        timestamp: Date.now(),
        percentage: positionData.percentage || 0,
        page: positionData.page,
        cfi: positionData.cfi,
        textSnippet,
        thumbnail
      };

      await addBookmark(newBookmark);
      showToast(type === 'favorite' ? "Added to Favorites" : "Bookmark added");
    }
  };

  const handleJumpToBookmark = (b: Bookmark) => {
     if (book.format === 'pdf' && b.page) {
        setPdfPageNum(b.page);
     } else if (book.format === 'epub' && b.cfi && epubRendition) {
        epubRendition.display(b.cfi);
     }
     setShowBookmarksPanel(false);
  };


  // --------------------------------------------------------------------------
  // SELECTION HANDLING
  // --------------------------------------------------------------------------
  const clearSelection = () => {
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
    if (epubRendition) {
      try {
         const iframe = epubContainerRef.current?.querySelector('iframe');
         if (iframe && iframe.contentWindow) {
            iframe.contentWindow.getSelection()?.removeAllRanges();
         }
      } catch(e) {}
    }
  };

  const handleTextSelection = (e: MouseEvent | TouchEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.no-select')) return;

    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionMenu(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (book.format === 'pdf' && highlightLayerRef.current && textLayerRef.current) {
         const layerRect = textLayerRef.current.getBoundingClientRect();
         if(!textLayerRef.current.contains(range.commonAncestorContainer)) return;

         const clientRects = Array.from(range.getClientRects());
         const relativeRects = clientRects.map(r => ({
            x: (r.left - layerRect.left) / layerRect.width,
            y: (r.top - layerRect.top) / layerRect.height,
            w: r.width / layerRect.width,
            h: r.height / layerRect.height
         }));

         setSelectionMenu({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
            text,
            rects: relativeRects
         });
      } else if (book.format === 'txt' || book.format === 'md') {
         setSelectionMenu({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
            text
         });
      }
    }, 10);
  };

  useEffect(() => {
    if (book.format !== 'epub') {
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('touchend', handleTextSelection);
    }
    return () => {
        document.removeEventListener('mouseup', handleTextSelection);
        document.removeEventListener('touchend', handleTextSelection);
    };
  }, [book.format, pdfPageNum]);

  // --------------------------------------------------------------------------
  // HIGHLIGHT ACTIONS
  // --------------------------------------------------------------------------
  const createHighlight = async (color: HighlightColor) => {
    if (!selectionMenu) return;

    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      bookId: book.id,
      text: selectionMenu.text,
      color,
      createdAt: Date.now(),
      page: book.format === 'pdf' ? pdfPageNum : undefined,
      rects: selectionMenu.rects,
      range: selectionMenu.range,
      cfiRange: selectionMenu.cfiRange
    };

    await addHighlight(newHighlight);
    
    if (book.format === 'epub' && epubRendition && selectionMenu.cfiRange) {
       epubRendition.annotations.add('highlight', selectionMenu.cfiRange, {}, null, `highlight-${color}`);
    }

    clearSelection();
  };

  const handleDeleteHighlight = async (id: string) => {
    if (book.format === 'epub' && epubRendition) {
       const hl = highlights?.find(h => h.id === id);
       if (hl?.cfiRange) epubRendition.annotations.remove(hl.cfiRange, 'highlight');
    }
    await deleteHighlight(id);
    setActiveHighlightId(null);
  };

  const handleCopy = () => {
    if (selectionMenu?.text) {
      navigator.clipboard.writeText(selectionMenu.text);
      showToast("Copied to clipboard");
      clearSelection();
    } else if (activeHighlightId) {
       const hl = highlights?.find(h => h.id === activeHighlightId);
       if (hl) {
         navigator.clipboard.writeText(hl.text);
         showToast("Copied to clipboard");
         setActiveHighlightId(null);
       }
    }
  };

  // --------------------------------------------------------------------------
  // EPUB ENGINE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (book.format === 'epub' && window.ePub && settings && epubContainerRef.current) {
      const loadEpub = async () => {
        try {
          const arrayBuffer = await book.file.arrayBuffer();
          const bookObj = window.ePub(arrayBuffer);
          
          const rendition = bookObj.renderTo(epubContainerRef.current, {
            width: '100%', height: '100%', flow: 'paginated', manager: 'default'
          });

          const themes = {
             day: { body: { color: '#1a1a1a', background: '#fafafa' }, '::selection': { background: 'rgba(0, 102, 255, 0.3)' } },
             night: { body: { color: '#ffffff', background: '#0a0a0a' }, '::selection': { background: 'rgba(0, 102, 255, 0.3)' } },
             sepia: { body: { color: '#3e2723', background: '#f4ecd8' }, '::selection': { background: 'rgba(230, 81, 0, 0.3)' } },
             twilight: { body: { color: '#e0e0e0', background: '#1a0f2e' }, '::selection': { background: 'rgba(156, 136, 255, 0.3)' } },
             console: { body: { color: '#39ff14', background: '#0d1117' }, '::selection': { background: 'rgba(0, 255, 255, 0.3)' } }
          };
          Object.entries(themes).forEach(([k, v]) => rendition.themes.register(k, v));
          
          rendition.themes.default({
             '.highlight-yellow': { fill: 'rgba(250, 204, 21, 0.3)', 'mix-blend-mode': 'multiply' },
             '.highlight-green': { fill: 'rgba(74, 222, 128, 0.3)', 'mix-blend-mode': 'multiply' },
             '.highlight-blue': { fill: 'rgba(96, 165, 250, 0.3)', 'mix-blend-mode': 'multiply' },
             '.highlight-purple': { fill: 'rgba(192, 132, 252, 0.3)', 'mix-blend-mode': 'multiply' },
             '.highlight-red': { fill: 'rgba(248, 113, 113, 0.3)', 'mix-blend-mode': 'multiply' }
          });

          await bookObj.ready;
          const startLoc = initialLocation?.cfi || book.currentCfi || undefined;
          await rendition.display(startLoc);
          setEpubRendition(rendition);
          setEpubReady(true);
          
          const navigation = await bookObj.loaded.navigation;
          setToc(navigation.toc);

          rendition.on('relocated', (location: any) => {
            const percentage = location.start.percentage * 100;
            const cfi = location.start.cfi;
            setCurrentCfi(cfi);
            updateBookProgress(book.id, percentage, cfi);
          });

          rendition.on('click', () => {
             setShowControls(prev => !prev);
             setSelectionMenu(null);
             setActiveHighlightId(null);
          });

          rendition.on('selected', (cfiRange: string, contents: any) => {
            const range = contents.window.getSelection().getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const iframeRect = epubContainerRef.current?.querySelector('iframe')?.getBoundingClientRect();
            if (iframeRect) {
               setSelectionMenu({
                  x: rect.left + iframeRect.left + rect.width / 2,
                  y: rect.top + iframeRect.top - 10,
                  text: range.toString(),
                  cfiRange
               });
            }
          });

          if (highlights) {
             highlights.forEach(hl => {
                if (hl.cfiRange) {
                   rendition.annotations.add('highlight', hl.cfiRange, {}, (e: any) => {
                      const rect = e.target.getBoundingClientRect();
                      const iframeRect = epubContainerRef.current?.querySelector('iframe')?.getBoundingClientRect();
                      setActiveHighlightId(hl.id);
                      if (iframeRect) {
                          setSelectionMenu({
                             x: rect.left + iframeRect.left + rect.width/2,
                             y: rect.top + iframeRect.top - 10,
                             text: hl.text,
                             cfiRange: hl.cfiRange 
                          });
                      }
                   }, `highlight-${hl.color}`);
                }
             });
          }

          return () => { if(bookObj) bookObj.destroy(); };
        } catch (error) { console.error("EPUB init error:", error); }
      };
      loadEpub();
    }
  }, [book.id, book.format]); // CRITICAL FIX: Changed [book.format] to [book.id, book.format]

  useEffect(() => {
    if (epubRendition && settings) {
      epubRendition.themes.select(settings.theme);
      epubRendition.themes.fontSize(`${settings.fontSize}px`);
      epubRendition.themes.font(settings.fontFamily === 'sans' ? 'Inter, sans-serif' : settings.fontFamily === 'serif' ? 'Playfair Display, serif' : 'JetBrains Mono, monospace');
    }
  }, [settings, epubRendition]);

  // --------------------------------------------------------------------------
  // PDF ENGINE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (book.format === 'pdf' && window.pdfjsLib) {
      const loadPdf = async () => {
        const arrayBuffer = await book.file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        const startPage = initialLocation?.page || book.currentPage || 1;
        if (startPage <= pdf.numPages) setPdfPageNum(startPage);
      };
      loadPdf();
    }
  }, [book.id, book.format]); // CRITICAL FIX: Changed [book] to [book.id, book.format]

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !settings) return;
    const renderPage = async () => {
      if (renderTaskRef.current) await renderTaskRef.current.cancel();
      setPdfRendering(true);
      try {
        const page = await pdfDoc.getPage(pdfPageNum);
        const viewport = page.getViewport({ scale: settings.pdfScale || 1.0 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (canvas && context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderTask = page.render({ canvasContext: context, viewport });
          renderTaskRef.current = renderTask;
          await renderTask.promise;

          if (textLayerRef.current) {
             textLayerRef.current.innerHTML = '';
             textLayerRef.current.style.height = `${viewport.height}px`;
             textLayerRef.current.style.width = `${viewport.width}px`;
             textLayerRef.current.style.setProperty('--scale-factor', `${settings.pdfScale || 1.0}`);

             window.pdfjsLib.renderTextLayer({
                textContentSource: await page.getTextContent(),
                container: textLayerRef.current,
                viewport: viewport,
                textDivs: []
             });
          }
          setPdfRendering(false);
          updateBookPage(book.id, pdfPageNum, numPages);
        }
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') setPdfRendering(false);
      }
    };
    renderPage();
  }, [pdfDoc, pdfPageNum, settings?.pdfScale]);

  const changePdfPage = (delta: number) => {
    setSelectionMenu(null);
    const newPage = pdfPageNum + delta;
    if (newPage >= 1 && newPage <= numPages) setPdfPageNum(newPage);
  };
  
  // --------------------------------------------------------------------------
  // UI TIMEOUTS & AUTO HIDE
  // --------------------------------------------------------------------------
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    handleUserActivity();
    
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!showSettings && !showTOC && !showBookmarksPanel) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [showSettings, showTOC, showBookmarksPanel, handleUserActivity]);

  useEffect(() => {
    window.addEventListener('mousemove', resetControlsTimeout);
    if (book.format !== 'epub') window.addEventListener('click', resetControlsTimeout);
    window.addEventListener('keydown', resetControlsTimeout);
    return () => {
      window.removeEventListener('mousemove', resetControlsTimeout);
      window.removeEventListener('click', resetControlsTimeout);
      window.removeEventListener('keydown', resetControlsTimeout);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showSettings, showTOC, showBookmarksPanel, resetControlsTimeout]);

  if (!settings) return null;
  const theme = THEMES[settings.theme];
  const isPdf = book.format === 'pdf';
  const isEpub = book.format === 'epub';

  return (
    <div 
      className={`min-h-screen transition-colors duration-500 ${theme.bg} ${theme.text} selection:bg-blue-500/30 relative overflow-hidden`}
      style={{ paddingTop: hasTabs ? '40px' : '0px' }}
    >
      {/* TOAST */}
      <AnimatePresence>
        {toast && (
           <motion.div 
             initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
             className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full shadow-xl flex items-center gap-2"
           >
              <Check className="w-4 h-4" /> {toast}
           </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR */}
      <motion.div 
        initial={{ y: -100 }}
        animate={{ y: showControls || showSettings || showTOC || showBookmarksPanel ? 0 : -100 }}
        className={`fixed left-0 right-0 h-16 ${theme.ui} backdrop-blur-lg border-b ${theme.border} z-40 flex items-center justify-between px-4 md:px-8 shadow-sm`}
        style={{ top: hasTabs ? '0px' : '0px' }}
      >
        <div className="flex items-center gap-4">
          <button onClick={onClose} className={`p-2 rounded-full hover:bg-white/10 transition-colors ${theme.text}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          {isEpub && (
             <button onClick={() => setShowTOC(!showTOC)} className={`p-2 rounded-full hover:bg-white/10 transition-colors ${showTOC ? 'bg-blue-500 text-white' : theme.text}`}>
               <Menu className="w-5 h-5" />
             </button>
          )}
          <div className="flex flex-col">
            <h1 className="font-bold text-sm max-w-[120px] md:max-w-[300px] truncate">{book.title}</h1>
            <span className="text-xs opacity-60 truncate">{book.author}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
             <button 
               disabled 
               className="p-2 rounded-full opacity-30 cursor-not-allowed hover:bg-transparent flex items-center gap-2"
               title="Coming Soon: Mindmap Generation"
            >
              <BrainCircuit className="w-5 h-5" />
            </button>
            <div className="w-[1px] h-6 bg-current opacity-10 mx-1" />

            <button 
              onClick={() => handleToggleBookmark('standard')}
              onContextMenu={(e) => { e.preventDefault(); handleToggleBookmark('favorite'); }}
              className="p-2 rounded-full hover:bg-white/10 relative group"
            >
              <BookmarkIcon 
                 className={`w-5 h-5 transition-all duration-300 ${activeBookmark ? (activeBookmark.type === 'favorite' ? 'fill-yellow-400 text-yellow-400' : 'fill-blue-500 text-blue-500') : 'text-current opacity-50 group-hover:opacity-100'}`} 
              />
              {activeBookmark && <motion.div layoutId="bookmark-glow" className="absolute inset-0 bg-blue-500/20 blur-md rounded-full" />}
            </button>
            
             <button 
              onClick={() => setShowBookmarksPanel(!showBookmarksPanel)}
              className={`p-2 rounded-full transition-colors ${showBookmarksPanel ? 'bg-blue-500 text-white' : 'hover:bg-white/10'}`}
            >
              <StickyNote className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-full transition-all ${showSettings ? 'bg-blue-500 text-white rotate-180' : 'hover:bg-white/10'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
        </div>
      </motion.div>

      {/* CONTEXT MENU & MODALS */}
       <AnimatePresence>
        {selectionMenu && (
          <motion.div
             initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
             style={{ top: selectionMenu.y, left: selectionMenu.x, transform: 'translate(-50%, -100%)' }}
             className="fixed z-50 mb-3 flex flex-col items-center pointer-events-auto"
          >
            <div className="flex items-center gap-1 p-1.5 rounded-full glass border border-white/10 shadow-2xl bg-black/80 backdrop-blur-md">
               {HIGHLIGHT_COLORS.map(c => (
                  <button key={c.id} onClick={() => activeHighlightId ? (updateHighlightColor(activeHighlightId, c.id), setActiveHighlightId(null), setSelectionMenu(null)) : createHighlight(c.id)} className="w-6 h-6 rounded-full border border-white/10 hover:scale-125 transition-transform" style={{ backgroundColor: c.hex }} />
               ))}
               <div className="w-[1px] h-4 bg-white/20 mx-1" />
               <button onClick={() => { if (activeHighlightId) { setShowNoteModal(true); setCurrentNote(highlights?.find(h => h.id === activeHighlightId)?.note || ""); } else { createHighlight('yellow'); showToast("Highlight created"); } }} className="p-1.5 hover:bg-white/10 rounded-full text-white"><MessageSquare className="w-4 h-4" /></button>
               <button onClick={handleCopy} className="p-1.5 hover:bg-white/10 rounded-full text-white"><Copy className="w-4 h-4" /></button>
               {activeHighlightId && <button onClick={() => handleDeleteHighlight(activeHighlightId)} className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded-full text-white"><Trash2 className="w-4 h-4" /></button>}
            </div>
            <div className="w-3 h-3 bg-black/80 rotate-45 mt-[-6px] border-r border-b border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
         {showNoteModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNoteModal(false)} />
               <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative w-full max-w-md p-6 rounded-2xl glass border border-white/10 bg-[#111] shadow-2xl m-4">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><StickyNote className="w-5 h-5 text-yellow-500" /> Note</h3>
                  <textarea className="w-full h-32 bg-black/20 rounded-lg p-3 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="Add your thoughts..." value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} autoFocus />
                  <div className="flex justify-end gap-3 mt-4">
                     <button onClick={() => setShowNoteModal(false)} className="px-4 py-2 rounded-lg hover:bg-white/10 text-sm">Cancel</button>
                     <button onClick={() => { if (activeHighlightId) { updateHighlightNote(activeHighlightId, currentNote); showToast("Note saved"); setShowNoteModal(false); setSelectionMenu(null); setActiveHighlightId(null); } }} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg">Save Note</button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* SETTINGS & TOC PANELS */}
       <AnimatePresence>
        {showTOC && isEpub && (
           <>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTOC(false)} className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" />
             <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className={`fixed top-0 left-0 bottom-0 w-72 ${theme.ui} backdrop-blur-xl border-r ${theme.border} z-50 flex flex-col shadow-2xl`}>
                <div className="p-4 border-b border-current/10 flex items-center justify-between"><h2 className="font-bold">Contents</h2><button onClick={() => setShowTOC(false)}><X className="w-5 h-5" /></button></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                   {toc.map((item, i) => (
                      <div key={i}>
                         <button onClick={() => { epubRendition?.display(item.href); setShowTOC(false); }} className="text-left text-sm py-2 hover:text-blue-500 transition-colors opacity-80 hover:opacity-100">{item.label.trim() || "Chapter " + (i+1)}</button>
                         {item.subitems?.map((sub, j) => (
                            <button key={j} onClick={() => { epubRendition?.display(sub.href); setShowTOC(false); }} className="text-left block text-xs py-1.5 pl-4 hover:text-blue-500 transition-colors opacity-60 hover:opacity-100">{sub.label.trim()}</button>
                         ))}
                      </div>
                   ))}
                </div>
             </motion.div>
           </>
        )}
        
        {showSettings && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]" />
            <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className={`fixed top-0 right-0 bottom-0 w-80 md:w-96 ${theme.ui} backdrop-blur-xl border-l ${theme.border} shadow-2xl z-50 overflow-y-auto`}>
               <div className="p-6">
                 <div className="flex items-center justify-between mb-8"><h2 className="text-lg font-bold">Appearance</h2><button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button></div>
                 <div className="mb-8">
                   <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-4 block">Theme</label>
                   <div className="grid grid-cols-5 gap-3">
                     {(Object.values(THEMES)).map((t) => (
                       <button key={t.id} onClick={() => setSettings({...settings, theme: t.id})} className={`group relative flex flex-col items-center gap-2`}>
                         <div className={`w-12 h-12 rounded-full border-2 shadow-sm transition-transform group-hover:scale-110 ${t.bg} ${settings.theme === t.id ? 'border-blue-500 scale-110 ring-2 ring-blue-500/30' : 'border-transparent'}`}></div>
                         <span className="text-[10px] opacity-60 group-hover:opacity-100 transition-opacity">{t.name}</span>
                       </button>
                     ))}
                   </div>
                 </div>
                 {isPdf ? (
                    <div className="mb-8">
                      <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-4 block">Zoom</label>
                      <div className="flex items-center gap-4 bg-black/10 p-3 rounded-xl">
                        <button onClick={() => { const newScale = Math.max(0.5, Math.min(3.0, (settings.pdfScale || 1.0) - 0.25)); setSettings({ ...settings, pdfScale: newScale }); }} className="p-2 hover:bg-white/10 rounded-full"><ZoomOut className="w-5 h-5" /></button>
                        <div className="flex-1 text-center font-mono font-bold text-lg">{Math.round((settings.pdfScale || 1.0) * 100)}%</div>
                        <button onClick={() => { const newScale = Math.max(0.5, Math.min(3.0, (settings.pdfScale || 1.0) + 0.25)); setSettings({ ...settings, pdfScale: newScale }); }} className="p-2 hover:bg-white/10 rounded-full"><ZoomIn className="w-5 h-5" /></button>
                      </div>
                    </div>
                 ) : (
                 <div className="mb-8">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-4 block">Typography</label>
                    <div className="flex bg-black/10 p-1 rounded-lg mb-4">
                       {['sans', 'serif', 'mono'].map((f) => (
                         <button key={f} onClick={() => setSettings({...settings, fontFamily: f as any})} className={`flex-1 py-2 text-sm rounded-md transition-all ${settings.fontFamily === f ? 'bg-white text-black shadow-sm font-bold' : 'text-current opacity-60 hover:opacity-100'}`}>{f}</button>
                       ))}
                    </div>
                    <div className="space-y-6">
                       <input type="range" min="14" max="32" value={settings.fontSize} onChange={(e) => setSettings({...settings, fontSize: parseInt(e.target.value)})} className="w-full accent-blue-500 h-1.5 bg-current/10 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                 </div>
                 )}
               </div>
            </motion.div>
          </>
        )}

        {showBookmarksPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBookmarksPanel(false)} className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]" />
            <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className={`fixed top-0 right-0 bottom-0 w-80 md:w-96 ${theme.ui} backdrop-blur-xl border-l ${theme.border} shadow-2xl z-50 overflow-y-auto flex flex-col`}>
               <div className="p-6 border-b border-current/10 flex items-center justify-between"><h2 className="text-lg font-bold">Bookmarks</h2><button onClick={() => setShowBookmarksPanel(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button></div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {bookmarks?.length === 0 && (
                     <div className="text-center py-12 opacity-50">
                        <BookmarkIcon className="w-12 h-12 mx-auto mb-4 stroke-1" />
                        <p>No bookmarks yet</p>
                     </div>
                  )}
                  {bookmarks?.map((b) => (
                     <motion.div 
                        key={b.id}
                        layout
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="group relative bg-black/5 hover:bg-black/10 rounded-xl p-3 cursor-pointer transition-colors overflow-hidden"
                        onClick={() => handleJumpToBookmark(b)}
                     >
                        <div className="flex gap-3">
                           {b.thumbnail && (
                              <img src={b.thumbnail} alt="Preview" className="w-16 h-20 object-cover rounded border border-white/10 bg-white" />
                           )}
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                 {b.type === 'favorite' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                                 <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${b.type === 'favorite' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-400'}`}>{b.page ? `Page ${b.page}` : 'Bookmark'}</span>
                                 <span className="text-xs opacity-40 ml-auto">{new Date(b.timestamp).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm opacity-80 line-clamp-3 font-serif leading-snug">{b.textSnippet || "No preview text"}</p>
                           </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteBookmark(b.id); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0"><Trash2 className="w-3 h-3" /></button>
                     </motion.div>
                  ))}
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* MAIN RENDERER AREA */}
      <div className={`w-full h-screen transition-all duration-300 ease-in-out flex flex-col items-center ${!isPdf && !isEpub ? 'pt-24 pb-32 px-4 overflow-y-auto' : 'overflow-hidden'}`}>
         {/* PDF CANVAS */}
         {isPdf && (
           <div className="flex flex-col items-center justify-center w-full h-full pt-16 pb-20 overflow-auto relative bg-[#0a0a0a]">
             <div className={`relative shadow-2xl transition-all duration-300 ${settings.theme === 'night' ? 'brightness-90 sepia-[.1]' : ''} ${settings.theme === 'sepia' ? 'sepia-[.3]' : ''}`}>
                <canvas ref={canvasRef} className="max-w-full h-auto rounded-sm block" />
                <div ref={textLayerRef} className="textLayer" />
                <div ref={highlightLayerRef} className="absolute inset-0 pointer-events-none">
                   {highlights?.filter(h => h.page === pdfPageNum).map(hl => (
                      <div key={hl.id}>
                        {hl.rects?.map((r, i) => (
                          <div 
                             key={i}
                             className={`absolute ${HIGHLIGHT_COLORS.find(c=>c.id===hl.color)?.class || 'bg-yellow-300/30'} cursor-pointer pointer-events-auto hover:brightness-110 transition-all`}
                             style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                             onClick={(e) => {
                                e.stopPropagation();
                                setActiveHighlightId(hl.id);
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                setSelectionMenu({ x: rect.left + rect.width/2, y: rect.top - 10, text: hl.text });
                             }}
                          />
                        ))}
                      </div>
                   ))}
                </div>
                {pdfRendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
             </div>
           </div>
         )}

         {/* EPUB CONTAINER */}
         {isEpub && (
            <div className="w-full h-full pt-16 pb-16 flex justify-center relative">
               <div ref={epubContainerRef} className="w-full h-full max-w-4xl px-2 md:px-12" style={{ opacity: epubReady ? 1 : 0, transition: 'opacity 0.5s' }} />
               {!epubReady && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
            </div>
         )}

         {/* TXT RENDERER */}
         {!isPdf && !isEpub && (
           <div ref={contentRef} className={`${settings.fontFamily === 'sans' ? 'font-sans' : settings.fontFamily === 'serif' ? 'font-serif' : 'font-mono'} ${settings.margin === 'narrow' ? 'max-w-[600px]' : settings.margin === 'normal' ? 'max-w-[800px]' : 'max-w-[1000px]'} w-full`} style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight, textAlign: settings.textAlign }}>
             <div className="mb-24 text-center border-b border-current/10 pb-12">
                <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight tracking-tight">{book.title}</h1>
                <p className="text-xl opacity-60 font-serif italic">{book.author}</p>
             </div>
             <div className="whitespace-pre-wrap relative">{book.content || "Content unavailable."}</div>
           </div>
         )}
      </div>

      {/* BOTTOM CONTROLS & PROGRESS */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: showControls ? 0 : 100 }}
        className={`fixed bottom-0 left-0 right-0 h-20 ${theme.ui} backdrop-blur-lg border-t ${theme.border} z-40 flex items-center justify-center px-4 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]`}
      >
        <div className="w-full max-w-3xl flex items-center justify-between gap-4">
           <button 
              onClick={() => isPdf ? changePdfPage(-1) : isEpub ? epubRendition?.prev() : null}
              disabled={isPdf && pdfPageNum <= 1}
              className="p-3 rounded-full hover:bg-current/5 disabled:opacity-30 transition-all"
           >
              <ChevronLeft className="w-6 h-6" />
           </button>
           
           {/* Progress Bar Container */}
           <div className="flex-1 flex flex-col items-center group">
               <div className="text-sm font-bold font-mono mb-2 opacity-60 group-hover:opacity-100 transition-opacity">
                 {isPdf ? `Page ${pdfPageNum} of ${numPages}` : `${Math.round(book.progress)}%`}
               </div>
               <div className="relative w-full h-1.5 bg-current/10 rounded-full hover:h-2 transition-all cursor-pointer">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-300 relative z-10" 
                    style={{ width: isPdf ? `${(pdfPageNum / numPages) * 100}%` : `${book.progress}%` }} 
                  />
                  
                  {/* Ticks at 25/50/75 */}
                  {[25, 50, 75].map(t => (
                     <div key={t} className="absolute top-0 bottom-0 w-[1px] bg-white/20 z-0 pointer-events-none" style={{ left: `${t}%` }} />
                  ))}

                  {bookmarks?.map(b => (
                    <div 
                      key={b.id}
                      className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-20 border border-white/20 shadow-sm transition-transform hover:scale-150 ${b.type === 'favorite' ? 'bg-yellow-400' : 'bg-blue-400'}`}
                      style={{ left: `${b.percentage}%` }}
                      title={`Bookmark: ${b.textSnippet}`}
                    />
                  ))}
               </div>
           </div>
           
           <button 
              onClick={() => isPdf ? changePdfPage(1) : isEpub ? epubRendition?.next() : null}
              disabled={isPdf && pdfPageNum >= numPages}
              className="p-3 rounded-full hover:bg-current/5 disabled:opacity-30 transition-all"
           >
              <ChevronRight className="w-6 h-6" />
           </button>
        </div>
      </motion.div>
    </div>
  );
};
