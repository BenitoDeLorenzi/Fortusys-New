"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Home,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ManagementState,
  ManagementTableFrame,
  ManagementTableSkeleton,
} from "@/components/management/management-layout";
import { SemanticStatusBadge } from "@/components/management/semantic-status-badge";
import type {
  BillingAssignor,
  BillingAssignorsResponse,
  BillingTicket,
  BillingTicketsResponse,
} from "@/features/billing/types";
import { formatDocument } from "@/features/billing/utils";
import type {
  RealEstateDashboardAgendaItem,
  RealEstateDashboardResponse,
  RealEstateLandlord,
  RealEstateLandlordsResponse,
} from "@/features/real-estate/types";
import type {
  AppNotification,
  NotificationsResponse,
} from "@/features/notifications/types";
import { cn } from "@/lib/utils";

const activeLandlordStorageKey = "fortusys:real-estate:active-landlord";
const activeAssignorStorageKey = "fortusys:billing:active-assignor";

type DashboardState = {
  assignor: BillingAssignor | null;
  tickets: BillingTicket[];
  realEstate: RealEstateDashboardResponse | null;
  landlord: RealEstateLandlord | null;
  notifications: AppNotification[];
  errors: string[];
};

function parseMoney(value?: string | null) {
  const normalized = (value ?? "0")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCents(value: number) {
  return formatCurrency(value / 100);
}

function getTicketStatus(ticket: BillingTicket) {
  return ticket.status?.trim().toUpperCase() || "DESCONHECIDO";
}

function isTicketOverdue(ticket: BillingTicket) {
  const status = getTicketStatus(ticket);

  if (["LIQUIDADO", "BAIXADO", "CANCELADO"].includes(status)) {
    return false;
  }

  if (!ticket.dueDate) {
    return false;
  }

  const dueDate = ticket.dueDate.includes("/")
    ? ticket.dueDate.split("/").reverse().join("-")
    : ticket.dueDate;
  const date = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return !Number.isNaN(date.getTime()) && date < today;
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  if (value.includes("/")) {
    return value.split(" ")[0];
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getStoredLandlord() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(activeLandlordStorageKey);
    return raw ? (JSON.parse(raw) as RealEstateLandlord) : null;
  } catch {
    return null;
  }
}

function getStoredAssignorId() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(activeAssignorStorageKey);
    const parsed = raw ? (JSON.parse(raw) as { id?: string }) : null;
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}

