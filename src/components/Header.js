import { Menu } from "lucide-react";
import QuestionIcon from "./QuestionIcon";

export default function Header({
  centerLabel = "SneakyLink",
  onMenuClick,
  onRulesClick,
}) {
  return (
    <div className="sticky top-0 z-30 backdrop-blur">
      <div className="max-w-screen-sm sm:max-w-3xl md:max-w-5xl lg:max-w-none mx-auto px-4 py-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        {/* Left: Menu button - hidden on md+ */}
        <div className="justify-self-start md:invisible">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Menu"
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors"
          >
            <Menu className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
        {/* Center: Title - hidden on md+ since it's in sidebar */}
        <div className="justify-self-center text-2xl font-semibold bg-linear-to-b from-white/90 via-blue-200 to-blue-500 bg-clip-text text-transparent md:invisible">
          {centerLabel}
        </div>
        {/* Right: Rules button - hidden on md+ */}
        <button
          type="button"
          onClick={onRulesClick}
          aria-label="Rules"
          className="inline-flex items-center justify-center h-9 w-9 hover:bg-white/10 rounded-full bg-white/5 ring-1 ring-blue-400/40 transition-colors md:invisible"
        >
          <QuestionIcon className="w-4 h-4 text-blue-400/90" />
        </button>
      </div>
    </div>
  );
}
