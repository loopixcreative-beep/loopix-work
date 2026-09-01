import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkTimer } from '@/hooks/useWorkTimer';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Timer } from 'lucide-react';

const ACTIVITY_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CONFIRM_WINDOW_SECONDS = 30;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
];

/**
 * Runs app-wide (mounted once, outside any single page) while a timer is
 * running: watches for mouse/keyboard activity, and if none is seen within a
 * 5-minute window, prompts "Are you still working?" with a 30s window to
 * confirm before the timer auto-stops. Also warns on tab close while running.
 */
export const IdleActivityMonitor = () => {
  const { running, stop } = useWorkTimer();
  const [promptOpen, setPromptOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CONFIRM_WINDOW_SECONDS);

  const activityCountRef = useRef(0);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationRef = useRef<Notification | null>(null);

  const clearCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
  };

  // Track raw mouse/keyboard activity at all times (cheap: just a counter).
  useEffect(() => {
    const bump = () => {
      activityCountRef.current += 1;
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, bump, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, bump));
    };
  }, []);

  const openStillWorkingPrompt = useCallback(() => {
    setSecondsLeft(CONFIRM_WINDOW_SECONDS);
    setPromptOpen(true);

    // If the tab is minimized/backgrounded, an in-page dialog is invisible —
    // fall back to a system notification so it still reaches the user's screen.
    if (typeof document !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification('Are you still working?', {
          body: "We haven't noticed any mouse or keyboard activity. Click to confirm you're still tracking time.",
          requireInteraction: true,
          tag: 'still-working-prompt',
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
        notificationRef.current = n;
      } catch {
        // Notifications unsupported/blocked — the in-page dialog still covers the visible-tab case.
      }
    }
  }, []);

  // (Re)starts the 5-minute idle-check window fresh from right now. Called on
  // timer start and after every confirmation, so each window always measures
  // a full 5 minutes of *actual* inactivity rather than reusing a stale count.
  const scheduleCheck = useCallback(() => {
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    activityCountRef.current = 0;
    checkIntervalRef.current = setInterval(() => {
      const hadActivity = activityCountRef.current > 0;
      activityCountRef.current = 0;
      if (!hadActivity) openStillWorkingPrompt();
    }, ACTIVITY_CHECK_INTERVAL_MS);
  }, [openStillWorkingPrompt]);

  const closePrompt = useCallback(() => {
    setPromptOpen(false);
    clearCountdown();
    scheduleCheck();
  }, [scheduleCheck]);

  const handleStillWorking = useCallback(() => {
    closePrompt();
  }, [closePrompt]);

  const handleNotWorking = useCallback(
    (auto: boolean) => {
      closePrompt();
      stop(
        auto
          ? "Timer stopped automatically — no response to the 'still working?' check."
          : 'Timer stopped — you confirmed you had stepped away.',
      );
    },
    [closePrompt, stop],
  );

  // 5-minute activity checks while the timer is running.
  useEffect(() => {
    if (!running) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      setPromptOpen(false);
      clearCountdown();
      return;
    }

    scheduleCheck();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [running, scheduleCheck]);

  // 30-second countdown once the prompt is open. Skipped while the tab is
  // hidden — a dialog the user can't see shouldn't burn down their window to
  // respond to it. The remaining seconds resume the moment the tab is visible
  // again, so switching away doesn't cost them their chance to confirm.
  useEffect(() => {
    if (!promptOpen) return;
    countdownIntervalRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [promptOpen]);

  // Separate from the ticker itself: react to the countdown reaching zero.
  useEffect(() => {
    if (promptOpen && secondsLeft === 0) handleNotWorking(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptOpen, secondsLeft]);

  // Warn before the tab/browser closes while a session is running. Browsers
  // ignore custom text on this dialog for security reasons and always show
  // their own generic "Leave site?" prompt — that native behavior can't be
  // restyled from a web page.
  useEffect(() => {
    if (!running) return;
    const message = 'Your timer is still running. Leaving now will stop time tracking.';
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message; // Firefox / Chromium
      return message; // legacy Safari / old Chromium fallback
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [running]);

  return (
    <AlertDialog open={promptOpen} onOpenChange={(open) => !open && handleStillWorking()}>
      <AlertDialogContent className="max-w-xs rounded-3xl border-none p-0 text-center shadow-2xl backdrop-blur">
        <div className="flex flex-col items-center gap-3 px-6 pb-2 pt-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Timer className="h-7 w-7 text-primary" />
          </div>
          <AlertDialogHeader className="items-center gap-1.5 space-y-0 text-center sm:text-center">
            <AlertDialogTitle className="text-lg font-semibold">Are you still working?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm">
              No mouse or keyboard activity was detected in the last 5 minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-xs font-medium text-muted-foreground">
            Auto-stopping in <span className="font-mono font-bold text-foreground">{secondsLeft}s</span> if you
            don't respond
          </p>
        </div>
        <AlertDialogFooter className="flex-col gap-0 border-t sm:flex-col sm:space-x-0">
          <Button
            variant="ghost"
            className="h-12 w-full rounded-none rounded-b-none border-b text-base font-semibold text-primary hover:text-primary"
            onClick={handleStillWorking}
          >
            Yes, I'm here
          </Button>
          <Button
            variant="ghost"
            className="h-12 w-full rounded-none rounded-b-3xl text-base text-destructive hover:text-destructive"
            onClick={() => handleNotWorking(false)}
          >
            No, stop the timer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
