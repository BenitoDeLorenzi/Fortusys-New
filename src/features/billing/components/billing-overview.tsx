"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  Clock3,
  EyeOff,
  FilterX,
  Loader2,
  ReceiptText,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  BillingAssignor,
  BillingTicket,
  BillingTicketsResponse,
} from "@/features/billing/types";

type PeriodMode = "daily" | "monthly" | "annual";
type ChartRange = "7d" | "30d" | "3m" | "6m" | "12m";

type ChartPoint = {
  label: string;
  registered: number;
  liquidated: number;
};

const periodOptions: Array<{ value: PeriodMode; label: string }> = [
  { value: "daily", label: "DiÃ¡rio" },
  { value: "monthly", label: "Mensal" },
  { value: "annual", label: "Anual" },
];

const rangeOptions: Array<{ value: ChartRange; label: string; days: number }> = [
  { value: "7d", label: "7D", days: 7 },
  { value: "30d", label: "30D", days: 30 },
  { value: "3m", label: "3M", days: 90 },
  { value: "6m", label: "6M", days: 180 },
  { value: "12m", label: "12M", days: 365 },
];

function parseTicketDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const rawDate = value.split(" ")[0];

  if (rawDate.includes("/")) {
    const [day, month, year] = rawDate.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  return new Date(`${rawDate}T00:00:00`);
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

function getPeriodRange(mode: PeriodMode) {
  const now = new Date();

  if (mode === "daily") {
    return {
      from: startOfDay(now),
      to: endOfDay(now),
    };
  }

  if (mode === "monthly") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }

  return {
    from: new Date(now.getFullYear(), 0, 1),
    to: endOfDay(new Date(now.getFullYear(), 11, 31)),
  };
}

function isInRange(date: Date | null, from: Date, to: Date) {
  if (!date) {
    return false;
  }

  const time = date.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatTime(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(value)
    : "-";
}

function getTicketStatus(ticket: BillingTicket) {
  return ticket.status.trim().toUpperCase();
}

function isSettled(ticket: BillingTicket) {
  return ["LIQUIDADO", "BAIXADO"].includes(getTicketStatus(ticket));
}

function isOverdue(ticket: BillingTicket) {
  const dueDate = parseTicketDate(ticket.dueDate);

  return Boolean(
    dueDate &&
      dueDate.getTime() < startOfDay(new Date()).getTime() &&
      !isSettled(ticket)
  );
}

function getReceivableTickets(tickets: BillingTicket[]) {
  return tickets.filter((ticket) =>
    ["SALVO", "EMITIDO", "REGISTRADO", "PENDENTE_RETENTATIVA"].includes(
      getTicketStatus(ticket)
    )
  );
}

function getLiquidatedTickets(tickets: BillingTicket[]) {
  return tickets.filter((ticket) => getTicketStatus(ticket) === "LIQUIDADO");
}

function getRegisteredTickets(tickets: BillingTicket[]) {
  return tickets.filter((ticket) => getTicketStatus(ticket) === "REGISTRADO");
}

function getWrittenOffTickets(tickets: BillingTicket[]) {
  return tickets.filter((ticket) => getTicketStatus(ticket) === "BAIXADO");
}

function sumTickets(tickets: BillingTicket[]) {
  return tickets.reduce((total, ticket) => total + parseCurrency(ticket.amount), 0);
}

function getChartPoints(tickets: BillingTicket[], range: ChartRange) {
  const rangeDays = rangeOptions.find((item) => item.value === range)?.days ?? 7;
  const today = startOfDay(new Date());

  return Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (rangeDays - index - 1));
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const dayTickets = tickets.filter((ticket) =>
      isInRange(parseTicketDate(ticket.issueDate), dayStart, dayEnd)
    );

    return {
      label: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
      }).format(date),
      registered: sumTickets(getRegisteredTickets(dayTickets)),
      liquidated: sumTickets(getLiquidatedTickets(dayTickets)),
    };
  });
}

