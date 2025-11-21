
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, createCollection, deleteCollection, toggleBookInCollection } from '../db';
import { Collection, Book } from '../types';
import { 
  BookOpen, Star, Clock, CheckCircle, Inbox, 
  Plus, X, Trash2, Hash, Smile, LayoutGrid, 
  Target, Zap, Lightbulb, Flag
} from 'lucide-react';
import { Button } from './ui/Button';

interface CollectionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
}

const SMART_COLLECTIONS = [
  { id: 'all', label: 'All Books', icon: BookOpen, color: 'text-white' },
  { id: 'favorites', label: 'Favorites', icon: Star, color: 'text-yellow-400' },
  { id: 'reading', label: 'Currently Reading', icon: Clock, color: 'text-blue-400' },
  { id: 'finished', label: 'Finished', icon: CheckCircle, color: 'text-green-400' },
  { id: 'recent', label: 'Recently Added', icon: Inbox, color: 'text-purple-400' },
];

const GRADIENTS = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-orange-500 to-red-500',
  'from-green-500 to-emerald-500',
  'from-slate-500 to-zinc-500',
];

const ICONS = [
  { char: '📚', name: 'Books' },
  { char: '🎓', name: 'School' },
  { char: '💡', name: 'Idea' },
  { char: '🚀', name: 'Rocket' },
  { char: '❤️', name: 'Love' },
  { char: '🔥', name: 'Fire' },
  { icon: Target, name: 'Target' },
  { icon: Flag, name: 'Flag' },
  { icon: Zap, name: 'Zap' },
];

export const CollectionsPanel: React.FC<CollectionsPanelProps> = ({ 
  isOpen, onClose, activeCollectionId, onSelectCollection 
}) => {
  const collections = useLiveQuery(() => db.collections.orderBy('createdAt').toArray());
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create Form State
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(GRADIENTS[0]);
  const [newIcon, setNewIcon] = useState('📚');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createCollection(newName, newColor, newIcon);
    setNewName('');
    setShowCreateModal(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this collection? Books inside will not be deleted.')) {
      if (activeCollectionId === id) onSelectCollection('all');
      await deleteCollection(id);
    }
  };

  const handleDrop = async (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-blue-500', 'bg-white/5');
    
    const bookId = e.dataTransfer.getData('bookId');
    if (bookId && collectionId) {
      await toggleBookInCollection(bookId, collectionId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('ring-2', 'ring-blue-500', 'bg-white/5');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-blue-500', 'bg-white/5');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div 
            initial={{ x: -320 }} 
            animate={{ x: 0 }} 
            exit={{ x: -320 }} 
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 bottom-0 w-full md:w-80 bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-white/10 z-50 shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Collections</h2>
              <button onClick={onClose} className="p-3 md:p-2 hover:bg-white/10 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
              {/* Smart Collections */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-2">Library</h3>
                {SMART_COLLECTIONS.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { onSelectCollection(item.id === 'all' ? null : item.id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg transition-all text-sm font-medium ${
                      (activeCollectionId === item.id) || (item.id === 'all' && !activeCollectionId) 
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                        : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 md:w-4 md:h-4 ${item.color}`} />
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Collections */}
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-3 px-2">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Your Shelves</h3>
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full text-white flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
                
                {collections?.length === 0 && (
                  <div className="px-3 py-8 text-center border border-dashed border-white/10 rounded-lg">
                    <LayoutGrid className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500">Create collections to organize your books</p>
                  </div>
                )}

                {collections?.map(collection => (
                  <motion.div
                    key={collection.id}
                    layout
                    onDrop={(e) => handleDrop(e, collection.id)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => { onSelectCollection(collection.id); onClose(); }}
                    className={`group relative w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all cursor-pointer border ${
                      activeCollectionId === collection.id 
                        ? 'bg-white/10 border-white/20' 
                        : 'bg-transparent border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded flex items-center justify-center text-xs bg-gradient-to-br ${collection.color}`}>
                      {collection.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-zinc-200 truncate">{collection.name}</div>
                      <div className="text-xs text-zinc-500">{collection.bookIds.length} books</div>
                    </div>

                    {/* Actions */}
                    <button 
                      onClick={(e) => handleDelete(collection.id, e)}
                      className="p-2 md:p-1.5 rounded-md hover:bg-red-500/20 text-zinc-600 hover:text-red-400 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Create Modal */}
          <AnimatePresence>
            {showCreateModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                  onClick={() => setShowCreateModal(false)}
                />
                <motion.div 
                  initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                  className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl"
                >
                  <h3 className="text-lg font-bold mb-4">New Collection</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Name</label>
                      <input 
                        type="text" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 md:py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g., Sci-Fi, Favorites"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Color</label>
                      <div className="grid grid-cols-5 gap-3 md:gap-2">
                        {GRADIENTS.map((g) => (
                          <button
                            key={g}
                            onClick={() => setNewColor(g)}
                            className={`w-10 h-10 md:w-8 md:h-8 rounded-full bg-gradient-to-br ${g} ring-2 transition-all ${newColor === g ? 'ring-white scale-110' : 'ring-transparent hover:scale-105'}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                       <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Icon</label>
                       <div className="flex flex-wrap gap-3 md:gap-2 h-32 overflow-y-auto custom-scrollbar p-1">
                          {ICONS.map((item: any, i) => (
                             <button 
                                key={i} 
                                onClick={() => setNewIcon(item.char || 'icon')}
                                className={`w-10 h-10 md:w-8 md:h-8 rounded flex items-center justify-center text-lg hover:bg-white/10 transition-colors ${newIcon === (item.char || 'icon') ? 'bg-white/20' : ''}`}
                             >
                                {item.char ? item.char : <item.icon className="w-5 h-5 md:w-4 md:h-4" />}
                             </button>
                          ))}
                       </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleCreate}>Create Collection</Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};
