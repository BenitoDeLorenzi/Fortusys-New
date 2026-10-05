"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import {
  ManagementDataCard,
  ManagementFilters,
  ManagementMetricCardsSkeleton,
  ManagementPage,
  ManagementPageHeader,
  ManagementState,
  ManagementTableFrame,
  ManagementTableSkeleton,
} from "@/components/management/management-layout";
import {
  SemanticStatusBadge,
  type StatusTone,
} from "@/components/management/semantic-status-badge";
import { Button } from "@/components/ui/button";
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
import type {
  RealEstateMonthlyChargePreviewItem,
  RealEstateMonthlyChargesPreviewResponse,
  RealEstateMonthlyChargeStatus,
  RealEstateMonthlyChargeTicketStatus,
} from "@/features/real-estate/monthly-charges";
import { RealEstateMetricCard as MetricCard } from "@/features/real-estate/components/real-estate-metric-card";

const activeLandlordStorageKey = "fortusys:real-estate:active-landlord";

const months = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const previewStatusTones = {
  not_launched: "warning",
  launched: "success",
  missing_data: "warning",
  outside_period: "neutral",
} as const satisfies Record<
  RealEstateMonthlyChargePreviewItem["status"],
  StatusTone
>;

const chargeStatusLabels = {
  open: "Em aberto",
  paid: "Pago",
  overdue: "Vencido",
  canceled: "Cancelada",
} as const satisfies Record<RealEstateMonthlyChargeStatus, string>;

const chargeStatusTones = {
  open: "warning",
  paid: "success",
  overdue: "danger",
  canceled: "neutral",
} as const satisfies Record<RealEstateMonthlyChargeStatus, StatusTone>;

const ticketStatusLabels = {
  not_generated: "Não gerado",
  registering: "Registrando",
  registered: "Registrado",
  failed: "Falhou",
  canceled: "Cancelado",
} as const satisfies Record<RealEstateMonthlyChargeTicketStatus, string>;

const ticketStatusTones = {
  not_generated: "neutral",
  registering: "info",
  registered: "success",
  failed: "danger",
  canceled: "neutral",
} as const satisfies Record<RealEstateMonthlyChargeTicketStatus, StatusTone>;

function formatCurrencyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getDefaultCompetence() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function getYearOptions(currentYear: number) {
  return Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
}

function getStoredLandlordDocument() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const stored = window.sessionStorage.getItem(activeLandlordStorageKey);
    const parsed = stored
      ? (JSON.parse(stored) as { document?: string | null })
      : null;

    return parsed?.document ?? "";
  } catch {
    return "";
  }
}

function getTicketLabel(item: RealEstateMonthlyChargePreviewItem) {
  if (item.ticketProviderStatus) {
    return item.ticketProviderStatus;
  }

  if (item.ticketStatus) {
    return ticketStatusLabels[item.ticketStatus];
  }

  return null;
}

function getTicketTone(item: RealEstateMonthlyChargePreviewItem): StatusTone {
  if (item.ticketStatus) {
    return ticketStatusTones[item.ticketStatus];
  }

  return "neutral";
}

type RealEstateMonthlyChargesManagementProps = {
  embedded?: boolean;
  landlordDocument?: string | null;
};

