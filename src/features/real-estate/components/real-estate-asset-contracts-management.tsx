"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  ManagementDataCard,
  ManagementFilters,
  ManagementPage,
  ManagementPagination,
  ManagementState,
  ManagementTableFrame,
  ManagementTableSkeleton,
} from "@/components/management/management-layout";
import { FormPageHeader } from "@/components/management/form-page-header";
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
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
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
import type {
  RealEstateLeaseDocumentStatus,
  RealEstateLeaseStatus,
} from "@/features/real-estate/leases";
import type { RealEstateDocument } from "@/features/real-estate/documents";
import type { Payer, PayersResponse } from "@/features/payers/types";

type RealEstateAssetContractsManagementProps = {
  assetId: string;
};

const returnTabs = ["resumo", "imoveis", "agenda", "cobrancas"] as const;

function getReturnTab(value?: string | null) {
  return returnTabs.includes(value as (typeof returnTabs)[number])
    ? value
    : "imoveis";
}

type ContractAdjustmentIndex = "none" | "ipca" | "igpm" | "other";

type AssetContract = {
  id: string;
  code: number | null;
  contractNumber: string | null;
  status: RealEstateLeaseStatus;
  documentStatus: RealEstateLeaseDocumentStatus;
  tenantName: string;
  tenantDocument: string;
  startDate: string;
  endDate: string;
  paymentDueDay: number | null;
  rentAmountCents: number;
  adjustmentIndex: ContractAdjustmentIndex;
  nextAdjustmentDate: string | null;
  documents: RealEstateDocument[];
  createdAt: string;
};

type AssetContractsResponse = {
  asset: {
    id: string;
    code: number | null;
    title: string;
    address: string | null;
    status: string;
    motive: string | null;
    rentAmount: string | null;
  };
  contracts: AssetContract[];
};

type NewContractForm = {
  tenantId: string;
  guarantorId: string;
  rentAmount: string;
  startDate: string;
  endDate: string;
  adjustmentIndex: ContractAdjustmentIndex;
  nextAdjustmentDate: string;
};

type NewContractErrors = Partial<Record<keyof NewContractForm, string>>;
type ContractDraftTemplate = "residential" | "commercial";
type ContractEndReason =
  | "term_finished"
  | "friendly_termination"
  | "default"
  | "property_sale"
  | "tenant_change"
  | "other";
type AssetStatusAfterContractEnd = "available" | "renovation" | "inactive" | "sold";
type EndContractForm = {
  endedAt: string;
  endReason: ContractEndReason;
  assetStatusAfterEnd: AssetStatusAfterContractEnd;
  notes: string;
};
type DraftResponse = {
  document?: {
    url?: string;
    downloadUrl?: string;
  };
  message?: string;
};

const defaultNewContractForm: NewContractForm = {
  tenantId: "",
  guarantorId: "",
  rentAmount: "",
  startDate: "",
  endDate: "",
  adjustmentIndex: "ipca",
  nextAdjustmentDate: "",
};

const endReasonLabels: Record<ContractEndReason, string> = {
  term_finished: "Fim do prazo",
  friendly_termination: "Rescisão amigável",
  default: "Inadimplência",
  property_sale: "Venda do imóvel",
  tenant_change: "Troca de inquilino",
  other: "Outro",
};

const assetStatusAfterEndLabels: Record<AssetStatusAfterContractEnd, string> = {
  available: "Disponível",
  renovation: "Em reforma",
  inactive: "Inativo",
  sold: "Vendido",
};

const pageSize = 8;

const statusLabels: Record<RealEstateLeaseStatus, string> = {
  draft: "Em preparação",
  active: "Ativo",
  ended: "Encerrado",
  canceled: "Cancelado",
};

const documentStatusLabels: Record<RealEstateLeaseDocumentStatus, string> = {
  not_generated: "Minuta pendente",
  draft_generated: "Minuta gerada",
  pending_signature: "Aguardando assinatura",
  signed: "Contrato assinado",
};

const documentStatusDescriptions: Record<RealEstateLeaseDocumentStatus, string> = {
  not_generated: "Gere a minuta para iniciar o processo.",
  draft_generated: "Anexe o PDF assinado pelas partes.",
  pending_signature: "Aguardando retorno do contrato assinado.",
  signed: "Pronto para ativar e liberar cobranças.",
};

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

function getDocumentStatusTone(
  status: RealEstateLeaseDocumentStatus,
  contractStatus: RealEstateLeaseStatus
): StatusTone {
  if (contractStatus === "active") {
    return "success";
  }

  if (status === "signed") {
    return "info";
  }

  if (status === "draft_generated" || status === "pending_signature") {
    return "warning";
  }

  return "neutral";
}

