import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export const getInitials = (name?: string | null, email?: string | null) => {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) return email[0].toUpperCase();
  return '?';
};

const sizes = {
  xs: 'h-6 w-6 text-[0.625rem]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
} as const;

export interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  ring?: boolean;
}

export const UserAvatar = ({
  name,
  email,
  avatarUrl,
  size = 'sm',
  className,
  ring = false,
}: UserAvatarProps) => (
  <Avatar
    className={cn(
      sizes[size],
      ring && 'ring-2 ring-background',
      'shrink-0',
      className,
    )}
    title={name || email || undefined}
  >
    {avatarUrl ? <AvatarImage src={avatarUrl} alt={name || email || 'User'} /> : null}
    <AvatarFallback className="bg-gradient-brand font-semibold text-primary-foreground">
      {getInitials(name, email)}
    </AvatarFallback>
  </Avatar>
);

export interface UserChipProps extends UserAvatarProps {
  subtitle?: string | null;
  compact?: boolean;
}

export const UserChip = ({ subtitle, compact, ...props }: UserChipProps) => (
  <div className="flex min-w-0 items-center gap-2">
    <UserAvatar {...props} />
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold leading-tight">
        {props.name || props.email || 'Unknown'}
      </p>
      {!compact && subtitle && (
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  </div>
);

export const AvatarStack = ({
  users,
  max = 3,
  size = 'sm',
}: {
  users: { name?: string | null; email?: string | null; avatarUrl?: string | null }[];
  max?: number;
  size?: keyof typeof sizes;
}) => (
  <div className="flex -space-x-2">
    {users.slice(0, max).map((u, i) => (
      <UserAvatar key={i} {...u} size={size} ring />
    ))}
    {users.length > max && (
      <div
        className={cn(
          sizes[size],
          'flex items-center justify-center rounded-full border-2 border-background bg-muted font-semibold',
        )}
      >
        +{users.length - max}
      </div>
    )}
  </div>
);
