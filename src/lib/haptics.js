export const supportsHaptics =
  typeof window === "undefined"
    ? false
    : window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

function coreHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
      return;
    }
    if (!supportsHaptics || typeof document === "undefined") return;
    const labelEl = document.createElement("label");
    labelEl.ariaHidden = "true";
    labelEl.style.display = "none";
    const inputEl = document.createElement("input");
    inputEl.type = "checkbox";
    inputEl.setAttribute("switch", "");
    labelEl.appendChild(inputEl);
    document.head.appendChild(labelEl);
    labelEl.click();
    document.head.removeChild(labelEl);
  } catch {
    // no-op
  }
}

export function hapticTap() {
  coreHaptic();
}

export function hapticConfirm() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([50, 70, 50]);
      return;
    }
  } catch {
    // ignore
  }
  coreHaptic();
  setTimeout(coreHaptic, 120);
}

export function hapticError() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([50, 70, 50, 70, 50]);
      return;
    }
  } catch {
    // ignore
  }
  coreHaptic();
  setTimeout(coreHaptic, 120);
  setTimeout(coreHaptic, 240);
}
