import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteHighlight, updateHighlightNote } from '../db';
import { Highlight, Book, HighlightColor } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, MessageSquare, Download, Share2, Trash2, ArrowRight, X, Quote } from 'lucide-react';
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
  const [shareData, setShareData] = useState<{highlight: Highlight, book: Book} | null>(null);

  const booksMap = useMemo(() => {
    const map: Record<string, Book> = {};
    books?.forEach(b => map[b.id] = b);
    return map;
  }, [books]);

  const filteredHighlights = useMemo(() => {
    if (!highlights) return [];
    return highlights.filter(h => {
      const matchesSearch = h.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (h.note && h.note.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesColor = activeColorFilter === 'all' || h.color === activeColorFilter;
      const matchesBook = activeBookFilter === 'all' || h.bookId === activeBookFilter;
      return matchesSearch && matchesColor && matchesBook;
    });
  }, [highlights, searchQuery, activeColorFilter, activeBookFilter]);

  const stats = useMemo(() => {
    if (!highlights) return { total: 0, recent: 0, favColor: 'None' };
    const total = highlights.length;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = highlights.filter(h => h.createdAt > oneWeekAgo).length;
    
    const colors = highlights.map(h => h.color);
    const mode = colors.sort((a,b) => colors.filter(v => v===a).length - colors.filter(v => v===b).length).pop();
    
    return { total, recent, favColor: mode || 'None' };
  }, [highlights]);

  const handleExport = () => {
    if (!filteredHighlights.length) return;
    
    let content = "# My Highlights - LEXICON\n\n";
    filteredHighlights.forEach(h => {
      const book = booksMap[h.bookId];
      content += `## ${book?.title || 'Unknown Book'}\n`;
      content += `> ${h.text}\n\n`;
      if (h.note) content += `*Note: ${h.note}*\n\n`;
      content += `---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lexicon-highlights-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async (h: Highlight) => {
    const book = booksMap[h.bookId];
    if (!book) return;
    setShareData({ highlight: h, book });
    // Wait for render
    setTimeout(async () => {
      if (shareCardRef.current && window.html2canvas) {
        setIsGeneratingImage(true);
        try {
          const canvas = await window.html2canvas(shareCardRef.current, {
            backgroundColor: null,
            scale: 2,
            logging: false,
            useCORS: true
          });
          const link = document.createElement('a');
          link.download = `quote-${book.title.slice(0, 10)}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        } catch (e) {
          console.error("Export failed", e);
        }
        setIsGeneratingImage(false);
        setShareData(null);
      }
    }, 100);
  };

  const getGradient = (color: HighlightColor) => {
    switch(color) {
      case 'yellow': return 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
      case 'green': return 'from-emerald-500/20 to-green-500/20 border-green-500/30';
      case 'blue': return 'from-blue-500/20 to-indigo-500/20 border-blue-500/30';
      case 'purple': return 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30';
      case 'red': return 'from-red-500/20 to-rose-500/20 border-red-500/30';
      default: return 'from-zinc-500/20 to-slate-500/20 border-zinc-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Hidden Share Card Renderer */}
      {shareData && (
        <div className="fixed top-[-9999px] left-[-9999px]">
           <div ref={shareCardRef} className="w-[600px] bg-[#0a0a0a] p-12 flex flex-col items-center text-center relative overflow-hidden">
              <div className={`absolute inset-0 opacity-30 bg-gradient-to-br ${getGradient(shareData.highlight.color)}`} />
              <Quote className="w-12 h-12 text-white/20 mb-8" />
              <h3 className="font-serif text-2xl leading-relaxed text-white mb-8 relative z-10">
                "{shareData.highlight.text}"
              </h3>
              <div className="mt-auto flex items-center gap-4 relative z-10">
                 <div className="w-12 h-16 bg-zinc-800 shadow-lg rounded-sm overflow-hidden">
                   {shareData.book.coverUrl && !shareData.book.coverUrl.startsWith('gradient') ? (
                      <img src={shareData.book.coverUrl} className="w-full h-full object-cover" />
                   ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600" />
                   )}
                 </div>
                 <div className="text-left">
                    <p className="font-bold text-white text-lg">{shareData.book.title}</p>
                    <p className="text-zinc-400">{shareData.book.author}</p>
                 </div>
              </div>
              <div className="absolute bottom-4 right-6 text-zinc-600 text-xs uppercase tracking-widest font-bold">LEXICON</div>
           </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="sticky top-0 z-20 glass border-b border-white/5 px-6 py-4 backdrop-blur-xl">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
            
            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
               <div className="flex flex-col">
                  <span className="text-zinc-500 text-xs uppercase tracking-wider">Total</span>
                  <span className="font-mono font-bold text-xl">{stats.total}</span>
               </div>
               <div className="w-[1px] h-8 bg-white/10" />
               <div className="flex flex-col">
                  <span className="text-zinc-500 text-xs uppercase tracking-wider">This Week</span>
                  <span className="font-mono font-bold text-xl text-blue-400">+{stats.recent}</span>
               </div>
            </div>

            {/* Search & Filters */}
            <div className="flex-1 w-full md:w-auto flex flex-col md:flex-row items-center gap-3 justify-end">
               <div className="relative w-full md:w-64 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400" />
                  <input 
                    type="text" 
                    placeholder="Search quotes & notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
               </div>
               
               <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                  <select 
                    className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none appearance-none cursor-pointer hover:bg-white/10"
                    value={activeBookFilter}
                    onChange={(e) => setActiveBookFilter(e.target.value)}
                  >
                     <option value="all">All Books</option>
                     {books?.map(b => <option key={b.id} value={b.id}>{b.title.length > 20 ? b.title.slice(0,20)+'...' : b.title}</option>)}
                  </select>
                  
                  <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
                     <button 
                        onClick={() => setActiveColorFilter('all')}
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${activeColorFilter === 'all' ? 'bg-white/20 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                     >
                       A
                     </button>
                     {HIGHLIGHT_COLORS.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => setActiveColorFilter(c.id)}
                          className={`w-6 h-6 rounded ml-1 transition-all border ${activeColorFilter === c.id ? 'border-white scale-110' : 'border-transparent hover:scale-110'}`}
                          style={{ backgroundColor: c.hex }}
                        />
                     ))}
                  </div>

                  <Button size="sm" variant="secondary" onClick={handleExport} title="Export to Markdown">
                     <Download className="w-4 h-4" />
                  </Button>
               </div>
            </div>
         </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 md:p-8">
         {filteredHighlights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
               <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <Quote className="w-8 h-8 text-zinc-500" />
               </div>
               <h3 className="text-xl font-bold mb-2">No highlights found</h3>
               <p className="text-zinc-400">Try adjusting your filters or start reading to add highlights.</p>
            </div>
         ) : (
            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
               {filteredHighlights.map((h) => {
                 const book = booksMap[h.bookId];
                 if (!book) return null;
                 
                 return (
                   <motion.div 
                      key={h.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`break-inside-avoid relative group bg-[#111] border rounded-xl p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br ${getGradient(h.color)}`}
                   >
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4 opacity-80">
                         <div className="w-8 h-10 bg-black rounded shadow overflow-hidden flex-shrink-0">
                            {book.coverUrl && !book.coverUrl.startsWith('gradient') ? (
                               <img src={book.coverUrl} className="w-full h-full object-cover" />
                            ) : (
                               <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
                            )}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-bold text-sm truncate">{book.title}</h4>
                            <p className="text-xs text-zinc-400 truncate">{book.author}</p>
                         </div>
                         <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: HIGHLIGHT_COLORS.find(c => c.id === h.color)?.hex }} />
                      </div>

                      {/* Quote Text */}
                      <div 
                        className="font-serif text-lg leading-relaxed text-zinc-100 mb-4 cursor-pointer"
                        onClick={() => onQuoteClick(h.bookId, h)}
                      >
                         "{h.text}"
                      </div>

                      {/* Note Section */}
                      {editingId === h.id ? (
                         <div className="mb-4 bg-black/20 rounded p-2">
                            <textarea 
                              className="w-full bg-transparent text-sm text-white focus:outline-none resize-none"
                              rows={3}
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                               <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded hover:bg-white/10">Cancel</button>
                               <button onClick={() => { updateHighlightNote(h.id, editNote); setEditingId(null); }} className="text-xs px-2 py-1 rounded bg-blue-600 text-white">Save</button>
                            </div>
                         </div>
                      ) : (
                         h.note && (
                            <div className="mb-4 flex items-start gap-2 text-sm text-zinc-400 italic bg-black/20 p-3 rounded-lg">
                               <MessageSquare className="w-3 h-3 mt-1 flex-shrink-0 opacity-70" />
                               <span>{h.note}</span>
                            </div>
                         )
                      )}

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                            {new Date(h.createdAt).toLocaleDateString()}
                         </span>
                         <div className="flex items-center gap-1">
                            <button onClick={() => { setEditNote(h.note || ''); setEditingId(h.id); }} className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white" title="Edit Note">
                               <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleShare(h)} className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white" title="Share Quote">
                               <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onQuoteClick(h.bookId, h)} className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white" title="Jump to book">
                               <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { if(window.confirm('Delete highlight?')) deleteHighlight(h.id); }} className="p-1.5 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-400" title="Delete">
                               <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                      </div>
                   </motion.div>
                 );
               })}
            </div>
         )}
      </div>
    </div>
  );
};
