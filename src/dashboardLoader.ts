// Share the expensive request across mounts (including React StrictMode).
const API = "https://api.corneliomove.com.br/mtg-api/api/dashboard";
const DB_NAME = "pina-dashboard-cache-v1";
const MAX_AGE = 24 * 60 * 60 * 1000;
let pending: Promise<unknown> | undefined;
let database: Promise<IDBDatabase> | undefined;

function openCache(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("snapshots")) request.result.createObjectStore("snapshots");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Cache bloqueado"));
  }).catch((error: unknown) => { database = undefined; throw error; });
  return database;
}

function validDashboard(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const data = value as { leaderboards?: Record<string, { players?: unknown; decks?: unknown }>; activity?: unknown };
  return Boolean(data.activity && ["geral", "evento", "mes", "semestre"].every((period) =>
    Array.isArray(data.leaderboards?.[period]?.players) && Array.isArray(data.leaderboards?.[period]?.decks),
  ));
}

export async function readDashboardCache<T>(): Promise<T | null> {
  try {
    const db = await openCache();
    return await new Promise<T | null>((resolve, reject) => {
      const request = db.transaction("snapshots", "readonly").objectStore("snapshots").get("dashboard");
      request.onsuccess = () => {
        const entry = request.result as { savedAt?: number; data?: unknown } | undefined;
        resolve(entry && typeof entry.savedAt === "number" && Date.now() - entry.savedAt < MAX_AGE && validDashboard(entry.data) ? entry.data as T : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch { return null; }
}

async function saveDashboardCache(data: unknown): Promise<void> {
  try {
    const db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").put({ savedAt: Date.now(), data }, "dashboard");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch { /* Storage may be unavailable or full. Network remains authoritative. */ }
}

export function fetchLeagueDashboard<T>(force = false): Promise<T> {
  if (pending) return pending as Promise<T>;
  pending = (async () => {
    const response = await fetch(force ? `${API}?refresh=1` : API, { cache: "no-store", signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error("Não foi possível carregar os dados da liga.");
    const data: unknown = await response.json();
    if (!validDashboard(data)) throw new Error("Resposta inválida do dashboard.");
    void saveDashboardCache(data);
    return data;
  })().finally(() => { pending = undefined; });
  return pending as Promise<T>;
}
