// Matches phones specifically (not tablets) — the timer restriction is about
// "started from a phone", not about screen size in general.
const MOBILE_UA_RE = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;

export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  if (MOBILE_UA_RE.test(navigator.userAgent)) return true;

  // Fallback for browsers that freeze/shorten the UA string: a coarse pointer
  // (touch, no hover) combined with a phone-width viewport is a good proxy.
  if (typeof window !== 'undefined' && window.matchMedia) {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const phoneWidth = window.matchMedia('(max-width: 767px)').matches;
    if (coarsePointer && phoneWidth) return true;
  }

  return false;
};
