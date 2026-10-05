import {
  AlertTriangle,
  ArchiveX,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AppNotification } from "@/features/notifications/types";
import { cn } from "@/lib/utils";

type NotificationActionTone =
  | "created"
  | "updated"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "billing";

type NotificationActionMeta = {
  label: string;
  icon: LucideIcon;
  tone: NotificationActionTone;
};

const toneClasses: Record<NotificationActionTone, string> = {
  created:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-300",
  updated:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-300",
  success:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/45 dark:text-green-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-300",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/45 dark:text-red-300",
  neutral:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  billing:
    "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/45 dark:text-cyan-300",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getNotificationActionMeta(
  notification: Pick<AppNotification, "type" | "title" | "severity">
): NotificationActionMeta {
  const source = normalize(`${notification.type} ${notification.title}`);

  if (source.includes("created") || source.includes("criad")) {
    return { label: "Criado", icon: Plus, tone: "created" };
  }

  if (
    source.includes("updated") ||
    source.includes("alter") ||
    source.includes("atualiz") ||
    source.includes("edit")
  ) {
    return { label: "Atualizado", icon: Pencil, tone: "updated" };
  }

  if (
    source.includes("deleted") ||
    source.includes("exclu") ||
    source.includes("removid")
  ) {
    return { label: "Excluído", icon: Trash2, tone: "danger" };
  }

  if (
    source.includes("activated") ||
    source.includes("ativad") ||
    source.includes("liquid") ||
    source.includes("pago")
  ) {
    return { label: "Concluído", icon: CheckCircle2, tone: "success" };
  }

  if (
    source.includes("ended") ||
    source.includes("encerr") ||
    source.includes("canceled") ||
    source.includes("cancelad")
  ) {
    return { label: "Encerrado", icon: Ban, tone: "neutral" };
  }

  if (source.includes("baix")) {
    return { label: "Baixado", icon: ArchiveX, tone: "warning" };
  }

  if (source.includes("discard") || source.includes("descart")) {
    return { label: "Descartado", icon: ArchiveX, tone: "warning" };
  }

  if (
    source.includes("failed") ||
    source.includes("falh") ||
    source.includes("rejeit") ||
    notification.severity === "danger"
  ) {
    return { label: "Falha", icon: XCircle, tone: "danger" };
  }

  if (source.includes("draft") || source.includes("minuta")) {
    return { label: "Minuta", icon: FileText, tone: "billing" };
  }

  if (
    source.includes("document") ||
    source.includes("assinad") ||
    source.includes("anex")
  ) {
    return { label: "Documento", icon: FileCheck2, tone: "success" };
  }

  if (source.includes("photo") || source.includes("foto")) {
    return { label: "Arquivo", icon: Upload, tone: "updated" };
  }

  if (
    source.includes("ticket") ||
    source.includes("boleto") ||
    source.includes("charge") ||
    source.includes("cobranca")
  ) {
    return { label: "Cobrança", icon: CircleDollarSign, tone: "billing" };
  }

  if (source.includes("status")) {
    return { label: "Status", icon: RefreshCw, tone: "updated" };
  }

  if (notification.severity === "warning") {
    return { label: "Atenção", icon: AlertTriangle, tone: "warning" };
  }

  return { label: "Aviso", icon: Info, tone: "neutral" };
}

type NotificationActionBadgeProps = {
  notification: Pick<AppNotification, "type" | "title" | "severity">;
  className?: string;
  compact?: boolean;
};

export function NotificationActionBadge({
  notification,
  className,
  compact = false,
}: NotificationActionBadgeProps) {
  const meta = getNotificationActionMeta(notification);
  const Icon = meta.icon;

  return (
    <Badge
      className={cn(
        "h-6 gap-1.5 border px-2.5 font-medium shadow-none",
        compact && "h-5 px-2 text-[10px]",
        toneClasses[meta.tone],
        className
      )}
      variant="outline"
    >
      <Icon className={cn("size-3.5", compact && "size-3")} />
      {meta.label}
    </Badge>
  );
}
