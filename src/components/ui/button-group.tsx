import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function ButtonGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border bg-background p-0.5 shadow-sm [&_[data-slot=button]]:border-0 [&_[data-slot=button]]:shadow-none",
        className
      )}
      data-slot="button-group"
      role="group"
      {...props}
    />
  );
}

export { ButtonGroup };