export function RealEstateMonthlyChargesManagement({
  embedded = false,
  landlordDocument: landlordDocumentProp,
}: RealEstateMonthlyChargesManagementProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaults = getDefaultCompetence();
  const initialMonth = Number(searchParams.get("month") ?? defaults.month);
  const initialYear = Number(searchParams.get("year") ?? defaults.year);
  const [month, setMonth] = useState(
    Number.isInteger(initialMonth) && initialMonth >= 1 && initialMonth <= 12
      ? initialMonth
      : defaults.month
  );
  const [year, setYear] = useState(
    Number.isInteger(initialYear) && initialYear >= 2000 && initialYear <= 2100
      ? initialYear
      : defaults.year
  );
  const [landlordDocument] = useState(
    () =>
      landlordDocumentProp ??
      searchParams.get("landlordDocument") ??
      getStoredLandlordDocument()
  );
  const [preview, setPreview] =
    useState<RealEstateMonthlyChargesPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const yearOptions = useMemo(() => getYearOptions(defaults.year), [defaults.year]);

  async function loadPreview(nextMonth = month, nextYear = year) {
    setIsLoading(true);

    try {
      const document = landlordDocument || getStoredLandlordDocument();
      const params = new URLSearchParams({
        month: String(nextMonth),
        year: String(nextYear),
      });

      if (document) {
        params.set("landlordDocument", document);
      }

      const response = await fetch(
        `/api/real-estate/monthly-charges?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as
        | RealEstateMonthlyChargesPreviewResponse
        | { message?: string };

      if (!response.ok || !("items" in data)) {
        throw new Error(
          "message" in data
            ? data.message
            : "Não foi possível carregar o financeiro mensal."
        );
      }

      setPreview(data);
      if (embedded) {
        params.set("tab", "cobrancas");
        router.replace(`/imobiliaria?${params.toString()}`, { scroll: false });
      } else {
        router.replace(`/imobiliaria/cobrancas/mensal?${params.toString()}`, {
          scroll: false,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o financeiro mensal."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    window.queueMicrotask(() => {
      void loadPreview();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAssetFinance(item: RealEstateMonthlyChargePreviewItem) {
    router.push(`/imobiliaria/${item.assetId}/financeiro?returnTab=cobrancas`);
  }

  return (
    <ManagementPage className="flex flex-col gap-3 space-y-0">
      {embedded ? null : (
        <ManagementPageHeader
          actions={
            <>
              <Button
                onClick={() => router.push("/imobiliaria?tab=cobrancas")}
                type="button"
                variant="outline"
              >
                <ArrowLeft className="size-4" />
                Voltar
              </Button>
              <Button onClick={() => void loadPreview()} type="button">
                <RefreshCw className="size-4" />
                Atualizar
              </Button>
            </>
          }
          badge="Financeiro mensal"
          description="Acompanhe a competência do mês e acesse o financeiro de cada imóvel para lançar cobranças com seus adicionais."
          icon={CalendarClock}
          title="Financeiro mensal"
        />
      )}

      {isLoading && !preview ? (
        <ManagementMetricCardsSkeleton
          className="order-1 md:grid-cols-2 xl:grid-cols-5"
          count={5}
        />
      ) : preview ? (
        <div className="order-1 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            description="Contratos ativos na carteira"
            icon={CalendarClock}
            title="Contratos"
            value={preview.summary.totalContracts}
          />
          <MetricCard
            description="Cobranças já criadas"
            icon={CheckCircle2}
            title="Lançadas"
            tone="success"
            value={preview.summary.launched}
          />
          <MetricCard
            description="Entrar no imóvel para lançar"
            icon={BadgeDollarSign}
            title="Pendentes"
            tone="warning"
            value={preview.summary.notLaunched}
          />
          <MetricCard
            description={`${preview.summary.paid} paga(s), ${preview.summary.overdue} vencida(s)`}
            icon={CircleDollarSign}
            title="Em aberto"
            tone="info"
            value={preview.summary.open}
          />
          <MetricCard
            description={`Lançado: ${formatCurrencyFromCents(
              preview.summary.launchedAmountCents
            )}`}
            icon={TrendingUp}
            title="Recebido"
            tone="neutral"
            value={formatCurrencyFromCents(preview.summary.paidAmountCents)}
          />
        </div>
      ) : null}

      <ManagementFilters className="order-2 gap-2 p-2.5 pl-4 shadow-sm before:inset-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <div className="w-full space-y-1 lg:w-56">
            <label className="text-xs font-medium text-muted-foreground">
              Mês
            </label>
            <NativeSelect
              onChange={(event) => setMonth(Number(event.target.value))}
              value={String(month)}
            >
              {months.map((item) => (
                <NativeSelectOption key={item.value} value={String(item.value)}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="w-full space-y-1 lg:w-40">
            <label className="text-xs font-medium text-muted-foreground">
              Ano
            </label>
            <NativeSelect
              onChange={(event) => setYear(Number(event.target.value))}
              value={String(year)}
            >
              {yearOptions.map((item) => (
                <NativeSelectOption key={item} value={String(item)}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex shrink-0 gap-2 lg:ml-auto">
            <Button
              className="h-8 min-w-24"
              onClick={() => void loadPreview(month, year)}
              type="button"
            >
              <Search className="size-4" />
              Consultar
            </Button>
          </div>
        </div>
      </ManagementFilters>

      <ManagementDataCard
        className="order-3"
        count={preview ? `${preview.items.length} contrato(s)` : "Carregando"}
        title="Competência mensal"
      >
        {isLoading ? (
          <ManagementTableSkeleton columns={9} rows={8} />
        ) : !preview || preview.items.length === 0 ? (
          <ManagementState>
            Nenhum contrato ativo encontrado para esta competência.
          </ManagementState>
        ) : (
          <ManagementTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Inquilino</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Aluguel</TableHead>
                  <TableHead className="text-right">Lançado</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <TableHead>Boleto</TableHead>
                  <TableHead className="w-36 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.items.map((item) => {
                  const ticketLabel = getTicketLabel(item);

                  return (
                    <TableRow key={item.leaseId}>
                      <TableCell className="max-w-72">
                        <p className="truncate font-medium">
                          {item.assetCode ? `${item.assetCode} · ` : ""}
                          {item.assetTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vigência {formatDate(item.startDate)} até{" "}
                          {formatDate(item.endDate)}
                        </p>
                      </TableCell>
                      <TableCell>{item.contractNumber ?? "-"}</TableCell>
                      <TableCell className="max-w-64">
                        <p className="truncate font-medium">{item.tenantName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.tenantDocument || "Documento não informado"}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyFromCents(item.rentAmountCents)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.totalAmountCents === null
                          ? "-"
                          : formatCurrencyFromCents(item.totalAmountCents)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {item.chargeStatus ? (
                            <SemanticStatusBadge
                              tone={chargeStatusTones[item.chargeStatus]}
                            >
                              {chargeStatusLabels[item.chargeStatus]}
                            </SemanticStatusBadge>
                          ) : (
                            <SemanticStatusBadge
                              tone={previewStatusTones[item.status]}
                            >
                              {item.statusLabel}
                            </SemanticStatusBadge>
                          )}
                          {item.reason ? (
                            <p className="max-w-56 text-xs text-muted-foreground">
                              {item.reason}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticketLabel ? (
                          <SemanticStatusBadge tone={getTicketTone(item)}>
                            {ticketLabel}
                          </SemanticStatusBadge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => openAssetFinance(item)}
                          size="sm"
                          type="button"
                          variant={item.chargeId ? "outline" : "default"}
                        >
                          {item.chargeId ? (
                            <ExternalLink className="size-4" />
                          ) : (
                            <BadgeDollarSign className="size-4" />
                          )}
                          {item.chargeId ? "Abrir" : "Lançar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ManagementTableFrame>
        )}
      </ManagementDataCard>
    </ManagementPage>
  );
}
