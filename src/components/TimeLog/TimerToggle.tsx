import { Button } from '@/components/ui/button';
import { MonitorSmartphone, Pause, Play, Square, Timer } from 'lucide-react';
import { formatDuration, useWorkTimer } from '@/hooks/useWorkTimer';
import { cn } from '@/lib/utils';

interface TimerToggleProps {
  variant?: 'default' | 'hero';
  className?: string;
}

export const TimerToggle = ({ variant = 'default', className }: TimerToggleProps) => {
  const { running, paused, elapsed, start, stop, pause, resume, loading, isMobile } = useWorkTimer();
  const hero = variant === 'hero';
  // A session already running (e.g. started on a laptop) still displays/controls fine
  // on mobile — only *starting/resuming* a new one from a phone is blocked.
  const blockedByDevice = isMobile && !running;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border px-3 py-2',
          hero ? 'border-primary-foreground/25 bg-primary-foreground/10' : 'bg-card',
        )}
      >
        <div className="flex items-center gap-2">
          <Timer className={cn('h-4 w-4', running && 'animate-pulse', hero ? '' : 'text-primary')} />
          <div className="leading-tight">
            <p className={cn('font-mono text-base font-bold tabular-nums', running ? '' : 'opacity-70')}>
              {formatDuration(elapsed)}
            </p>
            <p className={cn('text-[0.7rem] font-semibold uppercase tracking-wide', hero ? 'opacity-80' : 'text-muted-foreground')}>
              {running ? 'Working' : paused ? 'Paused' : 'Not tracking'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {running && (
            <Button
              size="sm"
              variant={hero ? 'secondary' : 'outline'}
              disabled={loading}
              onClick={() => pause()}
            >
              <Pause className="mr-1.5 h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            disabled={loading || blockedByDevice}
            variant={hero ? 'secondary' : running ? 'success' : 'default'}
            onClick={() => (running ? stop() : paused ? resume() : start())}
            title={blockedByDevice ? 'Timer cannot be started from a mobile device.' : undefined}
          >
            {running ? (
              <Square className="mr-1.5 h-3.5 w-3.5" />
            ) : blockedByDevice ? (
              <MonitorSmartphone className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {running ? 'Stop' : blockedByDevice ? 'Desktop only' : paused ? 'Resume' : 'Start working'}
          </Button>
        </div>
      </div>
      {blockedByDevice && (
        <p className={cn('px-1 text-xs', hero ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          Timer can't be started from mobile — please log in on your primary device (desktop or laptop).
        </p>
      )}
    </div>
  );
};
