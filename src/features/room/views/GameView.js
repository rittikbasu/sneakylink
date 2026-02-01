import BoardGrid from "@/components/BoardGrid";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import RulesModal from "@/components/RulesModal";
import Sidebar from "@/components/Sidebar";
import GameOverOverlay from "@/features/room/views/GameOverOverlay";

export default function GameView({
  sidebarProps,
  rulesOpen,
  onOpenRules,
  onCloseRules,
  onOpenSidebar,
  boardProps,
  footerProps,
  gameFinished,
  gameOverControls,
  showGameOver,
  onCloseGameOver,
  gameOverOverlayProps,
}) {
  return (
    <>
      {/* Mobile sidebar - fixed positioned */}
      <div className="md:hidden">
        <Sidebar {...sidebarProps} variant="mobile" />
      </div>
      <RulesModal isOpen={rulesOpen} onClose={onCloseRules} />
      <Header
        centerLabel="SneakyLink"
        onMenuClick={onOpenSidebar}
        onRulesClick={onOpenRules}
      />

      {/* Mobile layout */}
      <div className="md:hidden min-h-[calc(100dvh-56px)] grid place-items-center pt-2 pb-[calc(env(safe-area-inset-bottom)+120px)]">
        <BoardGrid {...boardProps} />
      </div>

      {/* Desktop layout - sidebar left of centered board */}
      <div className="hidden md:flex h-[calc(100dvh-120px)] justify-center items-center p-6">
        <div className="flex gap-4 w-full">
          <div className="self-stretch">
            <Sidebar {...sidebarProps} variant="desktop" />
          </div>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <BoardGrid {...boardProps} />
            {!gameFinished && <Footer {...footerProps} variant="desktop" />}
            {gameFinished && (
              <div className="hidden md:block w-full max-w-screen-sm sm:max-w-3xl md:max-w-[min(calc(100dvw-360px),calc((100dvh-240px)/1.4))] mx-auto">
                <div className="rounded-xl p-2.5 border border-white/10">
                  <div className="flex items-center">{gameOverControls}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {gameFinished && (
        <GameOverOverlay
          show={showGameOver}
          onClose={onCloseGameOver}
          {...gameOverOverlayProps}
        />
      )}

      {gameFinished ? (
        <div className="fixed inset-x-0 bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
          <div className="w-full max-w-screen-sm sm:max-w-3xl mx-auto px-4 h-[88px] flex items-center">
            {gameOverControls}
          </div>
        </div>
      ) : (
        /* Mobile footer - fixed positioned */
        <div className="md:hidden">
          <Footer {...footerProps} variant="mobile" />
        </div>
      )}
    </>
  );
}
