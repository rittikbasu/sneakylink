const suits = ["spade", "heart", "club", "diamond"];
const ranks = [
  "A",
  "K",
  "Q",
  "J",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
]; // J included for jacks

function mulberry32(seed) {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (a + seed.charCodeAt(i)) | 0;
  let t = (a + 0x6d2b79f5) | 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, rnd) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function formatCard(rank, suit) {
  return `${rank}_${suit}`; // e.g., "10_spade"
}

export function parseCard(card) {
  const [rank, suit] = card.split("_");
  return { rank, suit };
}

export function generateTwoDecks() {
  const deck = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(formatCard(rank, suit));
      }
    }
  }
  // Sequence uses jacks as one-eyed/two-eyed logic, so keep them
  return deck;
}

export function generateShuffledDeck(seed) {
  const base = generateTwoDecks();
  const rnd = mulberry32(seed);
  return shuffle(base, rnd);
}