function ExecutiveMetricCard({
  description,
  icon: Icon,
  tone = "primary",
  title,
  value,
}: {
  description: string;
  icon: typeof CircleDollarSign;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  title: string;
  value: string | number;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    danger: "bg-red-500/10 text-red-600",
    neutral: "bg-muted text-muted-foreground",
  }[tone];

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm" size="sm">
      <CardContent className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            toneClass
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p className="truncate text-xl font-semibold">{value}</p>
          <p className="truncate text-xs text-muted-foreground">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardOverview() {
  const [state, setState] = useState<DashboardState>({
    assignor: null,
    tickets: [],
    realEstate: null,
    landlord: null,
    notifications: [],
    errors: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      const errors: string[] = [];

      try {
        const [assignorsResponse, landlordsResponse, notificationsResponse] =
          await Promise.all([
            fetch("/api/billing/assignors", { cache: "no-store" }),
            fetch("/api/real-estate/landlords", { cache: "no-store" }),
            fetch("/api/notifications?limit=8", { cache: "no-store" }),
          ]);

        const assignorsPayload = assignorsResponse.ok
          ? ((await assignorsResponse.json()) as BillingAssignorsResponse)
          : null;
        const landlordsPayload = landlordsResponse.ok
          ? ((await landlordsResponse.json()) as RealEstateLandlordsResponse)
          : null;
        const notificationsPayload = notificationsResponse.ok
          ? ((await notificationsResponse.json()) as NotificationsResponse)
          : null;

        if (!assignorsResponse.ok) {
          errors.push("Não foi possível carregar cedentes/boletos.");
        }

        if (!landlordsResponse.ok) {
          errors.push("Não foi possível carregar dados da imobiliária.");
        }

        if (!notificationsResponse.ok) {
          errors.push("Não foi possível carregar notificações.");
        }

        const storedAssignorId = getStoredAssignorId();
        const assignor =
          assignorsPayload?.assignors.find(
            (item) => String(item.id) === storedAssignorId
          ) ??
          assignorsPayload?.assignors[0] ??
          null;
        const storedLandlord = getStoredLandlord();
        const landlord =
          landlordsPayload?.landlords.find(
            (item) => item.document === storedLandlord?.document
          ) ??
          landlordsPayload?.landlords[0] ??
          null;

        const [ticketsResult, realEstateResult] = await Promise.allSettled([
          assignor
            ? fetch(
                `/api/billing/tickets?document=${assignor.document}&limit=1000`,
                { cache: "no-store" }
              )
            : Promise.resolve(null),
          landlord?.document
            ? fetch(
                `/api/real-estate/dashboard?landlordDocument=${landlord.document}`,
                { cache: "no-store" }
              )
            : Promise.resolve(null),
        ]);

        let tickets: BillingTicket[] = [];
        let realEstate: RealEstateDashboardResponse | null = null;

        if (ticketsResult.status === "fulfilled" && ticketsResult.value) {
          const payload = (await ticketsResult.value.json()) as
            | BillingTicketsResponse
            | { message?: string };

          if (ticketsResult.value.ok && "tickets" in payload) {
            tickets = payload.tickets;
          } else {
            errors.push("Não foi possível carregar boletos do cedente ativo.");
          }
        }

        if (realEstateResult.status === "fulfilled" && realEstateResult.value) {
          const payload = (await realEstateResult.value.json()) as
            | RealEstateDashboardResponse
            | { message?: string };

          if (realEstateResult.value.ok && "summary" in payload) {
            realEstate = payload;
          } else {
            errors.push("Não foi possível carregar resumo imobiliário.");
          }
        }

        setState({
          assignor,
          tickets,
          realEstate,
          landlord,
          notifications: notificationsPayload?.notifications ?? [],
          errors,
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o dashboard."
        );
        setState((current) => ({
          ...current,
          errors: ["Não foi possível carregar o dashboard."],
        }));
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, [refreshKey]);

  const billingSummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);
    const registered = state.tickets.filter(
      (ticket) => getTicketStatus(ticket) === "REGISTRADO"
    );
    const settled = state.tickets.filter(
      (ticket) => getTicketStatus(ticket) === "LIQUIDADO"
    );
    const writtenOff = state.tickets.filter(
      (ticket) => getTicketStatus(ticket) === "BAIXADO"
    );
    const failed = state.tickets.filter((ticket) =>
      ["FALHA", "REJEITADO", "PENDENTE_RETENTATIVA"].includes(
        getTicketStatus(ticket)
      )
    );
    const overdue = state.tickets.filter(isTicketOverdue);
    const dueToday = state.tickets.filter((ticket) => {
      const dueDate = ticket.dueDate.includes("/")
        ? ticket.dueDate.split("/").reverse().join("-")
        : ticket.dueDate;
      return dueDate.slice(0, 10) === todayKey;
    });

    return {
      registered,
      settled,
      writtenOff,
      failed,
      overdue,
      dueToday,
      registeredAmount: registered.reduce(
        (total, ticket) => total + parseMoney(ticket.amount),
        0
      ),
      settledAmount: settled.reduce(
        (total, ticket) => total + parseMoney(ticket.amount),
        0
      ),
      overdueAmount: overdue.reduce(
        (total, ticket) => total + parseMoney(ticket.amount),
        0
      ),
    };
  }, [state.tickets]);

  const priorityAgenda = useMemo(
    () => (state.realEstate?.agenda ?? []).slice(0, 6),
    [state.realEstate?.agenda]
  );
  const actionItems = useMemo(() => {
    const ticketItems = [
      ...billingSummary.failed.slice(0, 3).map((ticket) => ({
        title: "Boleto com falha",
        description: `${ticket.payerName || "Pagador"} • ${formatDate(
          ticket.dueDate
        )}`,
        href: "/cobranca?tab=boletos",
        tone: "danger" as const,
      })),
      ...billingSummary.overdue.slice(0, 3).map((ticket) => ({
        title: "Boleto vencido",
        description: `${ticket.payerName || "Pagador"} • R$ ${
          ticket.amount || "0,00"
        }`,
        href: "/cobranca?tab=boletos",
        tone: "warning" as const,
      })),
    ];
    const agendaItems = priorityAgenda.slice(0, 4).map((item) => ({
      title: item.title,
      description: item.description,
      href: item.actionHref,
      tone: item.priority === "high" ? "danger" : "warning",
    }));

    return [...ticketItems, ...agendaItems].slice(0, 6);
  }, [billingSummary.failed, billingSummary.overdue, priorityAgenda]);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/40 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Badge className="mb-3 rounded-full bg-primary/10 px-3 text-primary hover:bg-primary/10">
              Dashboard
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              O que precisa da sua atenção hoje
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Visão executiva de boletos, imóveis, contratos, notificações e
              próximas ações do Fortusys.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full px-3" variant="secondary">
              <ShieldCheck className="size-3.5" />
              Operação Fortusys
            </Badge>
            <Button
              disabled={isLoading}
              onClick={() => setRefreshKey((current) => current + 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Atualizar
            </Button>
          </div>
        </div>
      </section>

      {state.errors.length > 0 ? (
        <Card className="border-amber-500/20 bg-amber-500/10 shadow-sm" size="sm">
          <CardContent className="flex gap-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Alguns dados não foram carregados.</p>
              <p className="mt-0.5">{state.errors.join(" ")}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetricCard
          description={`${billingSummary.dueToday.length} vencendo hoje`}
          icon={ReceiptText}
          title="Boletos registrados"
          tone="primary"
          value={billingSummary.registered.length}
        />
        <ExecutiveMetricCard
          description={formatCurrency(billingSummary.settledAmount)}
          icon={CheckCircle2}
          title="Liquidados"
          tone="success"
          value={billingSummary.settled.length}
        />
        <ExecutiveMetricCard
          description={formatCurrency(billingSummary.overdueAmount)}
          icon={Clock3}
          title="Vencidos"
          tone={billingSummary.overdue.length > 0 ? "warning" : "neutral"}
          value={billingSummary.overdue.length}
        />
        <ExecutiveMetricCard
          description={
            state.realEstate
              ? `${formatCents(
                  state.realEstate.summary.monthlyRentCents
                )} em aluguel`
              : "Resumo imobiliário"
          }
          icon={Home}
          title="Imóveis alugados"
          tone="success"
          value={state.realEstate?.summary.rentedAssets ?? 0}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="border-b">
            <div>
              <CardTitle>Central de ações</CardTitle>
              <CardDescription>
                Pendências financeiras e operacionais que merecem prioridade.
              </CardDescription>
            </div>
            <CardAction>
              <Badge className="rounded-full" variant="secondary">
                {actionItems.length} item(ns)
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ManagementTableSkeleton columns={3} rows={5} />
            ) : actionItems.length === 0 ? (
              <ManagementState>
                Nenhuma pendência crítica encontrada agora.
              </ManagementState>
            ) : (
              <div className="grid gap-2">
                {actionItems.map((item, index) => (
                  <Link
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-3 transition hover:bg-muted/50"
                    href={item.href}
                    key={`${item.title}-${index}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <SemanticStatusBadge
                      tone={item.tone === "danger" ? "danger" : "warning"}
                    >
                      Atenção
                    </SemanticStatusBadge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Atalhos rápidos</CardTitle>
            <CardDescription>Acesso direto às rotinas do dia.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              {
                href: "/cobranca",
                icon: CircleDollarSign,
                label: "Gestão de cobrança",
              },
              {
                href: "/imobiliaria?tab=imoveis",
                icon: Building2,
                label: "Imóveis",
              },
              {
                href: "/imobiliaria?tab=financeiro",
                icon: TrendingUp,
                label: "Financeiro imobiliário",
              },
              {
                href: "/cedentes",
                icon: Users,
                label: "Cedentes",
              },
            ].map((item) => (
              <Button
                className="h-11 justify-start rounded-2xl"
                key={item.href}
                nativeButton={false}
                render={<Link href={item.href} />}
                variant="outline"
              >
                <item.icon className="size-4" />
                {item.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="border-b">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                Agenda imobiliária
              </CardTitle>
              <CardDescription>
                {state.landlord?.name
                  ? `Locador: ${state.landlord.name}`
                  : "Próximos eventos dos imóveis"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ManagementTableSkeleton columns={3} rows={5} />
            ) : priorityAgenda.length === 0 ? (
              <ManagementState>
                Nenhum evento imobiliário relevante encontrado.
              </ManagementState>
            ) : (
              <ManagementTableFrame>
                <div className="divide-y">
                  {priorityAgenda.map((item: RealEstateDashboardAgendaItem) => (
                    <Link
                      className="flex items-center justify-between gap-3 px-3 py-3 transition hover:bg-muted/40"
                      href={item.actionHref}
                      key={item.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.assetCode ? `#${item.assetCode} • ` : ""}
                          {item.assetTitle}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium">
                          {formatDate(item.date)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.tenantName ?? "Sem cliente"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </ManagementTableFrame>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="border-b">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                Notificações recentes
              </CardTitle>
              <CardDescription>
                Últimos eventos registrados para o seu usuário.
              </CardDescription>
            </div>
            <CardAction>
              <Button
                nativeButton={false}
                render={<Link href="/notificacoes" />}
                size="sm"
                variant="outline"
              >
                Ver todas
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ManagementTableSkeleton columns={3} rows={5} />
            ) : state.notifications.length === 0 ? (
              <ManagementState>Nenhuma notificação recente.</ManagementState>
            ) : (
              <div className="grid gap-2">
                {state.notifications.map((notification) => (
                  <Link
                    className="rounded-2xl border border-border/70 bg-background/70 p-3 transition hover:bg-muted/50"
                    href={notification.actionHref ?? "/notificacoes"}
                    key={notification.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {notification.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                      </div>
                      <SemanticStatusBadge
                        tone={
                          notification.severity === "danger"
                            ? "danger"
                            : notification.severity === "warning"
                              ? "warning"
                              : notification.severity === "success"
                                ? "success"
                                : "info"
                        }
                      >
                        {notification.originLabel}
                      </SemanticStatusBadge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ExecutiveMetricCard
          description={
            state.assignor
              ? formatDocument(state.assignor.document)
              : "Nenhum cedente ativo"
          }
          icon={CircleDollarSign}
          title="Cedente financeiro"
          value={state.assignor?.corporateName ?? "-"}
        />
        <ExecutiveMetricCard
          description={`${state.realEstate?.summary.activeContracts ?? 0} contrato(s) ativo(s)`}
          icon={FileText}
          title="Contratos"
          value={state.realEstate?.summary.draftContracts ?? 0}
        />
        <ExecutiveMetricCard
          description={`${billingSummary.failed.length} falha(s) ou rejeição(ões)`}
          icon={AlertTriangle}
          title="Boletos baixados"
          value={billingSummary.writtenOff.length}
        />
      </section>
    </div>
  );
}
