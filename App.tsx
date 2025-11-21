
import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { Book, ViewState, Highlight, Tab } from './types';
import { db, saveTab, deleteTab } from './db';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Plus } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<ViewState>('library');
  
  // Tab State
  const tabs = useLiveQuery(() => db.tabs.toArray()) || [];
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  
  // Map to store initialLocations for each tab to pass to Reader
  const [tabLocations, setTabLocations] = useState<Record<string, {page?: number, cfi?: string}>>({});

  // Load initial tabs
  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
       // Restore last active tab
       const lastActive = tabs.sort((a,b) => b.lastAccessed - a.lastAccessed)[0];
       setActiveTabId(lastActive.id);
       setView('reader');
    }
  }, [tabs]);

  const handleOpenBook = async (book: Book, location?: {page?: number, cfi?: string}) => {
    // Check if already open
    const existingTab = tabs.find(t => t.bookId === book.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      if (location) {
         setTabLocations(prev => ({ ...prev, [existingTab.id]: location }));
      }
      await db.tabs.update(existingTab.id, { lastAccessed: Date.now() });
      setView('reader');
      return;
    }

    // Check Limit
    if (tabs.length >= 5) {
      alert("Maximum 5 tabs allowed. Please close a tab first.");
      return;
    }

    // Create New Tab
    const newTab: Tab = {
      id: crypto.randomUUID(),
      bookId: book.id,
      title: book.title,
      coverUrl: book.coverUrl,
      format: book.format,
      lastAccessed: Date.now()
    };

    await saveTab(newTab);
    if (location) {
       setTabLocations(prev => ({ ...prev, [newTab.id]: location }));
    }
    setActiveTabId(newTab.id);
    setView('reader');
  };

  const handleCloseTab = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    await deleteTab(tabId);
    if (activeTabId === tabId) {
      const remaining = tabs.filter(t => t.id !== tabId);
      if (remaining.length > 0) {
         setActiveTabId(remaining[remaining.length - 1].id);
      } else {
         setActiveTabId(null);
         setView('library');
      }
    }
  };

  const handleSwitchTab = async (tabId: string) => {
     setActiveTabId(tabId);
     await db.tabs.update(tabId, { lastAccessed: Date.now() });
     setView('reader');
  };

  const handleQuoteClick = (book: Book, highlight: Highlight) => {
    handleOpenBook(book, { page: highlight.page, cfi: highlight.cfiRange });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'reader') return;
      
      // Ctrl+W: Close Tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
         e.preventDefault();
         if (activeTabId) handleCloseTab(e as any, activeTabId);
      }
      
      // Ctrl+Tab would be here but difficult to override in browser
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, activeTabId, tabs]);

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-white overflow-hidden selection:bg-blue-500/30">
      <AnimatePresence mode="wait">
        {view === 'library' ? (
          <motion.div 
            key="library"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(20px)' }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
            className="w-full h-full"
          >
            <Library onOpenBook={handleOpenBook} onQuoteClick={handleQuoteClick} initialTab="library" />
          </motion.div>
        ) : (
          <motion.div 
            key="reader-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full relative z-10 bg-[#0a0a0a]"
          >
            {/* TAB BAR */}
            {tabs.length > 0 && (
              <div className="fixed top-0 left-0 right-0 h-10 bg-black/80 backdrop-blur-md border-b border-white/5 z-[60] flex items-end px-4 gap-1 overflow-x-auto no-scrollbar">
                 {tabs.map(tab => (
                    <div 
                       key={tab.id}
                       onClick={() => handleSwitchTab(tab.id)}
                       className={`
                          group relative flex items-center gap-2 px-4 py-2 min-w-[120px] max-w-[200px] cursor-pointer transition-all rounded-t-lg select-none
                          ${activeTabId === tab.id ? 'bg-[#1a1a1a] text-white shadow-[0_-2px_10px_rgba(0,0,0,0.2)]' : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'}
                       `}
                    >
                       {/* Active Indicator Top Line */}
                       {activeTabId === tab.id && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />}
                       
                       <span className="text-xs font-medium truncate flex-1">{tab.title}</span>
                       
                       {/* Close Button */}
                       <button 
                          onClick={(e) => handleCloseTab(e, tab.id)}
                          className={`p-0.5 rounded-full hover:bg-white/20 ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                       >
                          <X className="w-3 h-3" />
                       </button>
                    </div>
                 ))}
                 {/* Add Button */}
                 <button 
                    onClick={() => setView('library')} 
                    className="p-2 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white transition-colors mb-1"
                    title="Open another book"
                 >
                    <Plus className="w-4 h-4" />
                 </button>
              </div>
            )}

            {/* READERS - Multi-Instance Rendering */}
            {tabs.map(tab => {
               const isTabActive = activeTabId === tab.id;
               return (
                  <div key={tab.id} style={{ display: isTabActive ? 'block' : 'none', height: '100vh' }}>
                     <ReaderWrapper 
                        tab={tab} 
                        isActive={isTabActive}
                        onClose={() => setView('library')} 
                        initialLocation={tabLocations[tab.id]}
                        hasTabs={tabs.length > 0}
                     />
                  </div>
               );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Wrapper to handle individual book data fetching
const ReaderWrapper: React.FC<{ 
  tab: Tab, 
  isActive: boolean, 
  onClose: () => void, 
  initialLocation?: {page?: number, cfi?: string},
  hasTabs: boolean
}> = ({ tab, isActive, onClose, initialLocation, hasTabs }) => {
   const book = useLiveQuery(() => db.books.get(tab.bookId));
   
   if (!book) return <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-zinc-500">Loading book...</div>;
   
   return (
      <Reader 
         book={book} 
         onClose={onClose} 
         initialLocation={initialLocation} 
         hasTabs={hasTabs}
      />
   );
};