function getLinePath(points: number[], width: number, height: number, max: number) {
  if (!points.length) {
    return "";
  }

  return points
    .map((value, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function ValuesChart({ points }: { points: ChartPoint[] }) {
  const width = 640;
  const height = 170;
  const values = points.flatMap((point) => [point.registered, point.liquidated]);
  const max = Math.max(1, ...values);
  const registeredPath = getLinePath(
    points.map((point) => point.registered),
    width,
    height,
    max
  );
  const liquidatedPath = getLinePath(
    points.map((point) => point.liquidated),
    width,
    height,
    max
  );
  const areaPath = `${liquidatedPath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="h-72">
      <svg className="h-full w-full" viewBox={`0 0 ${width} ${height + 42}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((line) => (
          <line
            className="stroke-border"
            key={line}
            strokeDasharray="5 6"
            x1="0"
            x2={width}
            y1={height - line * height}
            y2={height - line * height}
          />
        ))}
        <path d={areaPath} fill="rgb(16 185 129 / 0.18)" />
        <path d={liquidatedPath} fill="none" stroke="#10b981" strokeWidth="4" />
        <path d={registeredPath} fill="none" stroke="#0ea5e9" strokeWidth="4" />
        <text className="fill-muted-foreground text-[11px]" x="0" y={height + 24}>
          {points[0]?.label ?? ""}
        </text>
        <text
          className="fill-muted-foreground text-[11px]"
          textAnchor="end"
          x={width}
          y={height + 24}
        >
          {points.at(-1)?.label ?? ""}
        </text>
      </svg>
      <div className="mt-2 flex justify-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-full bg-sky-500" />
          Registrados
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-full bg-emerald-500" />
          Liquidados
        </span>
      </div>
    </div>
  );
}

function RegisteredChart({ points }: { points: ChartPoint[] }) {
  const hasData = points.some((point) => point.registered > 0);

  if (!hasData) {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-center">
        <FilterX className="mb-5 size-12 text-primary/15" />
        <p className="font-medium">Sem dados para exibir no perÃ­odo selecionado</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Por favor escolha um perÃ­odo diferente no filtro.
        </p>
      </div>
    );
  }

  const max = Math.max(1, ...points.map((point) => point.registered));

  return (
    <div className="flex h-72 items-end gap-1.5 px-2 pt-8">
      {points.map((point, index) => (
        <div className="flex flex-1 flex-col items-center gap-2" key={index}>
          <div
            className="w-full rounded-t bg-primary/75"
            style={{ height: `${Math.max(6, (point.registered / max) * 210)}px` }}
          />
          {index === 0 || index === points.length - 1 ? (
            <span className="text-[10px] text-muted-foreground">
              {point.label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type BillingOverviewProps = {
  activeAssignor: BillingAssignor | null;
  refreshKey: number;
};

export function BillingOverview({
  activeAssignor,
  refreshKey,
}: BillingOverviewProps) {
  const [period, setPeriod] = useState<PeriodMode>("daily");
  const [range, setRange] = useState<ChartRange>("7d");
  const [tickets, setTickets] = useState<BillingTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValuesVisible, setIsValuesVisible] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      if (!activeAssignor) {
        setTickets([]);
        setUpdatedAt(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/billing/tickets?document=${activeAssignor.document}&limit=1000`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as BillingTicketsResponse;

        if (!response.ok) {
          throw new Error("Não foi possível carregar boletos.");
        }

        setTickets(data.tickets);
        setUpdatedAt(new Date());
      } catch {
        setTickets([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, [activeAssignor, refreshKey]);

  const filteredTickets = useMemo(() => {
    const periodRange = getPeriodRange(period);

    return tickets.filter((ticket) =>
      isInRange(parseTicketDate(ticket.issueDate), periodRange.from, periodRange.to)
    );
  }, [period, tickets]);
  const registeredTickets = getRegisteredTickets(filteredTickets);
  const liquidatedTickets = getLiquidatedTickets(filteredTickets);
  const overdueTickets = filteredTickets.filter(isOverdue);
  const writtenOffTickets = getWrittenOffTickets(filteredTickets);
  const receivableTickets = getReceivableTickets(filteredTickets);
  const chartPoints = useMemo(() => getChartPoints(tickets, range), [range, tickets]);

  return (
    <div className="space-y-5">
      {!activeAssignor ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Selecione um cedente para visualizar o resumo das cobranças.
        </div>
      ) : null}
      <section className="rounded-lg border bg-muted/30 p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-semibold text-primary">Resumo</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-primary">
            <span>Hoje Ã s {formatTime(updatedAt).split(" ")[1] ?? "--:--"}</span>
            <Button
              className="h-8 px-2"
              onClick={() => setIsValuesVisible((current) => !current)}
              type="button"
              variant="ghost"
            >
              <EyeOff className="size-4" />
            </Button>
            <div className="flex overflow-hidden rounded-md border">
              {periodOptions.map((option) => (
                <Button
                  className="h-8 rounded-none px-3 text-xs uppercase"
                  key={option.value}
                  onClick={() => setPeriod(option.value)}
                  type="button"
                  variant={period === option.value ? "default" : "ghost"}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando dashboard...
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
            <Card>
              <CardContent className="p-4">
                <p className="mb-3 font-semibold">Boletos</p>
                {[
                  ["Registrados", registeredTickets.length, "bg-sky-500"],
                  ["Liquidados", liquidatedTickets.length, "bg-emerald-500"],
                  ["Vencidos", overdueTickets.length, "bg-orange-500"],
                  ["Baixados", writtenOffTickets.length, "bg-slate-500"],
                ].map(([label, value, color]) => (
                  <div className="flex items-center gap-4 py-1" key={label}>
                    <span className={`size-2 rounded-full ${color}`} />
                    <span className="w-10 font-semibold">{value}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="divide-y p-4">
                <div className="pb-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-md bg-sky-100 text-sky-600">
                      <ReceiptText className="size-4" />
                    </span>
                    <p className="font-semibold">A receber</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-medium text-primary">
                      {isValuesVisible ? formatCurrency(sumTickets(receivableTickets)) : "R$ â€¢â€¢â€¢"}
                    </span>
                  </div>
                </div>
                <div className="pt-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                      <CircleDollarSign className="size-4" />
                    </span>
                    <p className="font-semibold">Liquidados</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-medium text-emerald-600">
                      {isValuesVisible ? formatCurrency(sumTickets(liquidatedTickets)) : "R$ â€¢â€¢â€¢"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="divide-y p-4">
                <div className="pb-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-md bg-orange-100 text-orange-600">
                      <Clock3 className="size-4" />
                    </span>
                    <p className="font-semibold">Vencidos</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-medium text-orange-600">
                      {isValuesVisible ? formatCurrency(sumTickets(overdueTickets)) : "R$ â€¢â€¢â€¢"}
                    </span>
                  </div>
                </div>
                <div className="pt-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <XCircle className="size-4" />
                    </span>
                    <p className="font-semibold">Baixados</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-medium text-slate-500">
                      {isValuesVisible ? formatCurrency(sumTickets(writtenOffTickets)) : "R$ â€¢â€¢â€¢"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold text-primary">GrÃ¡ficos</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-primary">
            <span>Atualizado em: {formatTime(updatedAt)}</span>
            <div className="flex overflow-hidden rounded-md border">
              {rangeOptions.map((option) => (
                <Button
                  className="h-8 rounded-none px-3 text-xs uppercase"
                  key={option.value}
                  onClick={() => setRange(option.value)}
                  type="button"
                  variant={range === option.value ? "default" : "ghost"}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button className="h-8 gap-2 text-xs uppercase" type="button" variant="outline">
              <RefreshCw className="size-3.5" />
              Customizado
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Boletos registrados</CardTitle>
            </CardHeader>
            <CardContent>
              <RegisteredChart points={chartPoints} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valores</CardTitle>
            </CardHeader>
            <CardContent>
              <ValuesChart points={chartPoints} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
