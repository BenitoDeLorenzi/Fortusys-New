"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  History,
  Landmark,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  TrendingUp,
  Trash2,
  Undo2,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ManagementDataCard,
  ManagementFilters,
  ManagementMetricCardsSkeleton,
  ManagementPage,
  ManagementPageHeader,
  ManagementPagination,
  ManagementState,
  ManagementTableFrame,
  ManagementTableSkeleton,
} from "@/components/management/management-layout";
import {
  SemanticStatusBadge,
  type StatusTone,
} from "@/components/management/semantic-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  BillingAssignor,
  BillingAssignorsResponse,
  BillingBankAccount,
  BillingBankAccountsResponse,
  BillingTicket,
  BillingTicketsResponse,
} from "@/features/billing/types";
import { getBrazilianBankName } from "@/features/billing/banks";
import { BankIcon } from "@/features/billing/components/bank-icon";
import { formatDocument } from "@/features/billing/utils";
import { RealEstateMetricCard as MetricCard } from "@/features/real-estate/components/real-estate-metric-card";
import { createClient } from "@/lib/supabase/client";

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toUpperCase() === "ATIVO";

  return (
    <SemanticStatusBadge tone={isActive ? "success" : "neutral"}>
      {isActive ? "Ativo" : status}
    </SemanticStatusBadge>
  );
}

const ticketStatusOptions = [
  { value: "Todas", label: "Todas" },
  { value: "SALVO", label: "Salvo" },
  { value: "EMITIDO", label: "Emitido" },
  { value: "REGISTRADO", label: "Registrado" },
  { value: "VENCIDO", label: "Vencido" },
  { value: "LIQUIDADO", label: "Liquidado" },
  { value: "BAIXADO", label: "Baixado" },
  { value: "FALHA", label: "Falha" },
  { value: "REJEITADO", label: "Rejeitado" },
  { value: "INCLUIDO_CARTORIO", label: "Cartório" },
  { value: "PENDENTE_RETENTATIVA", label: "Pendente" },
];

const allStatusFilterValue = "Todas";
const billingActiveAssignorStorageKey = "fortusys:billing:active-assignor";

const billingTabs = [
  "resumo",
  "boletos",
  "contas",
  "convenios",
] as const;

type BillingTab = (typeof billingTabs)[number];
type BillingSummaryRange = "7d" | "30d" | "3m" | "6m" | "12m" | "custom";

const billingSummaryRangeOptions: Array<{
  value: BillingSummaryRange;
  label: string;
}> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
  { value: "custom", label: "Customizado" },
];

function getBillingTab(value?: string | null): BillingTab {
  return billingTabs.includes(value as BillingTab)
    ? (value as BillingTab)
    : "resumo";
}

function parseBillingAmount(value?: string | null) {
  const normalized = (value ?? "0")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
}

function formatBillingCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getTicketStatusKey(ticket: BillingTicket) {
  return (ticket.status || "").trim().toUpperCase();
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfMonth(value: Date) {
  return startOfDay(new Date(value.getFullYear(), value.getMonth(), 1));
}

function endOfMonth(value: Date) {
  return endOfDay(new Date(value.getFullYear(), value.getMonth() + 1, 0));
}

function formatDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(value.getDate()).padStart(2, "0")}`;
}

function getDefaultSummaryCustomFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return formatDateInput(date);
}

function getDefaultSummaryCustomTo() {
  return formatDateInput(new Date());
}

function parseBillingDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const rawDate = value.split(" ")[0];

  if (rawDate.includes("/")) {
    const [day, month, year] = rawDate.split("/");
    const date = new Date(`${year}-${month}-${day}T00:00:00`);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(`${rawDate}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getSummaryRangeDates(
  range: BillingSummaryRange,
  customFrom: string,
  customTo: string
) {
  const today = startOfDay(new Date());

  if (range === "custom") {
    return {
      from: customFrom
        ? startOfDay(new Date(`${customFrom}T00:00:00`))
        : startOfDay(today),
      to: customTo
        ? endOfDay(new Date(`${customTo}T00:00:00`))
        : endOfDay(today),
    };
  }

  if (range === "3m" || range === "6m") {
    const months = range === "3m" ? 3 : 6;
    const from = startOfMonth(today);
    from.setMonth(from.getMonth() - (months - 1));

    return { from, to: endOfDay(today) };
  }

  if (range === "12m") {
    return {
      from: startOfDay(new Date(today.getFullYear(), 0, 1)),
      to: endOfDay(new Date(today.getFullYear(), 11, 31)),
    };
  }

  const from = new Date(today);
  from.setDate(today.getDate() - (range === "7d" ? 6 : 29));

  return { from: startOfDay(from), to: endOfDay(today) };
}

function isDateInRange(date: Date | null, from: Date, to: Date) {
  if (!date) {
    return false;
  }

  const time = date.getTime();

  return time >= from.getTime() && time <= to.getTime();
}

function isBillingTicketOverdue(ticket: BillingTicket) {
  const dueDate = parseBillingDate(ticket.dueDate);

  return Boolean(
    dueDate &&
      dueDate.getTime() < startOfDay(new Date()).getTime() &&
      !["LIQUIDADO", "BAIXADO"].includes(getTicketStatusKey(ticket))
  );
}

function getMonthLabel(value: Date) {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(value)
    .replace(".", "");

  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${value.getFullYear()}`;
}

function getDayLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(value);
}

function getTrendBuckets(
  range: BillingSummaryRange,
  from: Date,
  to: Date,
  tickets: BillingTicket[]
) {
  const days = Math.max(
    1,
    Math.ceil((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) +
      1
  );

  if (range === "7d") {
    return Array.from({ length: 7 }, (_, index) => {
      const bucketFrom = new Date(from);
      bucketFrom.setDate(from.getDate() + index);

      return {
        from: startOfDay(bucketFrom),
        to: endOfDay(bucketFrom),
        label: getDayLabel(bucketFrom),
      };
    });
  }

  if (range === "30d") {
    const daysWithTickets = Array.from(
      new Set(
        tickets
          .map((ticket) => parseBillingDate(ticket.issueDate))
          .filter((date): date is Date => Boolean(date))
          .map(formatDateInput)
      )
    ).sort();

    return daysWithTickets.map((dateValue) => {
      const bucketDate = new Date(`${dateValue}T00:00:00`);

      return {
        from: startOfDay(bucketDate),
        to: endOfDay(bucketDate),
        label: getDayLabel(bucketDate),
      };
    });
  }

  if (range === "3m" || range === "6m" || range === "12m") {
    const months =
      range === "3m" ? 3 : range === "6m" ? 6 : 12;
    const firstMonth =
      range === "12m"
        ? new Date(from.getFullYear(), 0, 1)
        : startOfMonth(from);

    return Array.from({ length: months }, (_, index) => {
      const bucketFrom = new Date(
        firstMonth.getFullYear(),
        firstMonth.getMonth() + index,
        1
      );

      return {
        from: startOfMonth(bucketFrom),
        to: endOfMonth(bucketFrom),
        label: getMonthLabel(bucketFrom),
      };
    });
  }

  if (days <= 14) {
    return Array.from({ length: days }, (_, index) => {
      const bucketFrom = new Date(from);
      bucketFrom.setDate(from.getDate() + index);

      return {
        from: startOfDay(bucketFrom),
        to: endOfDay(bucketFrom),
        label: getDayLabel(bucketFrom),
      };
    });
  }

  if (days <= 60) {
    const daysWithTickets = Array.from(
      new Set(
        tickets
          .map((ticket) => parseBillingDate(ticket.issueDate))
          .filter((date): date is Date => Boolean(date))
          .map(formatDateInput)
      )
    ).sort();

    return daysWithTickets.map((dateValue) => {
      const bucketDate = new Date(`${dateValue}T00:00:00`);

      return {
        from: startOfDay(bucketDate),
        to: endOfDay(bucketDate),
        label: getDayLabel(bucketDate),
      };
    });
  }

  const buckets = [];
  const cursor = startOfMonth(from);

  while (cursor.getTime() <= to.getTime()) {
    const bucketFrom = new Date(cursor);
    const bucketTo = endOfMonth(cursor);

    buckets.push({
      from: bucketFrom.getTime() < from.getTime() ? startOfDay(from) : bucketFrom,
      to: bucketTo.getTime() > to.getTime() ? endOfDay(to) : bucketTo,
      label: getMonthLabel(cursor),
    });

    cursor.setMonth(cursor.getMonth() + 1);

    if (buckets.length >= 18) {
      break;
    }
  }

  return buckets;
}


function TicketStatusBadge({
  status,
  failureMessage,
}: {
  status: string;
  failureMessage?: string | null;
}) {
  const statusKey = status.trim().toUpperCase();
  const toneByStatus: Record<string, StatusTone> = {
    LIQUIDADO: "success",
    REGISTRADO: "info",
    EMITIDO: "progress",
    SALVO: "warning",
    PENDENTE_RETENTATIVA: "warning",
    VENCIDO: "overdue",
    BAIXADO: "neutral",
    FALHA: "danger",
    REJEITADO: "danger",
    INCLUIDO_CARTORIO: "danger",
  };
  const labelByStatus: Record<string, string> = {
    LIQUIDADO: "Liquidado",
    REGISTRADO: "Registrado",
    EMITIDO: "Emitido",
    SALVO: "Salvo",
    PENDENTE_RETENTATIVA: "Pendente",
    VENCIDO: "Vencido",
    BAIXADO: "Baixado",
    FALHA: "Falha",
    REJEITADO: "Rejeitado",
    INCLUIDO_CARTORIO: "Incluído em cartório",
  };
  const badge = (
    <SemanticStatusBadge tone={toneByStatus[statusKey] ?? "neutral"}>
      {labelByStatus[statusKey] ?? status}
    </SemanticStatusBadge>
  );

  if (!["FALHA", "REJEITADO"].includes(statusKey)) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<button className="cursor-help" type="button" />}>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap break-words">
        {failureMessage?.trim() || "O banco/TecnoSpeed ainda não informou o motivo. Atualize a consulta ou confira o histórico do boleto."}
      </TooltipContent>
    </Tooltip>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const normalized = value.includes("/")
    ? value.split(" ")[0]
    : new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T00:00:00`));

  return normalized;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return formatDate(value);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  return `55${digits}`;
}

function getTicketSelectionKey(ticket: BillingTicket) {
  return (
    ticket.integrationId ||
    ticket.documentNumber ||
    `${ticket.payerDocument}-${ticket.ourNumber}-${ticket.dueDate}`
  );
}

function ticketHasWhatsAppPayload(ticket: BillingTicket) {
  return Boolean(ticket.boletoUrl || ticket.digitableLine);
}

function getBulkTicketsWhatsAppMessage(
  tickets: BillingTicket[],
  context: {
    assignorName: string;
    printUrl: string;
  }
) {
  const payerName = tickets[0]?.payerName;
  const orderedTickets = [...tickets].sort(
    (a, b) =>
      getInstallmentNumber(a.installment) - getInstallmentNumber(b.installment)
  );
  const ticketBlocks = orderedTickets.map((ticket, index) =>
    [
      `Parcela ${ticket.installment || index + 1}`,
      `Vencimento: ${formatDate(ticket.dueDate)}`,
      `Valor: R$ ${ticket.amount || "0,00"}`,
    ].join("\n")
  );

  return [
    `Olá${payerName ? `, ${payerName}` : ""}!`,
    `Segue a cobrança em nome de ${context.assignorName}.`,
    ...ticketBlocks,
    tickets.length === 1
      ? `Link do boleto: ${context.printUrl}`
      : `Link dos boletos: ${context.printUrl}`,
  ].join("\n\n");
}

function getInstallmentNumber(value: string) {
  return Number(value.split("/")[0]?.replace(/\D/g, "")) || 0;
}

function buildWhatsAppUrl(phone: string, message: string) {
  const params = new URLSearchParams({ text: message });

  if (phone) {
    return `https://wa.me/${phone}?${params.toString()}`;
  }

  return `https://web.whatsapp.com/send?${params.toString()}`;
}

function getTicketEmailLines(tickets: BillingTicket[]) {
  return [...tickets]
    .sort(
      (a, b) =>
        getInstallmentNumber(a.installment) -
        getInstallmentNumber(b.installment)
    )
    .map((ticket, index) =>
      [
        `Parcela ${ticket.installment || index + 1}`,
        `Vencimento: ${formatDate(ticket.dueDate)}`,
        `Valor: R$ ${ticket.amount || "0,00"}`,
      ].join("\n")
    )
    .join("\n\n");
}

