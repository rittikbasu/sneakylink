import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PlayingCard from "./PlayingCard";
import boardLayout from "@/data/boardLayout";
import { X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function c(rank, suit) {
  return { type: "card", rank, suit };
}

/** Cycles 0 → steps-1 while `active` is true. */
function useAnimStep(steps, ms, active) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    let iid;
    const tid = setTimeout(() => {
      setStep(0);
      iid = setInterval(() => setStep((s) => (s + 1) % steps), ms);
    }, 200);
    return () => {
      clearTimeout(tid);
      if (iid !== undefined) clearInterval(iid);
    };
  }, [active, steps, ms]);
  return step;
}

/** Animated text that transitions smoothly between phases. */
function StepText({ textKey, children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={textKey}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════
   Mini board primitives
   ═══════════════════════════════════════════════════════════ */

function MiniCell({ cell, chip, highlight, seq, glow, dim }) {
  return (
    <div
      className={`relative transition-opacity duration-300 ${dim ? "opacity-50" : ""}`}
    >
      <PlayingCard {...cell} interactive={false} />

      {/* Team chip ring */}
      <AnimatePresence>
        {chip && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className={`absolute inset-px rounded-md ring-2 pointer-events-none ${
              chip === "A"
                ? "ring-emerald-500"
                : chip === "B"
                ? "ring-sky-500"
                : "ring-rose-500"
            }`}
          />
        )}
      </AnimatePresence>

      {/* Highlight pulse */}
      {highlight && (
        <div
          className={`absolute inset-0 rounded-md ring-2 pointer-events-none animate-pulse ${
            highlight === "amber"
              ? "ring-amber-400/80"
              : highlight === "red"
              ? "ring-red-400/80"
              : highlight === "sky"
              ? "ring-sky-400/80"
              : "ring-emerald-400/80"
          }`}
        />
      )}

      {/* Sequence tint */}
      {seq && (
        <div className="absolute inset-0 rounded-md bg-emerald-500/20 pointer-events-none" />
      )}

      {/* Glow */}
      {glow && (
        <div className="absolute inset-0 rounded-md shadow-[0_0_10px_3px_rgba(16,185,129,0.5)] pointer-events-none animate-pulse" />
      )}
    </div>
  );
}

function MiniBoard({
  cells,
  chips = {},
  highlights = {},
  seqs = {},
  glows = {},
  dims = {},
  cols = 5,
  className = "",
}) {
  return (
    <div
      className={`rounded-xl p-2.5 sm:p-3 border border-white/10 shadow-[0_0_20px_2px_rgba(59,130,246,0.12)] grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "6px" }}
    >
      {cells.map((cell, i) => (
        <div key={i}>
          <MiniCell
            cell={cell}
            chip={chips[i]}
            highlight={highlights[i]}
            seq={seqs[i]}
            glow={glows[i]}
            dim={dims[i]}
          />
        </div>
      ))}
    </div>
  );
}

/** Compact 10×10 minimap of the real game board. */
function FullBoard({ className = "" }) {
  return (
    <div
      className={`rounded-xl p-1.5 sm:p-2 border border-white/10 shadow-[0_0_20px_2px_rgba(59,130,246,0.12)] ${className}`}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(10, 1fr)", gap: "5px" }}
      >
        {boardLayout.map((cell, i) => (
          <div
            key={i}
            className={`aspect-5/7 rounded-sm ${
              cell.type === "free"
                ? "bg-linear-to-br from-emerald-900/40 to-teal-900/40 ring-1 ring-emerald-500/50 animate-pulse"
                : "bg-zinc-900 ring-1 ring-white/[0.07]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slide 1 — What's a Sequence?
   ═══════════════════════════════════════════════════════════ */

const S1 = [
  c("6", "diamond"), c("7", "diamond"), c("8", "diamond"), c("9", "diamond"), c("10", "diamond"),
  c("3", "heart"),   c("2", "heart"),   c("2", "spade"),   c("3", "spade"),   c("4", "spade"),
  c("4", "heart"),   c("K", "diamond"), c("A", "diamond"), c("A", "club"),    c("K", "club"),
  c("5", "heart"),   c("Q", "diamond"), c("Q", "heart"),   c("10", "heart"),  c("9", "heart"),
  c("6", "heart"),   c("10", "diamond"),c("K", "heart"),   c("3", "heart"),   c("2", "heart"),
];

function SlideSequence({ active }) {
  const step = useAnimStep(11, 450, active);
  const row = [10, 11, 12, 13, 14];
  const chips = { 1: "B", 6: "B", 18: "B" };
  const seqs = {};
  const glows = {};

  if (step <= 8) {
    row.forEach((idx, i) => {
      if (step >= i) chips[idx] = "A";
      if (step >= 5) {
        seqs[idx] = true;
        glows[idx] = true;
      }
    });
  }

  const textPhase = step <= 4 ? "placing" : "done";

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-5 w-full">
      <MiniBoard
        cells={S1}
        chips={chips}
        seqs={seqs}
        glows={glows}
        className="w-full max-w-xs sm:max-w-[264px]"
      />
      <div className="min-h-[48px] flex items-start justify-center">
        <StepText textKey={textPhase}>
          <p className="text-sm text-gray-300 text-center leading-relaxed max-w-xs px-2">
            {textPhase === "placing" ? (
              <>
                Place your team&apos;s{" "}
                <span className="text-white font-semibold">chips in a row</span>{" "}
                on the board
              </>
            ) : (
              <>
                <span className="text-emerald-400 font-semibold">5 in a row</span>{" "}
                forms a sequence! Horizontal, vertical, or diagonal
              </>
            )}
          </p>
        </StepText>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slide 2 — The Board
   ═══════════════════════════════════════════════════════════ */

function SlideBoard() {
  return (
    <div className="flex flex-col items-center gap-4 sm:gap-5 w-full">
      <FullBoard className="w-full max-w-[280px]" />
      <div className="text-center px-2 space-y-1.5 max-w-xs">
        <p className="text-sm text-gray-300 leading-relaxed">
          The board is a{" "}
          <span className="text-white font-semibold">10×10 grid</span> of
          playing cards. Each card appears{" "}
          <span className="text-white font-semibold">twice</span>.
        </p>
        <p className="text-sm text-emerald-400 leading-relaxed">
          The 4 corners are free and count for everyone!
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slide 3 — Playing a Card
   ═══════════════════════════════════════════════════════════ */

const S3 = [
  c("8", "diamond"), c("9", "diamond"), c("10", "diamond"), c("Q", "diamond"),
  c("2", "heart"),   c("2", "spade"),   c("3", "spade"),    c("4", "spade"),
  c("K", "diamond"), c("A", "diamond"), c("A", "club"),     c("K", "club"),
  c("5", "heart"),   c("Q", "heart"),   c("10", "heart"),   c("9", "heart"),
];
const S3_HAND = [
  c("K", "heart"),
  c("A", "diamond"),
  c("9", "diamond"),
  c("5", "club"),
  c("8", "spade"),
];
const S3_NEW_CARD = c("3", "heart");

function SlidePlayCard({ active }) {
  // 10 steps × 650ms ≈ 6.5 s loop
  const step = useAnimStep(10, 650, active);

  const selIdx = step >= 1 && step <= 4 ? 2 : null; // 9♦ selected
  const replaced = step >= 5; // new card persists until loop restart

  // Board
  const chips = { 5: "B", 10: "A" };
  const hl = {};
  const dims = {};
  if (step >= 2 && step <= 3) hl[1] = "emerald";
  if (step >= 4) chips[1] = "A"; // chip persists once placed

  // Dim only empty, non-matching cells (skip cells with chips)
  if (selIdx !== null) {
    for (let i = 0; i < S3.length; i++) {
      if (i !== 1 && !chips[i]) dims[i] = true;
    }
  }

  const textPhase = step === 0 ? "hand" : step <= 4 ? "pick" : "drawn";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <MiniBoard
        cells={S3}
        chips={chips}
        highlights={hl}
        dims={dims}
        cols={4}
        className="w-full max-w-[272px]"
      />

      {/* Hand */}
      <div className="flex gap-1.5 sm:gap-2 items-end justify-center">
        {S3_HAND.map((card, i) => {
          const isSel = selIdx === i;
          const isDimmed = selIdx !== null && !isSel;
          const showNew = i === 2 && replaced;
          const display = showNew ? S3_NEW_CARD : card;
          const key = showNew ? "new" : `o${i}`;

          return (
            <div key={i} className="w-10 sm:w-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{
                    opacity: isDimmed ? 0.4 : 1,
                    y: isSel ? -6 : 0,
                    scale: isSel ? 1.05 : 1,
                  }}
                  exit={{ opacity: 0, y: 8, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="relative"
                >
                  <PlayingCard {...display} interactive={false} />
                  {isSel && (
                    <div className="absolute inset-0 ring-2 ring-emerald-500 rounded-md pointer-events-none" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="min-h-[48px] flex items-start justify-center">
        <StepText textKey={textPhase}>
          <p className="text-sm text-gray-300 text-center leading-relaxed max-w-xs px-2">
            {textPhase === "hand" ? (
              <>
                You start with{" "}
                <span className="text-white font-semibold">5 cards</span> in
                your hand
              </>
            ) : textPhase === "pick" ? (
              <>
                <span className="text-white font-semibold">Pick a card</span>,
                find the{" "}
                <span className="text-white font-semibold">matching spot</span>,
                and place your chip
              </>
            ) : (
              <>
                A <span className="text-white font-semibold">new card</span> is
                drawn automatically to replace it
              </>
            )}
          </p>
        </StepText>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slide 4 — Jacks are Special
   ═══════════════════════════════════════════════════════════ */

const S4A = [
  c("8", "diamond"), c("9", "diamond"), c("10", "diamond"),
  c("2", "heart"),   c("2", "spade"),   c("3", "spade"),
  c("K", "diamond"), c("A", "diamond"), c("A", "club"),
];
const S4B = [
  c("6", "diamond"), c("7", "diamond"), c("8", "diamond"),
  c("3", "heart"),   c("2", "heart"),   c("4", "spade"),
  c("4", "heart"),   c("K", "diamond"), c("Q", "club"),
];

function SlideJacks({ active }) {
  const step = useAnimStep(14, 450, active);

  /* two-eyed demo (steps 0-6) */
  const chA = { 4: "A", 1: "B" };
  const hlA = {};
  const dimA = {};
  if (step >= 1 && step <= 3) {
    [0, 2, 3, 5, 6, 7, 8].forEach((i) => (hlA[i] = "amber"));
    dimA[1] = true;
    dimA[4] = true;
  }
  if (step >= 4 && step <= 6) chA[7] = "A";

  /* one-eyed demo (steps 7-13) */
  const chB = { 1: "B", 7: "A" };
  if (step < 11) chB[4] = "B";
  const hlB = {};
  const dimB = {};
  if (step >= 8 && step <= 10) {
    hlB[1] = "red";
    hlB[4] = "red";
    [0, 2, 3, 5, 6, 7, 8].forEach((i) => (dimB[i] = true));
  }

  const twoOn = step <= 6;

  return (
    <div className="flex gap-3 sm:gap-5 items-start justify-center w-full">
      {/* Two-eyed */}
      <div className="flex flex-col items-center gap-4 sm:gap-5 flex-1 max-w-[160px]">
        <motion.div
          animate={{ opacity: twoOn ? 1 : 0.35 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <MiniBoard
            cells={S4A}
            chips={chA}
            highlights={hlA}
            dims={dimA}
            cols={3}
            className="w-full"
          />
        </motion.div>
        <motion.div
          className="w-10 sm:w-12 mt-8 lg:mt-0"
          animate={
            twoOn ? { scale: 1.1, y: -3 } : { scale: 1, y: 0 }
          }
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <PlayingCard
            type="card"
            rank="J"
            suit="diamond"
            interactive={false}
          />
        </motion.div>
        <div className="text-center space-y-0.5">
          <p className="text-xs sm:text-sm text-amber-400 font-semibold">
            Two-Eyed Jack
          </p>
          <p className="text-[11px] sm:text-xs text-gray-400 leading-snug">
            Place on
            <br />
            <span className="text-white font-medium">any empty spot</span>
          </p>
        </div>
      </div>

      <div className="w-px self-stretch bg-white/10" />

      {/* One-eyed */}
      <div className="flex flex-col items-center gap-4 sm:gap-5 flex-1 max-w-[160px]">
        <motion.div
          animate={{ opacity: twoOn ? 0.35 : 1 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <MiniBoard
            cells={S4B}
            chips={chB}
            highlights={hlB}
            dims={dimB}
            cols={3}
            className="w-full"
          />
        </motion.div>
        <motion.div
          className="w-10 sm:w-12 mt-8 lg:mt-0"
          animate={
            twoOn ? { scale: 1, y: 0 } : { scale: 1.1, y: -3 }
          }
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <PlayingCard
            type="card"
            rank="J"
            suit="heart"
            interactive={false}
          />
        </motion.div>
        <div className="text-center space-y-0.5">
          <p className="text-xs sm:text-sm text-red-400 font-semibold">
            One-Eyed Jack
          </p>
          <p className="text-[11px] sm:text-xs text-gray-400 leading-snug">
            Remove an
            <br />
            <span className="text-white font-medium">opponent&apos;s chip</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slide 5 — Dead Cards
   ═══════════════════════════════════════════════════════════ */

const S5 = [
  c("7", "diamond"), c("9", "diamond"), c("10", "diamond"),
  c("2", "heart"),   c("3", "spade"),   c("4", "spade"),
  c("K", "diamond"), c("9", "diamond"), c("A", "club"),
];
const S5_HAND = [
  c("K", "heart"),
  c("9", "diamond"),
  c("A", "club"),
  c("8", "spade"),
  c("5", "club"),
];
const S5_NEW_CARD = c("Q", "heart");

function SlideDeadCards({ active }) {
  /*
   * Timeline (12 steps × 550ms ≈ 6.6s loop):
   *  0       idle
   *  1       dead card selected (red ring + lift), other hand cards dim
   *  2-3     board spots highlighted red (both 9♦ taken)
   *  3-4     dead card shakes
   *  5       "Dead Card?" button fades in
   *  6       button "pressed" (scale shrink)
   *  7       dead card exits → new card enters
   *  8-11    new card visible, idle
   */
  const step = useAnimStep(12, 550, active);

  const deadIdx = 1; // 9♦ in hand
  const chips = { 1: "B", 7: "A", 4: "A", 2: "B" };
  const hl = {};
  if (step >= 2 && step <= 5) {
    hl[1] = "red";
    hl[7] = "red";
  }

  const selDead = step >= 1 && step <= 6;
  const isShake = step >= 3 && step <= 4;
  const showBtn = step >= 5 && step <= 7;
  const isPressed = step >= 6 && step <= 7;
  const replaced = step >= 7; // new card persists until loop restart

  const textPhase = step <= 4 ? "dead" : step <= 6 ? "button" : "replaced";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <MiniBoard
        cells={S5}
        chips={chips}
        highlights={hl}
        cols={3}
        className="w-full max-w-[220px]"
      />

      {/* Hand */}
      <div className="flex gap-1.5 sm:gap-2 items-end justify-center">
        {S5_HAND.map((card, i) => {
          const isDead = i === deadIdx;
          const showNew = isDead && replaced;
          const display = showNew ? S5_NEW_CARD : card;
          const key = showNew ? "new" : `o${i}`;
          const isDimmed = selDead && !isDead;

          return (
            <div key={i} className="w-10 sm:w-12">
              <motion.div
                animate={
                  isDead && isShake
                    ? { rotate: [-3, 3] }
                    : { rotate: 0 }
                }
                transition={
                  isDead && isShake
                    ? {
                        repeat: Infinity,
                        repeatType: "reverse",
                        duration: 0.15,
                      }
                    : { duration: 0.2 }
                }
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{
                      opacity: isDimmed ? 0.4 : 1,
                      y: isDead && selDead && !replaced ? -4 : 0,
                    }}
                    exit={{ opacity: 0, y: 8, scale: 0.9 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                    }}
                    className="relative"
                  >
                    <PlayingCard {...display} interactive={false} />
                    {isDead && selDead && !replaced && (
                      <div className="absolute inset-0 ring-2 ring-red-500 rounded-md pointer-events-none" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Dead Card button — fixed-height wrapper to prevent layout shift */}
      <div className="h-9 sm:h-10 flex items-center justify-center">
        <AnimatePresence>
          {showBtn && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: isPressed ? 0.9 : 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              <div
                className={`px-6 py-2 rounded-lg text-white text-xs sm:text-sm font-semibold text-center transition-colors duration-150 ${
                  isPressed
                    ? "bg-amber-500 shadow-lg shadow-amber-500/30"
                    : "bg-amber-600 animate-pulse"
                }`}
              >
                Dead Card?
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-[40px] flex items-start justify-center">
        <StepText textKey={textPhase}>
          <p className="text-sm text-gray-300 text-center leading-relaxed max-w-xs px-2">
            {textPhase === "dead" ? (
              <>
                If <span className="text-white font-semibold">both spots</span>{" "}
                for your card are taken, it&apos;s a{" "}
                <span className="text-red-400 font-semibold">dead card</span>
              </>
            ) : textPhase === "button" ? (
              <>
                Tap the{" "}
                <span className="text-amber-400 font-semibold">Dead Card</span>{" "}
                button to discard it
              </>
            ) : (
              <>
                A <span className="text-white font-semibold">new card</span> is
                drawn to replace it in your hand
              </>
            )}
          </p>
        </StepText>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slide 6 — Sharing a Chip
   ═══════════════════════════════════════════════════════════ */

function SlideChipReuse({ active }) {
  // 12 steps × 500ms = 6 s loop
  const step = useAnimStep(12, 500, active);

  const seq1 = [0, 1, 2, 3, 4]; // horizontal, top row
  const seq2 = [4, 9, 14, 19, 24]; // vertical, right column
  // shared chip: index 4

  const chips = { 6: "B", 16: "B", 22: "B" }; // opponent chips
  const seqs = {};
  const glows = {};
  const hl = {};

  // First sequence always present
  seq1.forEach((i) => {
    chips[i] = "A";
  });

  // Glow first sequence initially
  if (step <= 2) {
    seq1.forEach((i) => {
      seqs[i] = true;
      glows[i] = true;
    });
  }

  // Build second sequence one chip per step (step 3-6)
  const newChips = [9, 14, 19, 24]; // index 4 already placed
  newChips.forEach((idx, ci) => {
    if (step >= ci + 3) chips[idx] = "A";
  });

  // Both sequences complete
  if (step >= 7 && step <= 10) {
    [...new Set([...seq1, ...seq2])].forEach((i) => {
      seqs[i] = true;
      glows[i] = true;
    });
    hl[4] = "amber"; // highlight the shared chip
  }

  const textPhase =
    step <= 2 ? "have" : step <= 6 ? "build" : step <= 10 ? "shared" : "have";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <MiniBoard
        cells={S1}
        chips={chips}
        seqs={seqs}
        glows={glows}
        highlights={hl}
        className="w-full max-w-xs sm:max-w-[264px]"
      />
      <div className="min-h-[48px] flex items-start justify-center">
        <StepText textKey={textPhase}>
          <p className="text-sm text-gray-300 text-center leading-relaxed max-w-xs px-2">
            {textPhase === "have" ? (
              <>
                You already have a{" "}
                <span className="text-emerald-400 font-semibold">
                  sequence
                </span>
                . Can you build another?
              </>
            ) : textPhase === "build" ? (
              <>
                Build a second one that{" "}
                <span className="text-white font-semibold">
                  shares exactly one chip
                </span>
              </>
            ) : (
              <>
                The{" "}
                <span className="text-amber-400 font-semibold">
                  shared chip
                </span>{" "}
                counts for both sequences!
              </>
            )}
          </p>
        </StepText>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slide 7 — Win the Game!
   ═══════════════════════════════════════════════════════════ */

function SlideWin({ active }) {
  const step = useAnimStep(11, 450, active);
  const diag = [0, 6, 12, 18, 24];
  const chips = { 2: "B", 7: "B", 15: "B", 21: "B" };
  const seqs = {};
  const glows = {};

  if (step <= 8) {
    diag.forEach((idx, i) => {
      if (step >= i) chips[idx] = "A";
      if (step >= 5) {
        seqs[idx] = true;
        glows[idx] = true;
      }
    });
  }

  const textPhase = step <= 4 ? "race" : "win";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full flex justify-center">
        <MiniBoard
          cells={S1}
          chips={chips}
          seqs={seqs}
          glows={glows}
          className="w-full max-w-xs sm:max-w-[264px]"
        />
        <AnimatePresence>
          {step >= 5 && step <= 8 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-black/70 backdrop-blur-sm rounded-xl px-5 py-2.5 border border-emerald-500/30 shadow-[0_0_30px_8px_rgba(16,185,129,0.2)]">
                <span className="text-lg font-bold text-emerald-400">
                  Sequence!
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-[48px] flex items-start justify-center">
        <StepText textKey={textPhase}>
          <p className="text-sm text-gray-300 text-center leading-relaxed max-w-xs px-2">
            {textPhase === "race" ? (
              <>
                Race to get your team&apos;s{" "}
                <span className="text-white font-semibold">
                  chips in a row
                </span>
              </>
            ) : (
              <>
                First team to form the{" "}
                <span className="text-white font-semibold">
                  required number of sequences
                </span>{" "}
                wins!
              </>
            )}
          </p>
        </StepText>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slide registry & carousel animation
   ═══════════════════════════════════════════════════════════ */

const SLIDES = [
  { title: "What's a Sequence?", Comp: SlideSequence },
  { title: "The Board", Comp: SlideBoard },
  { title: "Playing a Card", Comp: SlidePlayCard },
  { title: "Jacks are Special", Comp: SlideJacks },
  { title: "Dead Cards", Comp: SlideDeadCards },
  { title: "Sharing a Chip", Comp: SlideChipReuse },
  { title: "Win the Game!", Comp: SlideWin },
];

const variants = {
  enter: (d) => ({ x: d === 0 ? 0 : d > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d === 0 ? 0 : d > 0 ? -200 : 200, opacity: 0 }),
};

const swipePow = (off, vel) => Math.abs(off) * vel;

/* ═══════════════════════════════════════════════════════════
   RulesModal
   ═══════════════════════════════════════════════════════════ */

export default function RulesModal({ isOpen, onClose }) {
  // epoch ensures every navigation produces a unique key,
  // guaranteeing the slide component is always freshly mounted.
  const [[page, dir, epoch], setPage] = useState([0, 0, 0]);

  /* reset to first slide every time the modal opens */
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => setPage(([, , e]) => [0, 0, e + 1]), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  const go = useCallback((d) => {
    setPage(([p, , e]) => {
      const n = p + d;
      if (n < 0 || n >= SLIDES.length) return [p, 0, e];
      return [n, d, e + 1];
    });
  }, []);

  /* keyboard navigation */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, go, onClose]);

  const isFirst = page === 0;
  const isLast = page === SLIDES.length - 1;
  const { Comp } = SLIDES[page];

  return (
    <>
      {/* Backdrop */}
      <div
        className={
          "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 " +
          (isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none")
        }
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={
          "fixed inset-3 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 " +
          "sm:w-full sm:max-w-lg sm:h-[min(88vh,740px)] z-50 flex flex-col rounded-2xl border border-white/10 " +
          "bg-[linear-gradient(to_bottom,black_0%,rgb(20,20,20)_70%,black_100%)] backdrop-blur " +
          "transition duration-300 transform overflow-hidden " +
          (isOpen
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none")
        }
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 shrink-0">
          <AnimatePresence mode="wait">
            <motion.h2
              key={`${page}-${epoch}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="text-lg sm:text-xl font-bold bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent"
            >
              {SLIDES[page].title}
            </motion.h2>
          </AnimatePresence>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Carousel ── */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={`${page}-${epoch}`}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={(_, { offset, velocity }) => {
                const p = swipePow(offset.x, velocity.x);
                if (p < -6000) go(1);
                else if (p > 6000) go(-1);
              }}
              className="h-full flex items-center justify-center px-4 py-3 sm:px-6 sm:py-5"
            >
              <Comp active={isOpen} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-white/10 shrink-0 space-y-3">
          {/* Dots */}
          <div className="flex justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() =>
                  setPage(([p, , e]) => [
                    i,
                    i > p ? 1 : i < p ? -1 : 0,
                    i !== p ? e + 1 : e,
                  ])
                }
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === page
                    ? "w-6 bg-blue-500"
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Two-button navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => go(-1)}
              disabled={isFirst}
              className="flex-1 py-3 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 font-semibold transition-colors"
            >
              Previous
            </button>

            {isLast ? (
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold transition-all shadow-lg shadow-blue-600/20"
              >
                Got It!
              </button>
            ) : (
              <button
                onClick={() => go(1)}
                className="flex-1 py-3 rounded-xl bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold transition-all shadow-lg shadow-blue-600/20"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
