import { UserAvatar, UserAvatarProps } from '@/components/ui/user-avatar';
import { useUserPresence } from '@/hooks/useWorkTimer';
import { cn } from '@/lib/utils';

interface PresenceAvatarProps extends UserAvatarProps {
  userId?: string | null;
  showLabel?: boolean;
}

/**
 * Avatar with a live status dot: solid green when the person has their work
 * timer running, hollow green when they are just signed in.
 */
export const PresenceAvatar = ({ userId, showLabel, ...props }: PresenceAvatarProps) => {
  const { working, online } = useUserPresence(userId);

  return (
    <span className="relative inline-flex shrink-0">
      <UserAvatar {...props} />
      {online && (
        <span
          title={working ? 'Working now' : 'Online'}
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
            working ? 'bg-chart-6 animate-pulse' : 'bg-chart-6/50',
          )}
        />
      )}
      {showLabel && working && (
        <span className="sr-only">Working now</span>
      )}
    </span>
  );
};
