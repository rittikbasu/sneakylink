import { ALL_LINES } from "./lines";

function cornerIndex(idx) {
  const r = Math.floor(idx / 10);
  const c = idx % 10;
  return (
    (r === 0 && c === 0) ||
    (r === 0 && c === 9) ||
    (r === 9 && c === 0) ||
    (r === 9 && c === 9)
  );
}

function nonCorner(line) {
  return line.filter((i) => !cornerIndex(i));
}

/**
 * Calculate the maximum number of non-overlapping sequences for a given team.
 * - occ: Map<index, { team: "A" | "B" | "C" }>
 * - team: "A" | "B" | "C"
 */
export function countMaxSequences(occ, team) {
  const existingLines = [];

  for (const line of ALL_LINES) {
    let ok = true;
    for (const idx of line) {
      if (cornerIndex(idx)) continue;
      const o = occ.get(idx);
      if (!o || o.team !== team) {
        ok = false;
        break;
      }
    }
    if (ok) existingLines.push(line);
  }

  const candidates = existingLines;
  if (candidates.length === 0) return 0;

  let maxFound = 0;

  function search(idx, usedChips, count) {
    if (idx === candidates.length) {
      maxFound = Math.max(maxFound, count);
      return;
    }
    if (count + (candidates.length - idx) <= maxFound) return;

    const line = candidates[idx];
    const nc = nonCorner(line);

    let overlap = 0;
    for (const i of nc) {
      if (usedChips.has(i)) overlap++;
    }

    if (overlap <= 1) {
      const nextChips = new Set(usedChips);
      for (const i of nc) nextChips.add(i);
      search(idx + 1, nextChips, count + 1);
    }

    search(idx + 1, usedChips, count);
  }

  search(0, new Set(), 0);
  return maxFound;
}


