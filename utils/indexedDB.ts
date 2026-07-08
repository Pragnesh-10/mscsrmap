const DB_NAME = 'MSC_Scanner_DB';
const DB_VERSION = 1;

export interface OfflineCheckin {
  id?: number;
  eventId: string;
  hash: string;
  type: 'PRIMARY' | 'MEMBER';
  memberIndex?: number;
  timestamp: number;
}

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is not available on server-side'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database failed to open:', event);
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('registrations')) {
        db.createObjectStore('registrations', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function saveRegistrations(regs: any[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['registrations'], 'readwrite');
    const store = transaction.objectStore('registrations');

    // Clear old registrations first
    store.clear();

    regs.forEach((reg) => {
      store.put(reg);
    });

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = (e) => {
      console.error('Error saving registrations to IndexedDB:', e);
      reject(e);
    };
  });
}

export async function saveSingleRegistration(reg: any): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['registrations'], 'readwrite');
    const store = transaction.objectStore('registrations');
    const request = store.put(reg);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (e) => {
      console.error('Error saving single registration to IndexedDB:', e);
      reject(e);
    };
  });
}

export async function getRegistrationByHash(hash: string): Promise<any | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['registrations'], 'readonly');
    const store = transaction.objectStore('registrations');
    const request = store.openCursor();
    
    let found = false;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        if (cursor.value.hash_payload === hash) {
          resolve(cursor.value);
          found = true;
          return;
        }
        cursor.continue();
      } else {
        if (!found) {
          resolve(null);
        }
      }
    };

    request.onerror = (e) => {
      reject(e);
    };
  });
}

export async function updateLocalRegistrationCheckin(
  hash: string,
  type: 'PRIMARY' | 'MEMBER',
  memberIndex?: number
): Promise<void> {
  const db = await initDB();
  const reg = await getRegistrationByHash(hash);
  if (!reg) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['registrations'], 'readwrite');
    const store = transaction.objectStore('registrations');

    if (type === 'PRIMARY') {
      reg.checked_in = true;
    } else if (type === 'MEMBER' && typeof memberIndex === 'number' && reg.team_data && reg.team_data.members) {
      if (reg.team_data.members[memberIndex]) {
        reg.team_data.members[memberIndex].checked_in = true;
      }
    }

    const request = store.put(reg);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (e) => {
      reject(e);
    };
  });
}

export async function addToSyncQueue(
  eventId: string,
  hash: string,
  type: 'PRIMARY' | 'MEMBER',
  memberIndex?: number
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');

    const checkin: OfflineCheckin = {
      eventId,
      hash,
      type,
      memberIndex,
      timestamp: Date.now(),
    };

    const request = store.add(checkin);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (e) => {
      reject(e);
    };
  });
}

export async function getSyncQueue(): Promise<OfflineCheckin[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync_queue'], 'readonly');
    const store = transaction.objectStore('sync_queue');
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest<OfflineCheckin[]>).result);
    };

    request.onerror = (e) => {
      reject(e);
    };
  });
}

export async function removeFromSyncQueue(ids: number[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');

    ids.forEach((id) => {
      store.delete(id);
    });

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = (e) => {
      reject(e);
    };
  });
}

export async function getRegistrationCount(): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['registrations'], 'readonly');
    const store = transaction.objectStore('registrations');
    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (e) => {
      reject(e);
    };
  });
}

export async function searchCachedRegistrations(query: string): Promise<any[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['registrations'], 'readonly');
    const store = transaction.objectStore('registrations');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const all = request.result;
      if (!query.trim()) {
        resolve([]);
        return;
      }
      const term = query.toLowerCase();
      const matches = all.filter(reg => {
        const leadEmail = reg.lead_email?.toLowerCase() || '';
        const name = reg.form_data?.fullName?.toLowerCase() || '';
        const regNum = reg.form_data?.regNum?.toLowerCase() || '';
        const teamName = reg.team_data?.teamName?.toLowerCase() || '';
        
        let memberMatch = false;
        if (reg.team_data?.members) {
          memberMatch = reg.team_data.members.some((m: any) => 
            m.fullName?.toLowerCase().includes(term) || 
            m.regNum?.toLowerCase().includes(term) ||
            m.email?.toLowerCase().includes(term)
          );
        }
        
        return leadEmail.includes(term) || name.includes(term) || regNum.includes(term) || teamName.includes(term) || memberMatch;
      });
      resolve(matches.slice(0, 5));
    };
    
    request.onerror = (e) => {
      reject(e);
    };
  });
}