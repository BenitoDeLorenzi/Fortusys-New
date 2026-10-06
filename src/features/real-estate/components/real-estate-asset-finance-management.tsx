"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Eye,
  ExternalLink,
  History,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { FormPageHeader } from "@/components/management/form-page-header";
import {
  ManagementDataCard,
  ManagementFilters,
  ManagementMetricCardsSkeleton,
  ManagementTableSkeleton,
  ManagementPage,
  ManagementPagination,
  ManagementState,
  ManagementTableFrame,
} from "@/components/management/management-layout";
import {
  SemanticStatusBadge,
  type StatusTone,
} from "@/components/management/semantic-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { protestOptions, usesProtestDays, getTicketPenaltyFields, type TicketPenaltyOptions } from "@/features/billing/ticket-options";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  RealEstateCharge,
  RealEstateChargeItemType,
  RealEstateChargesResponse,
} from "@/features/real-estate/charges";
import { RealEstateMetricCard as MetricCard } from "@/features/real-estate/components/real-estate-metric-card";
import { createClient } from "@/lib/supabase/client";

type RealEstateAssetFinanceManagementProps = {
  assetId: string;
  inlineAction?: {
    kind: "create" | "edit" | "ticket" | "print";
    chargeId: string | null;
    leaseId: string;
    month: number;
    year: number;
    dueDate: string | null;
  };
  onActionClose?: () => void;
};

const returnTabs = ["resumo", "imoveis", "agenda", "cobrancas"] as const;

function getReturnTab(value?: string | null) {
  return returnTabs.includes(value as (typeof returnTabs)[number])
    ? value
    : "imoveis";
}

type Filters = {
  search: string;
  status: string;
  ticketStatus: string;
};

type ChargeForm = {
  competenceMonth: string;
  competenceYear: string;
  dueDate: string;
  rentAmount: string;
  iptu: string;
  condominium: string;
  reserveFund: string;
  water: string;
  energy: string;
  trash: string;
  gas: string;
  otherDescription: string;
  otherAmount: string;
  discountAmount: string;
  notes: string;
};

type TicketDialogData = {
  charge: {
    id: string;
    competence: string;
    dueDate: string;
    totalAmountCents: number;
    ticketStatus: string;
  };
  asset: {
    id: string;
    code: number | null;
    title: string;
    assignorDocument: string;
  };
  lease: {
    id: string;
    code: number | null;
    contractNumber: string | null;
  };
  payer: {
    id: string;
    name: string;
    document: string;
  };
  items: Array<{
    type: string;
    description: string | null;
    amountCents: number;
    label: string;
  }>;
  accounts: Array<{
    id: string;
    label: string;
    bankCode: string;
    accountNumber: string;
    accountDigit: string | null;
    agreements: Array<{
      id: string;
      label: string;
      number: string | null;
      wallet: string | null;
    }>;
  }>;
};

