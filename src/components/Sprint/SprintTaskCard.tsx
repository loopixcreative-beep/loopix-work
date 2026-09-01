import { Link } from 'react-router-dom';
import { AlertCircle, Repeat } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SprintTask, labelTone } from './types';

interface Props {
  task: SprintTask;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  stale?: boolean;
  className?: string;
}

export const SprintTaskCard = ({ task, draggable, onDragStart, onDragEnd, stale, className }: Props) => {
  const label = task.labels?.[0];

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all',
        draggable && 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          to={`/app/issues/${task.id}`}
          className="min-w-0 flex-1 text-sm font-semibold leading-snug hover:text-primary"
        >
          {task.title}
        </Link>
        {stale && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-chart-2" />
            </TooltipTrigger>
            <TooltipContent>No movement in 3+ days</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        {task.assignee ? (
          <UserAvatar
            size="xs"
            name={task.assignee.full_name}
            email={task.assignee.email}
            avatarUrl={task.assignee.avatar_url}
          />
        ) : (
          <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-border" />
        )}

        {label && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'h-2.5 w-6 shrink-0 rounded-full border',
                  labelTone(label),
                )}
              />
            </TooltipTrigger>
            <TooltipContent>{task.labels?.join(', ')}</TooltipContent>
          </Tooltip>
        )}

        {task.carried_over_count > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-chart-2">
                <Repeat className="h-3 w-3" />
                {task.carried_over_count}
              </span>
            </TooltipTrigger>
            <TooltipContent>Carried over {task.carried_over_count}x</TooltipContent>
          </Tooltip>
        )}

        <span className="ml-auto shrink-0">
          {task.story_points != null ? (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {task.story_points}
            </span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>No estimate</TooltipContent>
            </Tooltip>
          )}
        </span>
      </div>
    </div>
  );
};
