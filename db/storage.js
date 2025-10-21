const DB_NAME = "smart-study";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const KV_STORE = "kv";

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          db.createObjectStore(SESSION_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function withStore(storeName, mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let callbackResult;
    let callbackError;
    let isPromise = false;

    try {
      const possiblePromise = callback(store);
      isPromise = possiblePromise instanceof Promise;
      if (isPromise) {
        possiblePromise
          .then((value) => {
            callbackResult = value;
          })
          .catch((error) => {
            callbackError = error;
            transaction.abort();
          });
      } else {
        callbackResult = possiblePromise;
      }
    } catch (error) {
      callbackError = error;
      transaction.abort();
    }

    transaction.oncomplete = () => {
      if (callbackError) {
        reject(callbackError);
      } else if (isPromise) {
        resolve(callbackResult);
      } else {
        resolve(callbackResult);
      }
    };
    transaction.onerror = () => reject(transaction.error || callbackError);
    transaction.onabort = () => reject(transaction.error || callbackError);
  });
}

export async function saveSession(session) {
  const data = typeof session.toJSON === "function" ? session.toJSON() : session;
  if (!data?.id) {
    throw new Error("Session must include an id before saving.");
  }
  await withStore(SESSION_STORE, "readwrite", (store) => {
    store.put({
      ...data,
      savedAt: new Date().toISOString()
    });
  });

  await setLastSessionId(data.id);
  return data.id;
}

export async function loadSession(id) {
  if (!id) {
    return null;
  }
  return withStore(SESSION_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  });
}

export async function deleteSession(id) {
  if (!id) return;
  await withStore(SESSION_STORE, "readwrite", (store) => store.delete(id));
  const current = await getLastSessionId();
  if (current === id) {
    await setLastSessionId(null);
  }
}

export async function listSessions() {
  return withStore(SESSION_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const sessions = Array.isArray(request.result) ? request.result : [];
        sessions.sort((a, b) => {
          const aTime = new Date(a.updatedAt || 0).getTime();
          const bTime = new Date(b.updatedAt || 0).getTime();
          return bTime - aTime;
        });
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export async function setLastSessionId(id) {
  await withStore(KV_STORE, "readwrite", (store) => {
    if (id) {
      store.put({ key: "lastSessionId", value: id });
    } else {
      store.delete("lastSessionId");
    }
  });
}

export async function getLastSessionId() {
  return withStore(KV_STORE, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get("lastSessionId");
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
  });
}
