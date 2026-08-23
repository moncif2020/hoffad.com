// Ultra-resilient offline storage & downloader engine for Holy Quran pages (604 pages)
// Supports: Cache API + IndexedDB + Session Memory Fallback

const CACHE_NAME = 'hoffad-quran-pages-v2';
const DB_NAME = 'Hoffad_Mushaf_Offline_v2';
const STORE_NAME = 'pages';

// In-memory cache for ultra-fast access
const memoryCache = new Map<number, Blob>();

// 1. Safe Cache API helper
async function getCache(): Promise<Cache | null> {
  try {
    if (typeof caches !== 'undefined' && caches.open) {
      return await caches.open(CACHE_NAME);
    }
  } catch (e) {
    // Cache API not available
  }
  return null;
}

// 2. Safe IndexedDB helper with 1.5s timeout to prevent hanging in iframes
let idbAvailable: boolean | null = null;

async function getIDB(): Promise<IDBDatabase | null> {
  if (idbAvailable === false || typeof indexedDB === 'undefined') return null;

  return new Promise<IDBDatabase | null>((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        idbAvailable = false;
        resolve(null);
      }
    }, 1500);

    try {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'page' });
        }
      };

      request.onsuccess = (event) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          idbAvailable = true;
          resolve((event.target as IDBOpenDBRequest).result);
        }
      };

      request.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          idbAvailable = false;
          resolve(null);
        }
      };

      request.onblocked = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(null);
        }
      };
    } catch {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        idbAvailable = false;
        resolve(null);
      }
    }
  });
}

/**
 * Save page blob to Cache API and IndexedDB and Memory Cache
 */
export async function savePageOffline(page: number, blob: Blob): Promise<void> {
  memoryCache.set(page, blob);

  // Save to Cache API
  try {
    const cache = await getCache();
    if (cache) {
      const cacheUrl = `https://hoffad-quran.local/pages/${page}.jpg`;
      const response = new Response(blob, {
        headers: {
          'Content-Type': blob.type || 'image/jpeg',
          'Content-Length': String(blob.size),
          'Cache-Control': 'public, max-age=31536000'
        }
      });
      await cache.put(cacheUrl, response);
    }
  } catch {}

  // Save to IndexedDB (convert to arrayBuffer for max browser compatibility)
  try {
    const db = await getIDB();
    if (db) {
      const buffer = await blob.arrayBuffer();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ page, buffer, mime: blob.type || 'image/jpeg' });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch {}
}

/**
 * Retrieve page blob from Memory > Cache API > IndexedDB
 */
export async function getPageOffline(page: number): Promise<Blob | null> {
  // 1. Memory cache
  if (memoryCache.has(page)) {
    return memoryCache.get(page)!;
  }

  // 2. Cache API
  try {
    const cache = await getCache();
    if (cache) {
      const cacheUrl = `https://hoffad-quran.local/pages/${page}.jpg`;
      const matched = await cache.match(cacheUrl);
      if (matched) {
        const blob = await matched.blob();
        if (blob && blob.size > 500) {
          memoryCache.set(page, blob);
          return blob;
        }
      }
    }
  } catch {}

  // 3. IndexedDB
  try {
    const db = await getIDB();
    if (db) {
      const blob = await new Promise<Blob | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(page);
        req.onsuccess = () => {
          if (req.result?.buffer) {
            const b = new Blob([req.result.buffer], { type: req.result.mime || 'image/jpeg' });
            resolve(b);
          } else if (req.result?.blob instanceof Blob) {
            resolve(req.result.blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });

      if (blob && blob.size > 500) {
        memoryCache.set(page, blob);
        return blob;
      }
    }
  } catch {}

  return null;
}

/**
 * Get count of all stored pages
 */
export async function getStoredPagesCount(): Promise<number> {
  const pages = await getStoredPageNumbers();
  return pages.size;
}

/**
 * Get set of stored page numbers
 */
export async function getStoredPageNumbers(): Promise<Set<number>> {
  const pageSet = new Set<number>();

  // From memory
  for (const p of memoryCache.keys()) {
    pageSet.add(p);
  }

  // From Cache API
  try {
    const cache = await getCache();
    if (cache) {
      const keys = await cache.keys();
      for (const req of keys) {
        const match = req.url.match(/hoffad-quran\.local\/pages\/(\d+)\.jpg/);
        if (match) {
          pageSet.add(parseInt(match[1], 10));
        }
      }
    }
  } catch {}

  // From IndexedDB
  try {
    const db = await getIDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => {
          const keys = (req.result as number[]) || [];
          keys.forEach((k) => pageSet.add(k));
          resolve();
        };
        req.onerror = () => resolve();
      });
    }
  } catch {}

  return pageSet;
}

