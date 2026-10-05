"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Download,
  DollarSign,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Home,
  Loader2,
  ReceiptText,
  Send,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { FormPageHeader } from "@/components/management/form-page-header";
import { ManagementState } from "@/components/management/management-layout";
import {
  SemanticStatusBadge,
  type StatusTone,
} from "@/components/management/semantic-status-badge";
import { Button } from "@/components/ui/button";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  LocalBillingCharge,
  LocalBillingChargesResponse,
  LocalBillingChargeStatus,
} from "@/features/billing/types";
import type { RealEstateDocument } from "@/features/real-estate/documents";
import type {
  RealEstateContractDetailsResponse,
  RealEstateLeaseDocumentStatus,
  RealEstateLeaseStatus,
} from "@/features/real-estate/leases";
import { RealEstateMetricCard as MetricCard } from "@/features/real-estate/components/real-estate-metric-card";

type RealEstateContractDetailManagementProps = {
  contractId: string;
};

type ContractCycleStatus =
  | "created"
  | "draft_generated"
  | "pending_signature"
  | "signed"
  | "active";

type ContractDraftTemplate = "residential" | "commercial";

const returnTabs = ["resumo", "imoveis", "agenda", "cobrancas"] as const;

function getReturnTab(value?: string | null) {
  return returnTabs.includes(value as (typeof returnTabs)[number])
    ? value
    : "imoveis";
}

type MonthlyChargeForm = {
  competence: string;
  dueDate: string;
  iptu: string;
  condominium: string;
  reserveFund: string;
  water: string;
  energy: string;
  trash: string;
  gas: string;
  other: string;
  otherDescription: string;
};

const statusLabels: Record<RealEstateLeaseStatus, string> = {
  draft: "Em preparação",
  active: "Ativo",
  ended: "Encerrado",
  canceled: "Cancelado",
};

const documentStatusLabels: Record<RealEstateLeaseDocumentStatus, string> = {
  not_generated: "Minuta não gerada",
  draft_generated: "Minuta gerada",
  pending_signature: "Aguardando assinatura",
  signed: "Contrato assinado",
};

const draftTemplateLabels: Record<ContractDraftTemplate, string> = {
  residential: "Residencial",
  commercial: "Comercial",
};

const documentTypeLabels: Record<string, string> = {
  draft: "Minuta",
  signed_contract: "Contrato assinado",
};

const localChargeStatusLabels: Record<LocalBillingChargeStatus, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  pending_emission: "Pendente de emissão",
  emitted: "Emitida",
  emission_failed: "Falha na emissão",
  paid: "Paga",
  overdue: "Vencida",
  canceled: "Cancelada",
};

const monthlyChargeCostFields: Array<{
  key: keyof MonthlyChargeForm;
  itemKey: string;
  label: string;
}> = [
  { key: "iptu", itemKey: "iptu", label: "IPTU" },
  { key: "condominium", itemKey: "condominium", label: "Condomínio" },
  { key: "reserveFund", itemKey: "reserve_fund", label: "Fundo reserva" },
  { key: "water", itemKey: "water", label: "Água" },
  { key: "energy", itemKey: "energy", label: "Energia" },
  { key: "trash", itemKey: "trash", label: "Lixo" },
  { key: "gas", itemKey: "gas", label: "Gás" },
  { key: "other", itemKey: "other", label: "Outros" },
];

