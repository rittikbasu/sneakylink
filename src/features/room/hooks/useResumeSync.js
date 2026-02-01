import { useEffect } from "react";

export const useResumeSync = ({ roomId, playerId, onResume }) => {
  useEffect(() => {
    if (!roomId || !playerId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onResume?.("visibility");
      }
    };
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        onResume?.("focus");
      }
    };
    const handleOnline = () => {
      onResume?.("online");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [roomId, playerId, onResume]);
};
