import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "info"
  | "progress"
  | "warning"
  | "overdue"
  | "danger"
  | "neutral";

const toneClasses: Record<StatusTone, { badge: string; dot: string }> = {
  success: {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  info: {
    badge:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  progress: {
    badge:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/45 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  warning: {
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  overdue: {
    badge:
      "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/45 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  danger: {
    badge:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/45 dark:text-red-300",
    dot: "bg-red-500",
  },
  neutral: {
    badge:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-500",
  },
};

type SemanticStatusBadgeProps = {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
};

export function SemanticStatusBadge({
  children,
  tone = "neutral",
  className,
}: SemanticStatusBadgeProps) {
  const colors = toneClasses[tone];

  return (
    <Badge
      className={cn(
        "h-6 gap-1.5 border px-2.5 font-medium shadow-none",
        colors.badge,
        className
      )}
      variant="outline"
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", colors.dot)}
      />
      {children}
    </Badge>
  );
}
