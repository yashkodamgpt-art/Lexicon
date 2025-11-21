
import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteHighlight, updateHighlightNote } from '../db';
import { Highlight, Book, HighlightColor } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, MessageSquare, Download, Share2, Trash2, ArrowRight, X, Quote, ImageIcon } from 'lucide-react';
import { Button } from './ui/Button';

// Declare global html2canvas
declare global {
  interface Window {
    html2canvas: any;
  }
}

interface QuotesViewProps {
  onQuoteClick: (bookId: string, highlight: Highlight) => void;
}

const HIGHLIGHT_COLORS: {id: HighlightColor, hex: string, label: string}[] = [
  { id: 'yellow', hex: '#facc15', label: 'Yellow' },
  { id: 'green', hex: '#4ade80', label: 'Green' },
  { id: 'blue', hex: '#60a5fa', label: 'Blue' },
  { id: 'purple', hex: '#c084fc', label: 'Purple' },
  { id: 'red', hex: '#f87171', label: 'Red' },
];

export const QuotesView: React.FC<QuotesViewProps> = ({ onQuoteClick }) => {
  const highlights = useLiveQuery(() => db.highlights.orderBy('createdAt').reverse().toArray());
  const books = useLiveQuery(() => db.books.toArray());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeColorFilter, setActiveColorFilter] = useState<HighlightColor | 'all'>('all');
  const [activeBookFilter, setActiveBookFilter] = useState<string | 'all'>('all');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [sharePreview, setSharePreview] = useState<{highlight: Highlight, book: Book} | null>(null);

  const filteredHighlights = useMemo(() => {
    if (!highlights) return [];
    let result = highlights;

    if (activeColorFilter !== 'all') {
      result = result.filter(h => h.color === activeColorFilter);
    }
    if (activeBookFilter !== 'all') {
      result = result.filter(h => h.bookId === activeBookFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(h => 
        h.text.toLowerCase().includes(q) || 
        h.note?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [highlights, activeColorFilter, activeBookFilter, searchQuery]);

  const handleSaveNote = async () => {
    if (editingId) {
      await updateHighlightNote(editingId, editNote);
      setEditingId(null);
    }
  };

  const handleShare = async (highlight: Highlight) => {
    const book = books?.find(b => b.id === highlight.bookId);
    if (!book) return;
    setSharePreview({ highlight, book });
  };

  const downloadImage = async () => {
    if (!shareCardRef.current || !window.html2canvas) return;
    setIsGeneratingImage(true);
    try {
      const canvas = await window.html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false
      });
      const link = document.createElement('a');
      link.download = `quote-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setSharePreview(null);
    } catch (e) {
      console.error("Image generation failed", e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const getBookInfo = (id: string) => books?.find(b => b.id === id);

  const getColorClass = (color: string) => {
    const map: Record<string, string> = {
      yellow: 'border-yellow-500/50 shadow-yellow-500/10',
      green: 'border-green-500/50 shadow-green-500/10',
      blue: 'border-blue-500/50 shadow-blue-500/10',
      purple: 'border-purple-500/50 shadow-purple-500/10',
      red: 'border-red-500/50 shadow-red-500/10',
    };
    return map[color] || 'border-zinc-700';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32 md:pb-20">
      {/* Toolbar */}
      <div className="glass border-b border-white/5 sticky top-0 z-30 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
            <button 
              onClick={() => setActiveColorFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${activeColorFilter === 'all' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 hover:bg-white/10 text-zinc-400'}`}
            >
              All
            </button>
            {HIGHLIGHT_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveColorFilter(c.id)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${activeColorFilter === c.id ? 'scale-110 ring-2 ring-white/20' : 'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: c.hex, borderColor: activeColorFilter === c.id ? 'white' : 'transparent' }}
              />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search quotes..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="relative">
               <select 
                  value={activeBookFilter}
                  onChange={(e) => setActiveBookFilter(e.target.value)}
                  className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               >
                  <option value="all" className="bg-black">All Books</option>
                  {books?.map(b => (
                     <option key={b.id} value={b.id} className="bg-black">{b.title.substring(0, 25)}{b.title.length > 25 ? '...' : ''}</option>
                  ))}
               </select>
               <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Masonry Grid */}
      <div className="max-w-7xl mx-auto p-4 md:p-6">
         {filteredHighlights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
               <Quote className="w-16 h-16 mb-4 text-zinc-700" />
               <h3 className="text-xl font-bold text-zinc-300">No quotes found</h3>
               <p className="text-sm text-zinc-500">Try adjusting filters or highlight text in your books.</p>
            </div>
         ) : (
            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
               <AnimatePresence>
                  {filteredHighlights.map((h, i) => {
                     const book = getBookInfo(h.bookId);
                     return (
                        <motion.div
                           key={h.id}
                           layout
                           initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, scale: 0.9 }}
                           transition={{ duration: 0.3, delay: i * 0.05 }}
                           className={`break-inside-avoid bg-[#111] border rounded-2xl p-5 md:p-6 hover:bg-[#151515] transition-all group shadow-lg ${getColorClass(h.color)}`}
                        >
                           <div className="flex items-start gap-3 mb-4">
                              <div className={`w-10 h-14 rounded bg-gradient-to-br shadow-md shrink-0`} style={{ backgroundImage: book?.coverUrl?.includes('gradient:') ? book.coverUrl.replace('gradient:', '') : 'none' }}>
                                 {!book?.coverUrl?.includes('gradient:') && book?.coverUrl && <img src={book.coverUrl} className="w-full h-full object-cover rounded" alt="" />}
                              </div>
                              <div className="min-w-0">
                                 <h4 className="font-bold text-sm text-zinc-200 truncate">{book?.title}</h4>
                                 <p className="text-xs text-zinc-500 truncate">{book?.author}</p>
                                 <p className="text-[10px] text-zinc-600 mt-1">{new Date(h.createdAt).toLocaleDateString()}</p>
                              </div>
                           </div>

                           <div 
                              className="font-serif text-lg md:text-xl leading-relaxed text-zinc-100 mb-4 cursor-pointer hover:text-blue-400 transition-colors"
                              onClick={() => onQuoteClick(h.bookId, h)}
                           >
                              "{h.text}"
                           </div>

                           {h.note && (
                              <div className="bg-white/5 rounded-lg p-3 mb-4 text-sm text-zinc-400 italic flex gap-2">
                                 <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                                 {h.note}
                              </div>
                           )}

                           <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-white/5">
                              <button onClick={() => { setEditingId(h.id); setEditNote(h.note || ''); }} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white" title="Edit Note">
                                 <MessageSquare className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleShare(h)} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white" title="Share">
                                 <Share2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => { if(window.confirm('Delete highlight?')) deleteHighlight(h.id); }} className="p-2 hover:bg-red-500/10 rounded-full text-zinc-400 hover:text-red-400" title="Delete">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => onQuoteClick(h.bookId, h)} className="p-2 hover:bg-blue-500/10 rounded-full text-zinc-400 hover:text-blue-400" title="Go to Text">
                                 <ArrowRight className="w-4 h-4" />
                              </button>
                           </div>
                        </motion.div>
                     );
                  })}
               </AnimatePresence>
            </div>
         )}
      </div>

      {/* Share Modal */}
      <AnimatePresence>
         {sharePreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSharePreview(null)}>
               <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-md w-full overflow-hidden"
                  onClick={e => e.stopPropagation()}
               >
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold">Share Quote</h3>
                     <button onClick={() => setSharePreview(null)}><X className="w-5 h-5" /></button>
                  </div>

                  <div 
                     ref={shareCardRef} 
                     className="aspect-[4/5] w-full bg-gradient-to-br from-[#1a1a1a] to-black p-8 flex flex-col justify-center relative rounded-xl border border-white/5 overflow-hidden shadow-2xl"
                  >
                     <div className={`absolute inset-0 opacity-20 bg-${sharePreview.highlight.color}-500/20 mix-blend-overlay`} />
                     <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
                     
                     <Quote className="w-8 h-8 text-white/20 mb-6" />
                     
                     <p className="font-serif text-2xl text-white leading-relaxed mb-8 relative z-10">
                        {sharePreview.highlight.text}
                     </p>

                     <div className="mt-auto flex items-center gap-4 relative z-10">
                        <div className="w-12 h-16 bg-zinc-800 rounded shadow-lg" style={{ backgroundImage: sharePreview.book.coverUrl?.includes('gradient:') ? sharePreview.book.coverUrl.replace('gradient:', '') : `url(${sharePreview.book.coverUrl})`, backgroundSize: 'cover' }} />
                        <div>
                           <h4 className="font-bold text-white text-sm">{sharePreview.book.title}</h4>
                           <p className="text-xs text-zinc-400">{sharePreview.book.author}</p>
                        </div>
                     </div>
                     <div className="absolute bottom-4 right-4 text-[10px] text-zinc-600 font-bold tracking-widest uppercase">LEXICON</div>
                  </div>

                  <div className="flex gap-3 mt-6">
                     <Button className="flex-1" onClick={downloadImage} disabled={isGeneratingImage}>
                        {isGeneratingImage ? 'Generating...' : <><ImageIcon className="w-4 h-4 mr-2" /> Save Image</>}
                     </Button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* Edit Note Modal */}
      <AnimatePresence>
         {editingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
               <motion.div 
                  initial={{ scale: 0.95 }} animate={{ scale: 1 }} 
                  className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-sm"
               >
                  <h3 className="font-bold mb-4">Edit Note</h3>
                  <textarea 
                     value={editNote} 
                     onChange={e => setEditNote(e.target.value)} 
                     className="w-full h-32 bg-white/5 rounded-lg p-3 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                     autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-4">
                     <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                     <Button onClick={handleSaveNote}>Save</Button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
};
