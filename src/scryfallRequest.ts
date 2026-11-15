/** Uma fila para as consultas ao Scryfall desta instância do site.
 * Consultas de busca/coleção têm limite menor que o da API geral. */
const GAP_MS = 650;
let tail: Promise<void> = Promise.resolve();
let lastStart = 0;
let blockedUntil = 0;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function scryfallFetch(url: string, init?: RequestInit, fetcher: typeof fetch = fetch): Promise<Response> {
  const task = tail.then(async () => {
    if (Date.now() < blockedUntil) return new Response(null, { status: 429 });
    const pause = GAP_MS - (Date.now() - lastStart);
    if (pause > 0) await sleep(pause);
    if (Date.now() < blockedUntil) return new Response(null, { status: 429 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      lastStart = Date.now();
      const headers = new Headers(init?.headers);
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
      const response = await fetcher(url, { ...init, headers, signal: controller.signal });
      if (response.status === 429) {
        const header = response.headers.get("Retry-After");
        const seconds = header === null ? NaN : Number(header);
        const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header ?? "") - Date.now();
        blockedUntil = Date.now() + Math.max(60000, Number.isFinite(requested) ? requested : 0);
      }
      return response;
    } finally { clearTimeout(timeout); }
  });
  tail = task.then(() => undefined, () => undefined);
  return task;
}