function normalizeSearch(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

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

function currencyMask(value: string) {
  const digits = onlyDigits(value);

  if (!digits) {
    return "";
  }

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeStoredCurrency(value?: string | null) {
  if (!value?.trim()) {
    return "";
  }

  if (value.includes(",") || /R\$/i.test(value)) {
    return currencyMask(value);
  }

  const amount = Number(value.replace(/\s/g, ""));

  return Number.isFinite(amount)
    ? currencyMask(String(Math.round(amount * 100)))
    : value;
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

function formatDocument(value?: string | null) {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }

  return value || "";
}

export function RealEstateAssetContractsManagement({
  assetId,
}: RealEstateAssetContractsManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTab = getReturnTab(searchParams.get("returnTab"));
  const signedContractInputRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<AssetContractsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState({
    search: "",
    status: "all",
  });
  const [filters, setFilters] = useState(draftFilters);
  const [isContractSheetOpen, setIsContractSheetOpen] = useState(false);
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<AssetContract | null>(
    null
  );
  const [isSavingEditContract, setIsSavingEditContract] = useState(false);
  const [editContractForm, setEditContractForm] = useState<NewContractForm>(
    defaultNewContractForm
  );
  const [editContractErrors, setEditContractErrors] =
    useState<NewContractErrors>({});
  const [contractToGenerateDraft, setContractToGenerateDraft] =
    useState<AssetContract | null>(null);
  const [selectedDraftTemplate, setSelectedDraftTemplate] =
    useState<ContractDraftTemplate>("residential");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [contractToUploadSigned, setContractToUploadSigned] =
    useState<AssetContract | null>(null);
  const [uploadingSignedContractId, setUploadingSignedContractId] = useState<
    string | null
  >(null);
  const [activatingContractId, setActivatingContractId] = useState<
    string | null
  >(null);
  const [draftDocumentToDelete, setDraftDocumentToDelete] = useState<{
    contract: AssetContract;
    document: RealEstateDocument;
  } | null>(null);
  const [isDeletingDraftDocument, setIsDeletingDraftDocument] = useState(false);
  const [contractToDelete, setContractToDelete] =
    useState<AssetContract | null>(null);
  const [isDeletingContract, setIsDeletingContract] = useState(false);
  const [contractToEnd, setContractToEnd] = useState<AssetContract | null>(
    null
  );
  const [isEndingContract, setIsEndingContract] = useState(false);
  const [endContractForm, setEndContractForm] = useState<EndContractForm>({
    endedAt: new Date().toISOString().slice(0, 10),
    endReason: "term_finished",
    assetStatusAfterEnd: "available",
    notes: "",
  });
  const [newContractForm, setNewContractForm] = useState<NewContractForm>(
    defaultNewContractForm
  );
  const [newContractErrors, setNewContractErrors] =
    useState<NewContractErrors>({});
  const [clients, setClients] = useState<Payer[]>([]);
  const [guarantors, setGuarantors] = useState<Payer[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [guarantorSearch, setGuarantorSearch] = useState("");
  const [isClientOpen, setIsClientOpen] = useState(false);
  const [isGuarantorOpen, setIsGuarantorOpen] = useState(false);

  const loadContracts = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts?assetId=${encodeURIComponent(assetId)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as
        | AssetContractsResponse
        | { message?: string };

      if (!response.ok || !("contracts" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar os contratos."
        );
      }

      setData(payload);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os contratos."
      );
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    window.queueMicrotask(() => {
      void loadContracts();
    });
  }, [loadContracts]);

  useEffect(() => {
    if (!isContractSheetOpen) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });

        if (clientSearch.trim()) {
          params.set("search", clientSearch.trim());
        }

        const response = await fetch(`/api/payers?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | PayersResponse
          | { message?: string };

        if (!response.ok || !("payers" in payload)) {
          throw new Error(
            "message" in payload
              ? payload.message
              : "Não foi possível buscar clientes."
          );
        }

        setClients(payload.payers.filter((payer) => payer.status === "active"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível buscar clientes."
        );
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [clientSearch, isContractSheetOpen]);

  useEffect(() => {
    if (!isContractSheetOpen) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });

        if (guarantorSearch.trim()) {
          params.set("search", guarantorSearch.trim());
        }

        const response = await fetch(`/api/payers?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | PayersResponse
          | { message?: string };

        if (!response.ok || !("payers" in payload)) {
          throw new Error(
            "message" in payload
              ? payload.message
              : "Não foi possível buscar fiadores."
          );
        }

        setGuarantors(
          payload.payers.filter((payer) => payer.status === "active")
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível buscar fiadores."
        );
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [guarantorSearch, isContractSheetOpen]);

  const filteredContracts = useMemo(() => {
    const search = normalizeSearch(filters.search);
    const digits = onlyDigits(filters.search);

    return (data?.contracts ?? []).filter((contract) => {
      const matchesStatus =
        filters.status === "all" || contract.status === filters.status;
      const matchesSearch =
        !search && !digits
          ? true
          : normalizeSearch(
              `${contract.contractNumber ?? ""} ${contract.tenantName}`
            ).includes(search) ||
            onlyDigits(contract.tenantDocument).includes(digits);

      return matchesStatus && matchesSearch;
    });
  }, [data, filters]);

  const safePage = Math.min(
    page,
    Math.max(Math.ceil(filteredContracts.length / pageSize), 1)
  );
  const paginatedContracts = useMemo(() => {
    const from = (safePage - 1) * pageSize;
    return filteredContracts.slice(from, from + pageSize);
  }, [filteredContracts, safePage]);
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === newContractForm.tenantId) ?? null,
    [clients, newContractForm.tenantId]
  );
  const selectedGuarantor = useMemo(
    () =>
      guarantors.find(
        (guarantor) => guarantor.id === newContractForm.guarantorId
      ) ?? null,
    [guarantors, newContractForm.guarantorId]
  );
  const visibleClients = useMemo(() => {
    const search = normalizeSearch(clientSearch);
    const digits = onlyDigits(clientSearch);

    if (!search && !digits) {
      return clients.slice(0, 8);
    }

    return clients
      .filter(
        (client) =>
          normalizeSearch(client.name).includes(search) ||
          onlyDigits(client.document).includes(digits)
      )
      .slice(0, 8);
  }, [clientSearch, clients]);
  const visibleGuarantors = useMemo(() => {
    const search = normalizeSearch(guarantorSearch);
    const digits = onlyDigits(guarantorSearch);

    if (!search && !digits) {
      return guarantors.slice(0, 8);
    }

    return guarantors
      .filter(
        (guarantor) =>
          normalizeSearch(guarantor.name).includes(search) ||
          onlyDigits(guarantor.document).includes(digits)
      )
      .slice(0, 8);
  }, [guarantorSearch, guarantors]);

  function openNewContractSheet() {
    setNewContractForm({
      ...defaultNewContractForm,
      rentAmount: normalizeStoredCurrency(data?.asset.rentAmount),
    });
    setNewContractErrors({});
    setClientSearch("");
    setGuarantorSearch("");
    setIsClientOpen(false);
    setIsGuarantorOpen(false);
    setIsContractSheetOpen(true);
  }

  function openEditContractSheet(contract: AssetContract) {
    setContractToEdit(contract);
    setEditContractForm({
      tenantId: "",
      guarantorId: "",
      rentAmount: formatCurrencyFromCents(contract.rentAmountCents),
      startDate: contract.startDate.slice(0, 10),
      endDate: contract.endDate.slice(0, 10),
      adjustmentIndex: contract.adjustmentIndex ?? "ipca",
      nextAdjustmentDate: contract.nextAdjustmentDate?.slice(0, 10) ?? "",
    });
    setEditContractErrors({});
  }

  function openEndContractDialog(contract: AssetContract) {
    setContractToEnd(contract);
    setEndContractForm({
      endedAt: new Date().toISOString().slice(0, 10),
      endReason: "term_finished",
      assetStatusAfterEnd:
        normalizeSearch(data?.asset.motive).includes("venda") ? "sold" : "available",
      notes: "",
    });
  }

  function clearNewContractError(field: keyof NewContractForm) {
    setNewContractErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function clearEditContractError(field: keyof NewContractForm) {
    setEditContractErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateContractEditForm() {
    const errors: NewContractErrors = {};

    if (onlyDigits(editContractForm.rentAmount).length === 0) {
      errors.rentAmount = "Informe o valor do contrato.";
    }

    if (!editContractForm.startDate) {
      errors.startDate = "Informe a data inicial.";
    }

    if (!editContractForm.endDate) {
      errors.endDate = "Informe a data final.";
    }

    if (
      editContractForm.startDate &&
      editContractForm.endDate &&
      editContractForm.endDate < editContractForm.startDate
    ) {
      errors.endDate = "A data final deve ser posterior à inicial.";
    }

    setEditContractErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateNewContractForm() {
    const errors: NewContractErrors = {};

    if (!newContractForm.tenantId) {
      errors.tenantId = "Selecione o cliente.";
    }

    if (onlyDigits(newContractForm.rentAmount).length === 0) {
      errors.rentAmount = "Informe o valor do contrato.";
    }

    if (!newContractForm.startDate) {
      errors.startDate = "Informe a data inicial.";
    }

    if (!newContractForm.endDate) {
      errors.endDate = "Informe a data final.";
    }

    if (
      newContractForm.startDate &&
      newContractForm.endDate &&
      newContractForm.endDate < newContractForm.startDate
    ) {
      errors.endDate = "A data final deve ser posterior à inicial.";
    }

    setNewContractErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function createContract() {
    if (!validateNewContractForm()) {
      return;
    }

    setIsSavingContract(true);

    try {
      const response = await fetch("/api/real-estate/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          tenantId: newContractForm.tenantId,
          guarantorId: newContractForm.guarantorId || null,
          rentAmount: newContractForm.rentAmount,
          startDate: newContractForm.startDate,
          endDate: newContractForm.endDate,
          adjustmentIndex: newContractForm.adjustmentIndex,
          nextAdjustmentDate: newContractForm.nextAdjustmentDate,
        }),
      });
      const payload = (await response.json()) as { id?: string; message?: string };

      if (!response.ok || !payload.id) {
        throw new Error(payload.message ?? "Não foi possível criar o contrato.");
      }

      toast.success("Contrato criado");
      setIsContractSheetOpen(false);
      setPage(1);
      await loadContracts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o contrato."
      );
    } finally {
      setIsSavingContract(false);
    }
  }

  async function saveEditedContract() {
    if (!contractToEdit || !validateContractEditForm()) {
      return;
    }

    setIsSavingEditContract(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractToEdit.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rentAmount: editContractForm.rentAmount,
            startDate: editContractForm.startDate,
            endDate: editContractForm.endDate,
            adjustmentIndex: editContractForm.adjustmentIndex,
            nextAdjustmentDate: editContractForm.nextAdjustmentDate,
          }),
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível atualizar o contrato.");
      }

      toast.success("Contrato atualizado");
      setContractToEdit(null);
      await loadContracts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o contrato."
      );
    } finally {
      setIsSavingEditContract(false);
    }
  }

  async function generateDraftPdf() {
    if (!contractToGenerateDraft) {
      return;
    }

    setIsGeneratingDraft(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractToGenerateDraft.id}/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateType: selectedDraftTemplate }),
        }
      );
      const payload = (await response.json()) as DraftResponse;

      if (!response.ok || !payload.document) {
        throw new Error(payload.message ?? "Não foi possível gerar a minuta.");
      }

      toast.success("Minuta gerada e anexada ao contrato");
      setContractToGenerateDraft(null);
      await loadContracts();

      const pdfUrl = payload.document.url || payload.document.downloadUrl;
      if (pdfUrl) {
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível gerar a minuta."
      );
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  function requestSignedContractUpload(contract: AssetContract) {
    setContractToUploadSigned(contract);
    window.queueMicrotask(() => {
      signedContractInputRef.current?.click();
    });
  }

  async function uploadSignedContract(file?: File | null) {
    if (!file || !contractToUploadSigned) {
      return;
    }

    setUploadingSignedContractId(contractToUploadSigned.id);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/real-estate/contracts/${contractToUploadSigned.id}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(
          payload.message ?? "Não foi possível anexar o contrato assinado."
        );
      }

      toast.success("Contrato assinado anexado. Ativação liberada.");
      setContractToUploadSigned(null);
      await loadContracts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível anexar o contrato assinado."
      );
    } finally {
      setUploadingSignedContractId(null);

      if (signedContractInputRef.current) {
        signedContractInputRef.current.value = "";
      }
    }
  }

  async function activateContract(contract: AssetContract) {
    setActivatingContractId(contract.id);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contract.id}/activate`,
        { method: "POST" }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível ativar o contrato.");
      }

      toast.success("Contrato ativado. Cobranças liberadas.");
      await loadContracts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar o contrato."
      );
    } finally {
      setActivatingContractId(null);
    }
  }

  async function deleteDraftDocument() {
    if (!draftDocumentToDelete) {
      return;
    }

    setIsDeletingDraftDocument(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${draftDocumentToDelete.contract.id}/documents?documentId=${encodeURIComponent(
          draftDocumentToDelete.document.id
        )}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível excluir a minuta.");
      }

      toast.success("Minuta excluída. Processo voltou para o início.");
      setDraftDocumentToDelete(null);
      await loadContracts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a minuta."
      );
    } finally {
      setIsDeletingDraftDocument(false);
    }
  }

  async function endContract() {
    if (!contractToEnd) {
      return;
    }

    if (!endContractForm.endedAt) {
      toast.warning("Informe a data de encerramento.");
      return;
    }

    setIsEndingContract(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractToEnd.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "ended",
            endedAt: endContractForm.endedAt,
            endReason: endContractForm.endReason,
            assetStatusAfterEnd: endContractForm.assetStatusAfterEnd,
            endNotes: endContractForm.notes,
          }),
        }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível encerrar o contrato.");
      }

      toast.success("Contrato encerrado. Imóvel liberado.");
      setContractToEnd(null);
      await loadContracts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível encerrar o contrato."
      );
    } finally {
      setIsEndingContract(false);
    }
  }

  async function deleteContract() {
    if (!contractToDelete) {
      return;
    }

    setIsDeletingContract(true);

    try {
      const response = await fetch(
        `/api/real-estate/contracts/${contractToDelete.id}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível excluir o contrato.");
      }

      toast.success("Contrato excluído");
      setContractToDelete(null);

      if (paginatedContracts.length === 1 && safePage > 1) {
        setPage((current) => current - 1);
      }

      await loadContracts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o contrato."
      );
    } finally {
      setIsDeletingContract(false);
    }
  }

  return (
    <ManagementPage>
      <input
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          void uploadSignedContract(event.target.files?.[0]);
        }}
        ref={signedContractInputRef}
        type="file"
      />
      <FormPageHeader
        actions={
          <Button onClick={openNewContractSheet} type="button">
            <Plus className="size-4" />
            Novo contrato
          </Button>
        }
        backLabel="Voltar para imobiliária"
        badge="Contratos do imóvel"
        onBack={() => router.push(`/imobiliaria?tab=${returnTab}`)}
        title={
          data?.asset
            ? `${data.asset.code ? `${data.asset.code} · ` : ""}${data.asset.title}`
            : "Contratos"
        }
      />

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
              placeholder="Contrato, cliente ou documento"
              value={draftFilters.search}
            />
          </div>
          <div className="w-full space-y-1 lg:w-56">
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
              <NativeSelectOption value="draft">Em preparação</NativeSelectOption>
              <NativeSelectOption value="active">Ativo</NativeSelectOption>
              <NativeSelectOption value="ended">Encerrado</NativeSelectOption>
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
                const cleared = { search: "", status: "all" };
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
        count={`${filteredContracts.length} contrato(s)`}
        description="Contratos vinculados exclusivamente a este imóvel."
        title="Contratos"
      >
        {isLoading ? (
          <ManagementTableSkeleton columns={4} rows={8} />
        ) : !data ? (
          <ManagementState>Não foi possível carregar os contratos.</ManagementState>
        ) : filteredContracts.length === 0 ? (
          <ManagementState>
            Nenhum contrato encontrado para este imóvel.
          </ManagementState>
        ) : (
          <>
            <ManagementTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead className="w-48 text-right">Próxima ação</TableHead>
                    <TableHead className="w-16 text-right">Mais</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContracts.map((contract) => {
                    const latestDraftDocument = contract.documents.find(
                      (document) => document.documentType === "draft"
                    );
                    const signedContractDocument = contract.documents.find(
                      (document) => document.documentType === "signed_contract"
                    );

                    return (
                    <TableRow key={contract.id}>
                      <TableCell className="min-w-80">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">
                            {contract.contractNumber ??
                              `#${contract.id.slice(0, 8)}`}
                          </p>
                          <SemanticStatusBadge
                            tone={getStatusTone(contract.status)}
                          >
                            {statusLabels[contract.status]}
                          </SemanticStatusBadge>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">
                          {contract.tenantName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(contract.startDate)} até{" "}
                          {formatDate(contract.endDate)} ·{" "}
                          {formatCurrencyFromCents(contract.rentAmountCents)}
                          {contract.paymentDueDay
                            ? ` · venc. dia ${contract.paymentDueDay}`
                            : ""}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-72">
                        <div className="flex items-center gap-1.5">
                          <SemanticStatusBadge
                            tone={getDocumentStatusTone(
                              contract.documentStatus,
                              contract.status
                            )}
                          >
                            {contract.status === "active"
                              ? "Contrato ativo"
                              : contract.status === "ended"
                                ? "Contrato encerrado"
                              : documentStatusLabels[contract.documentStatus]}
                          </SemanticStatusBadge>
                          {latestDraftDocument?.url ? (
                            <Button
                              aria-label="Visualizar minuta"
                              className="size-7"
                              onClick={() =>
                                window.open(
                                  latestDraftDocument.url,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <Eye className="size-3.5 text-muted-foreground" />
                            </Button>
                          ) : null}
                          {latestDraftDocument && contract.status === "draft" ? (
                            <Button
                              aria-label={`Excluir minuta do contrato ${
                                contract.contractNumber ??
                                `#${contract.id.slice(0, 8)}`
                              }`}
                              className="size-7"
                              onClick={() =>
                                setDraftDocumentToDelete({
                                  contract,
                                  document: latestDraftDocument,
                                })
                              }
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {contract.status === "active"
                            ? "Cobranças liberadas para este contrato."
                            : contract.status === "ended"
                              ? "Histórico preservado. Imóvel liberado."
                            : documentStatusDescriptions[
                                contract.documentStatus
                              ]}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {contract.status === "active" ? (
                          <Button disabled size="sm" type="button" variant="outline">
                            <CheckCircle2 className="size-4" />
                            Ativo
                          </Button>
                        ) : contract.status === "ended" ? (
                          <Button disabled size="sm" type="button" variant="outline">
                            <CheckCircle2 className="size-4" />
                            Encerrado
                          </Button>
                        ) : contract.status === "canceled" ? (
                          <Button disabled size="sm" type="button" variant="outline">
                            <Ban className="size-4" />
                            Cancelado
                          </Button>
                        ) : contract.documentStatus === "signed" ? (
                          <Button
                            disabled={activatingContractId === contract.id}
                            onClick={() => void activateContract(contract)}
                            size="sm"
                            type="button"
                          >
                            {activatingContractId === contract.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <PlayCircle className="size-4" />
                            )}
                            Ativar contrato
                          </Button>
                        ) : contract.documentStatus === "draft_generated" ||
                          contract.documentStatus === "pending_signature" ? (
                          <Button
                            disabled={uploadingSignedContractId === contract.id}
                            onClick={() => requestSignedContractUpload(contract)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {uploadingSignedContractId === contract.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Upload className="size-4" />
                            )}
                            Anexar assinado
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              setContractToGenerateDraft(contract);
                              setSelectedDraftTemplate("residential");
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <FileText className="size-4" />
                            Gerar minuta
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                aria-label="Mais ações do contrato"
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                              />
                            }
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-48">
                            {signedContractDocument?.url ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  window.open(
                                    signedContractDocument.url,
                                    "_blank",
                                    "noopener,noreferrer"
                                  )
                                }
                              >
                                <Eye className="size-4" />
                                Ver assinado
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              onClick={() => openEditContractSheet(contract)}
                            >
                              <Pencil className="size-4" />
                              Editar contrato
                            </DropdownMenuItem>
                            {contract.status === "active" ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openEndContractDialog(contract)}
                                  variant="destructive"
                                >
                                  <Ban className="size-4" />
                                  Encerrar contrato
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            {contract.status === "draft" ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setContractToDelete(contract)}
                                  variant="destructive"
                                >
                                  <Trash2 className="size-4" />
                                  Excluir contrato
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ManagementTableFrame>
            <ManagementPagination
              isLoading={isLoading}
              itemLabel="contrato(s)"
              onPageChange={setPage}
              page={safePage}
              pageSize={pageSize}
              total={filteredContracts.length}
              visible={paginatedContracts.length}
            />
          </>
        )}
      </ManagementDataCard>

      <Sheet open={isContractSheetOpen} onOpenChange={setIsContractSheetOpen}>
        <SheetContent
          className="!w-[min(40rem,calc(100vw-1rem))] !max-w-none gap-0 overflow-y-auto p-0"
          side="right"
        >
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>Novo contrato</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Cadastre um contrato vinculado a este imóvel.
            </p>
          </SheetHeader>

          <div className="space-y-5 px-5 py-4">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Dados do contrato
                </h3>
                <p className="text-xs text-muted-foreground">
                  O número será gerado automaticamente ao salvar.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Data
                  </label>
                  <Input
                    className="h-8 bg-muted/50"
                    readOnly
                    value={formatDate(new Date().toISOString())}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tipo
                  </label>
                  <Input
                    className="h-8 bg-muted/50 capitalize"
                    readOnly
                    value={data?.asset.motive ?? "Não informado"}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Valor do contrato
                  </label>
                  <Input
                    aria-invalid={Boolean(newContractErrors.rentAmount)}
                    className="h-8"
                    inputMode="numeric"
                    onChange={(event) => {
                      setNewContractForm((current) => ({
                        ...current,
                        rentAmount: currencyMask(event.target.value),
                      }));
                      clearNewContractError("rentAmount");
                    }}
                    placeholder="R$ 0,00"
                    value={newContractForm.rentAmount}
                  />
                  {newContractErrors.rentAmount ? (
                    <p className="text-xs text-destructive">
                      {newContractErrors.rentAmount}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Imóvel
                </h3>
                <p className="text-xs text-muted-foreground">
                  Este contrato será criado para o imóvel atual.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Imóvel vinculado
                </label>
                <Input
                  className="h-8 bg-muted/50"
                  readOnly
                  value={
                    data?.asset
                      ? `${data.asset.code ? `${data.asset.code} · ` : ""}${
                          data.asset.title
                        }`
                      : "Carregando imóvel..."
                  }
                />
                {data?.asset.address ? (
                  <p className="text-xs text-muted-foreground">
                    {data.asset.address}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Dados do cliente
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Pesquise pelo nome, CPF ou CNPJ.
                  </p>
                </div>
                <div className="relative space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Cliente
                  </label>
                  <Input
                    aria-invalid={Boolean(newContractErrors.tenantId)}
                    className="h-8"
                    onBlur={() =>
                      window.setTimeout(() => setIsClientOpen(false), 150)
                    }
                    onChange={(event) => {
                      setClientSearch(event.target.value);
                      setIsClientOpen(Boolean(event.target.value.trim()));
                      setNewContractForm((current) => ({
                        ...current,
                        tenantId: "",
                      }));
                      clearNewContractError("tenantId");
                    }}
                    onFocus={() =>
                      setIsClientOpen(Boolean(clientSearch.trim()))
                    }
                    placeholder="Digite o nome ou documento"
                    value={clientSearch}
                  />
                  {isClientOpen && visibleClients.length > 0 ? (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-lg">
                      {visibleClients.map((client) => (
                        <button
                          className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted"
                          key={client.id}
                          onClick={() => {
                            setNewContractForm((current) => ({
                              ...current,
                              tenantId: client.id,
                            }));
                            setClientSearch(client.name);
                            setIsClientOpen(false);
                            clearNewContractError("tenantId");
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          type="button"
                        >
                          <span className="font-medium">{client.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDocument(client.document) ||
                              "Documento não informado"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {newContractErrors.tenantId ? (
                    <p className="text-xs text-destructive">
                      {newContractErrors.tenantId}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Documento
                  </label>
                  <Input
                    className="h-8 bg-muted/50"
                    readOnly
                    value={formatDocument(selectedClient?.document)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Dados do fiador
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Opcional para contratos sem garantia.
                  </p>
                </div>
                <div className="relative space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Fiador
                  </label>
                  <Input
                    className="h-8"
                    onBlur={() =>
                      window.setTimeout(() => setIsGuarantorOpen(false), 150)
                    }
                    onChange={(event) => {
                      setGuarantorSearch(event.target.value);
                      setIsGuarantorOpen(Boolean(event.target.value.trim()));
                      setNewContractForm((current) => ({
                        ...current,
                        guarantorId: "",
                      }));
                    }}
                    onFocus={() =>
                      setIsGuarantorOpen(Boolean(guarantorSearch.trim()))
                    }
                    placeholder="Digite o nome ou documento"
                    value={guarantorSearch}
                  />
                  {isGuarantorOpen && visibleGuarantors.length > 0 ? (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-lg">
                      {visibleGuarantors.map((guarantor) => (
                        <button
                          className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted"
                          key={guarantor.id}
                          onClick={() => {
                            setNewContractForm((current) => ({
                              ...current,
                              guarantorId: guarantor.id,
                            }));
                            setGuarantorSearch(guarantor.name);
                            setIsGuarantorOpen(false);
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          type="button"
                        >
                          <span className="font-medium">{guarantor.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDocument(guarantor.document) ||
                              "Documento não informado"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Documento
                  </label>
                  <Input
                    className="h-8 bg-muted/50"
                    readOnly
                    value={formatDocument(selectedGuarantor?.document)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Duração
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Data início
                  </label>
                  <Input
                    aria-invalid={Boolean(newContractErrors.startDate)}
                    className="h-8"
                    onChange={(event) => {
                      setNewContractForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }));
                      clearNewContractError("startDate");
                    }}
                    type="date"
                    value={newContractForm.startDate}
                  />
                  {newContractErrors.startDate ? (
                    <p className="text-xs text-destructive">
                      {newContractErrors.startDate}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Data fim
                  </label>
                  <Input
                    aria-invalid={Boolean(newContractErrors.endDate)}
                    className="h-8"
                    onChange={(event) => {
                      setNewContractForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }));
                      clearNewContractError("endDate");
                    }}
                    type="date"
                    value={newContractForm.endDate}
                  />
                  {newContractErrors.endDate ? (
                    <p className="text-xs text-destructive">
                      {newContractErrors.endDate}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tempo
                  </label>
                  <Input
                    className="h-8 bg-muted/50"
                    readOnly
                    value={getDurationLabel(
                      newContractForm.startDate,
                      newContractForm.endDate
                    )}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Reajuste
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tipo
                  </label>
                  <NativeSelect
                    value={newContractForm.adjustmentIndex}
                    onChange={(event) =>
                      setNewContractForm((current) => ({
                        ...current,
                        adjustmentIndex:
                          event.target
                            .value as NewContractForm["adjustmentIndex"],
                      }))
                    }
                  >
                    <NativeSelectOption value="none">
                      Sem reajuste
                    </NativeSelectOption>
                    <NativeSelectOption value="ipca">IPCA</NativeSelectOption>
                    <NativeSelectOption value="igpm">IGP-M</NativeSelectOption>
                    <NativeSelectOption value="other">Outro</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Data reajuste
                  </label>
                  <Input
                    className="h-8"
                    onChange={(event) =>
                      setNewContractForm((current) => ({
                        ...current,
                        nextAdjustmentDate: event.target.value,
                      }))
                    }
                    type="date"
                    value={newContractForm.nextAdjustmentDate}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Valor índice
                  </label>
                  <Input
                    className="h-8 bg-muted/50"
                    readOnly
                    value="Automático"
                  />
                </div>
              </div>
            </section>
          </div>

          <SheetFooter className="border-t px-5 py-4 sm:flex-row sm:justify-end">
            <Button
              disabled={isSavingContract}
              onClick={() => setIsContractSheetOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSavingContract || !data}
              onClick={() => void createContract()}
              type="button"
            >
              {isSavingContract ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Criar contrato
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(contractToEdit)}
        onOpenChange={(open) => {
          if (!open && !isSavingEditContract) {
            setContractToEdit(null);
          }
        }}
      >
        <SheetContent
          className="!w-[min(40rem,calc(100vw-1rem))] !max-w-none gap-0 overflow-y-auto p-0"
          side="right"
        >
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>Editar contrato</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Atualize os dados principais do contrato selecionado.
            </p>
          </SheetHeader>

          <div className="space-y-5 px-5 py-4">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Dados do contrato
                </h3>
                <p className="text-xs text-muted-foreground">
                  {contractToEdit?.contractNumber ??
                    (contractToEdit
                      ? `#${contractToEdit.id.slice(0, 8)}`
                      : "Contrato")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Valor do contrato
                  </label>
                  <Input
                    aria-invalid={Boolean(editContractErrors.rentAmount)}
                    className="h-8"
                    inputMode="numeric"
                    onChange={(event) => {
                      setEditContractForm((current) => ({
                        ...current,
                        rentAmount: currencyMask(event.target.value),
                      }));
                      clearEditContractError("rentAmount");
                    }}
                    placeholder="R$ 0,00"
                    value={editContractForm.rentAmount}
                  />
                  {editContractErrors.rentAmount ? (
                    <p className="text-xs text-destructive">
                      {editContractErrors.rentAmount}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Cliente
                  </label>
                  <Input
                    className="h-8 bg-muted/50"
                    readOnly
                    value={contractToEdit?.tenantName ?? ""}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Duração
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Data início
                  </label>
                  <Input
                    aria-invalid={Boolean(editContractErrors.startDate)}
                    className="h-8"
                    onChange={(event) => {
                      setEditContractForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }));
                      clearEditContractError("startDate");
                    }}
                    type="date"
                    value={editContractForm.startDate}
                  />
                  {editContractErrors.startDate ? (
                    <p className="text-xs text-destructive">
                      {editContractErrors.startDate}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Data fim
                  </label>
                  <Input
                    aria-invalid={Boolean(editContractErrors.endDate)}
                    className="h-8"
                    onChange={(event) => {
                      setEditContractForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }));
                      clearEditContractError("endDate");
                    }}
                    type="date"
                    value={editContractForm.endDate}
                  />
                  {editContractErrors.endDate ? (
                    <p className="text-xs text-destructive">
                      {editContractErrors.endDate}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tempo
                  </label>
                  <Input
                    className="h-8 bg-muted/50"
                    readOnly
                    value={getDurationLabel(
                      editContractForm.startDate,
                      editContractForm.endDate
                    )}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Reajuste
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tipo
                  </label>
                  <NativeSelect
                    value={editContractForm.adjustmentIndex}
                    onChange={(event) =>
                      setEditContractForm((current) => ({
                        ...current,
                        adjustmentIndex:
                          event.target.value as ContractAdjustmentIndex,
                      }))
                    }
                  >
                    <NativeSelectOption value="none">
                      Sem reajuste
                    </NativeSelectOption>
                    <NativeSelectOption value="ipca">IPCA</NativeSelectOption>
                    <NativeSelectOption value="igpm">IGP-M</NativeSelectOption>
                    <NativeSelectOption value="other">Outro</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Data reajuste
                  </label>
                  <Input
                    className="h-8"
                    onChange={(event) =>
                      setEditContractForm((current) => ({
                        ...current,
                        nextAdjustmentDate: event.target.value,
                      }))
                    }
                    type="date"
                    value={editContractForm.nextAdjustmentDate}
                  />
                </div>
              </div>
            </section>
          </div>

          <SheetFooter className="border-t px-5 py-4 sm:flex-row sm:justify-end">
            <Button
              disabled={isSavingEditContract}
              onClick={() => setContractToEdit(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSavingEditContract || !contractToEdit}
              onClick={() => void saveEditedContract()}
              type="button"
            >
              {isSavingEditContract ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Pencil className="size-4" />
              )}
              Salvar alterações
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(contractToGenerateDraft)}
        onOpenChange={(open) => {
          if (!open && !isGeneratingDraft) {
            setContractToGenerateDraft(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar minuta do contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o modelo da minuta antes de gerar o PDF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 px-6 pb-5 sm:grid-cols-2">
            {(["residential", "commercial"] as ContractDraftTemplate[]).map(
              (template) => {
                const isSelected = selectedDraftTemplate === template;

                return (
                  <button
                    className={`rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-background hover:bg-muted/60"
                    }`}
                    key={template}
                    onClick={() => setSelectedDraftTemplate(template)}
                    type="button"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <FileText className="size-4" />
                      {template === "commercial"
                        ? "Comercial"
                        : "Residencial"}
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {template === "commercial"
                        ? "Modelo para locação comercial."
                        : "Modelo para locação residencial."}
                    </span>
                  </button>
                );
              }
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isGeneratingDraft}>
              Cancelar
            </AlertDialogClose>
            <Button
              disabled={isGeneratingDraft || !contractToGenerateDraft}
              onClick={() => void generateDraftPdf()}
              type="button"
            >
              {isGeneratingDraft ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Gerar minuta
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(draftDocumentToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingDraftDocument) {
            setDraftDocumentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir minuta?</AlertDialogTitle>
            <AlertDialogDescription>
              A minuta será removida dos documentos do contrato. Se não houver
              outra minuta vinculada, o processo volta para a etapa inicial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 text-sm">
            <p className="truncate rounded-xl border bg-muted/30 p-3 font-medium">
              {draftDocumentToDelete?.document.originalName ?? "Minuta do contrato"}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isDeletingDraftDocument}>
              Cancelar
            </AlertDialogClose>
            <AlertDialogAction
              disabled={isDeletingDraftDocument}
              onClick={() => void deleteDraftDocument()}
            >
              {isDeletingDraftDocument ? "Excluindo..." : "Excluir minuta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(contractToEnd)}
        onOpenChange={(open) => {
          if (!open && !isEndingContract) {
            setContractToEnd(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Informe como o contrato está sendo encerrado. O contrato será
              mantido no histórico e novas cobranças não serão geradas para ele.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 px-6 pb-2 text-sm">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="truncate font-medium">
                {contractToEnd?.contractNumber ??
                  (contractToEnd
                    ? `#${contractToEnd.id.slice(0, 8)}`
                    : "Contrato")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {contractToEnd?.tenantName ?? "Cliente não informado"} ·{" "}
                {contractToEnd ? formatCurrencyFromCents(contractToEnd.rentAmountCents) : ""}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Data de encerramento
                </label>
                <Input
                  disabled={isEndingContract}
                  onChange={(event) =>
                    setEndContractForm((current) => ({
                      ...current,
                      endedAt: event.target.value,
                    }))
                  }
                  type="date"
                  value={endContractForm.endedAt}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Motivo
                </label>
                <NativeSelect
                  disabled={isEndingContract}
                  onChange={(event) => {
                    const endReason = event.target.value as ContractEndReason;
                    setEndContractForm((current) => ({
                      ...current,
                      endReason,
                      assetStatusAfterEnd:
                        endReason === "property_sale"
                          ? "sold"
                          : current.assetStatusAfterEnd,
                    }));
                  }}
                  value={endContractForm.endReason}
                >
                  {Object.entries(endReasonLabels).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Situação do imóvel após encerramento
              </label>
              <NativeSelect
                disabled={isEndingContract}
                onChange={(event) =>
                  setEndContractForm((current) => ({
                    ...current,
                    assetStatusAfterEnd:
                      event.target.value as AssetStatusAfterContractEnd,
                  }))
                }
                value={endContractForm.assetStatusAfterEnd}
              >
                {Object.entries(assetStatusAfterEndLabels).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Observação
              </label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                disabled={isEndingContract}
                onChange={(event) =>
                  setEndContractForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Ex.: contrato encerrado por acordo entre as partes, vistoria agendada..."
                value={endContractForm.notes}
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Cobranças já criadas continuam no financeiro para revisão manual.
              Novas cobranças deixam de ser geradas para este contrato encerrado.
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogClose disabled={isEndingContract}>
              Voltar
            </AlertDialogClose>
            <AlertDialogAction
              disabled={isEndingContract}
              onClick={() => void endContract()}
            >
              {isEndingContract ? "Encerrando..." : "Encerrar contrato"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(contractToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingContract) {
            setContractToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o contrato selecionado e seus dados vinculados.
              Use somente quando o contrato foi criado por engano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 text-sm">
            <p className="truncate rounded-xl border bg-muted/30 p-3 font-medium">
              {contractToDelete?.contractNumber ??
                (contractToDelete
                  ? `#${contractToDelete.id.slice(0, 8)}`
                  : "Contrato")}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isDeletingContract}>
              Cancelar
            </AlertDialogClose>
            <AlertDialogAction
              disabled={isDeletingContract}
              onClick={() => void deleteContract()}
            >
              {isDeletingContract ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementPage>
  );
}