type TicketHistoryData = {
  integrationId: string | null;
  status: string | null;
  documentNumber: string | null;
  ourNumber: string | null;
  payerName: string | null;
  payerDocument: string | null;
  payerPhone: string | null;
  payerEmail: string | null;
  dueDate: string | null;
  amount: string | null;
  boletoUrl: string | null;
  pixUrl: string | null;
  digitableLine: string | null;
  failureMessage: string | null;
  movements: Array<{
    code: string;
    message: string;
    date: string;
    origin: string | null;
  }>;
  occurrences: Array<{
    code: string;
    message: string;
    date: string | null;
  }>;
  attempts: Array<{
    id: string;
    integrationId: string | null;
    status: string | null;
    isActive: boolean;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

const pageSize = 8;

type SheetMode = "create" | "view" | "edit";

const monthLabels = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const statusLabels: Record<RealEstateCharge["status"], string> = {
  open: "Em aberto",
  paid: "Pago",
  overdue: "Vencido",
  canceled: "Cancelado",
};

const statusTones: Record<RealEstateCharge["status"], StatusTone> = {
  open: "warning",
  paid: "success",
  overdue: "overdue",
  canceled: "danger",
};

const ticketStatusLabels: Record<RealEstateCharge["ticketStatus"], string> = {
  not_generated: "Não gerado",
  registering: "Registrando",
  registered: "Registrado",
  failed: "Falhou",
  canceled: "Cancelado",
};

const ticketStatusTones: Record<RealEstateCharge["ticketStatus"], StatusTone> = {
  not_generated: "neutral",
  registering: "progress",
  registered: "success",
  failed: "danger",
  canceled: "danger",
};

const providerTicketStatusLabels: Record<string, string> = {
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
  BAIXA_SOLICITADA: "Baixa solicitada",
  DESCARTADO: "Descartado",
};

const providerTicketStatusTones: Record<string, StatusTone> = {
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
  BAIXA_SOLICITADA: "neutral",
  DESCARTADO: "neutral",
};

function normalizeProviderStatus(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isCanceledTicketProviderStatus(value?: string | null) {
  const providerStatus = normalizeProviderStatus(value);

  return (
    providerStatus.includes("BAIX") ||
    providerStatus.includes("CANCEL") ||
    providerStatus.includes("DESCART") ||
    providerStatus.includes("FALHA") ||
    providerStatus.includes("REJEIT")
  );
}

function getTicketStatusLabel(charge: RealEstateCharge) {
  const providerStatus = normalizeProviderStatus(charge.ticketProviderStatus);

  if (providerStatus) {
    return providerTicketStatusLabels[providerStatus] ?? charge.ticketProviderStatus;
  }

  return ticketStatusLabels[charge.ticketStatus];
}

function getTicketStatusTone(charge: RealEstateCharge): StatusTone {
  const providerStatus = normalizeProviderStatus(charge.ticketProviderStatus);

  if (providerStatus) {
    return (
      providerTicketStatusTones[providerStatus] ??
      ticketStatusTones[charge.ticketStatus]
    );
  }

  return ticketStatusTones[charge.ticketStatus];
}

function getTicketFailureMessage(charge: RealEstateCharge) {
  return charge.ticketErrorMessage?.trim() ||
    (["FALHA", "REJEITADO"].includes(normalizeProviderStatus(charge.ticketProviderStatus))
      ? "O banco/TecnoSpeed ainda não informou o motivo. Atualize a consulta ou confira o histórico do boleto."
      : null);
}

function canDeleteCharge(charge: RealEstateCharge) {
  return !charge.hasTicketAttempts && charge.status !== "paid";
}

function canRequestTicketDischarge(charge: RealEstateCharge) {
  const providerStatus = normalizeProviderStatus(charge.ticketProviderStatus);

  if (!charge.ticketIntegrationId || !charge.ticketAssignorDocument) {
    return false;
  }

  if (charge.status === "paid" || charge.status === "canceled") {
    return false;
  }

  if (
    ["LIQUIDADO", "PAGO"].includes(providerStatus) ||
    isCanceledTicketProviderStatus(providerStatus)
  ) {
    return false;
  }

  return providerStatus === "REGISTRADO";
}

function canDiscardTicket(charge: RealEstateCharge) {
  const providerStatus = normalizeProviderStatus(charge.ticketProviderStatus);

  if (!charge.ticketIntegrationId || !charge.ticketAssignorDocument) {
    return false;
  }

  if (charge.status === "paid" || charge.status === "canceled") {
    return false;
  }

  return ["EMITIDO", "FALHA", "REJEITADO"].includes(providerStatus);
}

function hasActiveTicketForActions(charge: RealEstateCharge) {
  const providerStatus = normalizeProviderStatus(charge.ticketProviderStatus);

  if (!charge.ticketIntegrationId) {
    return false;
  }

  if (isCanceledTicketProviderStatus(providerStatus)) {
    return false;
  }

  return ["registering", "registered"].includes(charge.ticketStatus);
}

function canEditCharge(charge: RealEstateCharge) {
  return (
    !hasActiveTicketForActions(charge) &&
    charge.status !== "paid" &&
    charge.status !== "canceled"
  );
}

function formatCurrencyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function moneyTextToCents(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function getWhatsAppPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  return `55${digits}`;
}

function buildWhatsAppUrl(phone: string, message: string) {
  const params = new URLSearchParams({ text: message });

  if (phone) {
    return `https://wa.me/${phone}?${params.toString()}`;
  }

  return `https://web.whatsapp.com/send?${params.toString()}`;
}

function getChargeWhatsAppMessage(
  charge: RealEstateCharge,
  options?: {
    ticketUrl?: string | null;
    digitableLine?: string | null;
  }
) {
  const ticketUrl = options?.ticketUrl ?? charge.ticketUrl;
  const digitableLine = options?.digitableLine ?? charge.ticketDigitableLine;

  return [
    `Olá${charge.tenantName ? `, ${charge.tenantName}` : ""}!`,
    "Segue o boleto para pagamento.",
    `Documento: ${charge.ticketDocumentNumber ?? "-"}`,
    `Vencimento: ${formatDate(charge.dueDate)}`,
    `Valor: ${formatCurrencyFromCents(charge.totalAmountCents)}`,
    ticketUrl ? `Boleto: ${ticketUrl}` : null,
    digitableLine ? `Linha digitável: ${digitableLine}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function getDueDate(competenceMonth: number, competenceYear: number, dueDay = 10) {
  const normalizedDay = Math.min(Math.max(dueDay, 1), 28);
  const date = new Date(competenceYear, competenceMonth, normalizedDay);

  return date.toISOString().slice(0, 10);
}

function getDefaultForm(data?: RealEstateChargesResponse | null): ChargeForm {
  const now = new Date();
  const competenceMonth = now.getMonth() + 1;
  const competenceYear = now.getFullYear();

  return {
    competenceMonth: String(competenceMonth),
    competenceYear: String(competenceYear),
    dueDate: getDueDate(
      competenceMonth,
      competenceYear,
      data?.activeContract?.paymentDueDay ?? 10
    ),
    rentAmount: data?.activeContract
      ? formatCurrencyFromCents(data.activeContract.rentAmountCents)
      : "",
    iptu: "",
    condominium: "",
    reserveFund: "",
    water: "",
    energy: "",
    trash: "",
    gas: "",
    otherDescription: "",
    otherAmount: "",
    discountAmount: "",
    notes: "",
  };
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getChargeItemsCount(charge: RealEstateCharge) {
  return charge.items.filter((item) => item.type !== "rent").length;
}

function getChargeItemAmount(charge: RealEstateCharge, type: RealEstateChargeItemType) {
  return charge.items
    .filter((item) => item.type === type)
    .reduce((total, item) => total + item.amountCents, 0);
}

function getChargeOtherDescription(charge: RealEstateCharge) {
  return (
    charge.items.find((item) => item.type === "other")?.description ?? ""
  );
}

function getFormFromCharge(charge: RealEstateCharge): ChargeForm {
  return {
    competenceMonth: String(charge.competenceMonth),
    competenceYear: String(charge.competenceYear),
    dueDate: charge.dueDate,
    rentAmount: formatCurrencyFromCents(charge.rentAmountCents),
    iptu: formatOptionalCurrency(getChargeItemAmount(charge, "iptu")),
    condominium: formatOptionalCurrency(getChargeItemAmount(charge, "condominium")),
    reserveFund: formatOptionalCurrency(getChargeItemAmount(charge, "reserve_fund")),
    water: formatOptionalCurrency(getChargeItemAmount(charge, "water")),
    energy: formatOptionalCurrency(getChargeItemAmount(charge, "energy")),
    trash: formatOptionalCurrency(getChargeItemAmount(charge, "trash")),
    gas: formatOptionalCurrency(getChargeItemAmount(charge, "gas")),
    otherDescription: getChargeOtherDescription(charge),
    otherAmount: formatOptionalCurrency(getChargeItemAmount(charge, "other")),
    discountAmount: formatOptionalCurrency(charge.discountAmountCents),
    notes: charge.notes ?? "",
  };
}

function formatOptionalCurrency(value: number) {
  return value > 0 ? formatCurrencyFromCents(value) : "";
}

export function RealEstateAssetFinanceManagement({
  assetId,
  inlineAction,
  onActionClose,
}: RealEstateAssetFinanceManagementProps) {
  const actionStarted = useRef(false);
  const [actionReady, setActionReady] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTab = getReturnTab(searchParams.get("returnTab"));
  const [data, setData] = useState<RealEstateChargesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [selectedCharge, setSelectedCharge] = useState<RealEstateCharge | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRequestingDischarge, setIsRequestingDischarge] = useState(false);
  const [isDiscardingTicket, setIsDiscardingTicket] = useState(false);
  const [cancelCandidate, setCancelCandidate] =
    useState<RealEstateCharge | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<RealEstateCharge | null>(null);
  const [dischargeCandidate, setDischargeCandidate] =
    useState<RealEstateCharge | null>(null);
  const [ticketHistory, setTicketHistory] = useState<TicketHistoryData | null>(
    null
  );
  const [isLoadingTicketHistory, setIsLoadingTicketHistory] = useState(false);
  const [ticketGeneratingId, setTicketGeneratingId] = useState<string | null>(null);
  const [ticketDialogCharge, setTicketDialogCharge] =
    useState<RealEstateCharge | null>(null);
  const [ticketDialogData, setTicketDialogData] =
    useState<TicketDialogData | null>(null);
  const [isLoadingTicketDialog, setIsLoadingTicketDialog] = useState(false);
  const [selectedTicketAccountId, setSelectedTicketAccountId] = useState("");
  const [selectedTicketAgreementId, setSelectedTicketAgreementId] = useState("");
  const [ticketProtestCode, setTicketProtestCode] = useState("3");
  const [ticketProtestDays, setTicketProtestDays] = useState("");
  const [ticketIsHybrid, setTicketIsHybrid] = useState(false);
  const [ticketPenalties, setTicketPenalties] = useState<TicketPenaltyOptions>({
    interestCode: "2", interestDate: "", interestValue: "0,03",
    fineCode: "2", fineDate: "", fineValue: "10,00",
  });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "all",
    ticketStatus: "all",
  });
  const [draftFilters, setDraftFilters] = useState<Filters>({
    search: "",
    status: "all",
    ticketStatus: "all",
  });
  const [form, setForm] = useState<ChargeForm>(() => getDefaultForm());

  const loadFinance = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      const response = await fetch(`/api/real-estate/assets/${assetId}/charges`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | RealEstateChargesResponse
        | { message?: string };

      if (!response.ok || !("charges" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar o financeiro."
        );
      }

      setData(payload);
      setLastUpdatedAt(new Date());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o financeiro."
      );
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [assetId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFinance();
  }, [loadFinance]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`real-estate-finance-${assetId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "real_estate_charges",
          filter: `asset_id=eq.${assetId}`,
        },
        () => {
          void loadFinance({ silent: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "real_estate_charge_tickets",
        },
        () => {
          void loadFinance({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [assetId, loadFinance]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadFinance({ silent: true });
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [loadFinance]);

  const filteredCharges = useMemo(() => {
    const search = normalizeSearch(filters.search);

    return (data?.charges ?? []).filter((charge) => {
      const competence = `${String(charge.competenceMonth).padStart(2, "0")}/${
        charge.competenceYear
      }`;
      const haystack = normalizeSearch(
        [
          competence,
          charge.tenantName,
          charge.tenantDocument,
          charge.contractNumber,
          charge.contractCode ? String(charge.contractCode) : "",
          statusLabels[charge.status],
          getTicketStatusLabel(charge),
          charge.ticketProviderStatus,
        ].join(" ")
      );
      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus =
        filters.status === "all" || charge.status === filters.status;
      const matchesTicket =
        filters.ticketStatus === "all" ||
        charge.ticketStatus === filters.ticketStatus;

      return matchesSearch && matchesStatus && matchesTicket;
    });
  }, [data?.charges, filters]);

  const financeSummary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentCharges = (data?.charges ?? []).filter(
      (charge) =>
        charge.competenceMonth === currentMonth &&
        charge.competenceYear === currentYear
    );

    return {
      currentMonth,
      currentYear,
      expectedAmountCents: currentCharges
        .filter((charge) => charge.status !== "canceled")
        .reduce((total, charge) => total + charge.totalAmountCents, 0),
      openAmountCents: currentCharges
        .filter((charge) => charge.status === "open" || charge.status === "overdue")
        .reduce((total, charge) => total + charge.totalAmountCents, 0),
      paidAmountCents: currentCharges
        .filter((charge) => charge.status === "paid")
        .reduce((total, charge) => total + charge.totalAmountCents, 0),
      overdueCount: currentCharges.filter((charge) => charge.status === "overdue")
        .length,
      activeTicketCount: currentCharges.filter(hasActiveTicketForActions).length,
    };
  }, [data?.charges]);

  const safePage = Math.min(
    Math.max(page, 1),
    Math.max(1, Math.ceil(filteredCharges.length / pageSize))
  );
  const paginatedCharges = filteredCharges.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  function updateForm<K extends keyof ChargeForm>(key: K, value: ChargeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateMoneyField(key: keyof ChargeForm, value: string) {
    updateForm(key, formatMoneyInput(value));
  }

  function openNewChargeSheet() {
    if (!data?.activeContract) {
      toast.warning("Este imóvel não possui contrato ativo para gerar cobrança.");
      return;
    }

    setSheetMode("create");
    setSelectedCharge(null);
    setForm(getDefaultForm(data));
    setIsSheetOpen(true);
  }

  function openViewChargeSheet(charge: RealEstateCharge) {
    setSelectedCharge(charge);
    setSheetMode("view");
    setForm(getFormFromCharge(charge));
    setIsSheetOpen(true);
  }

  function openEditChargeSheet(charge: RealEstateCharge) {
    if (!canEditCharge(charge)) {
      toast.warning(
        "Esta cobrança não pode ser editada enquanto houver boleto ativo ou status finalizado."
      );
      return;
    }

    setSelectedCharge(charge);
    setSheetMode("edit");
    setForm(getFormFromCharge(charge));
    setIsSheetOpen(true);
  }

  function handleCompetenceChange(month: string, year = form.competenceYear) {
    const competenceMonth = Number(month);
    const competenceYear = Number(year);
    updateForm("competenceMonth", month);

    if (Number.isInteger(competenceMonth) && Number.isInteger(competenceYear)) {
      updateForm(
        "dueDate",
        getDueDate(
          competenceMonth,
          competenceYear,
          data?.activeContract?.paymentDueDay ?? 10
        )
      );
    }
  }

  function handleYearChange(year: string) {
    updateForm("competenceYear", year);
    handleCompetenceChange(form.competenceMonth, year);
  }

  async function createCharge() {
    if (!data?.activeContract) {
      toast.warning("Este imóvel não possui contrato ativo.");
      return;
    }

    const itemMapSource: Array<{
      type: RealEstateChargeItemType;
      description: string;
      amount: string;
    }> = [
      { type: "iptu", description: "IPTU", amount: form.iptu },
      { type: "condominium", description: "Condomínio", amount: form.condominium },
      {
        type: "reserve_fund",
        description: "Fundo reserva",
        amount: form.reserveFund,
      },
      { type: "water", description: "Água", amount: form.water },
      { type: "energy", description: "Energia", amount: form.energy },
      { type: "trash", description: "Lixo", amount: form.trash },
      { type: "gas", description: "Gás", amount: form.gas },
      {
        type: "other",
        description: form.otherDescription || "Outros",
        amount: form.otherAmount,
      },
    ];
    const itemMap = itemMapSource.filter(
      (item) => moneyTextToCents(item.amount) > 0
    );

    setIsSaving(true);

    try {
      const response = await fetch(`/api/real-estate/assets/${assetId}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competenceMonth: Number(form.competenceMonth),
          competenceYear: Number(form.competenceYear),
          dueDate: form.dueDate,
          rentAmount: form.rentAmount,
          discountAmount: form.discountAmount,
          notes: form.notes,
          items: itemMap,
        }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível criar a cobrança.");
      }

      toast.success("Cobrança interna criada");
      setIsSheetOpen(false);
      setPage(1);
      await loadFinance();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a cobrança."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function getFormItems() {
    const itemMapSource: Array<{
      type: RealEstateChargeItemType;
      description: string;
      amount: string;
    }> = [
      { type: "iptu", description: "IPTU", amount: form.iptu },
      { type: "condominium", description: "Condomínio", amount: form.condominium },
      {
        type: "reserve_fund",
        description: "Fundo reserva",
        amount: form.reserveFund,
      },
      { type: "water", description: "Água", amount: form.water },
      { type: "energy", description: "Energia", amount: form.energy },
      { type: "trash", description: "Lixo", amount: form.trash },
      { type: "gas", description: "Gás", amount: form.gas },
      {
        type: "other",
        description: form.otherDescription || "Outros",
        amount: form.otherAmount,
      },
    ];

    return itemMapSource.filter((item) => moneyTextToCents(item.amount) > 0);
  }

  async function updateCharge() {
    if (!selectedCharge) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/real-estate/charges/${selectedCharge.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            competenceMonth: Number(form.competenceMonth),
            competenceYear: Number(form.competenceYear),
            dueDate: form.dueDate,
            rentAmount: form.rentAmount,
            discountAmount: form.discountAmount,
            notes: form.notes,
            items: getFormItems(),
          }),
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível atualizar a cobrança.");
      }

      toast.success("Cobrança atualizada");
      setIsSheetOpen(false);
      setSelectedCharge(null);
      await loadFinance();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a cobrança."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelCharge() {
    if (!cancelCandidate) {
      return;
    }

    const charge = cancelCandidate;

    if (hasActiveTicketForActions(charge)) {
      toast.warning(
        "Esta cobrança possui boleto ativo. Solicite baixa ou descarte o boleto antes de cancelar."
      );
      setCancelCandidate(null);
      return;
    }

    setIsCanceling(true);

    try {
      const response = await fetch(`/api/real-estate/charges/${charge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error("message" in payload ? payload.message : "Não foi possível preparar a emissão do boleto.");
      }

      toast.success("Cobrança cancelada");
      setCancelCandidate(null);
      await loadFinance();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível cancelar a cobrança."
      );
    } finally {
      setIsCanceling(false);
    }
  }

  async function deleteCharge() {
    if (!deleteCandidate) {
      return;
    }

    if (!canDeleteCharge(deleteCandidate)) {
      toast.warning("Esta cobrança não pode ser excluída neste status.");
      setDeleteCandidate(null);
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/real-estate/charges/${deleteCandidate.id}`,
        {
          method: "DELETE",
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível excluir a cobrança.");
      }

      toast.success("Cobrança excluída");
      setDeleteCandidate(null);
      await loadFinance();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a cobrança."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function openTicketDialog(charge: RealEstateCharge) {
    const startDate = new Date(charge.dueDate + "T00:00:00Z");
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    const penaltyDate = startDate.toISOString().slice(0, 10);
    setTicketPenalties({
      interestCode: "2", interestDate: penaltyDate, interestValue: "0,03",
      fineCode: "2", fineDate: penaltyDate, fineValue: "10,00",
    });
    setTicketProtestCode("3");
    setTicketProtestDays("");
    setTicketIsHybrid(false);
    setTicketDialogCharge(charge);
    setTicketDialogData(null);
    setSelectedTicketAccountId("");
    setSelectedTicketAgreementId("");
    setIsLoadingTicketDialog(true);

    try {
      const response = await fetch(`/api/real-estate/charges/${charge.id}/ticket`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as TicketDialogData | { message?: string };

      if (!response.ok || !("accounts" in payload)) {
        throw new Error("message" in payload ? payload.message : "Não foi possível preparar a emissão do boleto.");
      }

      const firstAccount = payload.accounts[0];
      setTicketDialogData(payload);
      setSelectedTicketAccountId(firstAccount?.id ?? "");
      setSelectedTicketAgreementId(firstAccount?.agreements[0]?.id ?? "");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível gerar o boleto."
      );
      setTicketDialogCharge(null);
      setTicketDialogData(null);
    } finally {
      setIsLoadingTicketDialog(false);
    }
  }

  async function generateTicket() {
    if (!ticketDialogCharge) {
      return;
    }

    if (!selectedTicketAccountId || !selectedTicketAgreementId) {
      toast.warning("Selecione a conta e o convênio para gerar o boleto.");
      return;
    }

    if (usesProtestDays(ticketProtestCode) && (!/^\d{1,2}$/.test(ticketProtestDays) || Number(ticketProtestDays) < 1)) {
      toast.warning("Informe um prazo de protesto entre 1 e 99 dias.");
      return;
    }
    setTicketGeneratingId(ticketDialogCharge.id);

    try {
      getTicketPenaltyFields(ticketPenalties);
      const response = await fetch(
        `/api/real-estate/charges/${ticketDialogCharge.id}/ticket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: selectedTicketAccountId,
            agreementId: selectedTicketAgreementId,
            protestCode: ticketProtestCode,
            protestDays: ticketProtestDays,
            isHybrid: ticketIsHybrid,
            ...ticketPenalties,
          }),
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível gerar o boleto.");
      }

      toast.success("Boleto enviado para registro");
      setTicketDialogCharge(null);
      setTicketDialogData(null);
      await loadFinance();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível gerar o boleto."
      );
      await loadFinance();
    } finally {
      setTicketGeneratingId(null);
    }
  }

  async function getTicketHistory(charge: RealEstateCharge) {
    const response = await fetch(
      `/api/real-estate/charges/${charge.id}/ticket/history`,
      { cache: "no-store" }
    );
    const payload = (await response.json()) as
      | { ticket: TicketHistoryData }
      | { message?: string };

    if (!response.ok || !("ticket" in payload)) {
      throw new Error(
        "message" in payload
          ? payload.message
          : "Não foi possível carregar o histórico."
      );
    }

    return payload.ticket;
  }

  async function getTicketPrintUrl(charge: RealEstateCharge) {
    if (!charge.ticketIntegrationId || !charge.ticketAssignorDocument) {
      return null;
    }

    const response = await fetch("/api/billing/tickets/print", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignorDocument: charge.ticketAssignorDocument,
        integrationIds: [charge.ticketIntegrationId],
      }),
    });
    const payload = (await response.json()) as {
      message?: string;
      printUrl?: string;
    };

    if (!response.ok || !payload.printUrl) {
      throw new Error(payload.message ?? "Não foi possível solicitar a impressão.");
    }

    return payload.printUrl;
  }

  async function viewTicket(charge: RealEstateCharge) {
    if (charge.ticketUrl) {
      window.open(charge.ticketUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const printUrl = await getTicketPrintUrl(charge);

      if (!printUrl) {
        toast.warning("Boleto indisponível");
        return;
      }

      window.open(printUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir o boleto."
      );
    }
  }

  async function viewTicketQrCode(charge: RealEstateCharge) {
    if (charge.ticketPixUrl) {
      window.open(charge.ticketPixUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const history = await getTicketHistory(charge);

      if (!history.pixUrl) {
        toast.warning("QR Code indisponível");
        return;
      }

      window.open(history.pixUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir o QR Code."
      );
    }
  }

  async function sendTicketWhatsApp(charge: RealEstateCharge) {
    let ticketUrl = charge.ticketUrl;
    let digitableLine = charge.ticketDigitableLine;

    try {
      if (!ticketUrl || !digitableLine) {
        const history = await getTicketHistory(charge).catch(() => null);
        ticketUrl = ticketUrl ?? history?.boletoUrl ?? null;
        digitableLine = digitableLine ?? history?.digitableLine ?? null;
      }

      if (!ticketUrl && charge.ticketIntegrationId) {
        ticketUrl = await getTicketPrintUrl(charge);
      }

      if (!ticketUrl && !digitableLine) {
        toast.warning("Boleto indisponível para envio");
        return;
      }

      window.open(
        buildWhatsAppUrl(
          getWhatsAppPhone(charge.tenantPhone),
          getChargeWhatsAppMessage(charge, { ticketUrl, digitableLine })
        ),
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o envio por WhatsApp."
      );
    }
  }

  async function requestTicketDischarge() {
    if (!dischargeCandidate) {
      return;
    }

    const charge = dischargeCandidate;

    if (!canRequestTicketDischarge(charge)) {
      toast.warning("Boleto não pode receber baixa", {
        description: "Só é possível solicitar baixa de boletos registrados.",
      });
      setDischargeCandidate(null);
      return;
    }

    setIsRequestingDischarge(true);

    try {
      const response = await fetch(
        `/api/real-estate/charges/${charge.id}/ticket/discharge`,
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível solicitar a baixa.");
      }

      toast.success("Pedido de baixa solicitado", {
        description:
          payload.message ?? "A solicitação foi enviada para a TecnoSpeed.",
      });
      setDischargeCandidate(null);
      await loadFinance();
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

  async function discardTicket(charge: RealEstateCharge) {
    if (!canDiscardTicket(charge)) {
      toast.warning("Boleto não pode ser descartado", {
        description: "Só é possível descartar boletos emitidos, com falha ou rejeitados.",
      });
      return;
    }

    if (!window.confirm("Deseja descartar este boleto na TecnoSpeed?")) {
      return;
    }

    setIsDiscardingTicket(true);

    try {
      const response = await fetch(
        `/api/real-estate/charges/${charge.id}/ticket/discard`,
        { method: "POST" }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível descartar o boleto.");
      }

      toast.success("Boleto descartado", {
        description:
          payload.message ?? "A cobrança foi liberada para novo boleto.",
      });
      await loadFinance();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível descartar o boleto."
      );
    } finally {
      setIsDiscardingTicket(false);
    }
  }

  async function openTicketHistory(charge: RealEstateCharge) {
    if (!charge.ticketIntegrationId && !charge.ticketProviderStatus) {
      toast.warning("Esta cobrança ainda não possui histórico de boleto.");
      return;
    }

    setIsLoadingTicketHistory(true);

    try {
      const response = await fetch(
        `/api/real-estate/charges/${charge.id}/ticket/history`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as
        | { ticket: TicketHistoryData }
        | { message?: string };

      if (!response.ok || !("ticket" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar o histórico."
        );
      }

      setTicketHistory(payload.ticket);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o histórico."
      );
    } finally {
      setIsLoadingTicketHistory(false);
    }
  }

  const activeContract = data?.activeContract;
  const isReadOnlySheet = sheetMode === "view";
  const sheetContractCode =
    selectedCharge?.contractCode ?? activeContract?.code ?? null;
  const sheetContractNumber =
    selectedCharge?.contractNumber ?? activeContract?.contractNumber ?? null;
  const sheetTenantName =
    selectedCharge?.tenantName ?? activeContract?.tenantName ?? "-";
  const sheetTitle =
    sheetMode === "create"
      ? "Criar cobrança interna"
      : sheetMode === "edit"
        ? "Editar cobrança"
        : "Detalhes da cobrança";
  const totalPreview =
    moneyTextToCents(form.rentAmount) +
    moneyTextToCents(form.iptu) +
    moneyTextToCents(form.condominium) +
    moneyTextToCents(form.reserveFund) +
    moneyTextToCents(form.water) +
    moneyTextToCents(form.energy) +
    moneyTextToCents(form.trash) +
    moneyTextToCents(form.gas) +
    moneyTextToCents(form.otherAmount) -
    moneyTextToCents(form.discountAmount);
  const selectedTicketAccount = ticketDialogData?.accounts.find(
    (account) => account.id === selectedTicketAccountId
  );

  useEffect(() => {
    if (!inlineAction || isLoading || actionStarted.current) return;
    actionStarted.current = true;
    void (async () => {
      if (!data) { onActionClose?.(); return; }
      if (inlineAction.kind === "create") {
        if (data.activeContract?.id !== inlineAction.leaseId) {
          toast.warning("O contrato ativo mudou. Atualize a consulta mensal.");
          onActionClose?.(); return;
        }
        if (data.charges.some((charge) => charge.leaseId === inlineAction.leaseId && charge.competenceMonth === inlineAction.month && charge.competenceYear === inlineAction.year)) {
          toast.warning("Já existe uma cobrança para este contrato e competência.");
          onActionClose?.(); return;
        }
        openNewChargeSheet();
        setForm({ ...getDefaultForm(data), competenceMonth: String(inlineAction.month), competenceYear: String(inlineAction.year), dueDate: inlineAction.dueDate ?? getDueDate(inlineAction.month, inlineAction.year, data.activeContract.paymentDueDay ?? 10) });
      } else {
        const charge = data.charges.find((item) => item.id === inlineAction.chargeId && item.leaseId === inlineAction.leaseId);
        if (!charge) { toast.warning("Cobrança não encontrada. Atualize a consulta."); onActionClose?.(); return; }
        if (inlineAction.kind === "print") { await viewTicket(charge); onActionClose?.(); return; }
        if (!canEditCharge(charge)) { toast.warning("Cobrança finalizada ou com boleto ativo. Atualize a consulta."); onActionClose?.(); return; }
        if (inlineAction.kind === "edit") openEditChargeSheet(charge);
        else await openTicketDialog(charge);
      }
      setActionReady(true);
    })();
    // The monthly action runs once per mounted dialog, using freshly loaded finance data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isLoading, inlineAction]);

  useEffect(() => {
    if (inlineAction && actionReady && !isSheetOpen && !ticketDialogCharge && !isSaving && !ticketGeneratingId) onActionClose?.();
  }, [inlineAction, actionReady, isSheetOpen, ticketDialogCharge, isSaving, ticketGeneratingId, onActionClose]);

  return (
    <ManagementPage>
      {inlineAction ? null : <>
      <FormPageHeader
        actions={
          <Button
            disabled={!activeContract}
            onClick={openNewChargeSheet}
            type="button"
          >
            <Plus className="size-4" />
            Criar cobrança
          </Button>
        }
        backLabel="Voltar para imobiliária"
        badge={"Financeiro do im\u00f3vel"}
        onBack={() => router.push(`/imobiliaria?tab=${returnTab}`)}
        title={
          data?.asset
            ? `${data.asset.code ? `${data.asset.code} · ` : ""}${data.asset.title}`
            : "Financeiro"
        }
      />

      {isLoading ? (
        <ManagementMetricCardsSkeleton
          className="sm:grid-cols-2 xl:grid-cols-5"
          count={5}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            description="Mês de referência"
            icon={CalendarDays}
            title="Competência atual"
            value={`${String(financeSummary.currentMonth).padStart(2, "0")}/${
              financeSummary.currentYear
            }`}
          />
          <MetricCard
            description="Cobranças lançadas"
            icon={Banknote}
            title="Previsto no mês"
            tone="neutral"
            value={formatCurrencyFromCents(financeSummary.expectedAmountCents)}
          />
          <MetricCard
            description="Ainda não recebido"
            icon={CircleDollarSign}
            title="Em aberto"
            tone="warning"
            value={formatCurrencyFromCents(financeSummary.openAmountCents)}
          />
          <MetricCard
            description="Liquidações confirmadas"
            icon={Banknote}
            title="Recebido"
            tone="success"
            value={formatCurrencyFromCents(financeSummary.paidAmountCents)}
          />
          <MetricCard
            description={`${financeSummary.overdueCount} vencida(s) · ${financeSummary.activeTicketCount} boleto(s) ativo(s)`}
            icon={XCircle}
            title="Atenção"
            tone={financeSummary.overdueCount > 0 ? "danger" : "info"}
            value={
              financeSummary.overdueCount + financeSummary.activeTicketCount
            }
          />
        </div>
      )}

      <ManagementFilters className="gap-2 p-2.5 pl-4 shadow-sm before:inset-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <div className="w-full space-y-1 lg:w-80">
            <label className="text-xs font-medium text-muted-foreground">
              Buscar
            </label>
            <Input
              className="h-8"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Competência, contrato ou inquilino"
              value={draftFilters.search}
            />
          </div>
          <div className="w-full space-y-1 lg:w-48">
            <label className="text-xs font-medium text-muted-foreground">
              Situação
            </label>
            <NativeSelect
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              value={draftFilters.status}
            >
              <NativeSelectOption value="all">Todas</NativeSelectOption>
              <NativeSelectOption value="open">Em aberto</NativeSelectOption>
              <NativeSelectOption value="paid">Pago</NativeSelectOption>
              <NativeSelectOption value="overdue">Vencido</NativeSelectOption>
              <NativeSelectOption value="canceled">Cancelado</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="w-full space-y-1 lg:w-52">
            <label className="text-xs font-medium text-muted-foreground">
              Boleto
            </label>
            <NativeSelect
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  ticketStatus: event.target.value,
                }))
              }
              value={draftFilters.ticketStatus}
            >
              <NativeSelectOption value="all">Todos</NativeSelectOption>
              <NativeSelectOption value="not_generated">
                Não gerado
              </NativeSelectOption>
              <NativeSelectOption value="registering">Registrando</NativeSelectOption>
              <NativeSelectOption value="registered">Registrado</NativeSelectOption>
              <NativeSelectOption value="failed">Falhou</NativeSelectOption>
              <NativeSelectOption value="canceled">Cancelado</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex shrink-0 gap-2 lg:ml-auto">
            <Button
              className="h-8 min-w-24"
              onClick={() => {
                setFilters({ ...draftFilters });
                setPage(1);
              }}
              type="button"
            >
              <Search className="size-4" />
              Filtrar
            </Button>
            <Button
              className="h-8 min-w-24"
              onClick={() => {
                const cleared = {
                  search: "",
                  status: "all",
                  ticketStatus: "all",
                };
                setDraftFilters(cleared);
                setFilters(cleared);
                setPage(1);
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
        actions={
          lastUpdatedAt ? (
            <span className="text-xs text-muted-foreground">
              Atualizado automaticamente às {formatTime(lastUpdatedAt)}
            </span>
          ) : null
        }
        count={`${filteredCharges.length} cobrança(s)`}
        title="Cobranças"
      >
        {isLoading ? (
          <ManagementTableSkeleton columns={9} rows={8} />
        ) : !data ? (
          <ManagementState>Não foi possível carregar o financeiro.</ManagementState>
        ) : !activeContract ? (
          <ManagementState>
            Este imóvel ainda não possui contrato ativo para gerar cobranças.
          </ManagementState>
        ) : filteredCharges.length === 0 ? (
          <ManagementState>
            {"Nenhuma cobran\u00e7a interna encontrada para este im\u00f3vel."}
          </ManagementState>
        ) : (
          <>
            <ManagementTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Inquilino</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Boleto</TableHead>
                    <TableHead className="w-12 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCharges.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell className="font-medium">
                        {String(charge.competenceMonth).padStart(2, "0")}/
                        {charge.competenceYear}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4 text-muted-foreground" />
                          {formatDate(charge.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell>{charge.tenantName}</TableCell>
                      <TableCell>
                        {charge.contractCode
                          ? `Nº ${charge.contractCode}`
                          : charge.contractNumber ?? "-"}
                      </TableCell>
                      <TableCell>
                        {getChargeItemsCount(charge)} adicional(is)
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyFromCents(charge.totalAmountCents)}
                      </TableCell>
                      <TableCell>
                        <SemanticStatusBadge tone={statusTones[charge.status]}>
                          {statusLabels[charge.status]}
                        </SemanticStatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getTicketFailureMessage(charge) ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button className="cursor-help" type="button" />
                                }
                              >
                                <SemanticStatusBadge tone={getTicketStatusTone(charge)}>
                                  {getTicketStatusLabel(charge)}
                                </SemanticStatusBadge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-sm">
                                <span className="text-left">
                                  {getTicketFailureMessage(charge)}
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <SemanticStatusBadge tone={getTicketStatusTone(charge)}>
                              {getTicketStatusLabel(charge)}
                            </SemanticStatusBadge>
                          )}
                          {charge.ticketDocumentNumber || charge.ticketOurNumber ? (
                            <div className="text-xs text-muted-foreground">
                              {charge.ticketDocumentNumber
                                ? `Doc. ${charge.ticketDocumentNumber}`
                                : null}
                              {charge.ticketDocumentNumber && charge.ticketOurNumber
                                ? " · "
                                : null}
                              {charge.ticketOurNumber
                                ? `Nosso nº ${charge.ticketOurNumber}`
                                : null}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                aria-label="Abrir ações da cobrança"
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
                              onClick={() => openViewChargeSheet(charge)}
                            >
                              <Eye className="size-4" />
                              Ver cobrança
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!canEditCharge(charge)}
                              onClick={() => openEditChargeSheet(charge)}
                            >
                              <Pencil className="size-4" />
                              Editar cobrança
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {hasActiveTicketForActions(charge) ? (
                              <>
                                <DropdownMenuItem
                                  disabled={
                                    !charge.ticketUrl &&
                                    (!charge.ticketIntegrationId ||
                                      !charge.ticketAssignorDocument)
                                  }
                                  onClick={() => void viewTicket(charge)}
                                >
                                  <ExternalLink className="size-4" />
                                  Visualizar boleto
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={
                                    !charge.ticketPixUrl &&
                                    !charge.ticketIntegrationId
                                  }
                                  onClick={() => void viewTicketQrCode(charge)}
                                >
                                  <QrCode className="size-4" />
                                  Visualizar QR Code/Pix
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={
                                    !charge.ticketUrl &&
                                    !charge.ticketDigitableLine &&
                                    !charge.ticketIntegrationId
                                  }
                                  onClick={() => void sendTicketWhatsApp(charge)}
                                >
                                  <MessageCircle className="size-4" />
                                  Enviar via WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={
                                    isRequestingDischarge ||
                                    !canRequestTicketDischarge(charge)
                                  }
                                  onClick={() => setDischargeCandidate(charge)}
                                >
                                  {isRequestingDischarge ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <RotateCcw className="size-4" />
                                  )}
                                  Pedido de baixa
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={
                                    isDiscardingTicket || !canDiscardTicket(charge)
                                  }
                                  onClick={() => void discardTicket(charge)}
                                >
                                  {isDiscardingTicket ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-4" />
                                  )}
                                  Descartar boleto
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                disabled={
                                  ticketGeneratingId === charge.id ||
                                  charge.status === "canceled" ||
                                  charge.status === "paid"
                                }
                                onClick={() => void openTicketDialog(charge)}
                              >
                                {ticketGeneratingId === charge.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Banknote className="size-4" />
                                )}
                                {charge.hasTicketAttempts
                                  ? "Gerar novo boleto"
                                  : "Gerar boleto"}
                              </DropdownMenuItem>
                            )}
                            {charge.ticketIntegrationId || charge.ticketProviderStatus ? (
                              <DropdownMenuItem
                                disabled={isLoadingTicketHistory}
                                onClick={() => void openTicketHistory(charge)}
                              >
                                {isLoadingTicketHistory ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <History className="size-4" />
                                )}
                                Histórico TecnoSpeed
                              </DropdownMenuItem>
                            ) : null}
                            {!hasActiveTicketForActions(charge) && canDiscardTicket(charge) ? (
                              <DropdownMenuItem
                                disabled={isDiscardingTicket}
                                onClick={() => void discardTicket(charge)}
                              >
                                {isDiscardingTicket ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                                Descartar boleto
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={
                                isCanceling ||
                                hasActiveTicketForActions(charge) ||
                                charge.status === "paid" ||
                                charge.status === "canceled"
                              }
                              onClick={() => setCancelCandidate(charge)}
                            >
                              <XCircle className="size-4" />
                              Cancelar cobrança
                            </DropdownMenuItem>
                            {!charge.hasTicketAttempts ? (
                              <DropdownMenuItem
                                disabled={isDeleting || !canDeleteCharge(charge)}
                                onClick={() => setDeleteCandidate(charge)}
                                variant="destructive"
                              >
                                <Trash2 className="size-4" />
                                Excluir cobrança
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ManagementTableFrame>

            <ManagementPagination
              itemLabel="cobranças"
              onPageChange={setPage}
              page={safePage}
              pageSize={pageSize}
              total={filteredCharges.length}
              visible={paginatedCharges.length}
            />
          </>
        )}
      </ManagementDataCard>

      </>}
      <Sheet onOpenChange={(open) => { if (!isSaving) setIsSheetOpen(open); }} open={isSheetOpen}>
        <SheetContent className="gap-0 !w-[32rem] !max-w-[32rem] max-sm:!w-full max-sm:!max-w-full">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>{sheetTitle}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {selectedCharge?.ticketErrorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {selectedCharge.ticketErrorMessage}
              </div>
            ) : null}
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Contrato ativo</p>
                  <p className="font-medium">
                    {sheetContractCode
                      ? `Nº ${sheetContractCode}`
                      : sheetContractNumber ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Inquilino</p>
                  <p className="font-medium">
                    {sheetTenantName}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Competência
                </label>
                <NativeSelect
                  disabled={isReadOnlySheet}
                  onChange={(event) => handleCompetenceChange(event.target.value)}
                  value={form.competenceMonth}
                >
                  {monthLabels.map((label, index) => (
                    <NativeSelectOption key={label} value={String(index + 1)}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Ano
                </label>
                <Input
                  disabled={isReadOnlySheet}
                  onChange={(event) => handleYearChange(event.target.value)}
                  value={form.competenceYear}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Vencimento
                </label>
                <Input
                  disabled={isReadOnlySheet}
                  onChange={(event) => updateForm("dueDate", event.target.value)}
                  type="date"
                  value={form.dueDate}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput
                icon={<Banknote className="size-4 text-muted-foreground" />}
                label="Aluguel"
                onChange={(value) => updateMoneyField("rentAmount", value)}
                readOnly={isReadOnlySheet}
                value={form.rentAmount}
              />
              <MoneyInput
                label="IPTU"
                onChange={(value) => updateMoneyField("iptu", value)}
                readOnly={isReadOnlySheet}
                value={form.iptu}
              />
              <MoneyInput
                label="Condomínio"
                onChange={(value) => updateMoneyField("condominium", value)}
                readOnly={isReadOnlySheet}
                value={form.condominium}
              />
              <MoneyInput
                label="Fundo reserva"
                onChange={(value) => updateMoneyField("reserveFund", value)}
                readOnly={isReadOnlySheet}
                value={form.reserveFund}
              />
              <MoneyInput
                label="Água"
                onChange={(value) => updateMoneyField("water", value)}
                readOnly={isReadOnlySheet}
                value={form.water}
              />
              <MoneyInput
                label="Energia"
                onChange={(value) => updateMoneyField("energy", value)}
                readOnly={isReadOnlySheet}
                value={form.energy}
              />
              <MoneyInput
                label="Lixo"
                onChange={(value) => updateMoneyField("trash", value)}
                readOnly={isReadOnlySheet}
                value={form.trash}
              />
              <MoneyInput
                label="Gás"
                onChange={(value) => updateMoneyField("gas", value)}
                readOnly={isReadOnlySheet}
                value={form.gas}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Outros - descrição
                </label>
                <Input
                  disabled={isReadOnlySheet}
                  onChange={(event) =>
                    updateForm("otherDescription", event.target.value)
                  }
                  placeholder="Ex: Pintura, manutenção..."
                  value={form.otherDescription}
                />
              </div>
              <MoneyInput
                label="Outros - valor"
                onChange={(value) => updateMoneyField("otherAmount", value)}
                readOnly={isReadOnlySheet}
                value={form.otherAmount}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput
                label="Desconto"
                onChange={(value) => updateMoneyField("discountAmount", value)}
                readOnly={isReadOnlySheet}
                value={form.discountAmount}
              />
              <div className="rounded-xl border bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CircleDollarSign className="size-4" />
                  Total da cobrança
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrencyFromCents(Math.max(totalPreview, 0))}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Observações
              </label>
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                disabled={isReadOnlySheet}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="Informações internas sobre esta cobrança"
                value={form.notes}
              />
            </div>
          </div>

          <SheetFooter className="mt-0 border-t bg-background px-5 py-4 sm:flex-row sm:justify-end">
            <Button
              disabled={isSaving}
              onClick={() => setIsSheetOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            {sheetMode !== "view" ? (
              <Button
                disabled={isSaving}
                onClick={() =>
                  sheetMode === "edit"
                    ? void updateCharge()
                    : void createCharge()
                }
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                {sheetMode === "edit" ? "Salvar alterações" : "Salvar cobrança"}
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !isCanceling) {
            setCancelCandidate(null);
          }
        }}
        open={Boolean(cancelCandidate)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
              <XCircle className="size-5" />
            </div>
            <AlertDialogTitle>Cancelar cobrança?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancela a cobrança interna desta competência. Use quando
              o boleto já foi baixado, descartado ou quando a cobrança não deve
              mais ser cobrada.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {cancelCandidate ? (
            <div className="mx-6 mb-5 rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Competência</span>
                <span className="font-medium">
                  {String(cancelCandidate.competenceMonth).padStart(2, "0")}/
                  {cancelCandidate.competenceYear}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {formatCurrencyFromCents(cancelCandidate.totalAmountCents)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Boleto</span>
                <span className="font-medium">
                  {getTicketStatusLabel(cancelCandidate)}
                </span>
              </div>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogClose disabled={isCanceling}>Voltar</AlertDialogClose>
            <Button
              disabled={isCanceling}
              onClick={() => void cancelCharge()}
              type="button"
              variant="destructive"
            >
              {isCanceling ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancelar cobrança
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteCandidate(null);
          }
        }}
        open={Boolean(deleteCandidate)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cobrança?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a cobrança interna e seus itens. Só é permitida
              quando não existe boleto válido em circulação.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteCandidate ? (
            <div className="mx-6 mb-5 rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Competência</span>
                <span className="font-medium">
                  {String(deleteCandidate.competenceMonth).padStart(2, "0")}/
                  {deleteCandidate.competenceYear}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {formatCurrencyFromCents(deleteCandidate.totalAmountCents)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Boleto</span>
                <span className="font-medium">
                  {getTicketStatusLabel(deleteCandidate)}
                </span>
              </div>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogClose disabled={isDeleting}>Cancelar</AlertDialogClose>
            <Button
              disabled={isDeleting}
              onClick={() => void deleteCharge()}
              type="button"
              variant="destructive"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Excluir cobrança
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !isRequestingDischarge) {
            setDischargeCandidate(null);
          }
        }}
        open={Boolean(dischargeCandidate)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RotateCcw className="size-5" />
            </div>
            <AlertDialogTitle>Solicitar baixa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação enviará um pedido de baixa para o boleto na TecnoSpeed.
              Após a confirmação, a cobrança interna será marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {dischargeCandidate ? (
            <div className="mx-6 mb-5 rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Competência</span>
                <span className="font-medium">
                  {String(dischargeCandidate.competenceMonth).padStart(2, "0")}/
                  {dischargeCandidate.competenceYear}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Documento</span>
                <span className="font-medium">
                  {dischargeCandidate.ticketDocumentNumber || "-"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Situação boleto</span>
                <span className="font-medium">
                  {getTicketStatusLabel(dischargeCandidate)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {formatCurrencyFromCents(dischargeCandidate.totalAmountCents)}
                </span>
              </div>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogClose disabled={isRequestingDischarge}>
              Cancelar
            </AlertDialogClose>
            <Button
              disabled={isRequestingDischarge}
              onClick={() => void requestTicketDischarge()}
              type="button"
            >
              {isRequestingDischarge ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Solicitar baixa
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setTicketHistory(null);
          }
        }}
        open={Boolean(ticketHistory)}
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
                  {ticketHistory?.payerName || "Pagador não informado"}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="max-h-[60vh] space-y-5 overflow-auto px-6 py-5">
            <div className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Situação</p>
                <p className="text-sm font-medium">
                  {ticketHistory?.status || "-"}
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
              <div>
                <p className="text-xs text-muted-foreground">Nosso número</p>
                <p className="text-sm font-medium">
                  {ticketHistory?.ourNumber || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="text-sm font-medium">
                  R$ {ticketHistory?.amount || "0,00"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Linha digitável</p>
                <p className="truncate text-sm font-medium">
                  {ticketHistory?.digitableLine || "-"}
                </p>
              </div>
            </div>

            {ticketHistory?.failureMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {ticketHistory.failureMessage}
              </div>
            ) : null}

            {ticketHistory?.attempts.length ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Tentativas de boleto</p>
                <div className="space-y-2">
                  {ticketHistory.attempts.map((attempt, index) => (
                    <div
                      className="flex flex-col gap-2 rounded-lg border bg-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      key={attempt.id}
                    >
                      <div>
                        <p className="font-medium">
                          {attempt.status || "Status não informado"}
                          {attempt.isActive ? " · ativo" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tentativa {ticketHistory.attempts.length - index} ·{" "}
                          {attempt.integrationId || "sem integração"} ·{" "}
                          {formatDate(attempt.createdAt)}
                        </p>
                        {attempt.errorMessage ? (
                          <p className="mt-1 text-xs text-red-600">
                            {attempt.errorMessage}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

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
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          {formatDate(movement.date)}
                        </span>
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
        onOpenChange={(open) => {
          if (!open && !ticketGeneratingId) {
            setTicketDialogCharge(null);
            setTicketDialogData(null);
          }
        }}
        open={Boolean(ticketDialogCharge)}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle>Gerar boleto</AlertDialogTitle>
            <AlertDialogDescription>
              Confira o resumo da cobrança e selecione a conta e o convênio do
              cedente antes de enviar para a TecnoSpeed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 px-6 pb-5">
            {isLoadingTicketDialog ? (
              <div className="flex min-h-48 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Carregando dados da emissão...
              </div>
            ) : ticketDialogData ? (
              <>
                <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Imóvel</p>
                    <p className="font-medium">
                      {ticketDialogData.asset.code
                        ? `${ticketDialogData.asset.code} · `
                        : ""}
                      {ticketDialogData.asset.title}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contrato</p>
                    <p className="font-medium">
                      {ticketDialogData.lease.code
                        ? `Nº ${ticketDialogData.lease.code}`
                        : ticketDialogData.lease.contractNumber ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Inquilino</p>
                    <p className="font-medium">{ticketDialogData.payer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="font-medium">
                      {formatDate(ticketDialogData.charge.dueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Competência</p>
                    <p className="font-medium">
                      {ticketDialogData.charge.competence}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold">
                      {formatCurrencyFromCents(
                        ticketDialogData.charge.totalAmountCents
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border">
                  <div className="border-b px-4 py-2 text-sm font-medium">
                    Itens que irão na mensagem do boleto
                  </div>
                  <div className="divide-y">
                    {ticketDialogData.items.map((item, index) => (
                      <div
                        className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                        key={`${item.type}-${index}`}
                      >
                        <span>{item.label}</span>
                        <span className="font-medium">
                          {formatCurrencyFromCents(item.amountCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Conta do cedente
                    </label>
                    <NativeSelect
                      onChange={(event) => {
                        const accountId = event.target.value;
                        const account = ticketDialogData.accounts.find(
                          (item) => item.id === accountId
                        );
                        setSelectedTicketAccountId(accountId);
                        setSelectedTicketAgreementId(
                          account?.agreements[0]?.id ?? ""
                        );
                      }}
                      value={selectedTicketAccountId}
                    >
                      {ticketDialogData.accounts.length === 0 ? (
                        <NativeSelectOption value="">
                          Nenhuma conta encontrada
                        </NativeSelectOption>
                      ) : null}
                      {ticketDialogData.accounts.map((account) => (
                        <NativeSelectOption key={account.id} value={account.id}>
                          {account.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Convênio
                    </label>
                    <NativeSelect
                      disabled={!selectedTicketAccount}
                      onChange={(event) => {
                        setSelectedTicketAgreementId(event.target.value);
                      }}
                      value={selectedTicketAgreementId}
                    >
                      {(selectedTicketAccount?.agreements.length ?? 0) === 0 ? (
                        <NativeSelectOption value="">
                          Nenhum convênio encontrado
                        </NativeSelectOption>
                      ) : null}
                      {selectedTicketAccount?.agreements.map((agreement) => (
                        <NativeSelectOption
                          key={agreement.id}
                          value={agreement.id}
                        >
                          {agreement.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="ticket-type" className="text-sm font-medium">Tipo de boleto</label>
                    <NativeSelect id="ticket-type" value={ticketIsHybrid ? "hybrid" : "traditional"} disabled={Boolean(ticketGeneratingId)} onChange={(event) => setTicketIsHybrid(event.target.value === "hybrid")}>
                      <NativeSelectOption value="traditional">Boleto tradicional (sem Pix)</NativeSelectOption>
                      <NativeSelectOption value="hybrid">Boleto híbrido (com Pix)</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="ticket-protest" className="text-sm font-medium">Protesto</label>
                    <NativeSelect id="ticket-protest" value={ticketProtestCode} disabled={Boolean(ticketGeneratingId)} onChange={(event) => setTicketProtestCode(event.target.value)}>
                      {protestOptions.map((option) => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}
                    </NativeSelect>
                  </div>
                  {usesProtestDays(ticketProtestCode) ? (
                    <div className="space-y-2">
                      <label htmlFor="ticket-protest-days" className="text-sm font-medium">Prazo de protesto (dias)</label>
                      <Input id="ticket-protest-days" type="number" min={1} max={99} step={1} value={ticketProtestDays} disabled={Boolean(ticketGeneratingId)} onChange={(event) => setTicketProtestDays(event.target.value)} />
                    </div>
                  ) : null}
                </div>
                {(["interest", "fine"] as const).map((kind) => {
                  const isInterest = kind === "interest";
                  const codeKey = isInterest ? "interestCode" : "fineCode";
                  const dateKey = isInterest ? "interestDate" : "fineDate";
                  const valueKey = isInterest ? "interestValue" : "fineValue";
                  const code = ticketPenalties[codeKey];
                  const enabled = code !== (isInterest ? "3" : "0");
                  const options = isInterest
                    ? [{ value: "3", label: "Isento" }, { value: "1", label: "Valor por dia" }, { value: "2", label: "Taxa mensal" }]
                    : [{ value: "0", label: "Não registrar" }, { value: "1", label: "Valor fixo" }, { value: "2", label: "Percentual" }];
                  const valueLabel = code === "1"
                    ? (isInterest ? "Valor por dia (R$)" : "Valor da multa (R$)")
                    : (isInterest ? "Taxa mensal (%)" : "Percentual da multa (%)");
                  return (
                    <fieldset key={kind} className="space-y-3 rounded-md border p-4" disabled={Boolean(ticketGeneratingId)}>
                      <legend className="px-1 text-sm font-semibold">{isInterest ? "Juros" : "Multa"}</legend>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <label htmlFor={`ticket-${kind}-code`} className="text-sm font-medium">{isInterest ? "Tipo de juros" : "Tipo de multa"}</label>
                          <NativeSelect id={`ticket-${kind}-code`} value={code} onChange={(event) => setTicketPenalties((current) => ({ ...current, [codeKey]: event.target.value }))}>
                            {options.map((option) => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}
                          </NativeSelect>
                        </div>
                        {enabled ? (
                          <>
                            <div className="space-y-2">
                              <label htmlFor={`ticket-${kind}-date`} className="text-sm font-medium">Data de início</label>
                              <Input id={`ticket-${kind}-date`} type="date" value={ticketPenalties[dateKey]} onChange={(event) => setTicketPenalties((current) => ({ ...current, [dateKey]: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label htmlFor={`ticket-${kind}-value`} className="text-sm font-medium">{valueLabel}</label>
                              <Input id={`ticket-${kind}-value`} inputMode="decimal" placeholder="0,00" value={ticketPenalties[valueKey]} onChange={(event) => setTicketPenalties((current) => ({ ...current, [valueKey]: event.target.value }))} />
                            </div>
                          </>
                        ) : null}
                      </div>
                    </fieldset>
                  );
                })}
              </>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogClose disabled={Boolean(ticketGeneratingId)}>
              Cancelar
            </AlertDialogClose>
            <Button
              disabled={
                isLoadingTicketDialog ||
                Boolean(ticketGeneratingId) ||
                !selectedTicketAccountId ||
                !selectedTicketAgreementId
              }
              onClick={() => void generateTicket()}
              type="button"
            >
              {ticketGeneratingId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Confirmar e gerar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementPage>
  );
}

function MoneyInput({
  icon,
  label,
  onChange,
  readOnly = false,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  readOnly?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        {icon ? <span className="absolute left-3 top-2.5">{icon}</span> : null}
        <Input
          className={icon ? "pl-9" : undefined}
          disabled={readOnly}
          inputMode="numeric"
          onChange={(event) => onChange(event.target.value)}
          placeholder="R$ 0,00"
          value={value}
        />
      </div>
    </div>
  );
}
