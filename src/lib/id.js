const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CHAR_MAP = {};
for (let i = 0; i < ALPHABET.length; i++) {
  CHAR_MAP[ALPHABET[i]] = i;
}

function computeChecksumChar(base) {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    const val = CHAR_MAP[base[i]];
    // Use weight = index + 1 to detect transpositions
    sum += val * (i + 1);
  }
  return ALPHABET[sum % ALPHABET.length];
}

export function generateRoomCode(length = 6) {
  // Generate length-1 random characters
  let out = "";
  for (let i = 0; i < length - 1; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  // Append checksum character
  return out + computeChecksumChar(out);
}

export function validateRoomCode(code) {
  if (!code || typeof code !== "string") return false;
  const upper = code.toUpperCase();
  // Check length and invalid characters
  if (upper.length !== 6) return false;
  for (let i = 0; i < upper.length; i++) {
    if (CHAR_MAP[upper[i]] === undefined) return false;
  }

  const base = upper.slice(0, -1);
  const check = upper.slice(-1);
  return computeChecksumChar(base) === check;
}

export function generateSeed() {
  // Simple readable seed
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${ts}-${rnd}`;
}
