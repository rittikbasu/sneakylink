export default function RoomGate({ gameFinished, onBack }) {
  return (
    <div className="h-dvh flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-bold mb-4 text-white">
        {gameFinished ? "Game Finished" : "Game in Progress"}
      </h1>
      <p className="text-zinc-400 mb-8 max-w-md leading-relaxed">
        {gameFinished
          ? "This game has already ended. Please ask the host for a new code."
          : "This game has already started. You can join the next round once the host creates a new lobby."}
      </p>
      <button
        onClick={onBack}
        className="px-8 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all"
      >
        Back to Home
      </button>
    </div>
  );
}
