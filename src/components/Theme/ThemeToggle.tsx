import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export const ThemeToggle = ({ className, compact = false }: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border bg-muted/60 p-1',
        className
      )}
      role="radiogroup"
      aria-label="Color theme"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all duration-200',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
