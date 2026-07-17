const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

// Specs that mutate state behind BASE_URL (a game, the maintenance flag) write
// through the live API, so the write lands in that deployment's database rather
// than the runner's. Nothing observable from here tells us whether that database
// is disposable, so the caller has to declare it.
export function isWritableTarget() {
  return process.env.E2E_WRITABLE_TARGET === "1";
}

// Local, preview and production currently share one database, so "not remote"
// is no guarantee the target is disposable. Only the host tells us that.
export function isLocalDatabase(url = process.env.DATABASE_URL) {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function assertLocalDatabase() {
  if (isLocalDatabase()) return;
  throw new Error(
    "E2E setup mutates the database (it clears LoginAttempt and creates fixture rows) " +
    "and refuses to run against a non-local DATABASE_URL. Point DATABASE_URL at a " +
    "local Postgres before running the E2E suite.",
  );
}
