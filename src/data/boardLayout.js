function c(rank, suit) {
  return { type: "card", rank, suit };
}

const rows = [
  // 1
  [
    { type: "wild" },
    c("6", "diamond"),
    c("7", "diamond"),
    c("8", "diamond"),
    c("9", "diamond"),
    c("10", "diamond"),
    c("Q", "diamond"),
    c("K", "diamond"),
    c("A", "diamond"),
    { type: "wild" },
  ],
  // 2
  [
    c("5", "diamond"),
    c("3", "heart"),
    c("2", "heart"),
    c("2", "spade"),
    c("3", "spade"),
    c("4", "spade"),
    c("5", "spade"),
    c("6", "spade"),
    c("7", "spade"),
    c("A", "club"),
  ],
  // 3
  [
    c("4", "diamond"),
    c("4", "heart"),
    c("K", "diamond"),
    c("A", "diamond"),
    c("A", "club"),
    c("K", "club"),
    c("Q", "club"),
    c("10", "club"),
    c("8", "spade"),
    c("K", "club"),
  ],
  // 4
  [
    c("3", "diamond"),
    c("5", "heart"),
    c("Q", "diamond"),
    c("Q", "heart"),
    c("10", "heart"),
    c("9", "heart"),
    c("8", "heart"),
    c("9", "club"),
    c("9", "spade"),
    c("Q", "club"),
  ],
  // 5
  [
    c("2", "diamond"),
    c("6", "heart"),
    c("10", "diamond"),
    c("K", "heart"),
    c("3", "heart"),
    c("2", "heart"),
    c("7", "heart"),
    c("8", "club"),
    c("10", "spade"),
    c("10", "club"),
  ],
  // 6
  [
    c("A", "spade"),
    c("7", "heart"),
    c("9", "diamond"),
    c("A", "heart"),
    c("4", "heart"),
    c("5", "heart"),
    c("6", "heart"),
    c("7", "club"),
    c("Q", "spade"),
    c("9", "club"),
  ],
  // 7
  [
    c("K", "spade"),
    c("8", "heart"),
    c("8", "diamond"),
    c("2", "club"),
    c("3", "club"),
    c("4", "club"),
    c("5", "club"),
    c("6", "club"),
    c("K", "spade"),
    c("8", "club"),
  ],
  // 8
  [
    c("Q", "spade"),
    c("9", "heart"),
    c("7", "diamond"),
    c("6", "diamond"),
    c("5", "diamond"),
    c("4", "diamond"),
    c("3", "diamond"),
    c("2", "diamond"),
    c("A", "spade"),
    c("7", "club"),
  ],
  // 9
  [
    c("10", "spade"),
    c("10", "heart"),
    c("Q", "heart"),
    c("K", "heart"),
    c("A", "heart"),
    c("2", "club"),
    c("3", "club"),
    c("4", "club"),
    c("5", "club"),
    c("6", "club"),
  ],
  // 10
  [
    { type: "wild" },
    c("9", "spade"),
    c("8", "spade"),
    c("7", "spade"),
    c("6", "spade"),
    c("5", "spade"),
    c("4", "spade"),
    c("3", "spade"),
    c("2", "spade"),
    { type: "wild" },
  ],
];

const layout = rows.flat();

export default layout;
