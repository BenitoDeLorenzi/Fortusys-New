"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Edit3,
  CircleDollarSign,
  FileText,
  House,
  Images,
  KeyRound,
  Loader2,
  MapPinned,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Settings2,
  Shapes,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ManagementDataCard,
  ManagementFilters,
  ManagementFiltersSkeleton,
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
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  BillingAssignor,
  BillingAssignorsResponse,
} from "@/features/billing/types";
import type {
  RealEstateAsset,
  RealEstateAssetsResponse,
  RealEstateDashboardAgendaItem,
  RealEstateDashboardResponse,
  RealEstateLandlordsResponse,
} from "@/features/real-estate/types";
import { RealEstateContractModelsSettings } from "@/features/real-estate/components/real-estate-contract-models-settings";
import { RealEstateMetricCard as MetricCard } from "@/features/real-estate/components/real-estate-metric-card";
import { RealEstateMonthlyChargesManagement } from "@/features/real-estate/components/real-estate-monthly-charges-management";

const activeLandlordStorageKey = "fortusys:real-estate:active-landlord";
const realEstateTabs = [
  "resumo",
  "imoveis",
  "agenda",
  "cobrancas",
  "configuracoes",
] as const;

type RealEstateTab = (typeof realEstateTabs)[number];

function getRealEstateTab(value?: string | null): RealEstateTab {
  return realEstateTabs.includes(value as RealEstateTab)
    ? (value as RealEstateTab)
    : "resumo";
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toUpperCase() === "ATIVO";

  return (
    <SemanticStatusBadge tone={isActive ? "success" : "neutral"}>
      {isActive ? "Ativo" : status}
    </SemanticStatusBadge>
  );
}

function normalizeBadgeValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function formatCurrencyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

const chargeStatusLabels = {
  open: "Em aberto",
  paid: "Pago",
  overdue: "Vencido",
  canceled: "Cancelado",
} as const;

const chargeStatusTones = {
  open: "warning",
  paid: "success",
  overdue: "overdue",
  canceled: "danger",
} as const satisfies Record<keyof typeof chargeStatusLabels, StatusTone>;

const ticketStatusLabels = {
  not_generated: "Não gerado",
  registering: "Registrando",
  registered: "Registrado",
  failed: "Falhou",
  canceled: "Cancelado",
} as const;

const ticketStatusTones = {
  not_generated: "neutral",
  registering: "progress",
  registered: "success",
  failed: "danger",
  canceled: "neutral",
} as const satisfies Record<keyof typeof ticketStatusLabels, StatusTone>;

const agendaTypeLabels: Record<RealEstateDashboardAgendaItem["type"], string> = {
  charge_due: "Vencimento",
  charge_overdue: "Cobrança vencida",
  ticket_failed: "Boleto com falha",
  ticket_registering: "Boleto registrando",
  contract_ending: "Contrato vencendo",
  contract_document: "Documento pendente",
  adjustment: "Reajuste",
  missing_charge: "Cobrança pendente",
};

const agendaPriorityLabels: Record<
  RealEstateDashboardAgendaItem["priority"],
  string
> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const agendaPriorityTones = {
  low: "neutral",
  medium: "warning",
  high: "danger",
} as const satisfies Record<RealEstateDashboardAgendaItem["priority"], StatusTone>;

function AssetStatusBadge({ status }: { status: string }) {
  const normalizedStatus = normalizeBadgeValue(status);
  const statusByValue: Record<
    string,
    { label: string; tone: StatusTone }
  > = {
    available: { label: "Disponível", tone: "success" },
    disponivel: { label: "Disponível", tone: "success" },
    rented: { label: "Alugado", tone: "info" },
    alugado: { label: "Alugado", tone: "info" },
    renovation: { label: "Em reforma", tone: "overdue" },
    emreforma: { label: "Em reforma", tone: "overdue" },
    sold: { label: "Vendido", tone: "neutral" },
    vendido: { label: "Vendido", tone: "neutral" },
    inactive: { label: "Inativo", tone: "neutral" },
    inativo: { label: "Inativo", tone: "neutral" },
  };
  const statusConfig = statusByValue[normalizedStatus] ?? {
    label: status
      ? status.charAt(0).toLocaleUpperCase("pt-BR") + status.slice(1).toLowerCase()
      : "Não informado",
    tone: "neutral" as const,
  };

  return (
    <SemanticStatusBadge tone={statusConfig.tone}>
      {statusConfig.label}
    </SemanticStatusBadge>
  );
}

