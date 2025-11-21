export type BookFormat = 'pdf' | 'epub' | 'txt' | 'md';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  format: BookFormat;
  file: Blob;
  content?: string;
  
  // Metadata
  dateAdded: number;
  lastRead: number;
  progress: number; // 0-100
  totalPages?: number;
  currentPage?: number;
  isFavorite?: boolean;
  collectionIds?: string[];
  
  // Phase 2 Placeholders
  hasMindmap?: boolean;
}

export interface Theme {
  id: 'day' | 'night' | 'sepia' | 'twilight' | 'console';
  name: string;
  bg: string;
  text: string;
  accent: string;
  ui: string;
  border: string;
}

export interface ReadingSettings {
  theme: Theme['id'];
  fontFamily: 'sans' | 'serif' | 'mono';
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  textAlign: 'left' | 'justify';
  margin: 'narrow' | 'normal' | 'wide';
}

export interface Highlight {
  id: string;
  bookId: string;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'purple' | 'red';
  note?: string;
  cfiRange?: string;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  page: number; // or progress percentage if pageless
  type: 'standard' | 'favorite' | 'note';
  note?: string;
  timestamp: number;
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  icon: string;
  bookIds: string[];
  createdAt: number;
}

export type ViewState = 'library' | 'reader';

export const THEMES: Record<Theme['id'], Theme> = {
  day: { 
    id: 'day', 
    name: 'Day', 
    bg: 'bg-[#fafafa]', 
    text: 'text-[#1a1a1a]', 
    accent: 'text-[#0066ff]',
    ui: 'bg-white/90',
    border: 'border-zinc-200'
  },
  night: { 
    id: 'night', 
    name: 'Night', 
    bg: 'bg-[#0a0a0a]', 
    text: 'text-[#ffffff]', 
    accent: 'text-[#0088ff]',
    ui: 'bg-[#111111]/90',
    border: 'border-zinc-800'
  },
  sepia: { 
    id: 'sepia', 
    name: 'Sepia', 
    bg: 'bg-[#f4ecd8]', 
    text: 'text-[#3e2723]', 
    accent: 'text-[#e65100]',
    ui: 'bg-[#e9e2d0]/90',
    border: 'border-[#d7ccc8]'
  },
  twilight: { 
    id: 'twilight', 
    name: 'Twilight', 
    bg: 'bg-[#1a0f2e]', 
    text: 'text-[#e0e0e0]', 
    accent: 'text-[#9c88ff]',
    ui: 'bg-[#251842]/90',
    border: 'border-[#362858]'
  },
  console: { 
    id: 'console', 
    name: 'Console', 
    bg: 'bg-[#0d1117]', 
    text: 'text-[#39ff14]', 
    accent: 'text-[#00ffff]',
    ui: 'bg-[#050505]/90',
    border: 'border-[#30363d]'
  },
};