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

// Better seed mixing to avoid collisions on similar strings
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32FromInt(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
  const seed32 = xmur3(String(seed))();
  const rnd = mulberry32FromInt(seed32);
  return shuffle(base, rnd);
}
