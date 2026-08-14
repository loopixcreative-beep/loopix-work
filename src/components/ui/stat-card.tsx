import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type Tone = "blue" | "orange" | "sky" | "amber" | "violet" | "green";

const toneStyles: Record<Tone, { ring: string; icon: string; bar: string }> = {
  blue: {
    ring: "from-chart-1/15 to-chart-1/5 border-chart-1/30",
    icon: "bg-chart-1/15 text-chart-1",
    bar: "bg-chart-1",
  },
  orange: {
    ring: "from-chart-2/15 to-chart-2/5 border-chart-2/30",
    icon: "bg-chart-2/15 text-chart-2",
    bar: "bg-chart-2",
  },
  sky: {
    ring: "from-chart-3/15 to-chart-3/5 border-chart-3/30",
    icon: "bg-chart-3/15 text-chart-3",
    bar: "bg-chart-3",
  },
  amber: {
    ring: "from-chart-4/15 to-chart-4/5 border-chart-4/30",
    icon: "bg-chart-4/15 text-chart-4",
    bar: "bg-chart-4",
  },
  violet: {
    ring: "from-chart-5/15 to-chart-5/5 border-chart-5/30",
    icon: "bg-chart-5/15 text-chart-5",
    bar: "bg-chart-5",
  },
  green: {
    ring: "from-chart-6/15 to-chart-6/5 border-chart-6/30",
    icon: "bg-chart-6/15 text-chart-6",
    bar: "bg-chart-6",
  },
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** 0-100, renders a progress bar */
  progress?: number;
  className?: string;
}

export const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  progress,
  className,
}: StatCardProps) => {
  const styles = toneStyles[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-stat animate-fade-in sm:p-4",
        styles.ring,
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold leading-none sm:text-3xl">{value}</p>
          {hint && (
            <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">{hint}</p>
          )}
        </div>
        {Icon && (
          <div className={cn("shrink-0 rounded-lg p-1.5 sm:p-2", styles.icon)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>

      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-700", styles.bar)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default StatCard;
