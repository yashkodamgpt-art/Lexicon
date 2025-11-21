import React, { useState } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { Book, ViewState } from './types';
import { AnimatePresence, motion } from 'framer-motion';

export default function App() {
  const [view, setView] = useState<ViewState>('library');
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  const handleOpenBook = (book: Book) => {
    setActiveBook(book);
    setView('reader');
  };

  const handleCloseBook = () => {
    setView('library');
    setTimeout(() => setActiveBook(null), 500);
  };

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-white overflow-hidden selection:bg-blue-500/30">
      <AnimatePresence mode="wait">
        {view === 'library' ? (
          <motion.div 
            key="library"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(20px)' }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }} // Apple-style easing
            className="w-full h-full"
          >
            <Library onOpenBook={handleOpenBook} />
          </motion.div>
        ) : (
          <motion.div 
            key="reader"
            initial={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
            className="w-full h-full relative z-10"
          >
            {activeBook && <Reader book={activeBook} onClose={handleCloseBook} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}