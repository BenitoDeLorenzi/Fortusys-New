import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ManagementPage({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("space-y-5", className)}
      data-slot="management-page"
      {...props}
    />
  );
}

type ManagementPageHeaderProps = {
  badge: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  compact?: boolean;
  hideTitle?: boolean;
};

export function ManagementPageHeader({
  badge,
  title,
  description,
  icon: Icon,
  actions,
  compact = false,
  hideTitle = false,
}: ManagementPageHeaderProps) {
  return (
    <section
      className={cn(
        "flex flex-col lg:flex-row lg:items-center lg:justify-between",
        compact ? "gap-2" : "gap-4"
      )}
    >
      <div className="max-w-2xl">
        <Badge
          className={cn(
            "gap-1.5 bg-primary/10 text-primary hover:bg-primary/10",
            compact
              ? "h-10 rounded-xl px-3 text-sm"
              : "mb-3"
          )}
        >
          {Icon ? <Icon className="size-3.5" /> : null}
          {badge}
        </Badge>
        {hideTitle ? null : (
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
        )}
        {description ? (
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end [&_[data-slot=button]]:h-10">
          {actions}
        </div>
      ) : null}
    </section>
  );
}

type ManagementFiltersProps = {
  children: ReactNode;
  actions?: ReactNode;
  title?: string;
  description?: string;
  className?: string;
};

export function ManagementFilters({
  children,
  actions,
  title = "Filtros",
  description = "Refine os dados exibidos na tabela.",
  className,
}: ManagementFiltersProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.04] p-4 pl-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-primary/70 lg:flex-row lg:items-end lg:justify-between dark:to-primary/[0.07]",
        className
      )}
      data-slot="management-filters"
    >
      <span className="sr-only">{description}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 lg:ml-auto">
          {actions}
        </div>
      ) : null}
    </section>
  );
}

type ManagementDataCardProps = {
  title: string;
  description?: string;
  count?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ManagementDataCard({
  title,
  description,
  count,
  actions,
  children,
  className,
}: ManagementDataCardProps) {
  return (
    <Card
      className={cn(
        "gap-0 border-0 py-0 shadow-[0_16px_42px_-28px_rgba(15,23,42,0.65)] ring-1 ring-border/70",
        className
      )}
      data-slot="management-data"
    >
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-gradient-to-r from-muted/50 via-card to-primary/[0.035] py-4 sm:flex-row sm:items-center sm:justify-between dark:to-primary/[0.06]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-0.5">{description}</CardDescription>
            ) : null}
          </div>
          {count !== undefined ? <Badge variant="secondary">{count}</Badge> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 py-4">{children}</CardContent>
    </Card>
  );
}

export function ManagementTableFrame({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-background shadow-[0_6px_20px_-18px_rgba(15,23,42,0.65)] [&_[data-slot=table-header]]:bg-gradient-to-r [&_[data-slot=table-header]]:from-muted/70 [&_[data-slot=table-header]]:to-muted/35 [&_[data-slot=table-head]]:text-xs [&_[data-slot=table-head]]:font-semibold [&_[data-slot=table-head]]:uppercase [&_[data-slot=table-head]]:tracking-wide [&_[data-slot=table-head]]:text-muted-foreground [&_[data-slot=table-row]]:transition-colors",
        className
      )}
      data-slot="management-table-frame"
      {...props}
    />
  );
}

type ManagementStateProps = {
  children: ReactNode;
  loading?: boolean;
  className?: string;
};

export function ManagementState({
  children,
  loading = false,
  className,
}: ManagementStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/15 p-6 text-center text-sm text-muted-foreground",
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      <span>{children}</span>
    </div>
  );
}

export function ManagementMetricCardsSkeleton({
  className,
  count = 4,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <div
      className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-4", className)}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card
          className="relative h-full overflow-hidden border-border/70 bg-gradient-to-br from-muted/55 via-card to-card shadow-[0_10px_24px_-22px_rgba(15,23,42,0.7)]"
          key={index}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-3 py-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-20 animate-pulse rounded-full bg-muted-foreground/15" />
              <div className="h-5 w-24 animate-pulse rounded-full bg-muted-foreground/20" />
            </div>
            <div className="size-8 animate-pulse rounded-xl border bg-muted-foreground/10" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function ManagementFiltersSkeleton({
  fields = 3,
}: {
  fields?: number;
}) {
  return (
    <ManagementFilters className="gap-2 p-2.5 pl-4 shadow-sm before:inset-y-2">
      <div
        className="flex flex-col gap-2 lg:flex-row lg:items-end"
        aria-hidden="true"
      >
        {Array.from({ length: fields }).map((_, index) => (
          <div className="w-full space-y-1 lg:w-52" key={index}>
            <div className="h-3 w-16 animate-pulse rounded-full bg-muted-foreground/15" />
            <div className="h-8 animate-pulse rounded-md border bg-muted-foreground/10" />
          </div>
        ))}
        <div className="flex shrink-0 gap-2 lg:ml-auto">
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted-foreground/15" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted-foreground/10" />
        </div>
      </div>
    </ManagementFilters>
  );
}

export function ManagementTableSkeleton({
  columns = 6,
  rows = 8,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <ManagementTableFrame aria-hidden="true">
      <div className="divide-y">
        <div
          className="grid gap-3 bg-muted/45 px-4 py-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, index) => (
            <div
              className="h-3 animate-pulse rounded-full bg-muted-foreground/15"
              key={index}
            />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            className="grid gap-3 px-4 py-3"
            key={rowIndex}
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <div
                className={cn(
                  "h-4 animate-pulse rounded-full bg-muted-foreground/10",
                  columnIndex === 0 ? "w-4/5" : "w-full",
                  columnIndex === columns - 1 ? "justify-self-end" : ""
                )}
                key={columnIndex}
              />
            ))}
          </div>
        ))}
      </div>
    </ManagementTableFrame>
  );
}

