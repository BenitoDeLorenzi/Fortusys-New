"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import {
  Activity,
  Building2,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock3,
  ClipboardList,
  FileText,
  History,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { FormPageHeader } from "@/components/management/form-page-header";
import { ManagementState } from "@/components/management/management-layout";
import { SemanticStatusBadge } from "@/components/management/semantic-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PayerSheet } from "@/features/payers/components/payer-sheet";
import { formatDocument } from "@/features/billing/utils";
import type {
  RealEstateLeaseAdjustment,
  RealEstateLeaseGuarantee,
  RealEstateLeaseManagementResponse,
  RealEstateLeaseStatus,
} from "@/features/real-estate/leases";
import type { ClientRole, Payer, PayersResponse } from "@/features/payers/types";

type RealEstateLeaseManagementProps = {
  assetId: string;
};

const returnTabs = ["resumo", "imoveis", "agenda", "cobrancas"] as const;

function getReturnTab(value?: string | null) {
  return returnTabs.includes(value as (typeof returnTabs)[number])
    ? value
    : "imoveis";
}

type LeaseFormValues = {
  tenantId: string;
  status: RealEstateLeaseStatus;
  contractNumber: string;
  startDate: string;
  endDate: string;
  paymentDueDay: string;
  rentAmount: string;
  guaranteeType: RealEstateLeaseGuarantee;
  guaranteeAmount: string;
  guarantorId: string;
  adjustmentIndex: RealEstateLeaseAdjustment;
  nextAdjustmentDate: string;
  notes: string;
};

const defaultValues: LeaseFormValues = {
  tenantId: "",
  status: "draft",
  contractNumber: "",
  startDate: "",
  endDate: "",
  paymentDueDay: "",
  rentAmount: "",
  guaranteeType: "none",
  guaranteeAmount: "",
  guarantorId: "",
  adjustmentIndex: "ipca",
  nextAdjustmentDate: "",
  notes: "",
};

const statusLabels: Record<RealEstateLeaseStatus, string> = {
  draft: "Em preparação",
  active: "Contrato ativo",
  ended: "Encerrado",
  canceled: "Cancelado",
};

const statusDescriptions: Record<RealEstateLeaseStatus, string> = {
  draft: "Preencha e revise os dados antes de ativar a locação.",
  active: "Contrato vigente. O imóvel fica marcado como alugado.",
  ended: "Contrato encerrado. O imóvel volta a ficar disponível.",
  canceled: "Contrato cancelado. Use quando a locação não seguiu adiante.",
};

const adjustmentLabels: Record<RealEstateLeaseAdjustment, string> = {
  ipca: "IPCA",
  igpm: "IGP-M",
  other: "Outro índice",
  none: "Sem reajuste",
};

const contractInputClassName = "h-9 rounded-lg";
const contractCardClassName =
  "overflow-visible rounded-2xl border bg-gradient-to-br from-card via-card to-muted/25 p-5 shadow-sm ring-1 ring-foreground/5";