export const savePageToIndexedDB = (page: number, blobOrBuffer: Blob | ArrayBuffer) => {
  const blob = blobOrBuffer instanceof Blob ? blobOrBuffer : new Blob([blobOrBuffer], { type: 'image/jpeg' });
  return savePageOffline(page, blob);
};

export const getPageFromIndexedDB = (page: number) => getPageOffline(page);

export const getPageMirrors = (pageNum: number): string[] => {
  const pad3 = pageNum.toString().padStart(3, '0');
  return [
    `/api/quran-page/${pageNum}`,
    `https://cdn.jsdelivr.net/gh/QuranHub/quran-pages-images@main/kfgqpc/warsh/${pageNum}.jpg`,
    `https://fastly.jsdelivr.net/gh/QuranHub/quran-pages-images@main/kfgqpc/warsh/${pageNum}.jpg`,
    `https://cdn.jsdelivr.net/gh/QuranHub/quran-pages-images@main/kfgqpc/hafs-wasat/${pageNum}.jpg`,
    `https://files.quran.app/hafs/madani/width_1260/page${pad3}.png`,
    `https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/kfgqpc/warsh/${pageNum}.jpg`
  ];
};

/**
 * Loads a Quran page blob, prioritizing offline cache then CDN mirrors.
 */
export async function loadQuranPageBlob(
  pageNum: number,
  signal?: AbortSignal
): Promise<{ blob: Blob; source: 'offline' | 'network'; url?: string } | null> {
  // 1. Check offline storage
  const offlineBlob = await getPageOffline(pageNum);
  if (offlineBlob && offlineBlob.size > 500) {
    return { blob: offlineBlob, source: 'offline' };
  }

  // 2. Fetch from CDN mirrors with individual 6s timeout
  const mirrors = getPageMirrors(pageNum);
  for (const url of mirrors) {
    if (signal?.aborted) return null;

    try {
      const fetchCtrl = new AbortController();
      const timeoutId = setTimeout(() => fetchCtrl.abort(), 6000);

      const onAbort = () => fetchCtrl.abort();
      if (signal) signal.addEventListener('abort', onAbort);

      const res = await fetch(url, {
        mode: 'cors',
        signal: fetchCtrl.signal
      });

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onAbort);

      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 500) {
          // Save offline in background
          savePageOffline(pageNum, blob).catch(() => {});
          return { blob, source: 'network', url };
        }
      }
    } catch {
      if (signal?.aborted) return null;
      // Try next mirror
    }
  }

  return null;
}

export interface DownloadProgressInfo {
  completed: number;
  total: number;
  percent: number;
  currentPage?: number;
  status: 'downloading' | 'completed' | 'error';
}

/**
 * Downloads all 604 Quran pages with robust concurrency and instant progress updates.
 */
export async function downloadAllQuranPages(
  totalPages = 604,
  onProgress?: (info: DownloadProgressInfo) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; completed: number; total: number }> {
  // 1. Check stored pages
  const stored = await getStoredPageNumbers();
  const missing: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (!stored.has(i)) {
      missing.push(i);
    }
  }

  let completedCount = totalPages - missing.length;

  if (onProgress) {
    onProgress({
      completed: completedCount,
      total: totalPages,
      percent: Math.round((completedCount / totalPages) * 100),
      status: completedCount >= totalPages ? 'completed' : 'downloading'
    });
  }

  if (missing.length === 0) {
    return { success: true, completed: totalPages, total: totalPages };
  }

  const concurrency = 4;
  let nextMissingIdx = 0;

  const worker = async () => {
    while (nextMissingIdx < missing.length) {
      if (signal?.aborted) break;
      const curIdx = nextMissingIdx++;
      if (curIdx >= missing.length) break;

      const pageNum = missing[curIdx];

      try {
        const result = await loadQuranPageBlob(pageNum, signal);
        if (result && result.blob && result.blob.size > 500) {
          completedCount++;
        }
      } catch {}

      if (onProgress) {
        onProgress({
          completed: completedCount,
          total: totalPages,
          percent: Math.min(100, Math.round((completedCount / totalPages) * 100)),
          currentPage: pageNum,
          status: 'downloading'
        });
      }

      // 30ms yield to keep browser event loop smooth
      await new Promise((r) => setTimeout(r, 30));
    }
  };

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const finalStoredCount = await getStoredPagesCount();
  const isSuccess = finalStoredCount >= totalPages - 5;

  if (onProgress) {
    onProgress({
      completed: finalStoredCount,
      total: totalPages,
      percent: Math.min(100, Math.round((finalStoredCount / totalPages) * 100)),
      status: isSuccess ? 'completed' : 'error'
    });
  }

  return {
    success: isSuccess,
    completed: finalStoredCount,
    total: totalPages
  };
}
