import { X } from "lucide-react";

export default function RulesModal({ isOpen, onClose }) {
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
          "fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 " +
          "sm:w-full sm:max-w-2xl sm:max-h-[85vh] z-50 flex flex-col rounded-2xl border border-white/10 " +
          "bg-[linear-gradient(to_bottom,black_0%,rgb(20,20,20)_70%,black_100%)] backdrop-blur " +
          "transition duration-300 transform " +
          (isOpen
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none")
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold bg-linear-to-r from-white/90 via-gray-200 to-white/90 bg-clip-text text-transparent">
            How to Play SneakyLink
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-gray-300">
          <section>
            <h3 className="text-lg font-semibold text-white mb-2">
              🎯 Objective
            </h3>
            <p className="text-sm leading-relaxed">
              Be the first team to complete the required number of sequences (5
              cards in a row) on the board. A sequence can be horizontal,
              vertical, or diagonal.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-2">
              🎴 Game Setup
            </h3>
            <ul className="text-sm space-y-1 list-disc list-inside leading-relaxed">
              <li>Each player starts with 5 cards</li>
              <li>The board has a 10×10 grid with card positions</li>
              <li>Four corners are free spaces (automatically yours)</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-2">
              🎲 Taking Your Turn
            </h3>
            <ol className="text-sm space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                <strong className="text-white">Select a card</strong> from your
                hand
              </li>
              <li>
                <strong className="text-white">Click a matching square</strong>{" "}
                on the board
              </li>
              <li>
                <strong className="text-white">
                  Click &quot;Confirm Move&quot;
                </strong>{" "}
                to place your chip
              </li>
              <li>A new card is automatically drawn to replace it</li>
            </ol>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-2">🃏 Jacks</h3>
            <div className="text-sm space-y-2 leading-relaxed">
              <p>
                <strong className="text-amber-500">Two-Eyed Jacks</strong> (♦️
                ♣️): Wild cards - place your chip on any empty square
              </p>
              <p>
                <strong className="text-red-500">One-Eyed Jacks</strong> (♠️
                ♥️): Remove an opponent&apos;s chip (except chips in completed
                sequences)
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-2">
              💀 Dead Cards
            </h3>
            <p className="text-sm leading-relaxed">
              If both positions for your card are already occupied, it&apos;s a
              &quot;dead card.&quot; Click &quot;Dead Card?&quot; to discard it
              and draw a new one.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-2">
              ✨ Winning
            </h3>
            <div className="text-sm space-y-2 leading-relaxed">
              <p>
                Complete the required number of sequences (shown in lobby
                settings). A sequence is 5 of your team&apos;s chips in a row.
              </p>
              <p className="text-amber-400">
                <strong>Important:</strong> You can only reuse ONE chip from a
                previous sequence when making a new sequence.
              </p>
            </div>
          </section>

          <section className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-400 mb-2">
              💡 Pro Tips
            </h3>
            <ul className="text-sm space-y-1 list-disc list-inside leading-relaxed">
              <li>Use corners strategically - they&apos;re free spaces!</li>
              <li>Block opponent sequences while building your own</li>
              <li>Save Jacks for critical moments</li>
              <li>Watch for sequences that share chips efficiently</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
          >
            Got It!
          </button>
        </div>
      </div>
    </>
  );
}
