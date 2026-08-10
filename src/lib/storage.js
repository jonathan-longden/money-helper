// The artifact version of this app persisted through a host-provided
// `window.storage`. Standalone, everything lives in this device's
// localStorage — nothing leaves the phone, and nothing needs a login.

const PREFIX = "budget:";

export const SETUP_KEY = `${PREFIX}setup`;
export const WHOAMI_KEY = `${PREFIX}whoami`;
export const spendingKey = (month) => `${PREFIX}spending:${month}`;

const available = (() => {
  try {
    const probe = `${PREFIX}__probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    // Private-mode Safari and locked-down browsers throw on write.
    return false;
  }
})();

export const storageAvailable = available;

export function readJSON(key, fallback) {
  if (!available) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  if (!available) throw new Error("storage unavailable");
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readText(key, fallback = null) {
  if (!available) return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeText(key, value) {
  if (!available) throw new Error("storage unavailable");
  window.localStorage.setItem(key, value);
}

// --- Backup ---------------------------------------------------------------
// localStorage is per-device and a browser "clear site data" wipes it, so the
// ledger can be exported to a file and read back on another device.

export function exportAll() {
  const data = {};
  if (available) {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) data[key] = window.localStorage.getItem(key);
    }
  }
  return {
    app: "household-ledger",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function importAll(payload) {
  if (!payload || payload.app !== "household-ledger" || !payload.data) {
    throw new Error("That file isn't a Household Ledger backup.");
  }
  if (!available) throw new Error("storage unavailable");

  const entries = Object.entries(payload.data).filter(
    ([key, value]) => key.startsWith(PREFIX) && typeof value === "string"
  );
  if (entries.length === 0) throw new Error("That backup is empty.");

  // Drop the current ledger first so a restore is a replacement, not a merge
  // that could leave months from two different devices interleaved.
  const stale = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(PREFIX)) stale.push(key);
  }
  stale.forEach((key) => window.localStorage.removeItem(key));
  entries.forEach(([key, value]) => window.localStorage.setItem(key, value));
}
