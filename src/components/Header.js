import { Menu } from "lucide-react";

export default function Header({ centerLabel = "SneakyLink" }) {
  return (
    <div className="sticky top-0 z-30 backdrop-blur">
      <div className="max-w-screen-sm sm:max-w-3xl md:max-w-5xl mx-auto px-4 py-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        {/* Left: Menu button */}
        <div className="justify-self-start">
          <button
            type="button"
            aria-label="Menu"
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-neutral-900/5 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10"
          >
            <Menu className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
        {/* Center: Title */}
        <div className="justify-self-center text-xl sm:text-base font-semibold bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent">
          {centerLabel}
        </div>
        {/* Right: Empty space for balance */}
        <div className="w-9" />
      </div>
    </div>
  );
}
