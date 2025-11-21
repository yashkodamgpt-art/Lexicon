
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addBookToDb, toggleFavorite, deleteBook, toggleBookInCollection } from '../db';
import { Book, Highlight, Collection } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Grid, List as ListIcon, 
  Star, Trash2, BookOpen, Clock, Sparkles, Upload, Quote,
  Library as LibraryIcon, MoreVertical, FolderPlus, Check, BarChart2,
  BrainCircuit, Lock
} from 'lucide-react';
import { Button } from './ui/Button';
import { QuotesView } from './QuotesView';
import { StatsView } from './StatsView';
import { CollectionsPanel } from './CollectionsPanel';

interface LibraryProps {
  onOpenBook: (book: Book) => void;
  onQuoteClick: (book: Book, highlight: Highlight) => void;
  initialTab?: 'library' | 'quotes' | 'stats' | 'mindmaps';
}

export const Library: React.FC<LibraryProps> = ({ onOpenBook, onQuoteClick, initialTab = 'library' }) => {
  const books = useLiveQuery(() => db.books.orderBy('lastRead').reverse().toArray());
  const collections = useLiveQuery(() => db.collections.toArray());
  
  const [activeTab, setActiveTab] = useState<'library' | 'quotes' | 'stats' | 'mindmaps'>(initialTab);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCollections, setShowCollections] = useState(false);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await addBookToDb(e.target.files[0]);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await addBookToDb(e.dataTransfer.files[0]);
    }
  };

  const handleQuoteClickLocal = async (bookId: string, highlight: Highlight) => {
    const book = await db.books.get(bookId);
    if (book) {
      onQuoteClick(book, highlight);
    }
  };

  const filteredBooks = useMemo(() => {
    if (!books) return [];
    let result = books;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(book => 
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q)
      );
    }
    if (activeCollectionId) {
       switch(activeCollectionId) {
          case 'favorites':
             result = result.filter(b => b.isFavorite);
             break;
          case 'reading':
             result = result.filter(b => b.progress > 0 && b.progress < 100);
             break;
          case 'finished':
             result = result.filter(b => Math.floor(b.progress) === 100);
             break;
          case 'recent':
             const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
             result = result.filter(b => b.dateAdded > oneWeekAgo);
             break;
          default:
             result = result.filter(b => b.collectionIds?.includes(activeCollectionId));
             break;
       }
    }
    return result;
  }, [books, searchQuery, activeCollectionId]);

  const activeCollectionName = useMemo(() => {
    if (!activeCollectionId) return "Library";
    const smart = { favorites: 'Favorites', reading: 'Reading', finished: 'Finished', recent: 'Recent' };
    // @ts-ignore
    if (smart[activeCollectionId]) return smart[activeCollectionId];
    return collections?.find(c => c.id === activeCollectionId)?.name || "Collection";
  }, [activeCollectionId, collections]);

  const getGradient = (id: string) => {
    const gradients = [
      'from-blue-600 to-violet-600',
      'from-emerald-500 to-teal-700',
      'from-orange-500 to-rose-600',
      'from-fuchsia-600 to-purple-600',
      'from-slate-700 to-slate-900',
    ];
    const index = id.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  return (
    <div 
      className="min-h-screen bg-[#0a0a0a] text-white relative overflow-y-auto overflow-x-hidden pb-24 md:pb-0"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <CollectionsPanel 
        isOpen={showCollections} 
        onClose={() => setShowCollections(false)}
        activeCollectionId={activeCollectionId}
        onSelectCollection={setActiveCollectionId}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b-0 border-white/5 px-4 py-4 md:px-12 md:py-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          {/* Top Row (Logo + Tabs on Desktop) */}
          <div className="flex items-center justify-between w-full md:w-auto gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">LEXICON</h1>
                <p className="text-xs text-zinc-500 font-medium tracking-wide uppercase">Phase 1</p>
              </div>
            </div>

            {/* Desktop Tabs - Hidden on Mobile */}
            <div className="hidden md:flex bg-white/5 rounded-lg p-1 border border-white/5 overflow-x-auto">
               <button onClick={() => setActiveTab('library')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'library' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <Grid className="w-4 h-4" /> Library
               </button>
               <button onClick={() => setActiveTab('quotes')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'quotes' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <Quote className="w-4 h-4" /> Quotes
               </button>
               <button onClick={() => setActiveTab('stats')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'stats' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <BarChart2 className="w-4 h-4" /> Insights
               </button>
               <button onClick={() => setActiveTab('mindmaps')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'mindmaps' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <BrainCircuit className="w-4 h-4" /> Mindmaps
               </button>
            </div>
          </div>

          {/* Actions Toolbar - Responsive Stack */}
          {activeTab === 'library' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-[#1a1a1a]/50 p-1 rounded-xl border border-white/5 backdrop-blur-sm w-full sm:w-auto">
               <button onClick={() => setShowCollections(true)} className={`p-3 md:p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ${activeCollectionId ? 'text-blue-400' : ''}`} title="Collections">
                 <LibraryIcon className="w-5 h-5" />
               </button>
               <div className="w-[1px] h-6 bg-white/10 mx-1" />
              <div className="relative flex-1 sm:w-48 md:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:ring-0 focus:outline-none transition-all h-10" />
              </div>
            </div>

            <div className="flex items-center gap-3">
               <div className="hidden md:flex bg-[#1a1a1a] rounded-lg border border-white/5 p-1">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Grid className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><ListIcon className="w-4 h-4" /></button>
               </div>
               <Button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto flex-1 sm:flex-none justify-center"><Plus className="w-4 h-4 mr-2" /> Add Book</Button>
               <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.md,.epub,.pdf" />
            </div>
          </div>
          )}
        </div>
      </header>

      <AnimatePresence>
        {isDragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm border-2 border-dashed border-blue-500 m-4 rounded-3xl">
            <div className="text-center">
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Upload className="w-20 h-20 mx-auto text-blue-500 mb-6" />
              </motion.div>
              <h3 className="text-3xl font-bold text-white">Drop files to import</h3>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONTENT VIEWS */}
      {activeTab === 'quotes' ? (
         <QuotesView onQuoteClick={handleQuoteClickLocal} />
      ) : activeTab === 'stats' ? (
         <StatsView />
      ) : activeTab === 'mindmaps' ? (
         <MindmapsPlaceholder />
      ) : (
        <main className="max-w-7xl mx-auto p-4 md:p-12 pb-32 md:pb-12">
           <AnimatePresence>
             {activeCollectionId && (
               <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-3 mb-8 px-2">
                 <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{activeCollectionName}</h2>
                 <span className="text-zinc-500 bg-white/5 px-2 py-0.5 rounded text-sm">{filteredBooks.length}</span>
                 <button onClick={() => setActiveCollectionId(null)} className="text-xs text-blue-400 hover:underline ml-2">Clear filter</button>
               </motion.div>
             )}
           </AnimatePresence>

          <AnimatePresence mode="wait">
            {!books ? (
              <div className="flex items-center justify-center h-64 text-zinc-500"><Sparkles className="w-6 h-6 animate-spin mr-2" /> Loading Library...</div>
            ) : books.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-8 border border-white/5 shadow-2xl shadow-blue-500/10">
                    <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-white/80" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Your library awaits</h2>
                <Button size="lg" onClick={() => fileInputRef.current?.click()} className="group w-full md:w-auto">
                    Import First Book <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </Button>
              </motion.div>
            ) : filteredBooks.length === 0 && activeCollectionId ? (
                <div className="text-center py-20 opacity-60"><p className="text-xl">No books in this collection</p></div>
            ) : (
              <motion.div layout className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8" : "flex flex-col gap-3"}>
                {filteredBooks?.map((book, i) => (
                  <BookCard key={book.id} book={book} viewMode={viewMode} onOpen={() => onOpenBook(book)} gradient={getGradient(book.id)} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      )}

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] pb-safe glass border-t border-white/10 z-50 flex justify-around items-center bg-[#0a0a0a]/90 backdrop-blur-xl px-2 shadow-2xl">
         <MobileTab 
           label="Library" 
           icon={BookOpen} 
           isActive={activeTab === 'library'} 
           onClick={() => setActiveTab('library')} 
         />
         <MobileTab 
           label="Quotes" 
           icon={Quote} 
           isActive={activeTab === 'quotes'} 
           onClick={() => setActiveTab('quotes')} 
         />
         <MobileTab 
           label="Insights" 
           icon={BarChart2} 
           isActive={activeTab === 'stats'} 
           onClick={() => setActiveTab('stats')} 
         />
         <MobileTab 
           label="Mindmaps" 
           icon={BrainCircuit} 
           isActive={activeTab === 'mindmaps'} 
           onClick={() => setActiveTab('mindmaps')} 
         />
      </div>
    </div>
  );
};

const MobileTab: React.FC<{ label: string, icon: any, isActive: boolean, onClick: () => void }> = ({ label, icon: Icon, isActive, onClick }) => (
   <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center w-full h-full pt-2 pb-4 gap-1 transition-colors active:scale-95 ${isActive ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
   >
      <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-blue-500/10' : ''}`}>
         <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
         {isActive && <motion.div layoutId="activeTabIndicator" className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />}
      </div>
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
   </button>
);

const MindmapsPlaceholder = () => (
   <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-[70vh] text-center px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-8 border border-white/5 relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite] -skew-x-12" />
         <BrainCircuit className="w-10 h-10 text-zinc-400" />
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
         <Lock className="w-3 h-3" /> Phase 2 Feature
      </div>
      <h2 className="text-3xl font-bold text-white mb-4">AI Mindmaps</h2>
      <p className="text-zinc-400 max-w-md leading-relaxed">
         Connect your Gemini API key to automatically generate visual knowledge graphs and connection maps from your reading material.
      </p>
      <Button disabled className="mt-8 opacity-50 cursor-not-allowed">
         Coming Soon
      </Button>
   </motion.div>
);

const BookCard: React.FC<{ 
  book: Book; 
  viewMode: 'grid' | 'list'; 
  onOpen: () => void;
  gradient: string;
  index: number;
}> = ({ book, viewMode, onOpen, gradient, index }) => {
  
  const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);
  const collections = useLiveQuery(() => db.collections.orderBy('name').toArray());

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm(`Delete "${book.title}"?`)) {
      deleteBook(book.id);
    }
  };

  const handleToggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(book.id, book.isFavorite);
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
     e.preventDefault();
     setContextMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
     const close = () => setContextMenu(null);
     if (contextMenu) window.addEventListener('click', close);
     return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const handleDragStart = (e: React.DragEvent) => {
     e.dataTransfer.setData('bookId', book.id);
     // @ts-ignore
     e.dataTransfer.effectAllowed = 'copy';
     const el = e.target as HTMLElement;
     el.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
     const el = e.target as HTMLElement;
     el.style.opacity = '1';
  };

  // Estimate reading time
  const readingTime = useMemo(() => {
     // Approx 250 words/min or 2 mins per PDF page
     if (book.format === 'pdf' && book.totalPages) {
        const remaining = book.totalPages - (book.currentPage || 0);
        return `~${Math.max(1, Math.round(remaining * 1.5))} min left`;
     }
     // For TXT/EPUB just a rough guess
     return book.progress < 90 ? "~2 hrs left" : "~15 min left"; 
  }, [book]);

  const CardContent = () => {
    if (viewMode === 'list') {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          layout
          onClick={onOpen}
          onContextMenu={handleContextMenu}
          draggable
          onDragStart={handleDragStart as any}
          onDragEnd={handleDragEnd as any}
          className="group flex items-center gap-4 md:gap-6 p-3 md:p-4 rounded-xl bg-[#1a1a1a] hover:bg-[#222] border border-white/5 hover:border-white/10 transition-all cursor-pointer shadow-sm hover:shadow-md"
        >
          <div className={`w-10 h-14 md:w-12 md:h-16 rounded bg-gradient-to-br ${gradient} shadow-lg flex-shrink-0 flex items-center justify-center`}>
               <span className="text-[8px] md:text-[10px] font-bold text-white/50 uppercase tracking-tighter">{book.format}</span>
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-center">
            <div className="min-w-0">
               <h3 className="font-medium text-zinc-100 truncate text-base md:text-lg">{book.title}</h3>
               <p className="text-xs md:text-sm text-zinc-500 truncate">{book.author}</p>
            </div>
            <div className="hidden md:flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-zinc-500">
                 <span>{Math.round(book.progress)}%</span>
                 <span>{readingTime}</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500" style={{ width: `${book.progress}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 text-zinc-500 text-sm">
               <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={handleToggleFav} className="p-2 hover:text-yellow-400 transition-colors">
                    <Star className={`w-4 h-4 ${book.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  </button>
                  <button onClick={handleDelete} className="p-2 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        </motion.div>
      );
    }
  
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05, type: "spring", stiffness: 200, damping: 20 }}
        layout
        className="group relative w-full perspective-1000"
        onClick={onOpen}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart as any}
        onDragEnd={handleDragEnd as any}
      >
        <motion.div 
          whileHover={{ y: -8, scale: 1.02, rotateX: 4 }}
          className="relative aspect-[2/3] w-full rounded-lg shadow-xl cursor-pointer transition-all duration-300 ease-out transform-gpu preserve-3d bg-[#151515]"
        >
          {/* Cover */}
          <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${gradient} overflow-hidden border border-white/5`}>
             <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500" />
             
             {/* 3D Spine Effect */}
             <div className="absolute left-0 top-0 bottom-0 w-[2px] md:w-[3px] bg-white/20 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]" />
             <div className="absolute left-[2px] md:left-[3px] top-0 bottom-0 w-[1px] bg-black/30 z-10" />
             
             <div className="p-3 md:p-4 h-full flex flex-col justify-between relative z-0">
                <div className="text-right">
                   <span className="text-[9px] md:text-[10px] font-bold text-white/30 border border-white/10 px-1.5 py-0.5 rounded uppercase backdrop-blur-sm">{book.format}</span>
                </div>
                <div>
                   <h3 className="font-serif text-lg md:text-xl text-white leading-tight line-clamp-3 drop-shadow-md">{book.title}</h3>
                   <p className="text-[10px] md:text-xs text-white/70 mt-2 uppercase tracking-widest truncate">{book.author}</p>
                </div>
             </div>
          </div>
  
          {/* Page Curl on Hover (CSS trick) */}
          <div className="absolute bottom-0 right-0 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-tl-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm border-t border-l border-white/20" />

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 backdrop-blur-sm">
              <div className="h-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ width: `${book.progress}%` }} />
          </div>
  
          <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
            <button onClick={handleToggleFav} className="p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-white text-white hover:text-yellow-500 transition-colors shadow-lg border border-white/10">
              <Star className={`w-4 h-4 ${book.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
            </button>
             <button onClick={handleDelete} className="p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-red-500 text-white transition-colors shadow-lg border border-white/10">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <>
      <CardContent />
      <AnimatePresence>
         {contextMenu && (
            <div className="fixed z-50" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-[#111] border border-white/10 rounded-lg shadow-2xl w-48 overflow-hidden">
                 <div className="p-2 border-b border-white/5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Add to Collection</div>
                 <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">
                    {collections?.map(col => {
                      const isIn = book.collectionIds?.includes(col.id);
                      return (
                        <button key={col.id} onClick={async () => { await toggleBookInCollection(book.id, col.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white flex items-center justify-between">
                           <span className="truncate">{col.name}</span>
                           {isIn && <Check className="w-3 h-3 text-blue-500" />}
                        </button>
                      );
                    })}
                 </div>
                 <div className="border-t border-white/5 p-1">
                    <button onClick={handleDelete} className="w-full text-left px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded flex items-center gap-2"><Trash2 className="w-3 h-3" /> Delete Book</button>
                 </div>
              </motion.div>
            </div>
         )}
      </AnimatePresence>
    </>
  );
};