const cycleSteps: Array<{
  status: ContractCycleStatus;
  title: string;
  description: string;
}> = [
  {
    status: "created",
    title: "Contrato criado",
    description: "Dados principais cadastrados.",
  },
  {
    status: "draft_generated",
    title: "Minuta",
    description: "PDF preparado para conferência.",
  },
  {
    status: "pending_signature",
    title: "Assinatura",
    description: "Documento enviado ou em coleta.",
  },
  {
    status: "signed",
    title: "Assinado",
    description: "Pronto para ativação.",
  },
  {
    status: "active",
    title: "Ativo",
    description: "Ciclo contratual concluído.",
  },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatCurrencyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function getCurrentCompetence() {
  return new Date().toISOString().slice(0, 7);
}

function getDefaultDueDate() {
  return new Date().toISOString().slice(0, 10);
}

function currencyTextToCents(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function formatCurrencyInput(value: string) {
  const cents = currencyTextToCents(value);

  if (!cents) {
    return "";
  }

  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getStatusTone(status: RealEstateLeaseStatus): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "warning";
  }

  if (status === "canceled") {
    return "overdue";
  }

  return "neutral";
}

function getLocalChargeTone(status: LocalBillingChargeStatus): StatusTone {
  if (status === "paid" || status === "emitted") {
    return "success";
  }

  if (status === "pending_emission" || status === "pending") {
    return "warning";
  }

  if (status === "overdue" || status === "emission_failed") {
    return "overdue";
  }

  return "neutral";
}

function getCycleStatus(
  data: RealEstateContractDetailsResponse
): ContractCycleStatus {
  if (data.lease.status === "active") {
    return "active";
  }

  if (data.lease.documentStatus === "signed") {
    return "signed";
  }

  if (data.lease.documentStatus === "pending_signature") {
    return "pending_signature";
  }

  if (data.lease.documentStatus === "draft_generated") {
    return "draft_generated";
  }

  return "created";
}

export function RealEstateContractDetailManagement({
  contractId,
}: RealEstateContractDetailManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTab = getReturnTab(searchParams.get("returnTab"));
  const hasOpenedDraftAction = useRef(false);
  const signedContractInputRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] =
    useState<RealEstateContractDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingDocumentStatus, setIsUpdatingDocumentStatus] =
    useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isDraftSheetOpen, setIsDraftSheetOpen] = useState(false);
  const [selectedDraftTemplate, setSelectedDraftTemplate] =
    useState<ContractDraftTemplate>("residential");
  const [contractDocuments, setContractDocuments] = useState<
    RealEstateDocument[]
  >([]);
  const [isLoadingContractDocuments, setIsLoadingContractDocuments] =
    useState(false);
  const [isUploadingSignedContract, setIsUploadingSignedContract] =
    useState(false);
  const [documentToDelete, setDocumentToDelete] =
    useState<RealEstateDocument | null>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [isActivatingContract, setIsActivatingContract] = useState(false);
  const [localCharges, setLocalCharges] = useState<LocalBillingCharge[]>([]);
  const [isLoadingLocalCharges, setIsLoadingLocalCharges] = useState(false);
  const [isGeneratingLocalCharges, setIsGeneratingLocalCharges] =
    useState(false);
  const [isChargeSheetOpen, setIsChargeSheetOpen] = useState(false);
  const [monthlyChargeForm, setMonthlyChargeForm] =
    useState<MonthlyChargeForm>({
      competence: getCurrentCompetence(),
      dueDate: getDefaultDueDate(),
      iptu: "",
      condominium: "",
      reserveFund: "",
      water: "",
      energy: "",
      trash: "",
      gas: "",
      other: "",
      otherDescription: "",
    });

  const loadContract = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/real-estate/contracts/${contractId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | RealEstateContractDetailsResponse
        | { message?: string };

      if (!response.ok || !("lease" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar o contrato."
        );
      }

      setData(payload);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o contrato."
      );
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  const loadLocalCharges = useCallback(async () => {
    setIsLoadingLocalCharges(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractId}/charges`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as
        | LocalBillingChargesResponse
        | { message?: string };

      if (!response.ok || !("charges" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar as cobranças locais."
        );
      }

      setLocalCharges(payload.charges);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as cobranças locais."
      );
    } finally {
      setIsLoadingLocalCharges(false);
    }
  }, [contractId]);

  const loadContractDocuments = useCallback(async () => {
    setIsLoadingContractDocuments(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractId}/documents`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as
        | { documents: RealEstateDocument[]; total: number }
        | { message?: string };

      if (!response.ok || !("documents" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "NÃ£o foi possÃ­vel carregar os documentos do contrato."
        );
      }

      setContractDocuments(payload.documents);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "NÃ£o foi possÃ­vel carregar os documentos do contrato."
      );
    } finally {
      setIsLoadingContractDocuments(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (
      searchParams.get("action") !== "draft" ||
      hasOpenedDraftAction.current
    ) {
      return;
    }

    hasOpenedDraftAction.current = true;
    window.queueMicrotask(() => {
      setIsDraftSheetOpen(true);
    });
  }, [searchParams]);

  async function updateDocumentStatus(status: RealEstateLeaseDocumentStatus) {
    setIsUpdatingDocumentStatus(true);

    try {
      const response = await fetch(`/api/real-estate/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentStatus: status }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(
          payload.message ?? "Não foi possível atualizar o status documental."
        );
      }

      toast.success("Status documental atualizado");
      await loadContract();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o status documental."
      );
    } finally {
      setIsUpdatingDocumentStatus(false);
    }
  }

  async function generateDraftPdf(templateType: ContractDraftTemplate) {
    setIsGeneratingDraft(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractId}/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateType }),
        }
      );
      const payload = (await response.json()) as {
        document?: { url?: string; downloadUrl?: string; originalName?: string };
        message?: string;
      };

      if (!response.ok || !payload.document) {
        throw new Error(
          payload.message ?? "Não foi possível gerar a minuta em PDF."
        );
      }

      toast.success(
        `Minuta ${draftTemplateLabels[templateType].toLowerCase()} gerada e anexada ao contrato`
      );

      const pdfUrl = payload.document.url || payload.document.downloadUrl;
      if (pdfUrl) {
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
      }

      await loadContract();
      await loadContractDocuments();
      setIsDraftSheetOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a minuta em PDF."
      );
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  async function uploadSignedContract(file?: File | null) {
    if (!file) {
      return;
    }

    setIsUploadingSignedContract(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/real-estate/contracts/${contractId}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );
      const payload = (await response.json()) as
        | { document: RealEstateDocument; documents: RealEstateDocument[] }
        | { message?: string };

      if (!response.ok || !("document" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "NÃ£o foi possÃ­vel anexar o contrato assinado."
        );
      }

      toast.success("Contrato assinado anexado. AtivaÃ§Ã£o liberada.");
      setContractDocuments(payload.documents);
      await loadContract();
      await loadContractDocuments();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "NÃ£o foi possÃ­vel anexar o contrato assinado."
      );
    } finally {
      setIsUploadingSignedContract(false);

      if (signedContractInputRef.current) {
        signedContractInputRef.current.value = "";
      }
    }
  }

  function requestSignedContractUpload() {
    signedContractInputRef.current?.click();
  }

  async function deleteContractDocument() {
    if (!documentToDelete) {
      return;
    }

    setIsDeletingDocument(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractId}/documents?documentId=${encodeURIComponent(
          documentToDelete.id
        )}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as
        | {
            documents: RealEstateDocument[];
            documentStatus: RealEstateLeaseDocumentStatus;
          }
        | { message?: string };

      if (!response.ok || !("documents" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "NÃ£o foi possÃ­vel excluir o documento."
        );
      }

      setContractDocuments(payload.documents);
      setDocumentToDelete(null);
      toast.success("Documento removido");
      await loadContract();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "NÃ£o foi possÃ­vel excluir o documento."
      );
    } finally {
      setIsDeletingDocument(false);
    }
  }

  async function activateContract() {
    setIsActivatingContract(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractId}/activate`,
        { method: "POST" }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível ativar o contrato.");
      }

      toast.success("Contrato ativado com sucesso");
      await loadContract();
      await loadLocalCharges();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar o contrato."
      );
    } finally {
      setIsActivatingContract(false);
    }
  }

  async function generateLocalCharges() {
    setIsGeneratingLocalCharges(true);

    try {
      const lineItems = monthlyChargeCostFields
        .map((field) => {
          const amountCents = currencyTextToCents(
            String(monthlyChargeForm[field.key] ?? "")
          );

          if (amountCents <= 0) {
            return null;
          }

          return {
            key: field.itemKey,
            label: field.label,
            amountCents,
            description:
              field.itemKey === "other"
                ? monthlyChargeForm.otherDescription.trim() || null
                : null,
          };
        })
        .filter(Boolean);
      const response = await fetch(
        `/api/real-estate/contracts/${contractId}/charges`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competence: monthlyChargeForm.competence,
            dueDate: monthlyChargeForm.dueDate,
            lineItems,
          }),
        }
      );
      const payload = (await response.json()) as
        | LocalBillingChargesResponse
        | { message?: string };

      if (!response.ok || !("charges" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível gerar as cobranças locais."
        );
      }

      setLocalCharges(payload.charges);
      toast.success("Cobrança mensal gerada");
      setIsChargeSheetOpen(false);
      await loadContract();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar as cobranças locais."
      );
    } finally {
      setIsGeneratingLocalCharges(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    window.queueMicrotask(() => {
      if (isCurrent) {
        void loadContract();
        void loadLocalCharges();
        void loadContractDocuments();
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [loadContract, loadContractDocuments, loadLocalCharges]);

  const chargeSummary = useMemo(() => {
    const totalCents = localCharges.reduce(
      (total, charge) => total + charge.amountCents,
      0
    );
    const paidCents = localCharges
      .filter((charge) => charge.status === "paid")
      .reduce((total, charge) => total + charge.amountCents, 0);
    const pendingCents = localCharges
      .filter((charge) => charge.status !== "paid" && charge.status !== "canceled")
      .reduce((total, charge) => total + charge.amountCents, 0);
    const nextCharge = localCharges
      .filter((charge) => charge.status !== "paid" && charge.status !== "canceled")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    return {
      paidCents,
      pendingCents,
      totalCents,
      nextCharge,
    };
  }, [localCharges]);

  if (isLoading) {
    return <ManagementState loading>Carregando contrato...</ManagementState>;
  }

  if (!data) {
    return <ManagementState>Não foi possível carregar o contrato.</ManagementState>;
  }

  const cycleStatus = getCycleStatus(data);
  const currentCycleIndex = cycleSteps.findIndex(
    (step) => step.status === cycleStatus
  );
  const primaryAction =
    data.lease.status === "active"
      ? null
      : data.lease.documentStatus === "signed"
        ? {
            label: "Ativar contrato",
            icon: CheckCircle2,
            loading: isActivatingContract,
            disabled: isActivatingContract,
            onClick: activateContract,
          }
        : data.lease.documentStatus === "draft_generated"
            ? {
                label: "Informar envio para assinatura",
                icon: Send,
                loading: isUpdatingDocumentStatus,
                disabled: isUpdatingDocumentStatus,
                onClick: () => updateDocumentStatus("pending_signature"),
              }
            : data.lease.documentStatus === "not_generated"
              ? {
                  label: "Gerar minuta PDF",
                  icon: FileText,
                  loading: isGeneratingDraft,
                  disabled: isGeneratingDraft,
                  onClick: () => setIsDraftSheetOpen(true),
                }
              : null;
  const PrimaryIcon = primaryAction?.icon;
  const signedContractDocument = contractDocuments.find(
    (document) => document.documentType === "signed_contract"
  );
  const latestDraftDocument = contractDocuments.find(
    (document) => document.documentType === "draft"
  );

  return (
    <div className="space-y-5">
      <input
        accept="application/pdf"
        className="hidden"
        onChange={(event) =>
          void uploadSignedContract(event.target.files?.item(0))
        }
        ref={signedContractInputRef}
        type="file"
      />

      <FormPageHeader
        backLabel="Voltar para imobiliária"
        badge="Contrato"
        onBack={() => router.push(`/imobiliaria?tab=${returnTab}`)}
        title={data.lease.contractNumber ?? "Contrato"}
        actions={
          <SemanticStatusBadge tone={getStatusTone(data.lease.status)}>
            {statusLabels[data.lease.status]}
          </SemanticStatusBadge>
        }
      />

      <Tabs defaultValue="resumo" className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="resumo">
            <Activity className="size-4" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileText className="size-4" />
            Documentos/PDF
          </TabsTrigger>
          <TabsTrigger value="cobrancas">
            <ReceiptText className="size-4" />
            Cobranças
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="size-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-5">
          <Card className="border-border/70 bg-card shadow-sm">
            <CardContent className="p-4 md:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SemanticStatusBadge tone={getStatusTone(data.lease.status)}>
                      {statusLabels[data.lease.status]}
                    </SemanticStatusBadge>
                    <SemanticStatusBadge tone="neutral">
                      {documentStatusLabels[data.lease.documentStatus]}
                    </SemanticStatusBadge>
                  </div>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Resumo do contrato
                  </p>
                  <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">
                    {data.asset.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.tenant.name} · {formatDate(data.lease.startDate)} até{" "}
                    {formatDate(data.lease.endDate)}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-sm font-medium">Próxima ação</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Conforme a etapa atual.
                  </p>
                  {primaryAction && PrimaryIcon ? (
                    <Button
                      className="mt-3 w-full"
                      disabled={primaryAction.disabled}
                      onClick={() => void primaryAction.onClick()}
                      type="button"
                    >
                      {primaryAction.loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PrimaryIcon className="size-4" />
                      )}
                      {primaryAction.label}
                    </Button>
                  ) : (
                    <p className="mt-3 rounded-xl bg-background p-2 text-sm text-muted-foreground">
                      Ciclo principal concluído.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Ciclo do contrato</CardTitle>
              <CardDescription>
                Progresso do contrato até a ativação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-5">
                {cycleSteps.map((step, index) => {
                  const isCurrent = index === currentCycleIndex;
                  const isDone = index < currentCycleIndex;

                  return (
                    <div
                      className={
                        isCurrent
                          ? "rounded-2xl border border-primary/40 bg-primary/5 p-3"
                          : isDone
                            ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950"
                            : "rounded-2xl border bg-background p-3"
                      }
                      key={step.status}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            isDone
                              ? "flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white"
                              : isCurrent
                                ? "flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                : "flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
                          }
                        >
                          {isDone ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <span className="text-xs font-semibold">
                              {index + 1}
                            </span>
                          )}
                        </span>
                        <p className="text-sm font-semibold">{step.title}</p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              description={data.asset.address ?? "Endereço não informado"}
              icon={Home}
              title="Imóvel"
              value={data.asset.title}
            />
            <MetricCard
              description={data.tenant.document}
              icon={UserRound}
              title="Cliente"
              value={data.tenant.name}
            />
            <MetricCard
              description={`${formatDate(data.lease.startDate)} até ${formatDate(
                data.lease.endDate
              )}`}
              icon={CalendarClock}
              title="Vigência"
              value={data.lease.status === "active" ? "Contrato vigente" : "Em preparação"}
            />
            <MetricCard
              description="Valor mensal do contrato"
              icon={DollarSign}
              title="Aluguel"
              value={formatCurrencyFromCents(data.lease.rentAmountCents)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card>
              <CardHeader>
                <CardTitle>Próximos passos</CardTitle>
                <CardDescription>
                  Ações recomendadas para concluir ou manter o ciclo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {cycleSteps.map((step, index) => (
                  <div className="flex gap-3" key={step.status}>
                    <span
                      className={
                        index <= currentCycleIndex
                          ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                          : "flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                      }
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Partes</CardTitle>
                <CardDescription>Participantes vinculados ao contrato.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Locador</p>
                  <p className="font-medium">
                    {data.landlord.name ?? "Não informado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.landlord.document ?? "Documento não informado"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{data.tenant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.tenant.document}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fiador</p>
                  <p className="font-medium">
                    {data.guarantor?.name ?? "Não informado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.guarantor?.document ?? "Documento não informado"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Ciclo documental</CardTitle>
              <CardDescription>
                Controle a etapa documental antes da ativação do contrato.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-muted/25 p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <SemanticStatusBadge tone="neutral">
                      {documentStatusLabels[data.lease.documentStatus]}
                    </SemanticStatusBadge>
                    {data.lease.documentStatus === "not_generated" ? (
                      <>
                        <p className="font-semibold">PrÃ³ximo passo: gerar a minuta</p>
                        <p className="text-sm text-muted-foreground">
                          Escolha o modelo residencial ou comercial e gere o PDF
                          para conferÃªncia das partes.
                        </p>
                      </>
                    ) : data.lease.documentStatus === "draft_generated" ? (
                      <>
                        <p className="font-semibold">
                          PrÃ³ximo passo: enviar para assinatura
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Confira a minuta. Se estiver correta, envie para as
                          partes assinarem e registre o envio aqui.
                        </p>
                      </>
                    ) : data.lease.documentStatus === "pending_signature" ? (
                      <>
                        <p className="font-semibold">
                          PrÃ³ximo passo: anexar contrato assinado
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Depois que todas as partes assinarem, anexe o PDF final.
                          SÃ³ depois disso o contrato serÃ¡ liberado para ativaÃ§Ã£o.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">
                          Contrato assinado anexado
                        </p>
                        <p className="text-sm text-muted-foreground">
                          O contrato possui PDF assinado e jÃ¡ pode ser ativado
                          para iniciar o financeiro.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                    {data.lease.documentStatus === "not_generated" ? (
                      <Button
                        disabled={isGeneratingDraft}
                        onClick={() => setIsDraftSheetOpen(true)}
                        type="button"
                      >
                        {isGeneratingDraft ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                        Gerar minuta
                      </Button>
                    ) : data.lease.documentStatus === "draft_generated" ? (
                      <>
                        {latestDraftDocument?.url ? (
                          <Button
                            onClick={() =>
                              window.open(
                                latestDraftDocument.url,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            type="button"
                            variant="outline"
                          >
                            <ExternalLink className="size-4" />
                            Ver minuta
                          </Button>
                        ) : null}
                        <Button
                          disabled={isUpdatingDocumentStatus}
                          onClick={() =>
                            void updateDocumentStatus("pending_signature")
                          }
                          type="button"
                        >
                          {isUpdatingDocumentStatus ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                          Informar envio
                        </Button>
                      </>
                    ) : data.lease.documentStatus === "pending_signature" ? (
                      <Button
                        disabled={isUploadingSignedContract}
                        onClick={requestSignedContractUpload}
                        type="button"
                      >
                        {isUploadingSignedContract ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        Anexar PDF assinado
                      </Button>
                    ) : (
                      <>
                        {signedContractDocument?.url ? (
                          <Button
                            onClick={() =>
                              window.open(
                                signedContractDocument.url,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            type="button"
                            variant="outline"
                          >
                            <ExternalLink className="size-4" />
                            Ver contrato assinado
                          </Button>
                        ) : null}
                        <Button
                          disabled={
                            isActivatingContract ||
                            data.lease.status === "active"
                          }
                          onClick={() => void activateContract()}
                          type="button"
                        >
                          {isActivatingContract ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                          Ativar contrato
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Documentos do contrato</p>
                    <p className="text-sm text-muted-foreground">
                      Minutas e arquivos vinculados a este contrato.
                    </p>
                  </div>
                  <SemanticStatusBadge tone="neutral">
                    {contractDocuments.length} arquivo
                    {contractDocuments.length === 1 ? "" : "s"}
                  </SemanticStatusBadge>
                </div>

                {isLoadingContractDocuments ? (
                  <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                    Carregando documentos do contrato...
                  </div>
                ) : contractDocuments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center">
                    <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <FileText className="size-5" />
                    </div>
                    <p className="mt-3 font-medium">
                      Nenhum documento gerado para este contrato
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Gere a minuta residencial ou comercial para iniciar o ciclo
                      documental.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contractDocuments.map((document) => (
                      <div
                        className="flex flex-col gap-3 rounded-2xl border p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                        key={document.id}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <FileCheck2 className="size-4 text-primary" />
                            <p className="truncate font-medium">
                              {document.originalName}
                            </p>
                            {document.documentType ? (
                              <SemanticStatusBadge
                                tone={
                                  document.documentType === "signed_contract"
                                    ? "success"
                                    : "warning"
                                }
                              >
                                {documentTypeLabels[document.documentType] ??
                                  document.documentType}
                              </SemanticStatusBadge>
                            ) : null}
                            {document.templateType === "residential" ||
                            document.templateType === "commercial" ? (
                              <SemanticStatusBadge tone="neutral">
                                {
                                  draftTemplateLabels[
                                    document.templateType as ContractDraftTemplate
                                  ]
                                }
                              </SemanticStatusBadge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Gerado em {formatDate(document.createdAt)} Â·{" "}
                            {formatFileSize(document.sizeBytes)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={!document.url}
                            onClick={() =>
                              window.open(
                                document.url,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <ExternalLink className="size-4" />
                            Abrir
                          </Button>
                          <Button
                            disabled={!document.downloadUrl}
                            onClick={() =>
                              window.open(
                                document.downloadUrl,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Download className="size-4" />
                            Baixar
                          </Button>
                          <Button
                            disabled={
                              data.lease.status === "active" &&
                              document.documentType === "signed_contract"
                            }
                            onClick={() => setDocumentToDelete(document)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Trash2 className="size-4" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cobrancas" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              description="Soma de todas as mensalidades locais"
              icon={ReceiptText}
              title="Total do contrato"
              value={formatCurrencyFromCents(chargeSummary.totalCents)}
            />
            <MetricCard
              description="Valores ainda em aberto"
              icon={AlertCircle}
              title="Pendente"
              value={formatCurrencyFromCents(chargeSummary.pendingCents)}
            />
            <MetricCard
              description="Valores marcados como pagos"
              icon={CheckCircle2}
              title="Pago"
              value={formatCurrencyFromCents(chargeSummary.paidCents)}
            />
            <MetricCard
              description="Próxima parcela aberta"
              icon={CalendarClock}
              title="Próximo vencimento"
              value={
                chargeSummary.nextCharge
                  ? formatDate(chargeSummary.nextCharge.dueDate)
                  : "-"
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ativação e cobranças</CardTitle>
              <CardDescription>
                O contrato precisa estar ativo para gerar a cobrança mensal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.lease.status === "active" ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Contrato ativo</p>
                      <p className="mt-1 text-sm">
                        O imóvel já foi marcado como alugado. As cobranças
                        locais podem ser geradas e acompanhadas sem TecnoSpeed.
                      </p>
                    </div>
                  </div>
                </div>
              ) : data.lease.documentStatus === "signed" ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Pronto para ativação</p>
                      <p className="mt-1 text-sm">
                        O contrato está assinado. Ao ativar, ele passa a ficar
                        vigente e o imóvel será marcado como alugado.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Assinatura pendente</p>
                      <p className="mt-1 text-sm">
                        Antes de ativar, gere a minuta, colete a assinatura e
                        marque o contrato como assinado na aba Documentos/PDF.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  disabled={
                    isActivatingContract ||
                    data.lease.status === "active" ||
                    data.lease.documentStatus !== "signed"
                  }
                  onClick={() => void activateContract()}
                  type="button"
                >
                  {isActivatingContract ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Ativar contrato
                </Button>
                <Button
                  disabled={
                    isGeneratingLocalCharges ||
                    data.lease.status !== "active"
                  }
                  onClick={() => setIsChargeSheetOpen(true)}
                  type="button"
                >
                  <ReceiptText className="size-4" />
                  Gerar cobrança do mês
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cobranças mensais</CardTitle>
              <CardDescription>
                Competências salvas no Fortusys. Esta lista não depende da
                TecnoSpeed para carregar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLocalCharges ? (
                <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                  Carregando cobranças locais...
                </div>
              ) : localCharges.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center">
                  <p className="font-medium">Nenhuma cobrança mensal gerada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ative o contrato e gere a cobrança de cada mês para acompanhar o
                    financeiro sem depender da TecnoSpeed.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {localCharges.map((charge) => (
                    <div
                      className="flex flex-col gap-3 rounded-2xl border p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                      key={charge.id}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{charge.description}</p>
                          <SemanticStatusBadge
                            tone={getLocalChargeTone(charge.status)}
                          >
                            {localChargeStatusLabels[charge.status]}
                          </SemanticStatusBadge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Vencimento {formatDate(charge.dueDate)}
                          {charge.installmentNumber && charge.installmentTotal
                            ? ` · Parcela ${charge.installmentNumber}/${charge.installmentTotal}`
                            : ""}
                          {charge.competence ? ` · Competência ${charge.competence}` : ""}
                        </p>
                        {charge.lineItems.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {charge.lineItems.map((item) => (
                              <span
                                className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                                key={`${charge.id}-${item.key}`}
                              >
                                {item.label}
                                {item.description ? ` (${item.description})` : ""}:{" "}
                                {formatCurrencyFromCents(item.amountCents)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {charge.tecnospeedMessages ? (
                          <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
                            Mensagem boleto:{" "}
                            {[charge.tecnospeedMessages.message1, charge.tecnospeedMessages.message2]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-semibold">
                          {formatCurrencyFromCents(charge.amountCents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {charge.providerReference
                            ? `TecnoSpeed ${charge.providerReference}`
                            : "Ainda não emitida"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
              <CardDescription>
                Eventos registrados para este contrato.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum evento registrado.
                </p>
              ) : (
                data.events.map((event) => (
                  <div className="rounded-xl border p-3" key={event.id}>
                    <p className="font-medium">{event.title}</p>
                    {event.description ? (
                      <p className="text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet onOpenChange={setIsDraftSheetOpen} open={isDraftSheetOpen}>
        <SheetContent className="w-full sm:max-w-[34rem]">
          <SheetHeader>
            <SheetTitle>Gerar minuta do contrato</SheetTitle>
            <SheetDescription>
              Escolha o modelo correto antes de gerar o PDF para conferÃªncia e
              assinatura.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 px-4">
            {(["residential", "commercial"] as ContractDraftTemplate[]).map(
              (template) => {
                const isSelected = selectedDraftTemplate === template;

                return (
                  <button
                    className={
                      isSelected
                        ? "w-full rounded-2xl border border-primary bg-primary/5 p-4 text-left ring-2 ring-primary/15 transition"
                        : "w-full rounded-2xl border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-muted/30"
                    }
                    key={template}
                    onClick={() => setSelectedDraftTemplate(template)}
                    type="button"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="size-5" />
                      </span>
                      <span>
                        <span className="block font-semibold">
                          Contrato {draftTemplateLabels[template]}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {template === "commercial"
                            ? "Modelo para locaÃ§Ã£o comercial, com clÃ¡usulas de atividade, licenÃ§as e medidas de cobranÃ§a."
                            : "Modelo para locaÃ§Ã£o residencial, com clÃ¡usulas de moradia, conservaÃ§Ã£o e convivÃªncia."}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              }
            )}
          </div>

          <SheetFooter>
            <Button
              disabled={isGeneratingDraft}
              onClick={() => setIsDraftSheetOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={isGeneratingDraft}
              onClick={() => void generateDraftPdf(selectedDraftTemplate)}
              type="button"
            >
              {isGeneratingDraft ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Gerar minuta {draftTemplateLabels[selectedDraftTemplate]}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet onOpenChange={setIsChargeSheetOpen} open={isChargeSheetOpen}>
        <SheetContent className="w-full sm:max-w-[42rem]">
          <SheetHeader>
            <SheetTitle>Gerar cobrança do mês</SheetTitle>
            <SheetDescription>
              Informe a competência, vencimento e custos adicionais para compor
              a mensalidade do contrato.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 overflow-y-auto px-4 pb-2">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Competência</label>
                  <Input
                    disabled={data.lease.status !== "active"}
                    onChange={(event) =>
                      setMonthlyChargeForm((current) => ({
                        ...current,
                        competence: event.target.value,
                      }))
                    }
                    type="month"
                    value={monthlyChargeForm.competence}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Vencimento</label>
                  <Input
                    disabled={data.lease.status !== "active"}
                    onChange={(event) =>
                      setMonthlyChargeForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    type="date"
                    value={monthlyChargeForm.dueDate}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Aluguel</label>
                  <Input
                    disabled
                    value={formatCurrencyFromCents(data.lease.rentAmountCents)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Custos adicionais</p>
                <p className="text-xs text-muted-foreground">
                  Esses valores serão somados ao aluguel e salvos para a mensagem
                  do boleto.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {monthlyChargeCostFields.map((field) => (
                  <div className="space-y-1" key={field.itemKey}>
                    <label className="text-sm font-medium">{field.label}</label>
                    <Input
                      disabled={data.lease.status !== "active"}
                      inputMode="numeric"
                      onChange={(event) =>
                        setMonthlyChargeForm((current) => ({
                          ...current,
                          [field.key]: formatCurrencyInput(event.target.value),
                        }))
                      }
                      placeholder="0,00"
                      value={String(monthlyChargeForm[field.key] ?? "")}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Descrição de outros custos
              </label>
              <Input
                disabled={data.lease.status !== "active"}
                onChange={(event) =>
                  setMonthlyChargeForm((current) => ({
                    ...current,
                    otherDescription: event.target.value,
                  }))
                }
                placeholder="Ex.: manutenção, taxa extra, acordo..."
                value={monthlyChargeForm.otherDescription}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              disabled={isGeneratingLocalCharges}
              onClick={() => setIsChargeSheetOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                isGeneratingLocalCharges || data.lease.status !== "active"
              }
              onClick={() => void generateLocalCharges()}
              type="button"
            >
              {isGeneratingLocalCharges ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ReceiptText className="size-4" />
              )}
              Gerar cobrança
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !isDeletingDocument) {
            setDocumentToDelete(null);
          }
        }}
        open={Boolean(documentToDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete?.documentType === "signed_contract"
                ? "Este PDF assinado serÃ¡ removido do contrato. Se o contrato ainda nÃ£o estiver ativo, ele voltarÃ¡ para a etapa de aguardando assinatura."
                : "Este arquivo serÃ¡ removido da lista de documentos do contrato. Se nÃ£o houver mais minuta, o fluxo voltarÃ¡ para a etapa de gerar minuta."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-5 text-sm">
            <p className="truncate rounded-xl border bg-muted/30 p-3 font-medium">
              {documentToDelete?.originalName}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isDeletingDocument}>
              Cancelar
            </AlertDialogClose>
            <AlertDialogAction
              disabled={isDeletingDocument}
              onClick={() => void deleteContractDocument()}
            >
              {isDeletingDocument ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