export function ManagementFormSkeleton({
  sections = 3,
  fieldsPerSection = 6,
}: {
  sections?: number;
  fieldsPerSection?: number;
}) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <Card
          className="border-0 bg-gradient-to-br from-card via-card to-primary/[0.025] shadow-[0_14px_36px_-26px_rgba(15,23,42,0.7)] ring-1 ring-border/70"
          key={sectionIndex}
        >
          <CardHeader className="border-b border-border/60 bg-gradient-to-r from-muted/45 via-card to-primary/[0.035] pb-3">
            <div className="h-5 w-40 animate-pulse rounded-full bg-muted-foreground/15" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: fieldsPerSection }).map((__, fieldIndex) => (
                <div className="space-y-2" key={fieldIndex}>
                  <div className="h-3 w-20 animate-pulse rounded-full bg-muted-foreground/15" />
                  <div className="h-10 animate-pulse rounded-md border bg-muted-foreground/10" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ManagementGallerySkeleton({
  items = 8,
}: {
  items?: number;
}) {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/15 p-6">
        <div className="size-8 animate-pulse rounded-xl bg-muted-foreground/15" />
        <div className="h-4 w-56 animate-pulse rounded-full bg-muted-foreground/15" />
        <div className="h-3 w-72 animate-pulse rounded-full bg-muted-foreground/10" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: items }).map((_, index) => (
          <div
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
            key={index}
          >
            <div className="aspect-[4/3] animate-pulse bg-muted-foreground/10" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted-foreground/15" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ManagementPaginationProps = {
  page: number;
  visible: number;
  total: number;
  itemLabel: string;
  pageSize?: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
};

function getPaginationItems(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page - 1, page, page + 1]);

  if (page <= 3) {
    [2, 3, 4].forEach((item) => pages.add(item));
  }

  if (page >= totalPages - 2) {
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach((item) =>
      pages.add(item)
    );
  }

  const sortedPages = [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | string> = [];

  sortedPages.forEach((item, index) => {
    const previous = sortedPages[index - 1];

    if (previous && item - previous > 1) {
      items.push(`ellipsis-${previous}`);
    }

    items.push(item);
  });

  return items;
}

export function ManagementPagination({
  page,
  visible,
  total,
  itemLabel,
  pageSize = 8,
  isLoading = false,
  onPageChange,
}: ManagementPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const firstVisible = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastVisible = total === 0 ? 0 : firstVisible + visible - 1;
  const paginationItems = getPaginationItems(safePage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando{" "}
        <strong className="font-medium text-foreground">
          {firstVisible}-{lastVisible}
        </strong>{" "}
        de <strong className="font-medium text-foreground">{total}</strong>{" "}
        {itemLabel}.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button
          aria-label="Primeira página"
          disabled={safePage === 1 || isLoading}
          onClick={() => onPageChange(1)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          aria-label="Página anterior"
          disabled={safePage === 1 || isLoading}
          onClick={() => onPageChange(safePage - 1)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {paginationItems.map((item) =>
          typeof item === "number" ? (
            <Button
              aria-current={item === safePage ? "page" : undefined}
              aria-label={`Página ${item}`}
              className="min-w-8"
              disabled={isLoading}
              key={item}
              onClick={() => onPageChange(item)}
              size="icon-sm"
              type="button"
              variant={item === safePage ? "default" : "outline"}
            >
              {item}
            </Button>
          ) : (
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center text-muted-foreground"
              key={item}
            >
              …
            </span>
          )
        )}
        <Button
          aria-label="Próxima página"
          disabled={safePage === totalPages || isLoading}
          onClick={() => onPageChange(safePage + 1)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          aria-label="Última página"
          disabled={safePage === totalPages || isLoading}
          onClick={() => onPageChange(totalPages)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
