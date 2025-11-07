function idx(r, c) {
  return r * 10 + c;
}

export function precomputeLines() {
  const lines = [];
  // Horizontal
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c <= 10 - 5; c++) {
      lines.push([
        idx(r, c),
        idx(r, c + 1),
        idx(r, c + 2),
        idx(r, c + 3),
        idx(r, c + 4),
      ]);
    }
  }
  // Vertical
  for (let c = 0; c < 10; c++) {
    for (let r = 0; r <= 10 - 5; r++) {
      lines.push([
        idx(r, c),
        idx(r + 1, c),
        idx(r + 2, c),
        idx(r + 3, c),
        idx(r + 4, c),
      ]);
    }
  }
  // Diagonal down-right
  for (let r = 0; r <= 10 - 5; r++) {
    for (let c = 0; c <= 10 - 5; c++) {
      lines.push([
        idx(r, c),
        idx(r + 1, c + 1),
        idx(r + 2, c + 2),
        idx(r + 3, c + 3),
        idx(r + 4, c + 4),
      ]);
    }
  }
  // Diagonal up-right
  for (let r = 4; r < 10; r++) {
    for (let c = 0; c <= 10 - 5; c++) {
      lines.push([
        idx(r, c),
        idx(r - 1, c + 1),
        idx(r - 2, c + 2),
        idx(r - 3, c + 3),
        idx(r - 4, c + 4),
      ]);
    }
  }
  return lines;
}

export const ALL_LINES = precomputeLines();
