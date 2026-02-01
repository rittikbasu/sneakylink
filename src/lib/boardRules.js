import { ALL_LINES } from "./lines";

export const coordToIndex = (coord) => {
  const [r, c] = coord.split(",").map((n) => parseInt(n, 10));
  return r * 10 + c;
};

export const indexToCoord = (idx) => {
  const r = Math.floor(idx / 10);
  const c = idx % 10;
  return `${r},${c}`;
};

export const isCornerIndex = (idx) =>
  idx === 0 || idx === 9 || idx === 90 || idx === 99;

const nonCornerIndices = (line) => line.filter((idx) => !isCornerIndex(idx));

const completeLinesForTeam = (occ, team) => {
  const lines = [];
  for (const line of ALL_LINES) {
    let ok = true;
    for (const idx of line) {
      if (isCornerIndex(idx)) continue;
      const o = occ.get(idx);
      if (!o || o.team !== team) {
        ok = false;
        break;
      }
    }
    if (ok) lines.push(line);
  }
  return lines;
};

export const countMaxSequences = (occ, team) => {
  const candidates = completeLinesForTeam(occ, team);
  if (candidates.length === 0) return 0;

  let maxFound = 0;

  function search(idx, usedChips, count) {
    if (idx === candidates.length) {
      maxFound = Math.max(maxFound, count);
      return;
    }
    if (count + (candidates.length - idx) <= maxFound) return;

    const line = candidates[idx];
    const nc = nonCornerIndices(line);

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
};

export const computeSequenceSets = (chips) => {
  function acceptedLines(team) {
    const used = new Set();
    const acc = [];
    for (const line of ALL_LINES) {
      let ok = true;
      for (const idx of line) {
        if (isCornerIndex(idx)) continue;
        if (chips.get(idx) !== team) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      let overlap = 0;
      for (const idx of nonCornerIndices(line)) {
        if (used.has(idx)) overlap++;
        if (overlap > 1) break;
      }
      if (overlap <= 1) {
        acc.push(line);
        for (const idx of nonCornerIndices(line)) used.add(idx);
      }
    }
    return acc;
  }

  const aLines = acceptedLines("A");
  const bLines = acceptedLines("B");
  const cLines = acceptedLines("C");
  const seqA = new Set();
  const seqB = new Set();
  const seqC = new Set();
  for (const line of aLines) for (const i of nonCornerIndices(line)) seqA.add(i);
  for (const line of bLines) for (const i of nonCornerIndices(line)) seqB.add(i);
  for (const line of cLines) for (const i of nonCornerIndices(line)) seqC.add(i);
  return { seqA, seqB, seqC };
};

export const isIndexInLockedSequence = (occ, idx, team) => {
  const used = new Set();
  const accepted = [];
  for (const line of ALL_LINES) {
    let ok = true;
    for (const p of line) {
      if (isCornerIndex(p)) continue;
      const o = occ.get(p);
      if (!o || o.team !== team) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    let overlap = 0;
    for (const p of line) {
      if (isCornerIndex(p)) continue;
      if (used.has(p)) overlap++;
      if (overlap > 1) break;
    }
    if (overlap <= 1) {
      accepted.push(line);
      for (const p of line) if (!isCornerIndex(p)) used.add(p);
    }
  }
  for (const line of accepted) {
    if (!isCornerIndex(idx) && line.includes(idx)) return true;
  }
  return false;
};
