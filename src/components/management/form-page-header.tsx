import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FormPageHeaderProps = {
  title: string;
  backLabel: string;
  onBack: () => void;
  badge?: string;
  actions?: ReactNode;
};

export function FormPageHeader({
  title,
  backLabel,
  onBack,
  badge,
  actions,
}: FormPageHeaderProps) {
  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          aria-label={backLabel}
          className="size-10 shrink-0"
          onClick={onBack}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowLeft className="size-4" />
        </Button>
        {badge ? (
          <Badge className="shrink-0 bg-primary/10 text-primary hover:bg-primary/10">
            {badge}
          </Badge>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 [&_[data-slot=button]]:h-10">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
