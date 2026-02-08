const CLIENT_ID_KEY = "seq_cid";
let memoryClientId = null;

const bytesToHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const uuidFromBytes = (bytes) => {
  const hex = bytesToHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

const generateUuid = () => {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Set version (4) and variant (10xx)
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      return uuidFromBytes(bytes);
    }
  }

  // Fallback to Math.random (lower quality but acceptable)
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return uuidFromBytes(bytes);
};

export const getClientId = () => {
  if (memoryClientId) return memoryClientId;
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) {
      memoryClientId = existing;
      return existing;
    }
  } catch {}

  const nextId = generateUuid();
  memoryClientId = nextId;
  try {
    localStorage.setItem(CLIENT_ID_KEY, nextId);
  } catch {}
  return nextId;
};
