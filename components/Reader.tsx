import React, { useState, useEffect, useRef } from 'react';
import { Book, ReadingSettings, THEMES } from '../types';
import { updateBookProgress, initSettings, saveSettings } from '../db';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Settings, BrainCircuit, X, AlignLeft, AlignJustify
} from 'lucide-react';

interface ReaderProps {
  book: Book;
  onClose: () => void;
}

export const Reader: React.FC<ReaderProps> = ({ book, onClose }) => {
  const [settings, setSettings] = useState<ReadingSettings | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // Use 'any' or 'number' for browser compatibility to avoid Node.Timeout type conflicts
  const controlsTimeoutRef = useRef<any>(null);

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
  
  // Controls auto-hide logic
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!showSettings) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', resetControlsTimeout);
    window.addEventListener('click', resetControlsTimeout);
    window.addEventListener('scroll', resetControlsTimeout);
    window.addEventListener('keydown', resetControlsTimeout);
    
    return () => {
      window.removeEventListener('mousemove', resetControlsTimeout);
      window.removeEventListener('click', resetControlsTimeout);
      window.removeEventListener('scroll', resetControlsTimeout);
      window.removeEventListener('keydown', resetControlsTimeout);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showSettings]);

  // Scroll Progress Tracking
  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
      if (!isNaN(progress)) {
        updateBookProgress(book.id, progress);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position
  useEffect(() => {
    if (book.progress > 0) {
      setTimeout(() => {
        const { scrollHeight, clientHeight } = document.documentElement;
        const targetScroll = (book.progress / 100) * (scrollHeight - clientHeight);
        window.scrollTo({ top: targetScroll, behavior: 'auto' });
      }, 100);
    }
  }, []);

  if (!settings) return null;

  const theme = THEMES[settings.theme];
  
  const fontStyles = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono'
  };

  const marginStyles = {
    narrow: 'max-w-[600px]',
    normal: 'max-w-[800px]',
    wide: 'max-w-[1000px]'
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`min-h-screen transition-colors duration-500 ${theme.bg} ${theme.text} selection:bg-blue-500/30`}
    >
      {/* Top Bar */}
      <motion.div 
        initial={{ y: -100 }}
        animate={{ y: showControls || showSettings ? 0 : -100 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed top-0 left-0 right-0 h-16 ${theme.ui} backdrop-blur-lg border-b ${theme.border} z-40 flex items-center justify-between px-4 md:px-8 shadow-sm`}
      >
        <div className="flex items-center gap-4">
          <button onClick={onClose} className={`p-2 rounded-full hover:bg-white/10 transition-colors ${theme.text}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm max-w-[150px] md:max-w-[300px] truncate">{book.title}</h1>
            <span className="text-xs opacity-60 truncate">{book.author}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
            {/* Phase 2: AI Button (Disabled) */}
            <div className="group relative hidden md:block">
                <button 
                  disabled 
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${theme.border} border bg-opacity-20 cursor-not-allowed opacity-50 grayscale hover:grayscale-0 transition-all`}
                >
                  <BrainCircuit className="w-4 h-4" />
                  <span className="text-xs font-medium">Generate Mindmap</span>
                </button>
                <div className="absolute top-full mt-2 right-0 w-64 p-3 bg-black/90 text-xs text-center text-zinc-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10 z-50 shadow-xl">
                    <div className="font-bold text-white mb-1">Coming in Phase 2</div>
                    Connect your Gemini API key to generate interactive mindmaps from this book.
                </div>
            </div>

            <div className="h-6 w-[1px] bg-current opacity-10 mx-2"></div>

            <button 
              onClick={() => {
                setShowSettings(!showSettings);
                setShowControls(true);
              }}
              className={`p-2 rounded-full transition-all ${showSettings ? 'bg-blue-500 text-white rotate-180' : 'hover:bg-white/10'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
        </div>
      </motion.div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={`fixed top-0 right-0 bottom-0 w-80 md:w-96 ${theme.ui} backdrop-blur-xl border-l ${theme.border} shadow-2xl z-50 overflow-y-auto`}
            >
               <div className="p-6">
                 <div className="flex items-center justify-between mb-8">
                   <h2 className="text-lg font-bold">Appearance</h2>
                   <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full">
                     <X className="w-5 h-5" />
                   </button>
                 </div>

                 {/* Themes */}
                 <div className="mb-8">
                   <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-4 block">Theme</label>
                   <div className="grid grid-cols-5 gap-3">
                     {(Object.values(THEMES)).map((t) => (
                       <button
                        key={t.id}
                        onClick={() => setSettings({...settings, theme: t.id})}
                        className={`group relative flex flex-col items-center gap-2`}
                       >
                         <div className={`w-12 h-12 rounded-full border-2 shadow-sm transition-transform group-hover:scale-110 ${t.bg} ${settings.theme === t.id ? 'border-blue-500 scale-110 ring-2 ring-blue-500/30' : 'border-transparent'}`}>
                            {settings.theme === t.id && (
                               <motion.div layoutId="activeTheme" className="absolute inset-0 rounded-full border-2 border-blue-500" />
                            )}
                         </div>
                         <span className="text-[10px] opacity-60 group-hover:opacity-100 transition-opacity">{t.name}</span>
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Typography */}
                 <div className="mb-8">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-4 block">Typography</label>
                    <div className="flex bg-black/10 p-1 rounded-lg mb-4">
                       {['sans', 'serif', 'mono'].map((f) => (
                         <button
                            key={f}
                            onClick={() => setSettings({...settings, fontFamily: f as any})}
                            className={`flex-1 py-2 text-sm rounded-md transition-all ${settings.fontFamily === f ? 'bg-white text-black shadow-sm font-bold' : 'text-current opacity-60 hover:opacity-100'}`}
                         >
                           {f === 'sans' ? 'Inter' : f === 'serif' ? 'Serif' : 'Mono'}
                         </button>
                       ))}
                    </div>

                    <div className="space-y-6">
                       <div>
                          <div className="flex justify-between mb-2">
                              <span className="text-xs opacity-50">Size</span>
                              <span className="text-xs font-mono">{settings.fontSize}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="14" 
                            max="32" 
                            value={settings.fontSize}
                            onChange={(e) => setSettings({...settings, fontSize: parseInt(e.target.value)})}
                            className="w-full accent-blue-500 h-1.5 bg-current/10 rounded-lg appearance-none cursor-pointer"
                          />
                       </div>
                       
                       <div>
                          <div className="flex justify-between mb-2">
                              <span className="text-xs opacity-50">Line Height</span>
                              <span className="text-xs font-mono">{settings.lineHeight}</span>
                          </div>
                          <input 
                            type="range" 
                            min="1" 
                            max="2.5" 
                            step="0.1"
                            value={settings.lineHeight}
                            onChange={(e) => setSettings({...settings, lineHeight: parseFloat(e.target.value)})}
                            className="w-full accent-blue-500 h-1.5 bg-current/10 rounded-lg appearance-none cursor-pointer"
                          />
                       </div>
                    </div>
                 </div>

                 {/* Layout */}
                 <div className="mb-8">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-4 block">Layout</label>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                       <button 
                         onClick={() => setSettings({...settings, textAlign: 'left'})}
                         className={`flex items-center justify-center gap-2 p-2 rounded-lg border ${settings.textAlign === 'left' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-current/10 opacity-60'}`}
                       >
                         <AlignLeft className="w-4 h-4" /> Left
                       </button>
                       <button 
                         onClick={() => setSettings({...settings, textAlign: 'justify'})}
                         className={`flex items-center justify-center gap-2 p-2 rounded-lg border ${settings.textAlign === 'justify' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-current/10 opacity-60'}`}
                       >
                         <AlignJustify className="w-4 h-4" /> Justify
                       </button>
                    </div>

                    <div className="flex justify-between items-center bg-black/10 p-1 rounded-lg">
                       {['narrow', 'normal', 'wide'].map((m) => (
                         <button
                            key={m}
                            onClick={() => setSettings({...settings, margin: m as any})}
                            className={`flex-1 py-2 text-xs rounded-md transition-all uppercase tracking-wider ${settings.margin === m ? 'bg-white text-black shadow-sm font-bold' : 'opacity-60'}`}
                         >
                           {m}
                         </button>
                       ))}
                    </div>
                 </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div 
        ref={contentRef}
        className={`mx-auto min-h-screen pt-32 pb-32 px-6 md:px-12 transition-all duration-300 ease-in-out ${fontStyles[settings.fontFamily]} ${marginStyles[settings.margin]}`}
        style={{ 
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
          textAlign: settings.textAlign
        }}
      >
         {/* Title Page */}
         <div className="mb-24 text-center border-b border-current/10 pb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight tracking-tight">{book.title}</h1>
            <p className="text-xl opacity-60 font-serif italic">{book.author}</p>
            <div className="mt-8 flex justify-center gap-2">
               <span className="px-3 py-1 rounded-full border border-current/10 text-xs uppercase tracking-wider opacity-50">{book.format}</span>
               <span className="px-3 py-1 rounded-full border border-current/10 text-xs uppercase tracking-wider opacity-50">{Math.round(book.progress)}% Read</span>
            </div>
         </div>

         {/* Text Rendering */}
         <div className="whitespace-pre-wrap">
            {book.content || (
              <div className="p-8 rounded-xl border border-dashed border-current/20 text-center opacity-70">
                 <p>Binary content ({book.format}) is stored safely.</p>
                 <p className="text-sm mt-2">Full rendering for PDF/EPUB will be enabled in Phase 1.5. <br/>For now, please enjoy the TXT/MD experience.</p>
              </div>
            )}
         </div>
         
         {/* End of Book Marker */}
         <div className="mt-32 flex flex-col items-center justify-center opacity-50">
            <div className="w-16 h-1 bg-current mb-4 rounded-full" />
            <p className="text-sm uppercase tracking-widest font-bold">End of Book</p>
         </div>
      </div>

      {/* Footer Progress */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: showControls ? 0 : 100 }}
        transition={{ duration: 0.3 }}
        className={`fixed bottom-0 left-0 right-0 h-16 ${theme.ui} backdrop-blur-lg border-t ${theme.border} z-40 flex items-center justify-center px-8`}
      >
        <div className="flex items-center gap-6 w-full max-w-2xl">
          <span className="text-xs opacity-50 font-mono w-12 text-right">0%</span>
          <div className="flex-1 group relative h-1.5 bg-current/10 rounded-full cursor-pointer">
             <motion.div 
               className={`h-full ${theme.id === 'day' ? 'bg-blue-600' : 'bg-blue-500'} rounded-full relative`}
               style={{ width: `${Math.max(book.progress, 0)}%` }} 
             >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
             </motion.div>
          </div>
          <span className="text-xs opacity-50 font-mono w-12 text-left">100%</span>
        </div>
      </motion.div>
    </motion.div>
  );
};