const contractCardHeaderClassName = "mb-4 flex items-start gap-3";
const contractCardIconWrapClassName =
  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatMoneyInput(value: string) {
  const digits = onlyDigits(value);

  if (!digits) {
    return "";
  }

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function centsToMoney(value?: number | null) {
  return value ? formatMoneyInput(String(value)) : "";
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeMotive(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getDurationLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return "";
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return "";
  }

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth();

  if (months >= 1) {
    return `${months} mês${months > 1 ? "es" : ""}`;
  }

  const days = Math.max(
    Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
    1
  );

  return `${days} dia${days > 1 ? "s" : ""}`;
}

function getMotiveLabel(value?: string | null) {
  const normalized = normalizeMotive(value);

  if (normalized === "aluguel" || normalized === "locacao") {
    return "Locação";
  }

  if (normalized === "venda") {
    return "Venda";
  }

  return "Não informado";
}

type ContractPersonPickerProps = {
  buttonLabel: string;
  document: string;
  inputValue: string;
  isLoading: boolean;
  isOpen: boolean;
  onCreate: () => void;
  onInputBlur: () => void;
  onInputFocus: () => void;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelect: (payer: Payer) => void;
  payers: Payer[];
  placeholder: string;
  selectedId: string;
};

function ContractPersonPicker({
  buttonLabel,
  document,
  inputValue,
  isLoading,
  isOpen,
  onCreate,
  onInputBlur,
  onInputFocus,
  onOpenChange,
  onSearchChange,
  onSelect,
  payers,
  placeholder,
  selectedId,
}: ContractPersonPickerProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoComplete="off"
          className={`${contractInputClassName} pr-10 pl-9`}
          onBlur={onInputBlur}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={onInputFocus}
          placeholder={placeholder}
          value={inputValue}
        />
        <button
          aria-label="Abrir lista"
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onOpenChange(!isOpen)}
          type="button"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ChevronsUpDown className="size-4" />
          )}
        </button>

        {isOpen && payers.length > 0 ? (
          <div className="absolute z-50 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
            <div className="max-h-72 overflow-y-auto p-1">
              {payers.map((payer) => {
                const isSelected = payer.id === selectedId;

                return (
                  <button
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    key={payer.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(payer)}
                    type="button"
                  >
                    <span className="mt-0.5 flex size-4 items-center justify-center text-primary">
                      {isSelected ? <Check className="size-4" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {payer.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {payer.document || "Documento não informado"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <Input
        className={contractInputClassName}
        placeholder="Documento"
        readOnly
        value={document ? formatDocument(document) : ""}
      />

      <Button
        className="h-9 whitespace-nowrap rounded-lg"
        onClick={onCreate}
        type="button"
        variant="outline"
      >
        <Plus className="size-4" />
        {buttonLabel}
      </Button>
    </div>
  );
}

export function RealEstateLeaseManagement({
  assetId,
}: RealEstateLeaseManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTab = getReturnTab(searchParams.get("returnTab"));
  const returnHref = `/imobiliaria?tab=${returnTab}`;
  const form = useForm<LeaseFormValues>({ defaultValues });
  const tenantId = useWatch({
    control: form.control,
    name: "tenantId",
  });
  const guarantorId = useWatch({
    control: form.control,
    name: "guarantorId",
  });
  const watchedStartDate = useWatch({
    control: form.control,
    name: "startDate",
  });
  const watchedEndDate = useWatch({
    control: form.control,
    name: "endDate",
  });
  const [data, setData] =
    useState<RealEstateLeaseManagementResponse | null>(null);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [payerSearch, setPayerSearch] = useState("");
  const [guarantorSearch, setGuarantorSearch] = useState("");
  const [isTenantComboboxOpen, setIsTenantComboboxOpen] = useState(false);
  const [isGuarantorComboboxOpen, setIsGuarantorComboboxOpen] =
    useState(false);
  const [clientSheetContext, setClientSheetContext] = useState<
    "tenant" | "guarantor" | null
  >(null);
  const [activeTab, setActiveTab] = useState("resumo");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPayers, setIsLoadingPayers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cycleAction, setCycleAction] =
    useState<RealEstateLeaseStatus | null>(null);

  const loadManagement = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/lease`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as
        | RealEstateLeaseManagementResponse
        | { message?: string };

      if (!response.ok || !("asset" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar o contrato do imóvel."
        );
      }

      setData(payload);

      if (payload.lease) {
        form.reset({
          tenantId: payload.lease.tenantId,
          status: payload.lease.status,
          contractNumber: payload.lease.contractNumber ?? "",
          startDate: payload.lease.startDate,
          endDate: payload.lease.endDate,
          paymentDueDay: payload.lease.paymentDueDay
            ? String(payload.lease.paymentDueDay)
            : "",
          rentAmount: centsToMoney(payload.lease.rentAmountCents),
          guaranteeType: payload.lease.guaranteeType,
          guaranteeAmount: centsToMoney(
            payload.lease.guaranteeAmountCents
          ),
          guarantorId: payload.lease.guarantorId ?? "",
          adjustmentIndex: payload.lease.adjustmentIndex,
          nextAdjustmentDate: payload.lease.nextAdjustmentDate ?? "",
          notes: payload.lease.notes ?? "",
        });
        const selectedPeople: Payer[] = [
          {
            id: payload.lease.tenantId,
            firestoreId: null,
            code: null,
            name: payload.lease.tenantName,
            document: payload.lease.tenantDocument,
            email: null,
            phone: null,
            zipCode: null,
            street: null,
            number: null,
            complement: null,
            district: null,
            city: null,
            state: null,
            status: "active",
            roles: ["tenant"],
            createdAt: payload.lease.createdAt,
          },
        ];

        if (payload.lease.guarantorId && payload.lease.guarantorName) {
          selectedPeople.push({
            id: payload.lease.guarantorId,
            firestoreId: null,
            code: null,
            name: payload.lease.guarantorName,
            document: payload.lease.guarantorDocument ?? "",
            email: null,
            phone: null,
            zipCode: null,
            street: null,
            number: null,
            complement: null,
            district: null,
            city: null,
            state: null,
            status: "active",
            roles: ["guarantor"],
            createdAt: payload.lease.createdAt,
          });
        }

        setPayers(selectedPeople);
        setPayerSearch(payload.lease.tenantName);
        setGuarantorSearch(payload.lease.guarantorName ?? "");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o contrato do imóvel."
      );
    } finally {
      setIsLoading(false);
    }
  }, [assetId, form]);

  const searchPayers = useCallback(async (search: string) => {
    setIsLoadingPayers(true);

    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const response = await fetch(`/api/payers?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as PayersResponse;

      if (!response.ok) {
        throw new Error("Não foi possível buscar os clientes.");
      }

      setPayers((current) => {
        const selectedId = form.getValues("tenantId");
        const selected = current.find((payer) => payer.id === selectedId);
        const next = payload.payers.filter(
          (payer) => payer.status === "active"
        );

        return selected && !next.some((payer) => payer.id === selected.id)
          ? [selected, ...next]
          : next;
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível buscar os clientes."
      );
    } finally {
      setIsLoadingPayers(false);
    }
  }, [form]);

  useEffect(() => {
    let isCurrent = true;

    window.queueMicrotask(() => {
      if (isCurrent) {
        void Promise.all([loadManagement(), searchPayers("")]);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [loadManagement, searchPayers]);

  useEffect(() => {
    if (!isTenantComboboxOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void searchPayers(payerSearch);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [isTenantComboboxOpen, payerSearch, searchPayers]);

  useEffect(() => {
    if (!isGuarantorComboboxOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void searchPayers(guarantorSearch);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [guarantorSearch, isGuarantorComboboxOpen, searchPayers]);

  async function saveLease(values: LeaseFormValues) {
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/lease`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: values.tenantId,
            status: values.status,
            contractNumber: values.contractNumber,
            startDate: values.startDate,
            endDate: values.endDate,
            paymentDueDay: values.paymentDueDay
              ? Number(values.paymentDueDay)
              : null,
            rentAmountCents: Number(onlyDigits(values.rentAmount)),
            guaranteeType: values.guaranteeType,
            guaranteeAmountCents: Number(
              onlyDigits(values.guaranteeAmount)
            ),
            guarantorId: values.guarantorId || null,
            adjustmentIndex: values.adjustmentIndex,
            nextAdjustmentDate: values.nextAdjustmentDate,
            notes: values.notes,
          }),
        }
      );
      const payload = (await response.json()) as
        | RealEstateLeaseManagementResponse
        | { message?: string };

      if (!response.ok || !("lease" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível salvar o contrato."
        );
      }

      setData(payload);
      setActiveTab("resumo");
      toast.success("Contrato do imóvel atualizado");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o contrato."
      );
    } finally {
      setIsSaving(false);
      setCycleAction(null);
    }
  }

  async function handleSubmit(values: LeaseFormValues) {
    await saveLease(values);
  }

  async function handleCycleAction(status: RealEstateLeaseStatus) {
    setCycleAction(status);
    await saveLease({ ...form.getValues(), status });
    form.setValue("status", status);
  }

  function handleClientCreated(payer: Payer) {
    setPayers((current) =>
      current.some((item) => item.id === payer.id) ? current : [payer, ...current]
    );

    if (clientSheetContext === "tenant") {
      form.setValue("tenantId", payer.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setPayerSearch(payer.name);
    }

    if (clientSheetContext === "guarantor") {
      form.setValue("guarantorId", payer.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setGuarantorSearch(payer.name);
    }

    setClientSheetContext(null);
  }

  if (isLoading) {
    return <ManagementState loading>Carregando contrato do imóvel...</ManagementState>;
  }

  if (!data) {
    return <ManagementState>Não foi possível carregar o contrato do imóvel.</ManagementState>;
  }

  const isRental = ["aluguel", "locacao"].includes(
    normalizeMotive(data.asset.motive)
  );
  const currentStatus = data.lease?.status ?? "draft";
  const selectedTenant = payers.find((payer) => payer.id === tenantId);
  const selectedGuarantor = payers.find((payer) => payer.id === guarantorId);
  const tenantDocument =
    selectedTenant?.document || data.lease?.tenantDocument || "";
  const guarantorDocument =
    selectedGuarantor?.document || data.lease?.guarantorDocument || "";
  const durationLabel = getDurationLabel(watchedStartDate, watchedEndDate);
  const contractDateValue =
    data.lease?.createdAt?.slice(0, 10) ?? todayDateInputValue();
  const normalizedPayerSearch = normalizeSearchText(payerSearch);
  const payerSearchDigits = onlyDigits(payerSearch);
  const visiblePayers = payers.filter((payer) => {
    if (!normalizedPayerSearch && !payerSearchDigits) {
      return true;
    }

    return (
      normalizeSearchText(payer.name).includes(normalizedPayerSearch) ||
      onlyDigits(payer.document).includes(payerSearchDigits)
    );
  });
  const normalizedGuarantorSearch = normalizeSearchText(guarantorSearch);
  const guarantorSearchDigits = onlyDigits(guarantorSearch);
  const visibleGuarantors = payers.filter((payer) => {
    if (!normalizedGuarantorSearch && !guarantorSearchDigits) {
      return true;
    }

    return (
      normalizeSearchText(payer.name).includes(normalizedGuarantorSearch) ||
      onlyDigits(payer.document).includes(guarantorSearchDigits)
    );
  });
  const clientSheetRoles: ClientRole[] =
    clientSheetContext === "guarantor" ? ["guarantor"] : ["tenant"];
  const lease = data.lease;
  const contractNumberLabel =
    lease?.contractNumber || "Será gerado ao salvar";
  const tenantNameLabel =
    selectedTenant?.name || lease?.tenantName || "Cliente não selecionado";
  const rentAmountLabel = lease?.rentAmountCents
    ? centsToMoney(lease.rentAmountCents)
    : centsToMoney(Number(onlyDigits(form.getValues("rentAmount"))));
  const dueDayLabel =
    lease?.paymentDueDay || form.getValues("paymentDueDay")
      ? `Todo dia ${lease?.paymentDueDay ?? form.getValues("paymentDueDay")}`
      : "Não definido";
  const periodLabel =
    lease?.startDate && lease?.endDate
      ? `${formatDateLabel(lease.startDate)} até ${formatDateLabel(lease.endDate)}`
      : watchedStartDate && watchedEndDate
        ? `${formatDateLabel(watchedStartDate)} até ${formatDateLabel(watchedEndDate)}`
        : "Não definido";
  const nextStepItems =
    currentStatus === "draft"
      ? [
          "Conferir dados principais do contrato",
          "Anexar documentos e contrato assinado",
          "Ativar contrato para iniciar o ciclo",
        ]
      : currentStatus === "active"
        ? [
            "Manter documentos atualizados",
            "Preparar cobranças mensais do contrato",
            "Acompanhar histórico e eventos da locação",
          ]
        : currentStatus === "ended"
          ? [
              "Conferir vistoria final e pendências",
              "Manter documentos arquivados",
              "Consultar histórico sempre que necessário",
            ]
          : [
              "Contrato cancelado e sem ações operacionais",
              "Consultar histórico para auditoria",
              "Criar novo contrato se a negociação avançar novamente",
            ];
  const cycleSteps: Array<{
    status: RealEstateLeaseStatus;
    title: string;
    description: string;
  }> = [
    {
      status: "draft",
      title: "Preparação",
      description: "Cadastro e conferência dos dados.",
    },
    {
      status: "active",
      title: "Vigente",
      description: "Locação ativa e imóvel alugado.",
    },
    {
      status: "ended",
      title: "Encerramento",
      description: "Entrega, vistoria final e liberação.",
    },
  ];

  if (!isRental) {
    return (
      <div className="space-y-5">
        <FormPageHeader
          backLabel="Voltar para imóveis"
          badge="Contrato"
          onBack={() => router.push(returnHref)}
          title="Contrato do imóvel"
        />
        <ManagementState>
          <div className="mx-auto max-w-3xl space-y-5 text-left">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Ciclo de venda do imóvel
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Para venda, o fluxo profissional deve ser tratado como negociação:
                proposta, sinal, contrato de compra e venda, documentação,
                escritura e conclusão.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                "Captação",
                "Proposta",
                "Sinal",
                "Escritura",
                "Concluída",
              ].map((step, index) => (
                <div
                  className="rounded-xl border bg-card p-3 text-center shadow-sm"
                  key={step}
                >
                  <div className="mx-auto mb-2 flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium">{step}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              O próximo passo recomendado é criarmos uma rota própria de
              negociação de venda para não misturar compra e venda com contrato
              de locação.
            </p>
          </div>
        </ManagementState>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormPageHeader
          backLabel="Voltar para imóveis"
          badge="Contrato"
          onBack={() => router.push(returnHref)}
          title="Contrato do imóvel"
          actions={
            <SemanticStatusBadge
              tone={
                currentStatus === "active"
                  ? "success"
                  : currentStatus === "draft"
                    ? "warning"
                    : "neutral"
              }
            >
              {statusLabels[currentStatus]}
            </SemanticStatusBadge>
          }
        />

        <PayerSheet
          defaultRoles={clientSheetRoles}
          onOpenChange={(open) => {
            if (!open) {
              setClientSheetContext(null);
            }
          }}
          onSaved={handleClientCreated}
          open={Boolean(clientSheetContext)}
          title={
            clientSheetContext === "guarantor"
              ? "Novo fiador"
              : "Novo inquilino"
          }
        />

        <Tabs
          className="space-y-5"
          onValueChange={setActiveTab}
          value={activeTab}
        >
          <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="contrato">Contrato</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-5">
            <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
              <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <SemanticStatusBadge
                      tone={
                        currentStatus === "active"
                          ? "success"
                          : currentStatus === "draft"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {statusLabels[currentStatus]}
                    </SemanticStatusBadge>
                    <span className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                      {contractNumberLabel}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {currentStatus === "draft"
                        ? "Contrato salvo. Agora é hora de concluir o ciclo."
                        : currentStatus === "active"
                          ? "Contrato ativo e pronto para operação."
                          : currentStatus === "ended"
                            ? "Contrato encerrado e arquivado."
                            : "Contrato cancelado."}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      {statusDescriptions[currentStatus]}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {currentStatus === "draft" ? (
                      <Button
                        disabled={isSaving}
                        onClick={() => void handleCycleAction("active")}
                        type="button"
                      >
                        {cycleAction === "active" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        Ativar contrato
                      </Button>
                    ) : null}
                    {currentStatus === "active" ? (
                      <Button
                        onClick={() => setActiveTab("cobrancas")}
                        type="button"
                      >
                        <ReceiptText className="size-4" />
                        Preparar cobranças
                      </Button>
                    ) : null}
                    <Button
                      onClick={() => setActiveTab("documentos")}
                      type="button"
                      variant="outline"
                    >
                      <FileText className="size-4" />
                      Documentos
                    </Button>
                    <Button
                      onClick={() => setActiveTab("contrato")}
                      type="button"
                      variant="outline"
                    >
                      <ClipboardList className="size-4" />
                      Revisar dados
                    </Button>
                    {currentStatus === "active" ? (
                      <Button
                        disabled={isSaving}
                        onClick={() => void handleCycleAction("ended")}
                        type="button"
                        variant="outline"
                      >
                        {cycleAction === "ended" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        Encerrar contrato
                      </Button>
                    ) : null}
                    {currentStatus !== "ended" && currentStatus !== "canceled" ? (
                      <Button
                        disabled={isSaving}
                        onClick={() => void handleCycleAction("canceled")}
                        type="button"
                        variant="outline"
                      >
                        {cycleAction === "canceled" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <XCircle className="size-4" />
                        )}
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                  <p className="text-sm font-semibold">Próximos passos</p>
                  <div className="mt-4 space-y-3">
                    {nextStepItems.map((item, index) => (
                      <div className="flex gap-3" key={item}>
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <p className="pt-1 text-sm text-muted-foreground">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Cliente</CardDescription>
              <CardTitle>{tenantNameLabel}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Vigência</CardDescription>
              <CardTitle>{periodLabel}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Aluguel</CardDescription>
              <CardTitle>{rentAmountLabel || "Não definido"}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Vencimento</CardDescription>
              <CardTitle>{dueDayLabel}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Ciclo da locação
            </CardTitle>
            <CardDescription>
              Acompanhe o estágio do contrato e execute as ações principais da
              locação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {cycleSteps.map((step) => {
                const isCurrent = step.status === currentStatus;
                const isCompleted =
                  currentStatus === "active" && step.status === "draft";
                const Icon = isCurrent || isCompleted ? CheckCircle2 : ClipboardList;

                return (
                  <div
                    className={
                      isCurrent
                        ? "rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm"
                        : "rounded-xl border bg-background p-4"
                    }
                    key={step.status}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={
                          isCurrent || isCompleted
                            ? "size-4 text-primary"
                            : "size-4 text-muted-foreground"
                        }
                      />
                      <p className="font-medium">{step.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-medium">
                {statusLabels[currentStatus]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusDescriptions[currentStatus]}
              </p>
            </div>
          </CardContent>
        </Card>

          </TabsContent>

          <TabsContent value="contrato" className="space-y-5">
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <section className={contractCardClassName}>
              <div className={contractCardHeaderClassName}>
                <span className={contractCardIconWrapClassName}>
                  <FileText className="size-4" />
                </span>
                <div>
                  <p className="font-semibold tracking-tight">
                    Dados do contrato
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Identificação, situação e tipo do contrato vinculado ao imóvel.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm leading-none font-medium">
                    Data *
                  </label>
                  <Input
                    className={contractInputClassName}
                    readOnly
                    type="date"
                    value={contractDateValue}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Situação *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className={`${contractInputClassName} w-full`}>
                            <SelectValue>
                              {statusLabels[field.value] ?? "Selecione"}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <label className="text-sm leading-none font-medium">
                    Tipo *
                  </label>
                  <Input
                    className={contractInputClassName}
                    readOnly
                    value={getMotiveLabel(data.asset.motive)}
                  />
                </div>
              </div>
            </section>

            <section className={contractCardClassName}>
              <div className={contractCardHeaderClassName}>
                <span className={contractCardIconWrapClassName}>
                  <Building2 className="size-4" />
                </span>
                <div>
                  <p className="font-semibold tracking-tight">Locador</p>
                  <p className="text-xs text-muted-foreground">
                    Dados bloqueados porque já vêm do imóvel selecionado.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
                <Input
                  className={contractInputClassName}
                  readOnly
                  value={data.asset.landlordName ?? ""}
                  placeholder="Locador *"
                />
                <Input
                  className={contractInputClassName}
                  readOnly
                  value={
                    data.asset.landlordDocument
                      ? formatDocument(data.asset.landlordDocument)
                      : ""
                  }
                  placeholder="Documento"
                />
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className={contractCardClassName}>
              <div className={contractCardHeaderClassName}>
                <span className={contractCardIconWrapClassName}>
                  <UsersRound className="size-4" />
                </span>
                <div>
                  <p className="font-semibold tracking-tight">Cliente</p>
                  <p className="text-xs text-muted-foreground">
                    Selecione o cliente do contrato ou cadastre um novo sem sair da tela.
                  </p>
                </div>
              </div>
              <FormField
                control={form.control}
                name="tenantId"
                rules={{ required: "Selecione o inquilino." }}
                render={({ field }) => (
                  <FormItem>
                    <ContractPersonPicker
                      buttonLabel="Novo cliente"
                      document={tenantDocument}
                      inputValue={payerSearch}
                      isLoading={isLoadingPayers}
                      isOpen={isTenantComboboxOpen}
                      onCreate={() => setClientSheetContext("tenant")}
                      onInputBlur={() => {
                        window.setTimeout(
                          () => setIsTenantComboboxOpen(false),
                          120
                        );
                      }}
                      onInputFocus={() => setIsTenantComboboxOpen(true)}
                      onOpenChange={setIsTenantComboboxOpen}
                      onSearchChange={(value) => {
                        setPayerSearch(value);
                        setIsTenantComboboxOpen(true);

                        if (field.value) {
                          field.onChange("");
                        }
                      }}
                      onSelect={(payer) => {
                        field.onChange(payer.id);
                        setPayerSearch(payer.name);
                        setIsTenantComboboxOpen(false);
                      }}
                      payers={visiblePayers}
                      placeholder="Cliente *"
                      selectedId={field.value}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className={contractCardClassName}>
              <div className={contractCardHeaderClassName}>
                <span className={contractCardIconWrapClassName}>
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <p className="font-semibold tracking-tight">Fiador</p>
                  <p className="text-xs text-muted-foreground">
                    Informe apenas quando a garantia do contrato exigir um fiador.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 overflow-visible md:grid-cols-[minmax(0,1fr)_11rem_auto]">
                <FormField
                  control={form.control}
                  name="guarantorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              autoComplete="off"
                              className={`${contractInputClassName} pr-10 pl-9`}
                              onBlur={() => {
                                window.setTimeout(
                                  () => setIsGuarantorComboboxOpen(false),
                                  120
                                );
                              }}
                              onChange={(event) => {
                                setGuarantorSearch(event.target.value);
                                setIsGuarantorComboboxOpen(true);

                                if (field.value) {
                                  field.onChange("");
                                }
                              }}
                              onFocus={() => setIsGuarantorComboboxOpen(true)}
                              placeholder="Fiador"
                              value={guarantorSearch}
                            />
                            <button
                              aria-label="Abrir lista de fiadores"
                              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() =>
                                setIsGuarantorComboboxOpen((current) => !current)
                              }
                              type="button"
                            >
                              {isLoadingPayers ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <ChevronsUpDown className="size-4" />
                              )}
                            </button>
                          </div>

                          {isGuarantorComboboxOpen &&
                          visibleGuarantors.length > 0 ? (
                            <div className="absolute z-50 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                              <div className="max-h-72 overflow-y-auto p-1">
                                {visibleGuarantors.map((payer) => {
                                  const isSelected = payer.id === field.value;

                                  return (
                                    <button
                                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                                      key={payer.id}
                                      onMouseDown={(event) =>
                                        event.preventDefault()
                                      }
                                      onClick={() => {
                                        field.onChange(payer.id);
                                        form.setValue("guaranteeType", "guarantor");
                                        setGuarantorSearch(payer.name);
                                        setIsGuarantorComboboxOpen(false);
                                      }}
                                      type="button"
                                    >
                                      <span className="mt-0.5 flex size-4 items-center justify-center text-primary">
                                        {isSelected ? (
                                          <Check className="size-4" />
                                        ) : null}
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium">
                                          {payer.name}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                          {payer.document ||
                                            "Documento não informado"}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Input
                  className={contractInputClassName}
                  readOnly
                  value={
                    guarantorDocument ? formatDocument(guarantorDocument) : ""
                  }
                  placeholder="Documento"
                />
                <Button
                  className="h-9 whitespace-nowrap rounded-lg"
                  onClick={() => setClientSheetContext("guarantor")}
                  type="button"
                  variant="outline"
                >
                  <Plus className="size-4" />
                  Novo fiador
                </Button>
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className={contractCardClassName}>
              <div className={contractCardHeaderClassName}>
                <span className={contractCardIconWrapClassName}>
                  <Clock3 className="size-4" />
                </span>
                <div>
                  <p className="font-semibold tracking-tight">Duração</p>
                  <p className="text-xs text-muted-foreground">
                    Defina o período de vigência e acompanhe o tempo calculado.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  rules={{ required: "Informe o início." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          className={contractInputClassName}
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  rules={{ required: "Informe o término." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          className={contractInputClassName}
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Input
                  className={contractInputClassName}
                  placeholder="Tempo"
                  readOnly
                  value={durationLabel}
                />
              </div>
            </section>

            <section className={contractCardClassName}>
              <div className={contractCardHeaderClassName}>
                <span className={contractCardIconWrapClassName}>
                  <RefreshCw className="size-4" />
                </span>
                <div>
                  <p className="font-semibold tracking-tight">Reajuste</p>
                  <p className="text-xs text-muted-foreground">
                    Configure o índice e a próxima data de atualização do contrato.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="adjustmentIndex"
                  render={({ field }) => (
                    <FormItem>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className={`${contractInputClassName} w-full`}>
                            <SelectValue>
                              {adjustmentLabels[field.value] ?? "Tipo"}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(adjustmentLabels).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nextAdjustmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          className={contractInputClassName}
                          type="date"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Input
                  className={contractInputClassName}
                  placeholder="Valor índice"
                  readOnly
                />
              </div>
            </section>
          </div>
        </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => router.push(returnHref)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar contrato
              </Button>
            </div>

          </TabsContent>

          <TabsContent value="documentos" className="space-y-5">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/25">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Central de documentos
                </CardTitle>
                <CardDescription>
                  Organize os arquivos essenciais da locação antes e depois da ativação.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    "Contrato assinado",
                    "Documentos do cliente",
                    "Documentos do fiador",
                    "Vistoria de entrada",
                    "Comprovantes",
                    "Anexos complementares",
                  ].map((item) => (
                    <div
                      className="rounded-2xl border bg-background p-4"
                      key={item}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-primary" />
                        <p className="font-medium">{item}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Mantenha este item anexado para consulta e auditoria.
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border bg-primary/5 p-4">
                  <p className="font-semibold">Próxima ação</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Abra a gestão de documentos para anexar, consultar ou remover arquivos do imóvel.
                  </p>
                  <Button
                    className="mt-4 w-full"
                    onClick={() =>
                      router.push(
                        `/imobiliaria/${assetId}/documentos?returnTab=${returnTab}`
                      )
                    }
                    type="button"
                  >
                    <FileText className="size-4" />
                    Abrir documentos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cobrancas" className="space-y-5">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/25">
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="size-4 text-primary" />
                  Pré-faturamento da locação
                </CardTitle>
                <CardDescription>
                  Visualize os dados que serão usados para gerar mensalidades e boletos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Valor mensal</p>
                    <p className="mt-1 text-lg font-semibold">
                      {rentAmountLabel || "Não definido"}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Vencimento</p>
                    <p className="mt-1 text-lg font-semibold">{dueDayLabel}</p>
                  </div>
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="mt-1 text-lg font-semibold">
                      {currentStatus === "active"
                        ? "Liberado"
                        : "Aguardando ativação"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/25 p-4">
                  <p className="font-semibold">Como este módulo deve funcionar</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Quando implementarmos a geração de cobranças, esta etapa deverá criar as mensalidades do contrato,
                    permitir cobranças avulsas e enviar os boletos usando a gestão de cobrança já existente.
                  </p>
                </div>

                <Button
                  disabled={currentStatus !== "active"}
                  type="button"
                  variant="outline"
                >
                  <ReceiptText className="size-4" />
                  Gerar cobrança em breve
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              Histórico do contrato
            </CardTitle>
            <CardDescription>
              Registro das principais movimentações do ciclo da locação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.events.length > 0 ? (
              <div className="space-y-3">
                {data.events.map((event) => (
                  <div
                    className="flex gap-3 rounded-xl border bg-background p-3"
                    key={event.id}
                  >
                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <History className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{event.title}</p>
                      {event.description ? (
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum evento registrado ainda. Ao salvar, ativar, encerrar ou
                cancelar o contrato, o histórico será alimentado automaticamente.
              </p>
            )}
          </CardContent>
        </Card>

          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}
