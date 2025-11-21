
import Dexie, { Table } from 'dexie';
import { Book, Highlight, Bookmark, Collection, ReadingSettings, ReadingSession, Badge, Tab } from './types';

// Helper to safely access window.ePub
declare global {
  interface Window {
    ePub: any;
  }
}

export class LexiconDatabase extends Dexie {
  books!: Table<Book>;
  highlights!: Table<Highlight>;
  bookmarks!: Table<Bookmark>;
  collections!: Table<Collection>;
  readingSessions!: Table<ReadingSession>;
  badges!: Table<Badge>;
  tabs!: Table<Tab>;
  settings!: Table<{ id: string, value: ReadingSettings }>;

  constructor() {
    super('LexiconDB');
    (this as any).version(4).stores({
      books: 'id, title, author, dateAdded, lastRead, isFavorite, format, progress, *collectionIds',
      highlights: 'id, bookId, color, createdAt',
      bookmarks: 'id, bookId, type, timestamp, page',
      collections: 'id, name, createdAt',
      readingSessions: 'id, bookId, startTime, duration',
      badges: 'id, earnedAt',
      tabs: 'id, bookId, lastAccessed',
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
    margin: 'normal',
    pdfScale: 1.0
  };
  
  await db.settings.put({ id: 'user-preferences', value: defaults });
  return defaults;
};

export const saveSettings = async (settings: ReadingSettings) => {
  await db.settings.put({ id: 'user-preferences', value: settings });
};

export const addBookToDb = async (file: File): Promise<string> => {
  const id = crypto.randomUUID();
  
  let title = file.name.replace(/\.[^/.]+$/, "");
  let author = "Unknown Author";
  let coverUrl = generateGradientCover(id, title);
  let content = "";
  const format = file.name.split('.').pop()?.toLowerCase() as any || 'txt';

  // Handle EPUB Metadata Extraction
  if (format === 'epub' && window.ePub) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const book = window.ePub(arrayBuffer);
      await book.ready;
      
      // Metadata
      const meta = await book.loaded.metadata;
      if (meta.title) title = meta.title;
      if (meta.creator) author = meta.creator;

      // Cover
      const coverUrlBlob = await book.coverUrl();
      if (coverUrlBlob) {
        // Convert Blob URL to Base64
        const response = await fetch(coverUrlBlob);
        const blob = await response.blob();
        coverUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.error("Failed to parse EPUB metadata", e);
    }
  } else if (format === 'txt' || format === 'md') {
    content = await file.text();
  }

  const newBook: Book = {
    id,
    title,
    author,
    format,
    file: file,
    content,
    coverUrl,
    dateAdded: Date.now(),
    lastRead: Date.now(),
    progress: 0,
    currentPage: 1
  };

  await db.books.add(newBook);
  return id;
};

export const updateBookProgress = async (id: string, progress: number, cfi?: string) => {
  const updateData: any = { progress, lastRead: Date.now() };
  if (cfi) updateData.currentCfi = cfi;
  await db.books.update(id, updateData);
};

export const updateBookPage = async (id: string, currentPage: number, totalPages: number) => {
  const progress = (currentPage / totalPages) * 100;
  await db.books.update(id, { 
    currentPage, 
    totalPages, 
    progress, 
    lastRead: Date.now() 
  });
};

export const toggleFavorite = async (id: string, currentStatus: boolean | undefined) => {
  await db.books.update(id, { isFavorite: !currentStatus });
};

export const deleteBook = async (id: string) => {
  // Cast db to any to access 'transaction' if TS complains, or use standard way
  await (db as any).transaction('rw', [db.books, db.highlights, db.bookmarks, db.readingSessions, db.tabs], async () => {
    await db.books.delete(id);
    await db.highlights.where('bookId').equals(id).delete();
    await db.bookmarks.where('bookId').equals(id).delete();
    await db.readingSessions.where('bookId').equals(id).delete();
    await db.tabs.where('bookId').equals(id).delete();
  });
};

// --- Highlights Operations ---

export const addHighlight = async (highlight: Highlight) => {
  await db.highlights.add(highlight);
  
  // Badge Check: Highlighter (100 highlights)
  const count = await db.highlights.count();
  if (count >= 100) unlockBadge('highlighter');
};

export const deleteHighlight = async (id: string) => {
  await db.highlights.delete(id);
};

export const updateHighlightNote = async (id: string, note: string) => {
  await db.highlights.update(id, { note });
  // Badge Check: Thoughtful (50 notes)
  const count = await db.highlights.filter(h => !!h.note).count();
  if (count >= 50) unlockBadge('thoughtful');
};

export const updateHighlightColor = async (id: string, color: Highlight['color']) => {
  await db.highlights.update(id, { color });
};

export const getBookHighlights = async (bookId: string) => {
  return await db.highlights.where('bookId').equals(bookId).toArray();
};

// --- Bookmarks Operations ---

export const addBookmark = async (bookmark: Bookmark) => {
  if (bookmark.thumbnail && bookmark.thumbnail.length > 500000) {
    console.warn("Thumbnail too large, not saving");
    bookmark.thumbnail = undefined; 
  }
  await db.bookmarks.add(bookmark);
};

export const deleteBookmark = async (id: string) => {
  await db.bookmarks.delete(id);
};

export const getBookBookmarks = async (bookId: string) => {
  return await db.bookmarks.where('bookId').equals(bookId).reverse().sortBy('timestamp');
};

// --- Collections Operations ---

export const createCollection = async (name: string, color: string, icon: string) => {
  const newCollection: Collection = {
    id: crypto.randomUUID(),
    name,
    color,
    icon,
    bookIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await db.collections.add(newCollection);
  return newCollection.id;
};

export const deleteCollection = async (id: string) => {
  await (db as any).transaction('rw', [db.collections, db.books], async () => {
    const collection = await db.collections.get(id);
    if (!collection) return;
    
    const books = await db.books.bulkGet(collection.bookIds);
    for (const book of books) {
      if (book && book.collectionIds) {
        const newIds = book.collectionIds.filter(cid => cid !== id);
        await db.books.update(book.id, { collectionIds: newIds });
      }
    }
    await db.collections.delete(id);
  });
};

export const toggleBookInCollection = async (bookId: string, collectionId: string) => {
  await (db as any).transaction('rw', [db.collections, db.books], async () => {
    const collection = await db.collections.get(collectionId);
    const book = await db.books.get(bookId);
    if (!collection || !book) return;

    const bookIds = new Set(collection.bookIds);
    const collectionIds = new Set(book.collectionIds || []);

    if (bookIds.has(bookId)) {
      bookIds.delete(bookId);
      collectionIds.delete(collectionId);
    } else {
      bookIds.add(bookId);
      collectionIds.add(collectionId);
    }

    await db.collections.update(collectionId, { 
      bookIds: Array.from(bookIds),
      updatedAt: Date.now()
    });
    await db.books.update(bookId, { collectionIds: Array.from(collectionIds) });
  });
};

// --- Reading Sessions & Badges ---

export const logReadingSession = async (bookId: string, durationMs: number) => {
  if (durationMs < 1000 * 60) return; // Ignore sessions < 1 minute

  const session: ReadingSession = {
    id: crypto.randomUUID(),
    bookId,
    startTime: Date.now() - durationMs,
    endTime: Date.now(),
    duration: durationMs
  };

  await db.readingSessions.add(session);

  // Check Badges
  const finishedCount = await db.books.filter(b => Math.floor(b.progress) === 100).count();
  if (finishedCount >= 5) unlockBadge('completionist');
  if (finishedCount >= 10) unlockBadge('bookworm');
};

const unlockBadge = async (badgeId: string) => {
  const exists = await db.badges.get(badgeId);
  if (!exists) {
    await db.badges.add({ id: badgeId, earnedAt: Date.now() });
  }
};

// --- Tab Operations ---

export const saveTab = async (tab: Tab) => {
  await db.tabs.put(tab);
};

export const deleteTab = async (id: string) => {
  await db.tabs.delete(id);
};

export const getTabs = async () => {
  return await db.tabs.orderBy('lastAccessed').reverse().toArray();
};

function generateGradientCover(id: string, title: string): string {
  // Phase 2 Polish: More vibrant, premium gradients
  const gradients = [
    'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', // Blue to Violet
    'linear-gradient(135deg, #db2777 0%, #9333ea 100%)', // Pink to Purple
    'linear-gradient(135deg, #059669 0%, #0284c7 100%)', // Emerald to Sky
    'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)', // Orange to Red
    'linear-gradient(135deg, #0f172a 0%, #334155 100%)', // Slate
    'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)', // Royal to Cyan
    'linear-gradient(135deg, #be185d 0%, #f43f5e 100%)', // Pink to Rose
  ];
  const index = id.charCodeAt(0) % gradients.length;
  return `gradient:${gradients[index]}`; 
}