function getDefaultEmailMessage(tickets: BillingTicket[]) {
  const payerName = tickets[0]?.payerName || "cliente";

  return [
    `Olá, ${payerName},`,
    "",
    "Este é um e-mail automático gerado pelo nosso sistema de cobrança.",
    "",
    "Estamos enviando em anexo os boletos com vencimento. Seguem abaixo os detalhes das cobranças:",
    "",
    getTicketEmailLines(tickets),
  ].join("\n");
}

function parseTicketDate(value?: string | null) {
  if (!value) {
    return 0;
  }

  const rawDate = value.split(" ")[0];

  if (rawDate.includes("/")) {
    const [day, month, year] = rawDate.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00`).getTime();
  }

  return new Date(`${rawDate}T00:00:00`).getTime();
}

function getTodayTime() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function getTicketDisplayStatus(ticket: BillingTicket) {
  const status = ticket.status.toUpperCase();
  const settledStatuses = new Set(["LIQUIDADO", "BAIXADO"]);
  const overdueEligibleStatuses = new Set([
    "SALVO",
    "EMITIDO",
    "REGISTRADO",
    "PENDENTE_RETENTATIVA",
  ]);

  if (
    !settledStatuses.has(status) &&
    overdueEligibleStatuses.has(status) &&
    parseTicketDate(ticket.dueDate) < getTodayTime()
  ) {
    return "VENCIDO";
  }

  return ticket.status;
}

function isTicketRegistered(ticket: BillingTicket) {
  return ticket.status.trim().toUpperCase() === "REGISTRADO";
}

function isTicketSettled(ticket: BillingTicket) {
  return ["LIQUIDADO", "BAIXADO"].includes(ticket.status.trim().toUpperCase());
}

function canRequestTicketDischarge(ticket: BillingTicket) {
  return isTicketRegistered(ticket);
}

function isTicketDiscardable(ticket: BillingTicket) {
  return ["EMITIDO", "FALHA", "REJEITADO"].includes(
    ticket.status.trim().toUpperCase()
  );
}

function BulkActionButton({
  disabled,
  icon: Icon,
  label,
  onClick,
  variant = "outline",
}: {
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "outline" | "destructive";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-disabled={disabled}
            className={disabled ? "opacity-50" : undefined}
            onClick={() => {
              if (disabled) {
                toast.info("Selecione ao menos um boleto.");
                return;
              }

              onClick();
            }}
            size="icon"
            type="button"
            variant={variant}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

type BillingChartBar = {
  label: string;
  value: number;
  amount: number;
  tone: "info" | "success" | "warning" | "neutral";
};

function SummaryLoadingValue({ width = "w-16" }: { width?: string }) {
  return (
    <span
      aria-label="Atualizando indicador"
      className={`inline-flex h-6 ${width} animate-pulse rounded-md bg-gradient-to-r from-primary/15 via-primary/30 to-primary/15 align-middle ring-1 ring-primary/10`}
      role="status"
    />
  );
}

function BillingStatusBarChart({
  data,
  isLoading,
}: {
  data: BillingChartBar[];
  isLoading?: boolean;
}) {
  const max = Math.max(1, ...data.map((item) => item.amount));
  const toneClasses = {
    info: "bg-blue-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    neutral: "bg-slate-500",
  } as const;

  return (
    <ManagementDataCard
      className="h-full"
      count={`${data.length} status`}
      title="Valores por status"
    >
      <div className="relative flex h-[250px] flex-col justify-center space-y-3">
        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/45 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              Atualizando
            </div>
          </div>
        ) : null}
        {data.map((item) => (
          <div className="space-y-1.5" key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-2 rounded-full ${toneClasses[item.tone]}`}
                />
                <span className="truncate font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {item.value} boleto(s)
                </span>
              </div>
              <span className="font-medium">
                {formatBillingCurrency(item.amount)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${toneClasses[item.tone]}`}
                style={{ width: `${Math.max(4, (item.amount / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ManagementDataCard>
  );
}

type BillingTrendPoint = {
  label: string;
  registered: number;
  liquidated: number;
};

const billingTrendChartConfig = {
  registered: {
    label: "Registrados",
    color: "rgb(59 130 246)",
  },
  liquidated: {
    label: "Liquidados",
    color: "rgb(4 120 87)",
  },
} satisfies ChartConfig;

const billingTrendTitle = "Evolução do período";

function BillingTrendChart({
  isLoading,
  points,
}: {
  isLoading?: boolean;
  points: BillingTrendPoint[];
}) {
  return <BillingTrendPanel isLoading={isLoading} points={points} />;
}

export function BillingTrendBarChart({
  points,
}: {
  points: BillingTrendPoint[];
}) {
  const max = Math.max(
    1,
    ...points.flatMap((point) => [point.registered, point.liquidated])
  );

  return (
    <ManagementDataCard
      className="h-full"
      count={`${points.length} ponto(s)`}
      title="Evolução do período"
    >
      <div className="flex h-64 items-end gap-2 overflow-hidden rounded-xl border bg-muted/15 px-4 pb-8 pt-4">
        {points.map((point) => (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={point.label}>
            <div className="flex h-44 w-full items-end justify-center gap-1">
              <div
                className="w-full max-w-5 rounded-t bg-blue-500"
                style={{
                  height: `${Math.max(4, (point.registered / max) * 176)}px`,
                }}
                title={`Registrados: ${formatBillingCurrency(point.registered)}`}
              />
              <div
                className="w-full max-w-5 rounded-t bg-emerald-500"
                style={{
                  height: `${Math.max(4, (point.liquidated / max) * 176)}px`,
                }}
                title={`Liquidados: ${formatBillingCurrency(point.liquidated)}`}
              />
            </div>
            <span className="max-w-full truncate text-[10px] text-muted-foreground">
              {point.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-500" />
          Registrados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          Liquidados
        </span>
      </div>
    </ManagementDataCard>
  );
}

export function BillingTrendShadcnAreaChart({
  isLoading,
  points,
}: {
  isLoading?: boolean;
  points: BillingTrendPoint[];
}) {
  return (
    <ManagementDataCard
      className="h-full"
      count={`${points.length} ponto(s)`}
      title="Evolução do período"
    >
      <div className="relative h-[250px] overflow-hidden rounded-xl border bg-muted/15">
        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-card/45 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              Atualizando
            </div>
          </div>
        ) : null}
        {points.length > 0 ? (
          <ChartContainer
            className="aspect-auto h-[250px] w-full px-2 pt-4 sm:px-6 sm:pt-6"
            config={billingTrendChartConfig}
          >
            <AreaChart data={points}>
              <defs>
                <linearGradient
                  id="fillRegistered"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-registered)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-registered)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient
                  id="fillLiquidated"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-liquidated)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-liquidated)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                minTickGap={24}
                tickLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-[150px] items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {billingTrendChartConfig[
                            name as keyof typeof billingTrendChartConfig
                          ]?.label ?? name}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {formatBillingCurrency(Number(value))}
                        </span>
                      </div>
                    )}
                    indicator="dot"
                  />
                }
                cursor={false}
              />
              <Area
                dataKey="liquidated"
                fill="url(#fillLiquidated)"
                stackId="a"
                stroke="var(--color-liquidated)"
                type="natural"
              />
              <Area
                dataKey="registered"
                fill="url(#fillRegistered)"
                stackId="a"
                stroke="var(--color-registered)"
                type="natural"
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado para montar a evolução deste período.
          </div>
        )}
      </div>
    </ManagementDataCard>
  );
}

