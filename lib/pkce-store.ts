type PkceEntry = {
  verifier: string;
  createdAtMs: number;
};

const globalPkce = globalThis as unknown as { pkceStore?: Map<string, PkceEntry> };
const TTL_MS = 10 * 60 * 1000;

function store(): Map<string, PkceEntry> {
  if (!globalPkce.pkceStore) {
    globalPkce.pkceStore = new Map<string, PkceEntry>();
  }
  return globalPkce.pkceStore;
}

export function putPkceVerifier(state: string, verifier: string): void {
  const map = store();
  map.set(state, { verifier, createdAtMs: Date.now() });
}

export function takePkceVerifier(state: string): string | null {
  const map = store();
  const item = map.get(state);
  if (!item) {
    return null;
  }
  map.delete(state);

  if (Date.now() - item.createdAtMs > TTL_MS) {
    return null;
  }
  return item.verifier;
}

