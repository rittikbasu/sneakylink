import { Club, Spade, Diamond, Heart } from "lucide-react";

const suitIconByName = {
  club: Club,
  spade: Spade,
  diamond: Diamond,
  heart: Heart,
};

const suitColorByName = {
  heart: "text-rose-400",
  diamond: "text-rose-500",
  club: "text-zinc-400",
  spade: "text-zinc-100",
};

export default function PlayingCard({ type, rank, suit, interactive = true }) {
  if (type === "wild") {
    return (
      <div className="relative aspect-5/7 rounded-md bg-linear-to-br from-emerald-900/30 to-teal-900/30 ring-1 ring-emerald-600/30 shadow-sm grid place-items-center select-none">
        <div className="text-[10px] sm:text-xs font-semibold text-emerald-300 tracking-wide">
          WILD
        </div>
      </div>
    );
  }

  const Icon = suitIconByName[suit];
  const suitColor = suitColorByName[suit];

  return (
    <div
      className={
        "relative aspect-5/7 rounded-md bg-zinc-900 ring-1 ring-white/10 overflow-hidden select-none touch-manipulation " +
        (interactive ? "transition-transform active:scale-90" : "")
      }
    >
      <div
        className={`absolute top-px left-1 ${suitColor} text-[10px] sm:text-xs font-semibold select-none`}
      >
        {rank}
      </div>
      <div
        className={`absolute bottom-px right-1 ${suitColor} text-[10px] sm:text-xs font-semibold select-none`}
      >
        <span className="inline-block rotate-180">{rank}</span>
      </div>
      <div className="h-full w-full grid place-items-center">
        {Icon ? (
          <Icon
            className={`${suitColor} w-5 h-5 sm:w-6 sm:h-6`}
            strokeWidth={2.3}
            fill={
              suit === "heart" || suit === "spade" ? "currentColor" : "none"
            }
          />
        ) : null}
      </div>
    </div>
  );
}