function getAreaChartPath(
  points: Array<{ x: number; y: number }>,
  baseline: number
) {
  if (points.length === 0) {
    return "";
  }

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

function getLineChartPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export function BillingTrendAreaChart({
  isLoading,
  points,
}: {
  isLoading?: boolean;
  points: BillingTrendPoint[];
}) {
  const max = Math.max(
    1,
    ...points.flatMap((point) => [point.registered, point.liquidated])
  );
  const width = 720;
  const height = 240;
  const padding = { top: 18, right: 24, bottom: 42, left: 24 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baseline = padding.top + chartHeight;
  const getX = (index: number) =>
    padding.left +
    (points.length === 1
      ? chartWidth / 2
      : (chartWidth / (points.length - 1)) * index);
  const getY = (value: number) => baseline - (value / max) * chartHeight;
  const registeredPoints = points.map((point, index) => ({
    x: getX(index),
    y: getY(point.registered),
  }));
  const liquidatedPoints = points.map((point, index) => ({
    x: getX(index),
    y: getY(point.liquidated),
  }));

  return (
    <ManagementDataCard
      count={`${points.length} ponto(s)`}
      title="Evolução do período"
    >
      <div className="relative overflow-hidden rounded-xl border bg-muted/15">
        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 z-10 bg-card/45 backdrop-blur-[1px]">
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
          </div>
        ) : null}
        {points.length > 0 ? (
          <svg
            className="h-64 w-full"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${width} ${height}`}
          >
            <defs>
              <linearGradient id="registeredArea" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="rgb(59 130 246)"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="rgb(59 130 246)"
                  stopOpacity="0.03"
                />
              </linearGradient>
              <linearGradient id="liquidatedArea" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="rgb(16 185 129)"
                  stopOpacity="0.24"
                />
                <stop
                  offset="100%"
                  stopColor="rgb(16 185 129)"
                  stopOpacity="0.03"
                />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((line) => {
              const y = padding.top + (chartHeight / 3) * line;

              return (
                <line
                  key={line}
                  stroke="currentColor"
                  strokeDasharray="4 8"
                  strokeOpacity="0.12"
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                />
              );
            })}
            <path
              d={getAreaChartPath(registeredPoints, baseline)}
              fill="url(#registeredArea)"
            />
            <path
              d={getAreaChartPath(liquidatedPoints, baseline)}
              fill="url(#liquidatedArea)"
            />
            <path
              d={getLineChartPath(registeredPoints)}
              fill="none"
              stroke="rgb(59 130 246)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            <path
              d={getLineChartPath(liquidatedPoints)}
              fill="none"
              stroke="rgb(16 185 129)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            {points.map((point, index) => {
              const x = getX(index);

              return (
                <g key={point.label}>
                  <circle
                    cx={x}
                    cy={getY(point.registered)}
                    fill="rgb(59 130 246)"
                    r="3.5"
                  />
                  <circle
                    cx={x}
                    cy={getY(point.liquidated)}
                    fill="rgb(16 185 129)"
                    r="3.5"
                  />
                  <text
                    fill="currentColor"
                    fontSize="11"
                    opacity="0.6"
                    textAnchor="middle"
                    x={x}
                    y={height - 15}
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado para montar a evolução deste período.
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-500" />
          Registrados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          Liquidados
        </span>
      </div>
    </ManagementDataCard>
  );
}

function BillingTrendPanel({
  isLoading,
  points,
}: {
  isLoading?: boolean;
  points: BillingTrendPoint[];
}) {
  return (
    <ManagementDataCard
      className="h-full"
      count={`${points.length} ponto(s)`}
      title={billingTrendTitle}
    >
      <div className="relative h-[250px] overflow-hidden rounded-xl border bg-muted/15">
        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-card/45 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              Atualizando
            </div>
          </div>
        ) : null}
        {points.length > 0 ? (
          <ChartContainer
            className="aspect-auto h-[250px] w-full px-2 pt-4 sm:px-6 sm:pt-6"
            config={billingTrendChartConfig}
          >
            <AreaChart data={points}>
              <defs>
                <linearGradient
                  id="fillRegisteredPanel"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-registered)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-registered)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient
                  id="fillLiquidatedPanel"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-liquidated)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-liquidated)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                minTickGap={24}
                tickLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-[150px] items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {billingTrendChartConfig[
                            name as keyof typeof billingTrendChartConfig
                          ]?.label ?? name}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {formatBillingCurrency(Number(value))}
                        </span>
                      </div>
                    )}
                    indicator="dot"
                  />
                }
                cursor={false}
              />
              <Area
                dataKey="liquidated"
                fill="url(#fillLiquidatedPanel)"
                stackId="a"
                stroke="var(--color-liquidated)"
                type="natural"
              />
              <Area
                dataKey="registered"
                fill="url(#fillRegisteredPanel)"
                stackId="a"
                stroke="var(--color-registered)"
                type="natural"
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado para montar a evolução deste período.
          </div>
        )}
      </div>
    </ManagementDataCard>
  );
}

type TicketFilters = {
  status: string;
  payerName: string;
  payerDocument: string;
  issueDateFrom: string;
  issueDateTo: string;
  dueDateFrom: string;
  dueDateTo: string;
};

type WhatsAppPrintForm = {
  printType: string;
  hideDigitableLine: boolean;
  protectWithPassword: boolean;
  password: string;
};

type PreparedWhatsAppMessage = {
  phone: string;
  url: string;
};

type WhatsAppStep = "form" | "processing" | "ready";

type BatchPrintResult = {
  printUrl: string;
  protocol: string;
};

type PrintStep = "form" | "processing" | "ready";

type BatchDischargeResult = {
  message: string;
  count: number;
};

type DischargeStep = "confirm" | "processing" | "ready";

type BatchDiscardResult = {
  message: string;
  successCount: number;
  failures: Array<{
    idintegracao?: string;
    _erro?: string;
    _status_http?: number;
  }>;
};

type DiscardStep = "confirm" | "processing" | "ready";

type EmailForm = {
  senderName: string;
  senderEmail: string;
  subject: string;
  html: boolean;
  attachTicket: boolean;
  message: string;
  recipientEmail: string;
  printType: string;
};

type EmailStep = "form" | "processing" | "ready";

const defaultWhatsAppPrintForm: WhatsAppPrintForm = {
  printType: "0",
  hideDigitableLine: false,
  protectWithPassword: false,
  password: "",
};

const defaultEmailForm: EmailForm = {
  senderName: "",
  senderEmail: "",
  subject: "",
  html: false,
  attachTicket: true,
  message: "",
  recipientEmail: "",
  printType: "0",
};

const printTypeOptions = [
  { value: "0", label: "PDF normal" },
  { value: "1", label: "PDF carnê duplo" },
  { value: "2", label: "PDF carnê triplo" },
  { value: "3", label: "PDF dupla" },
  { value: "4", label: "PDF com marca d'água" },
  { value: "99", label: "PDF personalizado" },
];

function formatDateToInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(value: Date, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date;
}

function getDefaultBillingFilters(): TicketFilters {
  const now = new Date();

  return {
    status: allStatusFilterValue,
    payerName: "",
    payerDocument: "",
    issueDateFrom: formatDateToInput(addMonths(now, -1)),
    issueDateTo: formatDateToInput(addMonths(now, 1)),
    dueDateFrom: "",
    dueDateTo: "",
  };
}

export function BillingManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assignors, setAssignors] = useState<BillingAssignor[]>([]);
  const [tickets, setTickets] = useState<BillingTicket[]>([]);
  const [summaryTickets, setSummaryTickets] = useState<BillingTicket[]>([]);
  const [accounts, setAccounts] = useState<BillingBankAccount[]>([]);
  const [activeAssignorId, setActiveAssignorId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const storedAssignor = window.sessionStorage.getItem(
      billingActiveAssignorStorageKey
    );

    if (!storedAssignor) {
      return "";
    }

    try {
      const parsedAssignor = JSON.parse(storedAssignor) as {
        id?: string;
      };

      return parsedAssignor.id ?? "";
    } catch {
      window.sessionStorage.removeItem(billingActiveAssignorStorageKey);
      return "";
    }
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [ticketsRefreshKey, setTicketsRefreshKey] = useState(0);
  const [accountsRefreshKey, setAccountsRefreshKey] = useState(0);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsPage, setTicketsPage] = useState(1);
  const [filters, setFilters] = useState<TicketFilters>(getDefaultBillingFilters);
  const [draftFilters, setDraftFilters] =
    useState<TicketFilters>(getDefaultBillingFilters);
  const [ticketToDischarge, setTicketToDischarge] =
    useState<BillingTicket | null>(null);
  const [ticketToDiscard, setTicketToDiscard] = useState<BillingTicket | null>(
    null
  );
  const [ticketHistory, setTicketHistory] = useState<BillingTicket | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(
    new Set()
  );
  const [isRequestingDischarge, setIsRequestingDischarge] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [isProcessingWhatsApp, setIsProcessingWhatsApp] = useState(false);
  const [whatsAppPrintForm, setWhatsAppPrintForm] =
    useState<WhatsAppPrintForm>(defaultWhatsAppPrintForm);
  const [whatsAppStep, setWhatsAppStep] = useState<WhatsAppStep>("form");
  const [preparedWhatsAppMessages, setPreparedWhatsAppMessages] = useState<
    PreparedWhatsAppMessage[]
  >([]);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isProcessingPrint, setIsProcessingPrint] = useState(false);
  const [printStep, setPrintStep] = useState<PrintStep>("form");
  const [printForm, setPrintForm] =
    useState<WhatsAppPrintForm>(defaultWhatsAppPrintForm);
  const [batchPrintResult, setBatchPrintResult] =
    useState<BatchPrintResult | null>(null);
  const [isBulkDischargeDialogOpen, setIsBulkDischargeDialogOpen] =
    useState(false);
  const [isProcessingBulkDischarge, setIsProcessingBulkDischarge] =
    useState(false);
  const [bulkDischargeStep, setBulkDischargeStep] =
    useState<DischargeStep>("confirm");
  const [batchDischargeResult, setBatchDischargeResult] =
    useState<BatchDischargeResult | null>(null);
  const [isBulkDiscardDialogOpen, setIsBulkDiscardDialogOpen] = useState(false);
  const [isProcessingBulkDiscard, setIsProcessingBulkDiscard] = useState(false);
  const [bulkDiscardStep, setBulkDiscardStep] =
    useState<DiscardStep>("confirm");
  const [batchDiscardResult, setBatchDiscardResult] =
    useState<BatchDiscardResult | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isProcessingEmail, setIsProcessingEmail] = useState(false);
  const [emailStep, setEmailStep] = useState<EmailStep>("form");
  const [emailForm, setEmailForm] = useState<EmailForm>(defaultEmailForm);
  const [emailProtocol, setEmailProtocol] = useState("");
  const [summarySelectedRange, setSummarySelectedRange] =
    useState<BillingSummaryRange>("30d");
  const [summaryRange, setSummaryRange] =
    useState<BillingSummaryRange>("30d");
  const [summaryCustomFrom, setSummaryCustomFrom] = useState(
    getDefaultSummaryCustomFrom
  );
  const [summaryCustomTo, setSummaryCustomTo] = useState(() =>
    getDefaultSummaryCustomTo()
  );
  const [summaryDraftCustomFrom, setSummaryDraftCustomFrom] = useState(
    getDefaultSummaryCustomFrom
  );
  const [summaryDraftCustomTo, setSummaryDraftCustomTo] = useState(() =>
    getDefaultSummaryCustomTo()
  );

  const activeAssignor = useMemo(
    () =>
      assignors.find((assignor) => String(assignor.id) === activeAssignorId) ??
      null,
    [activeAssignorId, assignors]
  );
  const selectedTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        selectedTicketIds.has(getTicketSelectionKey(ticket))
      ),
    [selectedTicketIds, tickets]
  );
  const selectedTicketsCount = selectedTickets.length;
  const hasSelectedTickets = selectedTicketsCount > 0;
  const selectedTicketsForDischarge = useMemo(
    () => selectedTickets.filter(canRequestTicketDischarge),
    [selectedTickets]
  );
  const selectedUnavailableDischargeTicketsCount =
    selectedTicketsCount - selectedTicketsForDischarge.length;
  const selectedTicketsForDiscard = useMemo(
    () => selectedTickets.filter(isTicketDiscardable),
    [selectedTickets]
  );
  const selectedNotDiscardableTicketsCount =
    selectedTicketsCount - selectedTicketsForDiscard.length;
  const allVisibleTicketsSelected =
    tickets.length > 0 &&
    tickets.every((ticket) =>
      selectedTicketIds.has(getTicketSelectionKey(ticket))
    );
  const agreements = useMemo(
    () =>
      accounts.flatMap((account) =>
        account.agreements.map((agreement) => ({
          ...agreement,
          account,
        }))
      ),
    [accounts]
  );

  const activeTab = useMemo(
    () => getBillingTab(searchParams.get("tab")),
    [searchParams]
  );
  const isSummaryRefreshing = isInitialLoading || isLoadingSummary;
  const summary = useMemo(() => {
    const { from, to } = getSummaryRangeDates(
      summaryRange,
      summaryCustomFrom,
      summaryCustomTo
    );
    const periodTickets = summaryTickets.filter((ticket) =>
      isDateInRange(parseBillingDate(ticket.issueDate), from, to)
    );
    const registered = periodTickets.filter(
      (ticket) => getTicketStatusKey(ticket) === "REGISTRADO"
    );
    const settled = periodTickets.filter(
      (ticket) => getTicketStatusKey(ticket) === "LIQUIDADO"
    );
    const failed = periodTickets.filter((ticket) =>
      ["FALHA", "REJEITADO", "PENDENTE_RETENTATIVA"].includes(
        getTicketStatusKey(ticket)
      )
    );
    const writtenOff = periodTickets.filter(
      (ticket) => getTicketStatusKey(ticket) === "BAIXADO"
    );
    const overdue = periodTickets.filter(isBillingTicketOverdue);
    const buckets = getTrendBuckets(summaryRange, from, to, periodTickets);
    const chartPoints = buckets.map((bucket) => {
      const bucketTickets = periodTickets.filter((ticket) =>
        isDateInRange(parseBillingDate(ticket.issueDate), bucket.from, bucket.to)
      );

      return {
        label: bucket.label,
        registered: bucketTickets
          .filter((ticket) => getTicketStatusKey(ticket) === "REGISTRADO")
          .reduce((total, ticket) => total + parseBillingAmount(ticket.amount), 0),
        liquidated: bucketTickets
          .filter((ticket) => getTicketStatusKey(ticket) === "LIQUIDADO")
          .reduce((total, ticket) => total + parseBillingAmount(ticket.amount), 0),
      };
    });
    const registeredAmount = registered.reduce(
      (total, ticket) => total + parseBillingAmount(ticket.amount),
      0
    );
    const settledAmount = settled.reduce(
      (total, ticket) => total + parseBillingAmount(ticket.amount),
      0
    );
    const overdueAmount = overdue.reduce(
      (total, ticket) => total + parseBillingAmount(ticket.amount),
      0
    );
    const writtenOffAmount = writtenOff.reduce(
      (total, ticket) => total + parseBillingAmount(ticket.amount),
      0
    );

    return {
      from,
      to,
      periodTickets: periodTickets.length,
      registeredAmount,
      settledAmount,
      overdueAmount,
      writtenOffAmount,
      registered: registered.length,
      settled: settled.length,
      overdue: overdue.length,
      writtenOff: writtenOff.length,
      failed: failed.length,
      attentionTickets: [...failed, ...overdue].slice(0, 8),
      chartBars: [
        {
          label: "Registrados",
          value: registered.length,
          amount: registeredAmount,
          tone: "info" as const,
        },
        {
          label: "Liquidados",
          value: settled.length,
          amount: settledAmount,
          tone: "success" as const,
        },
        {
          label: "Vencidos",
          value: overdue.length,
          amount: overdueAmount,
          tone: "warning" as const,
        },
        {
          label: "Baixados",
          value: writtenOff.length,
          amount: writtenOffAmount,
          tone: "neutral" as const,
        },
      ],
      chartPoints,
    };
  }, [summaryCustomFrom, summaryCustomTo, summaryRange, summaryTickets]);

  useEffect(() => {
    if (!activeAssignor) {
      return;
    }

    window.sessionStorage.setItem(
      billingActiveAssignorStorageKey,
      JSON.stringify({
        id: String(activeAssignor.id),
        document: activeAssignor.document,
        name: activeAssignor.corporateName,
      })
    );
  }, [activeAssignor]);

  useEffect(() => {
    async function loadAssignors() {
      try {
        const response = await fetch("/api/billing/assignors", {
          cache: "no-store",
        });

        if (!response.ok) {
          const data = (await response.json()) as { message?: string };
          throw new Error(data.message ?? "Não foi possível carregar cedentes.");
        }

        const data = (await response.json()) as BillingAssignorsResponse;
        setAssignors(data.assignors);
        setActiveAssignorId((current) => {
          if (
            current &&
            data.assignors.some((assignor) => String(assignor.id) === current)
          ) {
            return current;
          }

          return data.assignors[0] ? String(data.assignors[0].id) : "";
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar cedentes."
        );
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadAssignors();
  }, []);

  useEffect(() => {
    async function loadTickets() {
      if (!activeAssignor) {
        setTickets([]);
        return;
      }

      setIsLoadingTickets(true);

      try {
        const params = new URLSearchParams({
          document: activeAssignor.document,
          page: String(ticketsPage),
          limit: "8",
        });
        Object.entries(filters).forEach(([key, value]) => {
          if (!value || value === allStatusFilterValue) {
            return;
          }

          params.set(key, value);
        });
        const response = await fetch(`/api/billing/tickets?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | BillingTicketsResponse
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível carregar boletos."
          );
        }

        if (!("tickets" in data)) {
          throw new Error("Não foi possível carregar boletos.");
        }

        setTickets(data.tickets);
        setTicketsTotal(data.total);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar boletos."
        );
      } finally {
        setIsLoadingTickets(false);
      }
    }

    void loadTickets();
  }, [activeAssignor, filters, ticketsPage, ticketsRefreshKey]);

  useEffect(() => {
    async function loadSummaryTickets() {
      if (!activeAssignor) {
        setSummaryTickets([]);
        return;
      }

      setIsLoadingSummary(true);

      try {
        const { from, to } = getSummaryRangeDates(
          summaryRange,
          summaryCustomFrom,
          summaryCustomTo
        );
        const params = new URLSearchParams({
          document: activeAssignor.document,
          page: "1",
          limit: "1000",
          issueDateFrom: formatDateInput(from),
          issueDateTo: formatDateInput(to),
        });
        const response = await fetch(`/api/billing/tickets?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | BillingTicketsResponse
          | { message?: string };

        if (!response.ok || !("tickets" in data)) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível carregar o resumo de cobranças."
          );
        }

        setSummaryTickets(data.tickets);
      } catch (error) {
        setSummaryTickets([]);
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o resumo de cobranças."
        );
      } finally {
        setIsLoadingSummary(false);
      }
    }

    void loadSummaryTickets();
  }, [
    activeAssignor,
    summaryCustomFrom,
    summaryCustomTo,
    summaryRange,
    ticketsRefreshKey,
  ]);

  useEffect(() => {
    async function loadAccounts() {
      if (!activeAssignor || !["contas", "convenios"].includes(activeTab)) {
        if (!activeAssignor) {
          setAccounts([]);
        }
        return;
      }

      setIsLoadingAccounts(true);

      try {
        const params = new URLSearchParams({
          document: activeAssignor.document,
        });
        const response = await fetch(
          `/api/billing/assignors/${activeAssignor.id}/accounts?${params.toString()}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as
          | BillingBankAccountsResponse
          | { message?: string };

        if (!response.ok || !("accounts" in data)) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível carregar as contas do cedente."
          );
        }

        setAccounts(data.accounts);
      } catch (error) {
        setAccounts([]);
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as contas do cedente."
        );
      } finally {
        setIsLoadingAccounts(false);
      }
    }

    void loadAccounts();
  }, [accountsRefreshKey, activeAssignor, activeTab]);

  useEffect(() => {
    if (!activeAssignor) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`billing-ticket-status-${activeAssignor.document}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billing_ticket_status_cache",
          filter: `assignor_document=eq.${activeAssignor.document.replace(
            /\D/g,
            ""
          )}`,
        },
        (payload) => {
          const updatedTicket = payload.new as {
            integration_id?: string | null;
            status?: string | null;
          };

          if (!updatedTicket.integration_id || !updatedTicket.status) {
            return;
          }

          setTickets((currentTickets) =>
            currentTickets.map((ticket) =>
              ticket.integrationId === updatedTicket.integration_id
                ? { ...ticket, status: updatedTicket.status ?? ticket.status }
                : ticket
            )
          );
          setSummaryTickets((currentTickets) =>
            currentTickets.map((ticket) =>
              ticket.integrationId === updatedTicket.integration_id
                ? { ...ticket, status: updatedTicket.status ?? ticket.status }
                : ticket
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeAssignor]);

  function handleNewBilling() {
    if (!activeAssignor) {
      toast.error("Selecione um cedente para criar uma cobrança.");
      return;
    }

    const params = new URLSearchParams({
      assignorId: String(activeAssignor.id),
      document: activeAssignor.document,
      name: activeAssignor.corporateName,
    });

    router.push(`/cobranca/nova?${params.toString()}`);
  }

  function handleTabChange(value: string) {
    const nextTab = getBillingTab(value);

    router.replace(
      nextTab === "resumo" ? "/cobranca" : `/cobranca?tab=${nextTab}`,
      { scroll: false }
    );
  }

  function handleSummaryRangeChange(range: BillingSummaryRange) {
    setSummarySelectedRange(range);

    if (range === "custom") {
      setSummaryDraftCustomFrom(summaryCustomFrom);
      setSummaryDraftCustomTo(summaryCustomTo);
      return;
    }

    setSummaryRange(range);
  }

  function handleApplyCustomSummaryRange() {
    if (!summaryDraftCustomFrom || !summaryDraftCustomTo) {
      toast.error("Informe a data inicial e final para filtrar o resumo.");
      return;
    }

    const from = new Date(`${summaryDraftCustomFrom}T00:00:00`);
    const to = new Date(`${summaryDraftCustomTo}T00:00:00`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      toast.error("Informe um período customizado válido.");
      return;
    }

    if (from > to) {
      toast.error("A data inicial não pode ser maior que a data final.");
      return;
    }

    setSummaryCustomFrom(summaryDraftCustomFrom);
    setSummaryCustomTo(summaryDraftCustomTo);
    setSummarySelectedRange("custom");
    setSummaryRange("custom");
  }

      function handleReloadTickets() {
    if (!activeAssignor) {
      return;
    }

    setSelectedTicketIds(new Set());
    setTicketsRefreshKey((current) => current + 1);
  }

  function handleReloadAccounts() {
    if (!activeAssignor) {
      return;
    }

    setAccountsRefreshKey((current) => current + 1);
  }

  function handleApplyFilters() {
    setTicketsPage(1);
    setSelectedTicketIds(new Set());
    setFilters(draftFilters);
  }

  function handleClearFilters() {
    setTicketsPage(1);
    setSelectedTicketIds(new Set());
    const defaultFilters = getDefaultBillingFilters();
    setDraftFilters(defaultFilters);
    setFilters(defaultFilters);
  }

  function handleAssignorChange(value: string | null) {
    setActiveAssignorId(value ?? "");
    setTicketsPage(1);
    setSelectedTicketIds(new Set());
  }

  function handleToggleTicketSelection(ticket: BillingTicket, checked: boolean) {
    const ticketId = getTicketSelectionKey(ticket);

    setSelectedTicketIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (checked) {
        nextSelection.add(ticketId);
      } else {
        nextSelection.delete(ticketId);
      }

      return nextSelection;
    });
  }

  function handleToggleVisibleTicketsSelection(checked: boolean) {
    setSelectedTicketIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      for (const ticket of tickets) {
        const ticketId = getTicketSelectionKey(ticket);

        if (checked) {
          nextSelection.add(ticketId);
        } else {
          nextSelection.delete(ticketId);
        }
      }

      return nextSelection;
    });
  }

  function handleOpenWhatsAppDialog() {
    setWhatsAppPrintForm(defaultWhatsAppPrintForm);
    setWhatsAppStep("form");
    setPreparedWhatsAppMessages([]);
    setIsWhatsAppDialogOpen(true);
  }

  function handleCloseWhatsAppDialog() {
    if (isProcessingWhatsApp) {
      return;
    }

    setIsWhatsAppDialogOpen(false);
    setWhatsAppStep("form");
    setPreparedWhatsAppMessages([]);
  }

  function handleOpenPrintDialog() {
    if (!activeAssignor) {
      toast.warning("Selecione um cedente.");
      return;
    }

    setPrintForm(defaultWhatsAppPrintForm);
    setPrintStep("form");
    setBatchPrintResult(null);
    setIsPrintDialogOpen(true);
  }

  function handleClosePrintDialog() {
    if (isProcessingPrint) {
      return;
    }

    setIsPrintDialogOpen(false);
    setPrintStep("form");
    setBatchPrintResult(null);
  }

  function handleDownloadBatchPrint() {
    if (!batchPrintResult?.printUrl) {
      return;
    }

    window.open(batchPrintResult.printUrl, "_blank", "noopener,noreferrer");
    handleClosePrintDialog();
  }

  function handleOpenBulkDischargeDialog() {
    if (!activeAssignor) {
      toast.warning("Selecione um cedente.");
      return;
    }

    if (!selectedTicketsForDischarge.length) {
      toast.warning("Nenhum boleto disponível para baixa", {
        description: "Só é possível solicitar baixa de boletos registrados.",
      });
      return;
    }

    setBulkDischargeStep("confirm");
    setBatchDischargeResult(null);
    setIsBulkDischargeDialogOpen(true);
  }

  function handleCloseBulkDischargeDialog() {
    if (isProcessingBulkDischarge) {
      return;
    }

    setIsBulkDischargeDialogOpen(false);
    setBulkDischargeStep("confirm");
    setBatchDischargeResult(null);
  }

  function handleOpenBulkDiscardDialog() {
    if (!activeAssignor) {
      toast.warning("Selecione um cedente.");
      return;
    }

    if (!selectedTicketsForDiscard.length) {
      toast.warning("Nenhum boleto disponível para descarte", {
        description: "Só é possível descartar boletos emitidos, com falha ou rejeitados.",
      });
      return;
    }

    setBulkDiscardStep("confirm");
    setBatchDiscardResult(null);
    setIsBulkDiscardDialogOpen(true);
  }

  function handleCloseBulkDiscardDialog() {
    if (isProcessingBulkDiscard) {
      return;
    }

    setIsBulkDiscardDialogOpen(false);
    setBulkDiscardStep("confirm");
    setBatchDiscardResult(null);
  }

  function handleSendPreparedWhatsApp() {
    for (const message of preparedWhatsAppMessages) {
      window.open(message.url, "_blank", "noopener,noreferrer");
    }

    toast.success("WhatsApp aberto", {
      description:
        preparedWhatsAppMessages.length === 1
          ? "A mensagem foi enviada para uma janela do WhatsApp."
          : `${preparedWhatsAppMessages.length} conversas foram abertas.`,
    });
    handleCloseWhatsAppDialog();
  }

  function handleOpenEmailDialog() {
    if (!activeAssignor) {
      toast.warning("Selecione um cedente.");
      return;
    }

    const recipientEmails = Array.from(
      new Set(selectedTickets.map((ticket) => ticket.payerEmail).filter(Boolean))
    );
    setEmailForm({
      ...defaultEmailForm,
      senderName: activeAssignor.corporateName,
      senderEmail: activeAssignor.email ?? "",
      subject: `Cobrança - ${activeAssignor.corporateName}`,
      message: getDefaultEmailMessage(selectedTickets),
      recipientEmail: recipientEmails.join(", "),
    });
    setEmailProtocol("");
    setEmailStep("form");
    setIsEmailDialogOpen(true);
  }

  function handleCloseEmailDialog() {
    if (isProcessingEmail) {
      return;
    }

    setIsEmailDialogOpen(false);
    setEmailProtocol("");
    setEmailStep("form");
  }

  async function handleSendEmail() {
    if (!activeAssignor) {
      toast.warning("Selecione um cedente.");
      return;
    }

    const recipients = emailForm.recipientEmail
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    if (
      !emailForm.senderName.trim() ||
      !emailForm.senderEmail.trim() ||
      !emailForm.subject.trim() ||
      !emailForm.message.trim() ||
      !recipients.length
    ) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    setEmailStep("processing");
    setIsProcessingEmail(true);

    try {
      const response = await fetch("/api/billing/tickets/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignorDocument: activeAssignor.document,
          integrationIds: selectedTickets.map((ticket) => ticket.integrationId),
          senderName: emailForm.senderName,
          senderEmail: emailForm.senderEmail,
          subject: emailForm.subject,
          message: emailForm.message,
          recipients,
          attachTicket: emailForm.attachTicket,
          html: emailForm.html,
          printType: emailForm.printType,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        protocol?: string;
      };

      if (!response.ok || !data.protocol) {
        throw new Error(data.message ?? "Não foi possível enviar o e-mail.");
      }

      setEmailProtocol(data.protocol);
      setEmailStep("ready");
    } catch (error) {
      setEmailStep("form");
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o e-mail."
      );
    } finally {
      setIsProcessingEmail(false);
    }
  }

  async function handleBatchPrint() {
    if (!activeAssignor) {
      toast.warning("Selecione um cedente.");
      return;
    }

    if (printForm.protectWithPassword && !printForm.password.trim()) {
      toast.warning("Informe a senha do PDF.");
      return;
    }

    const integrationIds = selectedTicketsForDischarge
      .map((ticket) => ticket.integrationId)
      .filter(Boolean);

    if (!integrationIds.length) {
      toast.warning("Nenhum boleto disponível para baixa", {
        description: "Só é possível solicitar baixa de boletos registrados.",
      });
      return;
    }

    setPrintStep("processing");
    setBatchPrintResult(null);
    setIsProcessingPrint(true);

    try {
      const response = await fetch("/api/billing/tickets/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignorDocument: activeAssignor.document,
          integrationIds,
          printType: printForm.printType,
          hideDigitableLine: printForm.hideDigitableLine,
          password: printForm.protectWithPassword
            ? printForm.password
            : undefined,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        printUrl?: string;
        protocol?: string;
      };

      if (!response.ok || !data.printUrl || !data.protocol) {
        throw new Error(
          data.message ?? "Não foi possível gerar o PDF dos boletos."
        );
      }

      setBatchPrintResult({
        printUrl: data.printUrl,
        protocol: data.protocol,
      });
      setPrintStep("ready");
    } catch (error) {
      setPrintStep("form");
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF dos boletos."
      );
    } finally {
      setIsProcessingPrint(false);
    }
  }

  async function handleBulkDischarge() {
    if (!activeAssignor) {
      toast.warning("Selecione um cedente.");
      return;
    }

    const integrationIds = selectedTicketsForDischarge
      .map((ticket) => ticket.integrationId)
      .filter(Boolean);

    if (!integrationIds.length) {
      toast.warning("Nenhum boleto disponível para baixa", {
        description: "Os boletos selecionados já estão baixados.",
      });
      return;
    }

    setBulkDischargeStep("processing");
    setBatchDischargeResult(null);
    setIsProcessingBulkDischarge(true);

    try {
      const response = await fetch("/api/billing/tickets/discharge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignorDocument: activeAssignor.document,
          integrationIds,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível solicitar a baixa.");
      }

      setBatchDischargeResult({
        message: data.message ?? "Pedido de baixa solicitado.",
        count: integrationIds.length,
      });
      setBulkDischargeStep("ready");
      setSelectedTicketIds(new Set());
      handleReloadTickets();
    } catch (error) {
      setBulkDischargeStep("confirm");
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível solicitar a baixa."
      );
    } finally {
      setIsProcessingBulkDischarge(false);
    }
  }

  async function discardTickets(ticketsToDiscard: BillingTicket[]) {
    if (!activeAssignor) {
      throw new Error("Selecione um cedente.");
    }

    const integrationIds = ticketsToDiscard
      .filter(isTicketDiscardable)
      .map((ticket) => ticket.integrationId)
      .filter(Boolean);

    if (!integrationIds.length) {
      throw new Error(
        "Só é possível descartar boletos emitidos, com falha ou rejeitados."
      );
    }

    const response = await fetch("/api/billing/tickets/discard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignorDocument: activeAssignor.document,
        integrationIds,
      }),
    });
    const data = (await response.json()) as {
      message?: string;
      data?: {
        _sucesso?: Array<{ idintegracao?: string }>;
        _falha?: Array<{
          idintegracao?: string;
          _erro?: string;
          _status_http?: number;
        }>;
      } | null;
    };

    if (!response.ok) {
      throw new Error(data.message ?? "Não foi possível descartar os boletos.");
    }

    return {
      message: data.message ?? "Descarte solicitado.",
      successCount: data.data?._sucesso?.length ?? 0,
      failures: data.data?._falha ?? [],
    };
  }

  async function handleBulkDiscard() {
    setBulkDiscardStep("processing");
    setBatchDiscardResult(null);
    setIsProcessingBulkDiscard(true);

    try {
      const result = await discardTickets(selectedTicketsForDiscard);

      setBatchDiscardResult(result);
      setBulkDiscardStep("ready");
      setSelectedTicketIds(new Set());
      handleReloadTickets();
    } catch (error) {
      setBulkDiscardStep("confirm");
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível descartar os boletos."
      );
    } finally {
      setIsProcessingBulkDiscard(false);
    }
  }

  async function handleBulkWhatsApp() {
    if (!activeAssignor) {
      toast.warning("Selecione um cedente.");
      return;
    }

    if (
      whatsAppPrintForm.protectWithPassword &&
      !whatsAppPrintForm.password.trim()
    ) {
      toast.warning("Informe a senha do PDF.");
      return;
    }

    const availableTickets = selectedTickets.filter(ticketHasWhatsAppPayload);

    if (!availableTickets.length) {
      toast.warning("Nenhum boleto disponível", {
        description:
          "Os boletos selecionados não possuem link de impressão ou linha digitável.",
      });
      return;
    }

    const ticketsByPhone = new Map<string, BillingTicket[]>();
    const ticketsWithoutPhone: BillingTicket[] = [];

    for (const ticket of availableTickets) {
      const phone = getWhatsAppPhone(ticket.payerPhone);

      if (!phone) {
        ticketsWithoutPhone.push(ticket);
        continue;
      }

      ticketsByPhone.set(phone, [...(ticketsByPhone.get(phone) ?? []), ticket]);
    }

    setWhatsAppStep("processing");
    setPreparedWhatsAppMessages([]);
    setIsProcessingWhatsApp(true);

    try {
      const preparedMessages: PreparedWhatsAppMessage[] = [];
      const groups = [
        ...Array.from(ticketsByPhone.entries()).map(([phone, groupedTickets]) => ({
          phone,
          tickets: groupedTickets,
        })),
        ...(ticketsWithoutPhone.length
          ? [{ phone: "", tickets: ticketsWithoutPhone }]
          : []),
      ];

      for (const group of groups) {
        const response = await fetch("/api/billing/tickets/print", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignorDocument: activeAssignor.document,
            integrationIds: group.tickets.map((ticket) => ticket.integrationId),
            printType: whatsAppPrintForm.printType,
            hideDigitableLine: whatsAppPrintForm.hideDigitableLine,
            password: whatsAppPrintForm.protectWithPassword
              ? whatsAppPrintForm.password
              : undefined,
          }),
        });
        const data = (await response.json()) as {
          message?: string;
          printUrl?: string;
        };

        if (!response.ok || !data.printUrl) {
          throw new Error(
            data.message ?? "Não foi possível gerar o PDF dos boletos."
          );
        }

        const message = getBulkTicketsWhatsAppMessage(group.tickets, {
          assignorName: activeAssignor.corporateName,
          printUrl: data.printUrl,
        });
        const url = buildWhatsAppUrl(group.phone, message);

        preparedMessages.push({
          phone: group.phone,
          url,
        });
      }

      setPreparedWhatsAppMessages(preparedMessages);
      setWhatsAppStep("ready");
    } catch (error) {
      setWhatsAppStep("form");
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o envio por WhatsApp."
      );
    } finally {
      setIsProcessingWhatsApp(false);
    }
  }

  function handleViewBoleto(ticket: BillingTicket) {
    if (!ticket.boletoUrl) {
      toast.warning("Boleto indisponível", {
        description: "A TecnoSpeed não retornou o link de impressão deste boleto.",
      });
      return;
    }

    window.open(ticket.boletoUrl, "_blank", "noopener,noreferrer");
  }

  function handleViewQrCode(ticket: BillingTicket) {
    if (!ticket.pixUrl) {
      toast.warning("QR Code indisponível", {
        description: "A TecnoSpeed não retornou o link Pix deste boleto.",
      });
      return;
    }

    window.open(ticket.pixUrl, "_blank", "noopener,noreferrer");
  }

  function handleSendWhatsApp(ticket: BillingTicket) {
    if (!ticket.boletoUrl && !ticket.digitableLine) {
      toast.warning("Boleto indisponível", {
        description:
          "A TecnoSpeed não retornou link de impressão ou linha digitável para este boleto.",
      });
      return;
    }

    const phone = getWhatsAppPhone(ticket.payerPhone);
    const messageParts = [
      `Olá${ticket.payerName ? `, ${ticket.payerName}` : ""}!`,
      "Segue o boleto para pagamento.",
      `Documento: ${ticket.documentNumber || "-"}`,
      `Vencimento: ${formatDate(ticket.dueDate)}`,
      `Valor: R$ ${ticket.amount || "0,00"}`,
      ticket.boletoUrl ? `Boleto: ${ticket.boletoUrl}` : null,
      ticket.digitableLine ? `Linha digitável: ${ticket.digitableLine}` : null,
    ].filter(Boolean);
    const url = buildWhatsAppUrl(phone, messageParts.join("\n"));

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleRequestDischarge() {
    if (!ticketToDischarge || !activeAssignor) {
      return;
    }

    if (!canRequestTicketDischarge(ticketToDischarge)) {
      toast.warning("Boleto não pode receber baixa", {
        description: "Só é possível solicitar baixa de boletos registrados.",
      });
      setTicketToDischarge(null);
      return;
    }

    setIsRequestingDischarge(true);

    try {
      const response = await fetch("/api/billing/tickets/discharge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignorDocument: activeAssignor.document,
          integrationId: ticketToDischarge.integrationId,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível solicitar a baixa.");
      }

      toast.success("Pedido de baixa solicitado", {
        description:
          data.message ?? "A solicitação foi enviada para a TecnoSpeed.",
      });
      setTicketToDischarge(null);
      handleReloadTickets();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível solicitar a baixa."
      );
    } finally {
      setIsRequestingDischarge(false);
    }
  }

  async function handleDiscardTicket() {
    if (!ticketToDiscard) {
      return;
    }

    if (!isTicketDiscardable(ticketToDiscard)) {
      toast.warning("Boleto não pode ser descartado", {
        description:
          "Só é possível descartar boletos emitidos, com falha ou rejeitados.",
      });
      setTicketToDiscard(null);
      return;
    }

    setIsProcessingBulkDiscard(true);

    try {
      const result = await discardTickets([ticketToDiscard]);

      if (result.failures.length) {
        throw new Error(
          result.failures[0]?._erro ?? "Não foi possível descartar o boleto."
        );
      }

      toast.success("Boleto descartado", {
        description: result.message,
      });
      setTicketToDiscard(null);
      handleReloadTickets();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível descartar o boleto."
      );
    } finally {
      setIsProcessingBulkDiscard(false);
    }
  }

  return (
    <>
    <ManagementPage className="space-y-3">
      <ManagementPageHeader
        badge="Cobrança"
        compact
        hideTitle
        icon={CircleDollarSign}
        title="Gestão de cobranças"
        actions={
          <>
          <div className="flex h-10 items-center gap-2 text-sm font-medium">
            <CircleDollarSign className="size-4 text-primary" />
            Cedente ativo
          </div>
          <NativeSelect
            className="h-10 min-w-64 lg:min-w-96"
            value={activeAssignorId}
            onChange={(event) => handleAssignorChange(event.target.value)}
          >
            <NativeSelectOption value="">
              Selecione um cedente
            </NativeSelectOption>
            {assignors.map((assignor) => (
              <NativeSelectOption key={assignor.id} value={String(assignor.id)}>
                {assignor.corporateName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="flex h-10 items-center">
            {activeAssignor ? (
              <StatusBadge status={activeAssignor.status} />
            ) : (
              <Badge variant="secondary">
                {isInitialLoading ? "Carregando" : "Não selecionado"}
              </Badge>
            )}
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={!activeAssignor}
            onClick={handleNewBilling}
            type="button"
          >
            <Plus className="size-4" />
            Nova cobrança
          </Button>
          </>
        }
      />

      <Tabs
        className="space-y-3"
        onValueChange={handleTabChange}
        value={activeTab}
      >
        <TabsList className="h-9 w-full justify-start overflow-x-auto overflow-y-hidden p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="resumo">
            <Activity className="size-4" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="boletos">
            <CircleDollarSign className="size-4" />
            Boletos
          </TabsTrigger>
          <TabsTrigger value="contas">
            <Landmark className="size-4" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="convenios">
            <Webhook className="size-4" />
            Convênios
          </TabsTrigger>
        </TabsList>

        <TabsContent keepMounted value="resumo" className="space-y-3">
          {activeAssignor ? (
            <ManagementFilters
              description="Escolha o período analisado no resumo."
              title="Período do resumo"
            >
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <ButtonGroup className="flex flex-wrap">
                  {billingSummaryRangeOptions.map((option) => (
                    <Button
                      className="h-8"
                      key={option.value}
                      onClick={() => handleSummaryRangeChange(option.value)}
                      size="sm"
                      type="button"
                      variant={
                        summarySelectedRange === option.value
                          ? "default"
                          : "outline"
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </ButtonGroup>
                {summarySelectedRange === "custom" ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        De
                      </label>
                      <Input
                        className="h-8"
                        onChange={(event) =>
                          setSummaryDraftCustomFrom(event.target.value)
                        }
                        type="date"
                        value={summaryDraftCustomFrom}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Até
                      </label>
                      <Input
                        className="h-8"
                        onChange={(event) =>
                          setSummaryDraftCustomTo(event.target.value)
                        }
                        type="date"
                        value={summaryDraftCustomTo}
                      />
                    </div>
                    <Button
                      className="h-8 min-w-24 gap-2"
                      onClick={handleApplyCustomSummaryRange}
                      size="sm"
                      type="button"
                    >
                      <Search className="size-4" />
                      Filtrar
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-8 items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="size-4" />
                    {new Intl.DateTimeFormat("pt-BR").format(summary.from)} até{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(summary.to)}
                  </div>
                )}
              </div>
            </ManagementFilters>
          ) : null}

          {false ? (
            <>
              <ManagementMetricCardsSkeleton
                className="md:grid-cols-2 xl:grid-cols-4"
                count={4}
              />
              <ManagementMetricCardsSkeleton
                className="md:grid-cols-2 xl:grid-cols-4"
                count={4}
              />
              <ManagementDataCard
                count="Carregando"
                title="Gráficos"
              >
                <ManagementTableSkeleton columns={4} rows={6} />
              </ManagementDataCard>
            </>
          ) : !activeAssignor ? (
            <ManagementState>
              Selecione um cedente para visualizar o resumo das cobranças.
            </ManagementState>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={BarChart3}
                  title="Registrados"
                  tone="info"
                  value={
                    isSummaryRefreshing ? (
                      <SummaryLoadingValue width="w-10" />
                    ) : (
                      summary.registered
                    )
                  }
                />
                <MetricCard
                  icon={ReceiptText}
                  title="Liquidados"
                  tone="success"
                  value={
                    isSummaryRefreshing ? (
                      <SummaryLoadingValue width="w-10" />
                    ) : (
                      summary.settled
                    )
                  }
                />
                <MetricCard
                  icon={Clock3}
                  title="Vencidos"
                  tone={summary.overdue > 0 ? "warning" : "neutral"}
                  value={
                    isSummaryRefreshing ? (
                      <SummaryLoadingValue width="w-10" />
                    ) : (
                      summary.overdue
                    )
                  }
                />
                <MetricCard
                  icon={Undo2}
                  title="Baixados"
                  tone="neutral"
                  value={
                    isSummaryRefreshing ? (
                      <SummaryLoadingValue width="w-10" />
                    ) : (
                      summary.writtenOff
                    )
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={CircleDollarSign}
                  title="Valor registrado"
                  tone="info"
                  value={
                    isSummaryRefreshing ? (
                      <SummaryLoadingValue width="w-24" />
                    ) : (
                      formatBillingCurrency(summary.registeredAmount)
                    )
                  }
                />
                <MetricCard
                  icon={TrendingUp}
                  title="Valor liquidado"
                  tone="success"
                  value={
                    isSummaryRefreshing ? (
                      <SummaryLoadingValue width="w-24" />
                    ) : (
                      formatBillingCurrency(summary.settledAmount)
                    )
                  }
                />
                <MetricCard
                  icon={Clock3}
                  title="Valor vencido"
                  tone={summary.overdueAmount > 0 ? "warning" : "neutral"}
                  value={
                    isSummaryRefreshing ? (
                      <SummaryLoadingValue width="w-24" />
                    ) : (
                      formatBillingCurrency(summary.overdueAmount)
                    )
                  }
                />
                <MetricCard
                  icon={Undo2}
                  title="Valor baixado"
                  tone="neutral"
                  value={
                    isSummaryRefreshing ? (
                      <SummaryLoadingValue width="w-24" />
                    ) : (
                      formatBillingCurrency(summary.writtenOffAmount)
                    )
                  }
                />
              </div>

              <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
                <div className="h-full min-w-0">
                  <BillingStatusBarChart
                    data={summary.chartBars}
                    isLoading={isSummaryRefreshing}
                  />
                </div>
                <div className="h-full min-w-0">
                  <BillingTrendChart
                    isLoading={isSummaryRefreshing}
                    points={summary.chartPoints}
                  />
                </div>
              </div>

              <ManagementDataCard
                count={`${summary.attentionTickets.length} item(ns)`}
                title="Boletos que precisam de atenção"
              >
                {summary.attentionTickets.length === 0 ? (
                  <ManagementState>
                    Nenhum boleto com falha, rejeição, pendência ou vencimento no período carregado.
                  </ManagementState>
                ) : (
                  <ManagementTableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Situação</TableHead>
                          <TableHead>Pagador</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.attentionTickets.map((ticket, index) => (
                          <TableRow
                            key={`summary-${getTicketSelectionKey(ticket)}-${index}`}
                          >
                            <TableCell>
                              <TicketStatusBadge
                                failureMessage={ticket.failureMessage}
                                status={getTicketDisplayStatus(ticket)}
                              />
                            </TableCell>
                            <TableCell className="max-w-64 truncate">
                              {ticket.payerName || "-"}
                            </TableCell>
                            <TableCell>
                              {ticket.payerDocument
                                ? formatDocument(ticket.payerDocument)
                                : "-"}
                            </TableCell>
                            <TableCell>{formatDate(ticket.dueDate)}</TableCell>
                            <TableCell>R$ {ticket.amount || "0,00"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => handleTabChange("boletos")}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Abrir
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ManagementTableFrame>
                )}
              </ManagementDataCard>
            </>
          )}
        </TabsContent>

        <TabsContent keepMounted value="boletos" className="space-y-3">
      <ManagementFilters description="Selecione o cedente e refine os boletos exibidos.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[140px_minmax(160px,1.2fr)_minmax(150px,1fr)_145px_145px_145px_145px_auto] xl:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Situação
              </label>
              <NativeSelect
                aria-label="Situação"
                value={draftFilters.status}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: event.target.value || allStatusFilterValue,
                  }))
                }
              >
                {ticketStatusOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Pagador
              </label>
              <Input
                aria-label="Pagador"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    payerName: event.target.value,
                  }))
                }
                placeholder="Nome"
                value={draftFilters.payerName}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                CPF/CNPJ
              </label>
              <Input
                aria-label="CPF/CNPJ"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    payerDocument: event.target.value,
                  }))
                }
                placeholder="Documento"
                value={draftFilters.payerDocument}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Emiss. de
              </label>
              <Input
                aria-label="Emissão de"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    issueDateFrom: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.issueDateFrom}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Emiss. até
              </label>
              <Input
                aria-label="Emissão até"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    issueDateTo: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.issueDateTo}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Venc. de
              </label>
              <Input
                aria-label="Vencimento de"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    dueDateFrom: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.dueDateFrom}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Venc. até
              </label>
              <Input
                aria-label="Vencimento até"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    dueDateTo: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.dueDateTo}
              />
            </div>
            <div className="flex gap-2 md:col-span-2 md:ml-auto xl:col-span-1 xl:ml-0 xl:justify-self-end">
              <Button
                className="h-8 min-w-24"
                onClick={handleApplyFilters}
                type="button"
              >
                <Search className="size-4" />
                Filtrar
              </Button>
              <Button
                className="h-8 min-w-24"
                onClick={handleClearFilters}
                type="button"
                variant="outline"
              >
                <RotateCcw className="size-4" />
                Limpar
              </Button>
            </div>
        </div>
      </ManagementFilters>

        <ManagementDataCard
          count={
            hasSelectedTickets
              ? `${selectedTicketsCount} selecionado(s)`
              : `${ticketsTotal} boleto(s)`
          }
          title="Boletos"
          actions={
              <>
                <BulkActionButton
                  disabled={!hasSelectedTickets}
                  icon={MessageCircle}
                  label="Enviar via WhatsApp"
                  onClick={handleOpenWhatsAppDialog}
                />
                <BulkActionButton
                  disabled={!hasSelectedTickets}
                  icon={Mail}
                  label="Enviar por e-mail"
                  onClick={handleOpenEmailDialog}
                />
                <BulkActionButton
                  disabled={!hasSelectedTickets}
                  icon={Printer}
                  label="Imprimir em lote"
                  onClick={handleOpenPrintDialog}
                />
                <BulkActionButton
                  disabled={!selectedTicketsForDischarge.length}
                  icon={Undo2}
                  label="Baixar em lote"
                  onClick={handleOpenBulkDischargeDialog}
                />
                <BulkActionButton
                  disabled={!selectedTicketsForDiscard.length}
                  icon={Trash2}
                  label="Descartar em lote"
                  onClick={handleOpenBulkDiscardDialog}
                  variant="destructive"
                />
              <Button
                disabled={!activeAssignor || isLoadingTickets}
                onClick={handleReloadTickets}
                size="sm"
                type="button"
                variant="outline"
              >
                {isLoadingTickets ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Atualizar
              </Button>
              </>
          }
        >
              {isLoadingTickets ? (
                <ManagementTableSkeleton columns={13} rows={8} />
              ) : tickets.length > 0 ? (
                <ManagementTableFrame>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            aria-label="Selecionar todos os boletos visíveis"
                            checked={allVisibleTicketsSelected}
                            onCheckedChange={(checked) =>
                              handleToggleVisibleTicketsSelection(
                                Boolean(checked)
                              )
                            }
                          />
                        </TableHead>
                        <TableHead>Id integração</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Banco</TableHead>
                        <TableHead>Nosso N.</TableHead>
                        <TableHead>N. Doc</TableHead>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Pagador</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead className="w-12 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket, index) => {
                        const ticketSelectionKey = getTicketSelectionKey(ticket);
                        const canViewBoleto = Boolean(ticket.boletoUrl);
                        const canViewQrCode =
                          Boolean(ticket.pixUrl) && !isTicketSettled(ticket);
                        const canSendTicketWhatsApp =
                          ticketHasWhatsAppPayload(ticket) &&
                          !isTicketSettled(ticket);
                        const canDischargeTicket =
                          canRequestTicketDischarge(ticket);
                        const canDiscardTicket = isTicketDiscardable(ticket);

                        return (
                        <TableRow
                          key={`ticket-${ticketSelectionKey}-${index}`}
                          className={
                            selectedTicketIds.has(ticketSelectionKey)
                              ? "bg-muted/40"
                              : undefined
                          }
                        >
                          <TableCell>
                            <Checkbox
                              aria-label={`Selecionar boleto ${
                                ticket.integrationId || ticket.documentNumber
                              }`}
                              checked={selectedTicketIds.has(ticketSelectionKey)}
                              onCheckedChange={(checked) =>
                                handleToggleTicketSelection(
                                  ticket,
                                  Boolean(checked)
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {ticket.integrationId || "-"}
                          </TableCell>
                          <TableCell>
                            <TicketStatusBadge
                              failureMessage={ticket.failureMessage}
                              status={getTicketDisplayStatus(ticket)}
                            />
                          </TableCell>
                          <TableCell><BankIcon code={ticket.bankCode} name={ticket.bankName} /></TableCell>
                          <TableCell>{ticket.ourNumber || "-"}</TableCell>
                          <TableCell>{ticket.documentNumber || "-"}</TableCell>
                          <TableCell>{ticket.installment}</TableCell>
                          <TableCell className="max-w-44 truncate">
                            {ticket.payerName || "-"}
                          </TableCell>
                          <TableCell>
                            {ticket.payerDocument
                              ? formatDocument(ticket.payerDocument)
                              : "-"}
                          </TableCell>
                          <TableCell>{formatDate(ticket.issueDate)}</TableCell>
                          <TableCell>{formatDate(ticket.dueDate)}</TableCell>
                          <TableCell>R$ {ticket.amount || "0,00"}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    aria-label="Abrir ações do boleto"
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                  />
                                }
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-56">
                                <DropdownMenuItem
                                  disabled={!canViewBoleto}
                                  onClick={() => handleViewBoleto(ticket)}
                                >
                                  <Eye className="size-4" />
                                  Visualizar boleto
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!canViewQrCode}
                                  onClick={() => handleViewQrCode(ticket)}
                                >
                                  <QrCode className="size-4" />
                                  Visualizar QR Code
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!canSendTicketWhatsApp}
                                  onClick={() => handleSendWhatsApp(ticket)}
                                >
                                  <MessageCircle className="size-4" />
                                  Enviar via WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setTicketHistory(ticket)}
                                >
                                  <History className="size-4" />
                                  Histórico
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={!canDischargeTicket}
                                  onClick={() => {
                                    if (!canDischargeTicket) {
                                      return;
                                    }

                                    setTicketToDischarge(ticket);
                                  }}
                                >
                                  <Undo2 className="size-4" />
                                  Pedido de baixa
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!canDiscardTicket}
                                  onClick={() => {
                                    if (!canDiscardTicket) {
                                      return;
                                    }

                                    setTicketToDiscard(ticket);
                                  }}
                                  variant="destructive"
                                >
                                  <Trash2 className="size-4" />
                                  Descartar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ManagementTableFrame>
              ) : (
                <ManagementState>
                  Nenhum boleto encontrado para o cedente selecionado.
                </ManagementState>
              )}
              <ManagementPagination
                isLoading={isLoadingTickets}
                itemLabel="boleto(s)"
                onPageChange={setTicketsPage}
                page={ticketsPage}
                pageSize={8}
                total={ticketsTotal}
                visible={tickets.length}
              />
          </ManagementDataCard>
        </TabsContent>

        <TabsContent keepMounted value="contas" className="space-y-3">
          <ManagementDataCard
            count={
              activeAssignor
                ? `${accounts.length} conta(s)`
                : "Selecione um cedente"
            }
            title="Contas do cedente"
            actions={
              <Button
                disabled={!activeAssignor || isLoadingAccounts}
                onClick={handleReloadAccounts}
                size="sm"
                type="button"
                variant="outline"
              >
                {isLoadingAccounts ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Atualizar
              </Button>
            }
          >
            {!activeAssignor ? (
              <ManagementState>
                Selecione um cedente para visualizar as contas bancárias.
              </ManagementState>
            ) : isLoadingAccounts ? (
              <ManagementTableSkeleton columns={8} rows={5} />
            ) : accounts.length === 0 ? (
              <ManagementState>
                Nenhuma conta encontrada para o cedente selecionado.
              </ManagementState>
            ) : (
              <ManagementTableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banco</TableHead>
                      <TableHead>Agência</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Beneficiário</TableHead>
                      <TableHead>Convênios</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Última atualização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => {
                      const bankCode = account.bankCode || "-";
                      const agency = [account.agency, account.agencyDigit]
                        .filter(Boolean)
                        .join("-");
                      const accountNumber = [
                        account.accountNumber,
                        account.accountDigit,
                      ]
                        .filter(Boolean)
                        .join("-");

                      return (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div className="font-medium">
                              {bankCode !== "-"
                                ? `${bankCode} - ${getBrazilianBankName(bankCode)}`
                                : "-"}
                            </div>
                          </TableCell>
                          <TableCell>{agency || "-"}</TableCell>
                          <TableCell>{accountNumber || "-"}</TableCell>
                          <TableCell>{account.accountType || "-"}</TableCell>
                          <TableCell>
                            {account.beneficiaryCode ||
                              account.companyCode ||
                              "-"}
                          </TableCell>
                          <TableCell>
                            <Badge className="rounded-full" variant="secondary">
                              {account.agreements.length}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <SemanticStatusBadge
                              tone={account.active ? "success" : "neutral"}
                            >
                              {account.active ? "Ativa" : "Inativa"}
                            </SemanticStatusBadge>
                          </TableCell>
                          <TableCell>
                            {formatDateTime(account.updatedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ManagementTableFrame>
            )}
          </ManagementDataCard>
        </TabsContent>

        <TabsContent keepMounted value="convenios" className="space-y-3">
          <ManagementDataCard
            count={
              activeAssignor
                ? `${agreements.length} convênio(s)`
                : "Selecione um cedente"
            }
            title="Convênios do cedente"
            actions={
              <Button
                disabled={!activeAssignor || isLoadingAccounts}
                onClick={handleReloadAccounts}
                size="sm"
                type="button"
                variant="outline"
              >
                {isLoadingAccounts ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Atualizar
              </Button>
            }
          >
            {!activeAssignor ? (
              <ManagementState>
                Selecione um cedente para visualizar os convênios.
              </ManagementState>
            ) : isLoadingAccounts ? (
              <ManagementTableSkeleton columns={8} rows={5} />
            ) : agreements.length === 0 ? (
              <ManagementState>
                Nenhum convênio encontrado para o cedente selecionado.
              </ManagementState>
            ) : (
              <ManagementTableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Carteira</TableHead>
                      <TableHead>Espécie</TableHead>
                      <TableHead>CNAB</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreements.map(({ account, ...agreement }) => {
                      const accountNumber = [
                        account.accountNumber,
                        account.accountDigit,
                      ]
                        .filter(Boolean)
                        .join("-");

                      return (
                        <TableRow key={agreement.id}>
                          <TableCell className="font-medium">
                            {agreement.number || "-"}
                          </TableCell>
                          <TableCell>{agreement.description || "-"}</TableCell>
                          <TableCell>{accountNumber || account.id}</TableCell>
                          <TableCell>{agreement.wallet || "-"}</TableCell>
                          <TableCell>{agreement.species || "-"}</TableCell>
                          <TableCell>{agreement.cnabPattern || "-"}</TableCell>
                          <TableCell>
                            {agreement.instantRegistration
                              ? "Instantâneo"
                              : "Manual"}
                          </TableCell>
                          <TableCell>
                            <SemanticStatusBadge
                              tone={agreement.active ? "success" : "neutral"}
                            >
                              {agreement.active ? "Ativo" : "Inativo"}
                            </SemanticStatusBadge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ManagementTableFrame>
            )}
          </ManagementDataCard>
        </TabsContent>
      </Tabs>
      </ManagementPage>
      <AlertDialog
        open={isWhatsAppDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseWhatsAppDialog();
            return;
          }

          setIsWhatsAppDialogOpen(true);
        }}
      >
        <AlertDialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <AlertDialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="size-5" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-base font-semibold">
                  Enviar boletos por WhatsApp
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Vamos gerar um PDF agrupado e abrir o WhatsApp com a mensagem
                  pronta.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {whatsAppStep === "processing" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium">Gerando PDF em lote</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aguarde enquanto a TecnoSpeed prepara os boletos selecionados.
                </p>
              </div>
            </div>
          ) : whatsAppStep === "ready" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium">Tudo pronto para enviar</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  O PDF foi gerado e a mensagem está pronta para abrir no
                  WhatsApp.
                </p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {preparedWhatsAppMessages.length} conversa(s) preparada(s)
              </div>
            </div>
          ) : (
          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-3 rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">PDF dos boletos</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTicketsCount} boleto(s) selecionado(s)
                  </p>
                </div>
                <Badge variant="secondary">{activeAssignor?.corporateName}</Badge>
              </div>
              <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo de impressão
              </label>
              <NativeSelect
                disabled={isProcessingWhatsApp}
                value={whatsAppPrintForm.printType}
                onChange={(event) =>
                  setWhatsAppPrintForm((current) => ({
                    ...current,
                    printType: event.target.value,
                  }))
                }
              >
                {printTypeOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
              <span>
                <span className="block font-medium">Ocultar linha digitável</span>
                <span className="text-xs text-muted-foreground">
                  Remove linha digitável e código de barras da impressão.
                </span>
              </span>
              <Checkbox
                checked={whatsAppPrintForm.hideDigitableLine}
                disabled={isProcessingWhatsApp}
                onCheckedChange={(checked) =>
                  setWhatsAppPrintForm((current) => ({
                    ...current,
                    hideDigitableLine: Boolean(checked),
                  }))
                }
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
              <span>
                <span className="block font-medium">Proteger com senha</span>
                <span className="text-xs text-muted-foreground">
                  Adiciona senha ao arquivo PDF gerado.
                </span>
              </span>
              <Checkbox
                checked={whatsAppPrintForm.protectWithPassword}
                disabled={isProcessingWhatsApp}
                onCheckedChange={(checked) =>
                  setWhatsAppPrintForm((current) => ({
                    ...current,
                    protectWithPassword: Boolean(checked),
                    password: checked ? current.password : "",
                  }))
                }
              />
            </label>

            {whatsAppPrintForm.protectWithPassword ? (
              <Input
                disabled={isProcessingWhatsApp}
                onChange={(event) =>
                  setWhatsAppPrintForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Senha do PDF"
                type="password"
                value={whatsAppPrintForm.password}
              />
            ) : null}
          </div>
          )}

          <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-6 py-4 sm:space-x-0">
            <AlertDialogClose
              className="h-9 rounded-lg"
              disabled={isProcessingWhatsApp}
              onClick={(event) => {
                event.preventDefault();
                handleCloseWhatsAppDialog();
              }}
            >
              Cancelar
            </AlertDialogClose>
            {whatsAppStep === "ready" ? (
              <Button
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSendPreparedWhatsApp}
                type="button"
              >
                <MessageCircle className="size-4" />
                Enviar
              </Button>
            ) : (
              <Button
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isProcessingWhatsApp}
                onClick={() => {
                  void handleBulkWhatsApp();
                }}
                type="button"
              >
                {isProcessingWhatsApp ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Processar
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={isPrintDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClosePrintDialog();
            return;
          }

          setIsPrintDialogOpen(true);
        }}
      >
        <AlertDialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <AlertDialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Printer className="size-5" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-base font-semibold">
                  Imprimir boletos em lote
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Gere um PDF único com os boletos selecionados para baixar ou
                  imprimir.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {printStep === "processing" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium">Gerando PDF em lote</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aguarde enquanto a TecnoSpeed prepara o arquivo para
                  impressão.
                </p>
              </div>
            </div>
          ) : printStep === "ready" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Download className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium">PDF pronto para baixar</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  O arquivo foi gerado com {selectedTicketsCount} boleto(s)
                  selecionado(s).
                </p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Protocolo: {batchPrintResult?.protocol}
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-3 rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">PDF dos boletos</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTicketsCount} boleto(s) selecionado(s)
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {activeAssignor?.corporateName}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tipo de impressão
                  </label>
                  <NativeSelect
                    disabled={isProcessingPrint}
                    value={printForm.printType}
                    onChange={(event) =>
                      setPrintForm((current) => ({
                        ...current,
                        printType: event.target.value,
                      }))
                    }
                  >
                    {printTypeOptions.map((option) => (
                      <NativeSelectOption
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
                <span>
                  <span className="block font-medium">
                    Ocultar linha digitável
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Remove linha digitável e código de barras da impressão.
                  </span>
                </span>
                <Checkbox
                  checked={printForm.hideDigitableLine}
                  disabled={isProcessingPrint}
                  onCheckedChange={(checked) =>
                    setPrintForm((current) => ({
                      ...current,
                      hideDigitableLine: Boolean(checked),
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
                <span>
                  <span className="block font-medium">Proteger com senha</span>
                  <span className="text-xs text-muted-foreground">
                    Adiciona senha ao arquivo PDF gerado.
                  </span>
                </span>
                <Checkbox
                  checked={printForm.protectWithPassword}
                  disabled={isProcessingPrint}
                  onCheckedChange={(checked) =>
                    setPrintForm((current) => ({
                      ...current,
                      protectWithPassword: Boolean(checked),
                      password: checked ? current.password : "",
                    }))
                  }
                />
              </label>

              {printForm.protectWithPassword ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Senha do PDF
                  </label>
                  <Input
                    disabled={isProcessingPrint}
                    onChange={(event) =>
                      setPrintForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Digite a senha"
                    type="password"
                    value={printForm.password}
                  />
                </div>
              ) : null}
            </div>
          )}

          <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-6 py-4 sm:space-x-0">
            <AlertDialogClose
              className="h-9 rounded-lg"
              disabled={isProcessingPrint}
              onClick={(event) => {
                event.preventDefault();
                handleClosePrintDialog();
              }}
            >
              {printStep === "ready" ? "Fechar" : "Cancelar"}
            </AlertDialogClose>
            {printStep === "ready" ? (
              <Button
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleDownloadBatchPrint}
                type="button"
              >
                <Download className="size-4" />
                Baixar
              </Button>
            ) : (
              <Button
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isProcessingPrint}
                onClick={() => {
                  void handleBatchPrint();
                }}
                type="button"
              >
                {isProcessingPrint ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Processar
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={isBulkDischargeDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseBulkDischargeDialog();
            return;
          }

          setIsBulkDischargeDialogOpen(true);
        }}
      >
        <AlertDialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <AlertDialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Undo2 className="size-5" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-base font-semibold">
                  Baixar boletos em lote
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Envie um pedido de baixa para os boletos selecionados deste
                  cedente.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {bulkDischargeStep === "processing" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium">Solicitando baixa em lote</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aguarde enquanto a TecnoSpeed processa os boletos
                  selecionados.
                </p>
              </div>
            </div>
          ) : bulkDischargeStep === "ready" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Undo2 className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium">Pedido de baixa enviado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {batchDischargeResult?.message}
                </p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {batchDischargeResult?.count ?? selectedTicketsCount} boleto(s)
                processado(s)
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Boletos selecionados</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTicketsForDischarge.length} boleto(s) serão enviados para
                      baixa.
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {activeAssignor?.corporateName}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Confira os boletos selecionados antes de continuar. A baixa será
                solicitada para a TecnoSpeed em lote somente para boletos
                registrados.
                {selectedUnavailableDischargeTicketsCount > 0 ? (
                  <span className="mt-1 block">
                    {selectedUnavailableDischargeTicketsCount} boleto(s) fora dessa regra
                    serão ignorado(s).
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-6 py-4 sm:space-x-0">
            <AlertDialogClose
              className="h-9 rounded-lg"
              disabled={isProcessingBulkDischarge}
              onClick={(event) => {
                event.preventDefault();
                handleCloseBulkDischargeDialog();
              }}
            >
              {bulkDischargeStep === "ready" ? "Fechar" : "Cancelar"}
            </AlertDialogClose>
            {bulkDischargeStep === "ready" ? (
              <Button
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCloseBulkDischargeDialog}
                type="button"
              >
                Concluir
              </Button>
            ) : (
              <Button
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isProcessingBulkDischarge}
                onClick={() => {
                  void handleBulkDischarge();
                }}
                type="button"
              >
                {isProcessingBulkDischarge ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Undo2 className="size-4" />
                )}
                Solicitar baixa
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={isBulkDiscardDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseBulkDiscardDialog();
            return;
          }

          setIsBulkDiscardDialogOpen(true);
        }}
      >
        <AlertDialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <AlertDialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-base font-semibold">
                  Descartar boletos em lote
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Descarte somente boletos que ainda não foram encaminhados ao
                  banco.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {bulkDiscardStep === "processing" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium">Descartando boletos</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aguarde enquanto a TecnoSpeed processa o descarte.
                </p>
              </div>
            </div>
          ) : bulkDiscardStep === "ready" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium">Descarte processado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {batchDiscardResult?.message}
                </p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {batchDiscardResult?.successCount ?? 0} descartado(s)
                {batchDiscardResult?.failures.length
                  ? `, ${batchDiscardResult.failures.length} falha(s)`
                  : ""}
              </div>
              {batchDiscardResult?.failures.length ? (
                <div className="max-h-28 w-full overflow-auto rounded-lg border bg-background p-3 text-left text-xs text-muted-foreground">
                  {batchDiscardResult.failures.map((failure) => (
                    <p key={`${failure.idintegracao}-${failure._erro}`}>
                      {failure.idintegracao ?? "Boleto"}:{" "}
                      {failure._erro ?? "Falha ao descartar"}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Boletos selecionados</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTicketsForDiscard.length} boleto(s) serão
                      descartado(s).
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {activeAssignor?.corporateName}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                O descarte é permitido para boletos emitidos, com falha ou
                rejeitados. Boletos registrados, liquidados ou baixados não serão
                descartados por este fluxo.
                {selectedNotDiscardableTicketsCount > 0 ? (
                  <span className="mt-1 block">
                    {selectedNotDiscardableTicketsCount} boleto(s) fora dessa
                    regra serão ignorado(s).
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-6 py-4 sm:space-x-0">
            <AlertDialogClose
              className="h-9 rounded-lg"
              disabled={isProcessingBulkDiscard}
              onClick={(event) => {
                event.preventDefault();
                handleCloseBulkDiscardDialog();
              }}
            >
              {bulkDiscardStep === "ready" ? "Fechar" : "Cancelar"}
            </AlertDialogClose>
            {bulkDiscardStep === "ready" ? (
              <Button
                className="h-9 rounded-lg"
                onClick={handleCloseBulkDiscardDialog}
                type="button"
              >
                Concluir
              </Button>
            ) : (
              <Button
                className="h-9 rounded-lg"
                disabled={isProcessingBulkDiscard}
                onClick={() => {
                  void handleBulkDiscard();
                }}
                type="button"
                variant="destructive"
              >
                {isProcessingBulkDiscard ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Descartar
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={isEmailDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseEmailDialog();
            return;
          }

          setIsEmailDialogOpen(true);
        }}
      >
        <AlertDialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <AlertDialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="size-5" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-base font-semibold">
                  Enviar e-mail para o sacado
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Preencha os dados do remetente e da mensagem para solicitar o
                  envio pela TecnoSpeed.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {emailStep === "processing" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium">Solicitando envio</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aguarde enquanto a TecnoSpeed processa o e-mail.
                </p>
              </div>
            </div>
          ) : emailStep === "ready" ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium">E-mail solicitado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A TecnoSpeed recebeu a solicitação e retornou o protocolo do
                  processamento.
                </p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Protocolo: {emailProtocol}
              </div>
            </div>
          ) : (
            <div className="space-y-3 px-6 py-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Nome remetente *
                </label>
              <Input
                disabled={isProcessingEmail}
                onChange={(event) =>
                  setEmailForm((current) => ({
                    ...current,
                    senderName: event.target.value,
                  }))
                }
                placeholder="Nome remetente *"
                value={emailForm.senderName}
              />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  E-mail remetente *
                </label>
              <Input
                disabled={isProcessingEmail}
                onChange={(event) =>
                  setEmailForm((current) => ({
                    ...current,
                    senderEmail: event.target.value,
                  }))
                }
                placeholder="E-mail remetente *"
                value={emailForm.senderEmail}
              />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Assunto *
                </label>
              <Input
                disabled={isProcessingEmail}
                onChange={(event) =>
                  setEmailForm((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
                placeholder="Assunto *"
                value={emailForm.subject}
              />
              </div>

              <div className="flex flex-wrap gap-5 py-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={emailForm.html}
                    disabled={isProcessingEmail}
                    onCheckedChange={(checked) =>
                      setEmailForm((current) => ({
                        ...current,
                        html: Boolean(checked),
                      }))
                    }
                  />
                  HTML
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={emailForm.attachTicket}
                    disabled={isProcessingEmail}
                    onCheckedChange={(checked) =>
                      setEmailForm((current) => ({
                        ...current,
                        attachTicket: Boolean(checked),
                      }))
                    }
                  />
                  Anexar boleto
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Mensagem *
                </label>
                <textarea
                  className="min-h-44 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isProcessingEmail}
                  onChange={(event) =>
                    setEmailForm((current) => ({
                      ...current,
                      message: event.target.value,
                    }))
                  }
                  placeholder="Mensagem do e-mail"
                  value={emailForm.message}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  E-mail destinatário *
                </label>
                <Input
                  disabled={isProcessingEmail}
                  onChange={(event) =>
                    setEmailForm((current) => ({
                      ...current,
                      recipientEmail: event.target.value,
                    }))
                  }
                  placeholder="cliente@email.com"
                  value={emailForm.recipientEmail}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-6 py-4 sm:space-x-0">
            <AlertDialogClose
              className="h-9 rounded-lg"
              disabled={isProcessingEmail}
              onClick={(event) => {
                event.preventDefault();
                handleCloseEmailDialog();
              }}
            >
              {emailStep === "ready" ? "Fechar" : "Cancelar"}
            </AlertDialogClose>
            {emailStep === "ready" ? (
              <Button
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCloseEmailDialog}
                type="button"
              >
                Concluir
              </Button>
            ) : (
              <Button
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isProcessingEmail}
                onClick={() => {
                  void handleSendEmail();
                }}
                type="button"
              >
                {isProcessingEmail ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Enviar
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(ticketToDischarge)}
        onOpenChange={(open) => {
          if (!open) {
            setTicketToDischarge(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Undo2 className="size-5" />
            </div>
            <AlertDialogTitle>Solicitar baixa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação enviará um pedido de baixa para o boleto{" "}
              {ticketToDischarge?.documentNumber || "selecionado"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isRequestingDischarge}>
              Cancelar
            </AlertDialogClose>
            <AlertDialogAction
              disabled={isRequestingDischarge}
              onClick={(event) => {
                event.preventDefault();
                void handleRequestDischarge();
              }}
            >
              {isRequestingDischarge ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Solicitar baixa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(ticketHistory)}
        onOpenChange={(open) => {
          if (!open) {
            setTicketHistory(null);
          }
        }}
      >
        <AlertDialogContent className="overflow-hidden p-0 sm:max-w-2xl">
          <AlertDialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="size-5" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-base font-semibold">
                  Histórico do boleto
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {ticketHistory?.integrationId ?? "Boleto selecionado"} ·{" "}
                  {ticketHistory?.payerName || "Sacado não informado"}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="max-h-[60vh] space-y-5 overflow-auto px-6 py-5">
            <div className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Situação</p>
                <p className="text-sm font-medium">
                  {ticketHistory ? getTicketDisplayStatus(ticketHistory) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Documento</p>
                <p className="text-sm font-medium">
                  {ticketHistory?.documentNumber || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p className="text-sm font-medium">
                  {formatDate(ticketHistory?.dueDate ?? "")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Movimentos</p>
              {ticketHistory?.movements.length ? (
                <div className="space-y-3">
                  {ticketHistory.movements.map((movement, index) => (
                    <div
                      className="rounded-lg border bg-background p-4"
                      key={`${movement.code}-${movement.date}-${index}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {movement.message || "Movimento sem descrição"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Código {movement.code || "-"}
                            {movement.origin ? ` · Origem ${movement.origin}` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {formatDate(movement.date)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum movimento retornado pela TecnoSpeed.
                </div>
              )}
            </div>

            {ticketHistory?.occurrences.length ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Ocorrências</p>
                <div className="space-y-2">
                  {ticketHistory.occurrences.map((occurrence, index) => (
                    <div
                      className="rounded-lg border bg-muted/30 px-4 py-3 text-sm"
                      key={`${occurrence.code}-${occurrence.date}-${index}`}
                    >
                      <p className="font-medium">
                        {occurrence.message || "Ocorrência sem descrição"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Código {occurrence.code || "-"}
                        {occurrence.date
                          ? ` · ${formatDate(occurrence.date)}`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <AlertDialogFooter className="border-t bg-muted/20 px-6 py-4">
            <AlertDialogClose className="h-9 rounded-lg">
              Fechar
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(ticketToDiscard)}
        onOpenChange={(open) => {
          if (!open && !isProcessingBulkDiscard) {
            setTicketToDiscard(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 className="size-5" />
            </div>
            <AlertDialogTitle>Descartar boleto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação descartará o boleto{" "}
              {ticketToDiscard?.documentNumber || "selecionado"} na
              TecnoSpeed. Use somente para boletos que não foram encaminhados ao
              banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isProcessingBulkDiscard}>
              Cancelar
            </AlertDialogClose>
            <AlertDialogAction
              disabled={isProcessingBulkDiscard}
              onClick={(event) => {
                event.preventDefault();
                void handleDiscardTicket();
              }}
            >
              {isProcessingBulkDiscard ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