function AssetActions({
  canDelete,
  onContracts,
  onDocuments,
  onFinance,
  onDelete,
  onEdit,
  onPhotos,
}: {
  canDelete: boolean;
  onContracts: () => void;
  onDocuments: () => void;
  onFinance: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onPhotos: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Abrir ações do imóvel"
            size="icon"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={onEdit}>
          <Edit3 className="size-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPhotos}>
          <Images className="size-4" />
          Fotos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDocuments}>
          <FileText className="size-4" />
          Documentos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onContracts}>
          <ClipboardList className="size-4" />
          Contratos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFinance}>
          <CircleDollarSign className="size-4" />
          Financeiro
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canDelete}
          onClick={onDelete}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          {canDelete ? "Excluir" : "Excluir bloqueado: imóvel alugado"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssetTypeBadge({ type }: { type: string }) {
  const normalizedType = normalizeBadgeValue(type);
  const types: Record<string, { label: string; icon: LucideIcon }> = {
    apartment: { label: "Apartamento", icon: Building2 },
    commercial: { label: "Comercial", icon: Store },
    condominium: { label: "Condomínio", icon: Building2 },
    house: { label: "Casa", icon: House },
    land: { label: "Terreno", icon: MapPinned },
    office: { label: "Escritório", icon: Building2 },
    residential: { label: "Residencial", icon: House },
    room: { label: "Sala", icon: Store },
    seasonal: { label: "Temporada", icon: House },
    warehouse: { label: "Galpão", icon: Warehouse },
  };
  const typeConfig = types[normalizedType] ?? {
    label: "Outro",
    icon: Shapes,
  };
  const Icon = typeConfig.icon;

  return (
    <Badge
      className="h-6 gap-1.5 border-slate-200 bg-slate-50 px-2.5 text-slate-700 shadow-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      variant="outline"
    >
      <Icon className="size-3.5" />
      {typeConfig.label}
    </Badge>
  );
}

function AssetMotiveBadge({ motive }: { motive: string | null }) {
  const normalizedMotive = normalizeBadgeValue(motive);
  const isRental =
    normalizedMotive === "aluguel" || normalizedMotive === "locacao";
  const isSale = normalizedMotive === "venda";
  const Icon = isRental ? KeyRound : isSale ? BadgeDollarSign : CircleHelp;
  const label = isRental ? "Aluguel" : isSale ? "Venda" : "Não informado";

  return (
    <Badge
      className={
        isRental
          ? "h-6 gap-1.5 border-violet-200 bg-violet-50 px-2.5 text-violet-700 shadow-none dark:border-violet-800 dark:bg-violet-950/45 dark:text-violet-300"
          : isSale
            ? "h-6 gap-1.5 border-rose-200 bg-rose-50 px-2.5 text-rose-700 shadow-none dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-300"
            : "h-6 gap-1.5 border-slate-200 bg-slate-100 px-2.5 text-slate-700 shadow-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }
      variant="outline"
    >
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

export function RealEstateManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [landlords, setLandlords] = useState<BillingAssignor[]>([]);
  const [activeLandlordId, setActiveLandlordId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const storedLandlord = window.sessionStorage.getItem(
      activeLandlordStorageKey
    );

    if (!storedLandlord) {
      return "";
    }

    try {
      const parsedLandlord = JSON.parse(storedLandlord) as { id?: string };
      return parsedLandlord.id ?? "";
    } catch {
      window.sessionStorage.removeItem(activeLandlordStorageKey);
      return "";
    }
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [assets, setAssets] = useState<RealEstateAsset[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [dashboard, setDashboard] =
    useState<RealEstateDashboardResponse | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [assetsPage, setAssetsPage] = useState(1);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [assetsRefreshKey, setAssetsRefreshKey] = useState(0);
  const [assetToDelete, setAssetToDelete] = useState<RealEstateAsset | null>(
    null
  );
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    type: "all",
    motive: "all",
    status: "all",
  });
  const [assetFilters, setAssetFilters] = useState(draftFilters);
  const [agendaFilters, setAgendaFilters] = useState({
    type: "all",
    priority: "all",
  });
  const activeTab = useMemo(
    () => getRealEstateTab(searchParams.get("tab")),
    [searchParams]
  );

  const activeLandlord = useMemo(
    () =>
      landlords.find((landlord) => String(landlord.id) === activeLandlordId) ??
      null,
    [activeLandlordId, landlords]
  );
  const filteredAgenda = useMemo(() => {
    return (dashboard?.agenda ?? []).filter((item) => {
      const matchesType =
        agendaFilters.type === "all" || item.type === agendaFilters.type;
      const matchesPriority =
        agendaFilters.priority === "all" ||
        item.priority === agendaFilters.priority;

      return matchesType && matchesPriority;
    });
  }, [agendaFilters, dashboard?.agenda]);
  const agendaSummary = useMemo(() => {
    const items = dashboard?.agenda ?? [];

    return {
      total: items.length,
      high: items.filter((item) => item.priority === "high").length,
      financial: items.filter((item) =>
        [
          "charge_due",
          "charge_overdue",
          "ticket_failed",
          "ticket_registering",
          "missing_charge",
        ].includes(item.type)
      ).length,
      contracts: items.filter((item) =>
        ["contract_ending", "contract_document", "adjustment"].includes(
          item.type
        )
      ).length,
    };
  }, [dashboard?.agenda]);

  useEffect(() => {
    async function loadLandlords() {
      try {
        const [assignorsResponse, landlordsResponse] = await Promise.all([
          fetch("/api/billing/assignors", {
            cache: "no-store",
          }),
          fetch("/api/real-estate/landlords", {
            cache: "no-store",
          }),
        ]);
        const assignorsData = (await assignorsResponse.json()) as
          | BillingAssignorsResponse
          | { message?: string };
        const landlordsData = (await landlordsResponse.json()) as
          | RealEstateLandlordsResponse
          | { message?: string };

        if (!assignorsResponse.ok || !("assignors" in assignorsData)) {
          throw new Error(
            "message" in assignorsData
              ? assignorsData.message
              : "Não foi possível carregar proprietários."
          );
        }

        if (!landlordsResponse.ok || !("landlords" in landlordsData)) {
          throw new Error(
            "message" in landlordsData
              ? landlordsData.message
              : "Não foi possível carregar proprietários."
          );
        }

        const landlordDocuments = new Set(
          landlordsData.landlords
            .map((landlord) => landlord.document)
            .filter(Boolean)
        );
        const assignorsWithAssets = assignorsData.assignors.filter((assignor) =>
          landlordDocuments.has(onlyDigits(assignor.document))
        );

        setLandlords(assignorsWithAssets);
        setActiveLandlordId((current) => {
          if (
            current &&
            assignorsWithAssets.some((landlord) => String(landlord.id) === current)
          ) {
            return current;
          }

          return assignorsWithAssets[0] ? String(assignorsWithAssets[0].id) : "";
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar proprietários."
        );
      } finally {
        setIsInitialLoading(false);
      }
    }

    void loadLandlords();
  }, []);

  useEffect(() => {
    if (!activeLandlord) {
      return;
    }

    window.sessionStorage.setItem(
      activeLandlordStorageKey,
      JSON.stringify({
        id: String(activeLandlord.id),
        document: activeLandlord.document,
        name: activeLandlord.corporateName,
      })
    );
  }, [activeLandlord]);

  useEffect(() => {
    async function loadAssets() {
      if (!activeLandlord) {
        setAssets([]);
        setTotalAssets(0);
        return;
      }

      setIsLoadingAssets(true);

      try {
        const params = new URLSearchParams({
          landlordDocument: activeLandlord.document,
          page: String(assetsPage),
          limit: "8",
        });
        if (assetFilters.type !== "all") {
          params.set("type", assetFilters.type);
        }
        if (assetFilters.motive !== "all") {
          params.set("motive", assetFilters.motive);
        }
        if (assetFilters.status !== "all") {
          params.set("status", assetFilters.status);
        }
        const response = await fetch(`/api/real-estate/assets?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | RealEstateAssetsResponse
          | { message?: string };

        if (!response.ok || !("assets" in data)) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível carregar imóveis."
          );
        }

        setAssets(
          [...data.assets].sort((a, b) => {
            const codeDiff = (b.code ?? 0) - (a.code ?? 0);

            if (codeDiff !== 0) {
              return codeDiff;
            }

            return b.createdAt.localeCompare(a.createdAt);
          })
        );
        setTotalAssets(data.total);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar imóveis."
        );
      } finally {
        setIsLoadingAssets(false);
      }
    }

    void loadAssets();
  }, [activeLandlord, assetFilters, assetsPage, assetsRefreshKey]);

  useEffect(() => {
    async function loadDashboard() {
      if (!activeLandlord) {
        setDashboard(null);
        return;
      }

      setIsLoadingDashboard(true);

      try {
        const params = new URLSearchParams({
          landlordDocument: activeLandlord.document,
          landlordId: String(activeLandlord.id),
        });
        const response = await fetch(
          `/api/real-estate/dashboard?${params.toString()}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as
          | RealEstateDashboardResponse
          | { message?: string };

        if (!response.ok || !("summary" in data)) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível carregar o resumo da imobiliária."
          );
        }

        setDashboard(data);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o resumo da imobiliária."
        );
      } finally {
        setIsLoadingDashboard(false);
      }
    }

    void loadDashboard();
  }, [activeLandlord, assetsRefreshKey]);

  function handleLandlordChange(value: string | null) {
    const nextValue = value ?? "";
    setActiveLandlordId(nextValue);
    setAssetsPage(1);

    if (!nextValue) {
      window.sessionStorage.removeItem(activeLandlordStorageKey);
    }
  }

  function handleTabChange(value: string) {
    const nextTab = realEstateTabs.includes(value as RealEstateTab)
      ? (value as RealEstateTab)
      : "resumo";

    router.replace(
      nextTab === "resumo" ? "/imobiliaria" : `/imobiliaria?tab=${nextTab}`,
      { scroll: false }
    );
  }

  function withReturnTab(href: string, tab: RealEstateTab = activeTab) {
    const [pathname, query = ""] = href.split("?");
    const params = new URLSearchParams(query);

    params.set("returnTab", tab);

    return `${pathname}?${params.toString()}`;
  }

  function pushWithReturnTab(href: string, tab: RealEstateTab = activeTab) {
    router.push(withReturnTab(href, tab));
  }

  async function handleDeleteAsset() {
    if (!assetToDelete) {
      return;
    }

    setIsDeletingAsset(true);

    try {
      const response = await fetch(
        `/api/real-estate/assets?id=${encodeURIComponent(assetToDelete.id)}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível excluir o imóvel.");
      }

      setAssetToDelete(null);
      toast.success("Imóvel excluído");

      if (assets.length === 1 && assetsPage > 1) {
        setAssetsPage((current) => current - 1);
      } else {
        setAssetsRefreshKey((current) => current + 1);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o imóvel."
      );
    } finally {
      setIsDeletingAsset(false);
    }
  }

  return (
    <ManagementPage className="space-y-3">
      <ManagementPageHeader
        badge="Imobiliária"
        compact
        hideTitle
        icon={Building2}
        title="Gestão imobiliária"
        actions={
          <>
          <div className="flex h-10 items-center gap-2 text-sm font-medium">
            <Building2 className="size-4 text-primary" />
            Proprietário ativo
          </div>
          <NativeSelect
            className="h-10 min-w-64 lg:min-w-96"
            value={activeLandlordId}
            onChange={(event) => handleLandlordChange(event.target.value)}
          >
            <NativeSelectOption value="">
              Selecione um proprietário
            </NativeSelectOption>
            {landlords.map((landlord) => (
              <NativeSelectOption key={landlord.id} value={String(landlord.id)}>
                {landlord.corporateName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="flex h-10 items-center">
            {activeLandlord ? (
              <StatusBadge status={activeLandlord.status} />
            ) : (
              <Badge variant="secondary">
                {isInitialLoading ? "Carregando" : "Não selecionado"}
              </Badge>
            )}
          </div>
          {activeTab === "imoveis" ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => pushWithReturnTab("/imobiliaria/novo", "imoveis")}
              type="button"
            >
              <Plus className="size-4" />
              Novo imóvel
            </Button>
          ) : null}
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
          <TabsTrigger value="imoveis">
            <House className="size-4" />
            Imóveis
          </TabsTrigger>
          <TabsTrigger value="cobrancas">
            <BadgeDollarSign className="size-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="agenda">
            <CalendarDays className="size-4" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="configuracoes">
            <Settings2 className="size-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-5">
          {isInitialLoading || isLoadingDashboard ? (
            <>
              <ManagementMetricCardsSkeleton count={4} />
              <Card className="overflow-hidden border-border/70 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.75)]">
                <CardHeader className="border-b bg-gradient-to-r from-primary/[0.08] via-card to-muted/50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2" aria-hidden="true">
                      <div className="h-5 w-44 animate-pulse rounded-full bg-muted-foreground/15" />
                      <div className="h-3 w-32 animate-pulse rounded-full bg-muted-foreground/10" />
                    </div>
                    <div className="flex gap-2" aria-hidden="true">
                      <div className="h-8 w-32 animate-pulse rounded-md bg-muted-foreground/15" />
                      <div className="h-8 w-24 animate-pulse rounded-md bg-muted-foreground/10" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <ManagementMetricCardsSkeleton
                    className="sm:grid-cols-2 xl:grid-cols-5"
                    count={5}
                  />
                  <ManagementMetricCardsSkeleton
                    className="sm:grid-cols-2 xl:grid-cols-5"
                    count={5}
                  />
                </CardContent>
              </Card>
              <ManagementDataCard count="Carregando" title="Cobranças que precisam de atenção">
                <ManagementTableSkeleton columns={8} rows={5} />
              </ManagementDataCard>
            </>
          ) : !activeLandlord ? (
            <ManagementState>
              Selecione um proprietário para visualizar o resumo.
            </ManagementState>
          ) : !dashboard ? (
            <ManagementState>Não foi possível carregar o resumo.</ManagementState>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  description="Carteira do proprietário"
                  icon={Building2}
                  title="Imóveis cadastrados"
                  value={dashboard.summary.totalAssets}
                />
                <MetricCard
                  description="Prontos para negociação"
                  icon={KeyRound}
                  title="Disponíveis"
                  tone="success"
                  value={dashboard.summary.availableAssets}
                />
                <MetricCard
                  description="Com contrato ativo"
                  icon={House}
                  title="Alugados"
                  tone="primary"
                  value={dashboard.summary.rentedAssets}
                />
                <MetricCard
                  description="Imóveis para venda"
                  icon={Store}
                  title="Para venda"
                  tone="neutral"
                  value={dashboard.summary.saleAssets}
                />
              </div>

              <Card className="overflow-hidden border-border/70 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.75)]">
                <CardHeader className="border-b bg-gradient-to-r from-primary/[0.08] via-card to-muted/50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BadgeDollarSign className="size-4 text-primary" />
                        Financeiro do mês
                      </CardTitle>
                      <CardDescription>
                        Competência{" "}
                        {String(
                          dashboard.summary.currentCompetenceMonth
                        ).padStart(2, "0")}
                        /{dashboard.summary.currentCompetenceYear}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          const params = new URLSearchParams({
                            month: String(
                              dashboard.summary.currentCompetenceMonth
                            ),
                            year: String(
                              dashboard.summary.currentCompetenceYear
                            ),
                          });

                          if (activeLandlord?.document) {
                            params.set(
                              "landlordDocument",
                              activeLandlord.document
                            );
                          }

                          params.set("tab", "cobrancas");

                          router.push(`/imobiliaria?${params.toString()}`);
                        }}
                        size="sm"
                        type="button"
                      >
                        <BadgeDollarSign className="size-4" />
                        Financeiro mensal
                      </Button>
                      <Button
                        onClick={() => router.push("/imobiliaria?tab=imoveis")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Ver imóveis
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                      description="Soma dos contratos ativos"
                      icon={ReceiptText}
                      title="Contratado"
                      value={formatCurrencyFromCents(
                        dashboard.summary.monthlyRentCents
                      )}
                    />
                    <MetricCard
                      description="Cobranças geradas no mês"
                      icon={BadgeDollarSign}
                      title="Cobrado"
                      value={formatCurrencyFromCents(
                        dashboard.summary.expectedChargesCents
                      )}
                    />
                    <MetricCard
                      description={`${dashboard.summary.paidCharges} cobrança(s) paga(s)`}
                      icon={TrendingUp}
                      title="Recebido"
                      tone="success"
                      value={formatCurrencyFromCents(
                        dashboard.summary.paidChargesCents
                      )}
                    />
                    <MetricCard
                      description={`${dashboard.summary.openCharges} cobrança(s) aberta(s)`}
                      icon={CircleDollarSign}
                      title="Em aberto"
                      tone="warning"
                      value={formatCurrencyFromCents(
                        dashboard.summary.openChargesCents
                      )}
                    />
                    <MetricCard
                      description={`${dashboard.summary.overdueCharges} cobrança(s) vencida(s)`}
                      icon={TrendingDown}
                      title="Vencido"
                      tone="danger"
                      value={formatCurrencyFromCents(
                        dashboard.summary.overdueChargesCents
                      )}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                      description="Cobranças abertas"
                      icon={CircleDollarSign}
                      title="Abertas"
                      tone="warning"
                      value={dashboard.summary.openCharges}
                    />
                    <MetricCard
                      description="Cobranças liquidadas"
                      icon={TrendingUp}
                      title="Pagas"
                      tone="success"
                      value={dashboard.summary.paidCharges}
                    />
                    <MetricCard
                      description="Exigem atenção"
                      icon={TrendingDown}
                      title="Vencidas"
                      tone="danger"
                      value={dashboard.summary.overdueCharges}
                    />
                    <MetricCard
                      description="Boletos pendentes"
                      icon={BadgeDollarSign}
                      title="Pendentes"
                      tone="neutral"
                      value={dashboard.summary.pendingTickets}
                    />
                    <MetricCard
                      description="Boletos operacionais"
                      icon={ReceiptText}
                      title="Boletos ativos"
                      tone="info"
                      value={dashboard.summary.activeTickets}
                    />
                  </div>
                </CardContent>
              </Card>

              <ManagementDataCard
                count={`${dashboard.charges.length} item(ns)`}
                title="Cobranças que precisam de atenção"
              >
                {dashboard.charges.length === 0 ? (
                  <ManagementState>
                    Nenhuma cobrança pendente, vencida ou com falha no momento.
                  </ManagementState>
                ) : (
                  <ManagementTableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Competência</TableHead>
                          <TableHead>Imóvel</TableHead>
                          <TableHead>Inquilino</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Cobrança</TableHead>
                          <TableHead>Boleto</TableHead>
                          <TableHead className="w-12 text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.charges.map((charge) => (
                          <TableRow key={charge.id}>
                            <TableCell className="font-medium">
                              {String(charge.competenceMonth).padStart(2, "0")}/
                              {charge.competenceYear}
                            </TableCell>
                            <TableCell className="max-w-64">
                              <p className="truncate font-medium">
                                {charge.assetCode
                                  ? `${charge.assetCode} · `
                                  : ""}
                                {charge.assetTitle}
                              </p>
                            </TableCell>
                            <TableCell className="max-w-56 truncate">
                              {charge.tenantName}
                            </TableCell>
                            <TableCell>{formatDate(charge.dueDate)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrencyFromCents(charge.totalAmountCents)}
                            </TableCell>
                            <TableCell>
                              <SemanticStatusBadge
                                tone={chargeStatusTones[charge.status]}
                              >
                                {chargeStatusLabels[charge.status]}
                              </SemanticStatusBadge>
                            </TableCell>
                            <TableCell>
                              <SemanticStatusBadge
                                tone={ticketStatusTones[charge.ticketStatus]}
                              >
                                {charge.ticketProviderStatus ||
                                  ticketStatusLabels[charge.ticketStatus]}
                              </SemanticStatusBadge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() =>
                                  pushWithReturnTab(
                                    `/imobiliaria/${charge.assetId}/financeiro`
                                  )
                                }
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

        <TabsContent value="imoveis" className="space-y-3">
          {isInitialLoading || isLoadingAssets ? (
            <>
              <ManagementFiltersSkeleton fields={3} />
              <ManagementDataCard count="Carregando" title="Imóveis">
                <ManagementTableSkeleton columns={10} rows={8} />
              </ManagementDataCard>
            </>
          ) : (
            <>
      <ManagementFilters className="gap-2 p-2.5 pl-4 shadow-sm before:inset-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <div className="w-full space-y-1 lg:w-56">
            <label className="text-xs font-medium text-muted-foreground">
              Tipo
            </label>
            <NativeSelect
              value={draftFilters.type}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
            >
              <NativeSelectOption value="all">Todos os tipos</NativeSelectOption>
              <NativeSelectOption value="house">Casa</NativeSelectOption>
              <NativeSelectOption value="apartment">Apartamento</NativeSelectOption>
              <NativeSelectOption value="office">Escritório</NativeSelectOption>
              <NativeSelectOption value="room">Sala</NativeSelectOption>
              <NativeSelectOption value="condominium">Condomínio</NativeSelectOption>
              <NativeSelectOption value="warehouse">Galpão</NativeSelectOption>
              <NativeSelectOption value="residential">Residencial</NativeSelectOption>
              <NativeSelectOption value="commercial">Comercial</NativeSelectOption>
              <NativeSelectOption value="land">Terreno</NativeSelectOption>
              <NativeSelectOption value="seasonal">Temporada</NativeSelectOption>
              <NativeSelectOption value="other">Outro</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="w-full space-y-1 lg:w-48">
            <label className="text-xs font-medium text-muted-foreground">
              Motivo
            </label>
            <NativeSelect
              value={draftFilters.motive}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  motive: event.target.value,
                }))
              }
            >
              <NativeSelectOption value="all">Todos os motivos</NativeSelectOption>
              <NativeSelectOption value="aluguel">Aluguel</NativeSelectOption>
              <NativeSelectOption value="venda">Venda</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="w-full space-y-1 lg:w-52">
            <label className="text-xs font-medium text-muted-foreground">
              Situação
            </label>
            <NativeSelect
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <NativeSelectOption value="all">Todas as situações</NativeSelectOption>
              <NativeSelectOption value="available">Disponível</NativeSelectOption>
              <NativeSelectOption value="rented">Alugado</NativeSelectOption>
              <NativeSelectOption value="renovation">Em reforma</NativeSelectOption>
              <NativeSelectOption value="sold">Vendido</NativeSelectOption>
              <NativeSelectOption value="inactive">Inativo</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex shrink-0 gap-2 lg:ml-auto">
            <Button
              className="h-8 min-w-24"
              onClick={() => {
                setAssetsPage(1);
                setAssetFilters({ ...draftFilters });
              }}
              type="button"
            >
              <Search className="size-4" />
              Filtrar
            </Button>
            <Button
              className="h-8 min-w-24"
              onClick={() => {
                const cleared = { type: "all", motive: "all", status: "all" };
                setDraftFilters(cleared);
                setAssetFilters(cleared);
                setAssetsPage(1);
              }}
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
        className="[&_[data-slot=card-content]]:space-y-3 [&_[data-slot=card-content]]:py-3 [&_[data-slot=card-header]]:py-3"
        count={`${totalAssets} imóvel(is)`}
        title="Imóveis"
      >
          {!activeLandlord ? (
            <ManagementState>
              Selecione um proprietário para visualizar os imóveis.
            </ManagementState>
          ) : assets.length === 0 ? (
            <ManagementState>
              Nenhum imóvel encontrado para o proprietário selecionado.
            </ManagementState>
          ) : (
            <>
            <ManagementTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Imóvel</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Fotos</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-12 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        {asset.code ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-72">
                        <p className="truncate font-medium">{asset.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {asset.bedrooms || "0"} quarto(s) ·{" "}
                          {asset.bathrooms || "0"} banheiro(s)
                        </p>
                      </TableCell>
                      <TableCell>
                        <AssetTypeBadge type={asset.type} />
                      </TableCell>
                      <TableCell>
                        <AssetMotiveBadge motive={asset.motive} />
                      </TableCell>
                      <TableCell>
                        <AssetStatusBadge status={asset.status} />
                      </TableCell>
                      <TableCell>
                        <SemanticStatusBadge tone={asset.contractStatus === "active" ? "success" : asset.contractStatus === "draft" ? "warning" : "neutral"}>
                          {asset.contractStatus === "active" ? "Ativo" : asset.contractStatus === "draft" ? "Rascunho" : asset.contractStatus === "ended" ? "Encerrado" : asset.contractStatus === "canceled" ? "Cancelado" : "Sem contrato"}
                        </SemanticStatusBadge>
                      </TableCell>
                      <TableCell className="max-w-72 truncate">
                        {asset.address || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <Images className="size-4 text-muted-foreground" />
                          {asset.photosCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {asset.rentAmount || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AssetActions
                          canDelete={
                            !["alugado", "rented"].includes(
                              normalizeBadgeValue(asset.status)
                            )
                          }
                          onContracts={() =>
                            pushWithReturnTab(
                              `/imobiliaria/${asset.id}/contratos`,
                              "imoveis"
                            )
                          }
                          onDocuments={() =>
                            pushWithReturnTab(
                              `/imobiliaria/${asset.id}/documentos`,
                              "imoveis"
                            )
                          }
                          onFinance={() =>
                            pushWithReturnTab(
                              `/imobiliaria/${asset.id}/financeiro`,
                              "imoveis"
                            )
                          }
                          onEdit={() =>
                            pushWithReturnTab(
                              `/imobiliaria/novo?id=${asset.id}`,
                              "imoveis"
                            )
                          }
                          onDelete={() => setAssetToDelete(asset)}
                          onPhotos={() =>
                            pushWithReturnTab(
                              `/imobiliaria/${asset.id}/fotos`,
                              "imoveis"
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ManagementTableFrame>
            <ManagementPagination
              isLoading={isLoadingAssets}
              itemLabel="imóvel(is)"
              onPageChange={setAssetsPage}
              page={assetsPage}
              pageSize={8}
              total={totalAssets}
              visible={assets.length}
            />
            </>
          )}
      </ManagementDataCard>
            </>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-5">
          {isInitialLoading || isLoadingDashboard ? (
            <>
              <ManagementMetricCardsSkeleton count={4} />
              <ManagementFiltersSkeleton fields={2} />
              <ManagementDataCard count="Carregando" title="Agenda operacional">
                <ManagementTableSkeleton columns={7} rows={6} />
              </ManagementDataCard>
            </>
          ) : !activeLandlord ? (
            <ManagementState>
              Selecione um proprietário para visualizar a agenda.
            </ManagementState>
          ) : !dashboard ? (
            <ManagementState>Não foi possível carregar a agenda.</ManagementState>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  description="Pendências operacionais"
                  icon={CalendarDays}
                  title="Agenda"
                  value={agendaSummary.total}
                />
                <MetricCard
                  description="Exigem ação rápida"
                  icon={AlertTriangle}
                  title="Prioridade alta"
                  tone={agendaSummary.high > 0 ? "danger" : "neutral"}
                  value={agendaSummary.high}
                />
                <MetricCard
                  description="Cobranças e boletos"
                  icon={BadgeDollarSign}
                  title="Financeiro"
                  tone="warning"
                  value={agendaSummary.financial}
                />
                <MetricCard
                  description="Contratos, documentos e reajustes"
                  icon={ClipboardList}
                  title="Contratos"
                  tone="primary"
                  value={agendaSummary.contracts}
                />
              </div>

              <ManagementFilters className="gap-2 p-2.5 pl-4 shadow-sm before:inset-y-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
                  <div className="w-full space-y-1 lg:w-72">
                    <label className="text-xs font-medium text-muted-foreground">
                      Tipo
                    </label>
                    <NativeSelect
                      onChange={(event) =>
                        setAgendaFilters((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                      value={agendaFilters.type}
                    >
                      <NativeSelectOption value="all">Todos os tipos</NativeSelectOption>
                      {Object.entries(agendaTypeLabels).map(([value, label]) => (
                        <NativeSelectOption key={value} value={value}>
                          {label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="w-full space-y-1 lg:w-48">
                    <label className="text-xs font-medium text-muted-foreground">
                      Prioridade
                    </label>
                    <NativeSelect
                      onChange={(event) =>
                        setAgendaFilters((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                      value={agendaFilters.priority}
                    >
                      <NativeSelectOption value="all">Todas</NativeSelectOption>
                      <NativeSelectOption value="high">Alta</NativeSelectOption>
                      <NativeSelectOption value="medium">Média</NativeSelectOption>
                      <NativeSelectOption value="low">Baixa</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className="flex shrink-0 gap-2 lg:ml-auto">
                    <Button
                      className="h-8 min-w-24"
                      onClick={() =>
                        setAgendaFilters({ type: "all", priority: "all" })
                      }
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
                count={`${filteredAgenda.length} item(ns)`}
                title="Agenda operacional"
              >
                {filteredAgenda.length === 0 ? (
                  <ManagementState>
                    Nenhuma pendência encontrada para os filtros selecionados.
                  </ManagementState>
                ) : (
                  <ManagementTableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Imóvel</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead className="w-12 text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAgenda.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {formatDate(item.date)}
                            </TableCell>
                            <TableCell>
                              <SemanticStatusBadge
                                tone={
                                  item.type === "ticket_failed" ||
                                  item.type === "charge_overdue"
                                    ? "danger"
                                    : item.type === "ticket_registering"
                                      ? "progress"
                                      : "info"
                                }
                              >
                                {agendaTypeLabels[item.type]}
                              </SemanticStatusBadge>
                            </TableCell>
                            <TableCell className="max-w-64">
                              <p className="truncate font-medium">
                                {item.assetCode ? `${item.assetCode} · ` : ""}
                                {item.assetTitle}
                              </p>
                            </TableCell>
                            <TableCell className="max-w-52 truncate">
                              {item.tenantName ?? "-"}
                            </TableCell>
                            <TableCell className="max-w-96">
                              <p className="font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.description}
                              </p>
                            </TableCell>
                            <TableCell>
                              <SemanticStatusBadge
                                tone={agendaPriorityTones[item.priority]}
                              >
                                {agendaPriorityLabels[item.priority]}
                              </SemanticStatusBadge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() =>
                                  pushWithReturnTab(item.actionHref, "agenda")
                                }
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {item.actionLabel}
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

        <TabsContent value="cobrancas" className="space-y-3">
          {!activeLandlord ? (
            <ManagementState>
              Selecione um proprietário para visualizar o financeiro mensal.
            </ManagementState>
          ) : (
            <RealEstateMonthlyChargesManagement
              key={activeLandlord.document}
              embedded
              landlordDocument={activeLandlord.document}
            />
          )}
        </TabsContent>

        <TabsContent value="configuracoes" className="space-y-3">
          <RealEstateContractModelsSettings />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(assetToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingAsset) {
            setAssetToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imóvel?</AlertDialogTitle>
            <AlertDialogDescription>
              O imóvel “{assetToDelete?.title}”, seu contrato de aluguel e os
              arquivos associados serão excluídos permanentemente. Esta ação
              não pode ser desfeita. Imóveis com contrato ativo ou cobranças
              vinculadas não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isDeletingAsset}>
              Cancelar
            </AlertDialogClose>
            <AlertDialogAction
              disabled={isDeletingAsset}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteAsset();
              }}
            >
              {isDeletingAsset ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Excluir imóvel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </ManagementPage>
  );
}
