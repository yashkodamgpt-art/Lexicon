import Dexie, { Table } from 'dexie';
import { Book, Highlight, Bookmark, Collection, ReadingSettings } from './types';

export class LexiconDatabase extends Dexie {
  books!: Table<Book>;
  highlights!: Table<Highlight>;
  bookmarks!: Table<Bookmark>;
  collections!: Table<Collection>;
  settings!: Table<{ id: string, value: ReadingSettings }>;

  constructor() {
    super('LexiconDB');
    // Use 'this as any' to bypass strict TS checks on the Dexie subclass version method if needed, 
    // or simply call version() if types allow. Safe fallback used here.
    (this as any).version(1).stores({
      books: 'id, title, author, dateAdded, lastRead, isFavorite, format, progress',
      highlights: 'id, bookId, color, createdAt',
      bookmarks: 'id, bookId, type, timestamp',
      collections: 'id, name, createdAt',
      settings: 'id'
    });
  }
}

export const db = new LexiconDatabase();

// Initialize default settings if not present
export const initSettings = async (): Promise<ReadingSettings> => {
  const existing = await db.settings.get('user-preferences');
  if (existing) return existing.value;

  const defaults: ReadingSettings = {
    theme: 'night',
    fontFamily: 'sans',
    fontSize: 18,
    lineHeight: 1.6,
    maxWidth: 800,
    textAlign: 'left',
    margin: 'normal'
  };
  
  await db.settings.put({ id: 'user-preferences', value: defaults });
  return defaults;
};

export const saveSettings = async (settings: ReadingSettings) => {
  await db.settings.put({ id: 'user-preferences', value: settings });
};

export const addBookToDb = async (file: File): Promise<string> => {
  const id = crypto.randomUUID();
  
  // Phase 1: Basic Text Extraction for TXT/MD
  let content = "";
  let title = file.name.replace(/\.[^/.]+$/, "");
  const format = file.name.split('.').pop()?.toLowerCase() as any || 'txt';

  if (format === 'txt' || format === 'md') {
    content = await file.text();
  } else {
    content = "This format is stored but rendering is limited in Phase 1 demo. Please use TXT or MD files for full experience.";
  }

  const newBook: Book = {
    id,
    title,
    author: "Unknown Author", 
    format,
    file: file,
    content,
    dateAdded: Date.now(),
    lastRead: Date.now(),
    progress: 0,
    coverUrl: generateGradientCover(id, title)
  };

  await db.books.add(newBook);
  return id;
};

export const updateBookProgress = async (id: string, progress: number) => {
  await db.books.update(id, { progress, lastRead: Date.now() });
};

export const toggleFavorite = async (id: string, currentStatus: boolean | undefined) => {
  await db.books.update(id, { isFavorite: !currentStatus });
};

export const deleteBook = async (id: string) => {
  await db.books.delete(id);
};

function generateGradientCover(id: string, title: string): string {
  return `gradient:${id}`; 
}