import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addBookToDb, toggleFavorite, deleteBook } from '../db';
import { Book } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Grid, List as ListIcon, 
  Star, Trash2, BookOpen, Clock, Sparkles, Upload
} from 'lucide-react';
import { Button } from './ui/Button';

interface LibraryProps {
  onOpenBook: (book: Book) => void;
}

export const Library: React.FC<LibraryProps> = ({ onOpenBook }) => {
  const books = useLiveQuery(() => db.books.orderBy('lastRead').reverse().toArray());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const filteredBooks = books?.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Custom Gradients for generated covers
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
      className="min-h-screen bg-[#0a0a0a] text-white relative overflow-y-auto overflow-x-hidden"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Background Ambient Glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b-0 border-white/5 px-6 py-4 md:px-12 md:py-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">LEXICON</h1>
              <p className="text-xs text-zinc-500 font-medium tracking-wide uppercase">Phase 1 • Local Storage</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto bg-[#1a1a1a]/50 p-1 rounded-xl border border-white/5 backdrop-blur-sm">
            <div className="relative flex-1 md:w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search your library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:ring-0 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
             <div className="flex bg-[#1a1a1a] rounded-lg border border-white/5 p-1">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
             </div>
             <Button onClick={() => fileInputRef.current?.click()}>
                <Plus className="w-4 h-4 mr-2" /> Add Book
             </Button>
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".txt,.md,.epub,.pdf"
              />
          </div>
        </div>
      </header>

      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm border-2 border-dashed border-blue-500 m-4 rounded-3xl"
          >
            <div className="text-center">
              <motion.div 
                animate={{ y: [0, -10, 0] }} 
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Upload className="w-20 h-20 mx-auto text-blue-500 mb-6" />
              </motion.div>
              <h3 className="text-3xl font-bold text-white">Drop files to import</h3>
              <p className="text-blue-400 mt-2">PDF, EPUB, TXT, MD</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {!books ? (
            <div className="flex items-center justify-center h-64 text-zinc-500">
               <Sparkles className="w-6 h-6 animate-spin mr-2" /> Loading Library...
            </div>
          ) : books.length === 0 ? (
             <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-[60vh] text-center"
             >
               <div className="w-32 h-32 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-8 border border-white/5 shadow-2xl shadow-blue-500/10">
                  <BookOpen className="w-12 h-12 text-white/80" />
               </div>
               <h2 className="text-3xl font-bold text-white mb-4">Your library awaits</h2>
               <p className="text-zinc-400 max-w-md mb-8 text-lg leading-relaxed">
                 Experience the next generation of reading. Drag and drop your files or click below to get started.
               </p>
               <Button size="lg" onClick={() => fileInputRef.current?.click()} className="group">
                  Import First Book <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
               </Button>
             </motion.div>
          ) : (
            <motion.div 
              layout
              className={viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8" 
                : "flex flex-col gap-3"
              }
            >
              {filteredBooks?.map((book, i) => (
                <BookCard 
                  key={book.id} 
                  book={book} 
                  viewMode={viewMode}
                  onOpen={() => onOpenBook(book)} 
                  gradient={getGradient(book.id)}
                  index={i}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const BookCard: React.FC<{ 
  book: Book; 
  viewMode: 'grid' | 'list'; 
  onOpen: () => void;
  gradient: string;
  index: number;
}> = ({ book, viewMode, onOpen, gradient, index }) => {
  
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

  if (viewMode === 'list') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        layout
        onClick={onOpen}
        className="group flex items-center gap-6 p-4 rounded-xl bg-[#1a1a1a] hover:bg-[#222] border border-white/5 hover:border-white/10 transition-all cursor-pointer shadow-sm hover:shadow-md"
      >
        <div className={`w-12 h-16 rounded bg-gradient-to-br ${gradient} shadow-lg flex-shrink-0 flex items-center justify-center`}>
             <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">{book.format}</span>
        </div>
        
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="min-w-0">
             <h3 className="font-medium text-zinc-100 truncate text-lg">{book.title}</h3>
             <p className="text-sm text-zinc-500 truncate">{book.author}</p>
          </div>
          
          <div className="hidden md:flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-zinc-500">
               <span>Progress</span>
               <span>{Math.round(book.progress)}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500" style={{ width: `${book.progress}%` }} />
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2 text-zinc-500 text-sm">
             <span className="hidden lg:flex items-center gap-1 text-xs bg-zinc-900 px-2 py-1 rounded border border-white/5">
                <Clock className="w-3 h-3" /> {new Date(book.lastRead).toLocaleDateString()}
             </span>
             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

  // Grid View with 3D Tilt and Premium Hover
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200, damping: 20 }}
      layout
      className="group relative w-full perspective-1000"
      onClick={onOpen}
    >
      <motion.div 
        whileHover={{ y: -10, scale: 1.02, rotateX: 5, zIndex: 10 }}
        className="relative aspect-[2/3] w-full rounded-lg shadow-xl cursor-pointer transition-all duration-300 ease-out transform-gpu preserve-3d"
      >
        {/* Book Cover */}
        <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${gradient} overflow-hidden`}>
           <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
           {/* Spine Effect */}
           <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/20 z-10" />
           <div className="absolute left-[2px] top-0 bottom-0 w-[4px] bg-black/20 z-10" />
           
           {/* Content on Cover */}
           <div className="p-4 h-full flex flex-col justify-between relative z-0">
              <div className="text-right">
                 <span className="text-[10px] font-bold text-white/40 border border-white/20 px-1.5 py-0.5 rounded uppercase">{book.format}</span>
              </div>
              <div>
                 <h3 className="font-serif text-xl text-white leading-tight line-clamp-3 shadow-black drop-shadow-md">{book.title}</h3>
                 <p className="text-xs text-white/70 mt-2 uppercase tracking-widest">{book.author}</p>
              </div>
           </div>
        </div>

        {/* Progress Bar Bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 backdrop-blur-sm">
            <div className="h-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${book.progress}%` }} />
        </div>

        {/* Hover Overlay Actions */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
          <button 
            onClick={handleToggleFav}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-white text-white hover:text-yellow-500 transition-colors shadow-lg border border-white/10"
          >
            <Star className={`w-4 h-4 ${book.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
          </button>
           <button 
            onClick={handleDelete}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-red-500 text-white transition-colors shadow-lg border border-white/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
      
      {/* Reflection/Shadow below book */}
      <div className="absolute -bottom-4 left-4 right-4 h-4 bg-black/80 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.div>
  );
};