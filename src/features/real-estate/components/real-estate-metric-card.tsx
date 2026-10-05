import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type RealEstateMetricCardTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const toneClasses: Record<
  RealEstateMetricCardTone,
  {
    accent: string;
    icon: string;
    value: string;
  }
> = {
  primary: {
    accent: "from-primary/[0.12]",
    icon: "border-primary/15 bg-primary/10 text-primary",
    value: "text-foreground",
  },
  success: {
    accent: "from-emerald-500/[0.13]",
    icon: "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    accent: "from-amber-500/[0.15]",
    icon: "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
    value: "text-amber-700 dark:text-amber-300",
  },
  danger: {
    accent: "from-red-500/[0.13]",
    icon: "border-red-200/70 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
    value: "text-red-700 dark:text-red-300",
  },
  info: {
    accent: "from-blue-500/[0.13]",
    icon: "border-blue-200/70 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
    value: "text-blue-700 dark:text-blue-300",
  },
  neutral: {
    accent: "from-slate-500/[0.10]",
    icon: "border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300",
    value: "text-foreground",
  },
};

type RealEstateMetricCardProps = {
  description?: string;
  icon: LucideIcon;
  tone?: RealEstateMetricCardTone;
  title: string;
  value: ReactNode;
};

export function RealEstateMetricCard({
  icon: Icon,
  tone = "primary",
  title,
  value,
}: RealEstateMetricCardProps) {
  const classes = toneClasses[tone];

  return (
    <Card
      className={`group relative h-full overflow-hidden border-border/70 bg-gradient-to-br ${classes.accent} via-card to-card shadow-[0_10px_24px_-22px_rgba(15,23,42,0.7)] transition-colors hover:border-primary/25`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-3 py-2">
        <div className="min-w-0">
          <CardDescription className="truncate text-[11px] font-medium leading-4">
            {title}
          </CardDescription>
          <CardTitle
            className={`truncate text-lg font-semibold tracking-tight ${classes.value}`}
          >
            {value}
          </CardTitle>
        </div>
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl border shadow-sm ${classes.icon}`}
        >
          <Icon className="size-[18px]" />
        </div>
      </CardHeader>
    </Card>
  );
}
