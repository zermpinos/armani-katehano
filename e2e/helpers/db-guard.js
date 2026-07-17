const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

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
