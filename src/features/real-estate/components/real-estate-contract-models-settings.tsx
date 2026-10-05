"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  ManagementDataCard,
  ManagementMetricCardsSkeleton,
  ManagementState,
  ManagementTableFrame,
  ManagementTableSkeleton,
} from "@/components/management/management-layout";
import { SemanticStatusBadge } from "@/components/management/semantic-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
  RealEstateContractModel,
  RealEstateContractModelClause,
  RealEstateContractModelPurpose,
  RealEstateContractModelsResponse,
  RealEstateContractModelStatus,
  RealEstateContractModelUsage,
} from "@/features/real-estate/types";
import { RealEstateMetricCard as MetricCard } from "@/features/real-estate/components/real-estate-metric-card";

type ContractModelForm = {
  name: string;
  contractPurpose: RealEstateContractModelPurpose;
  propertyUsage: RealEstateContractModelUsage;
  description: string;
  notes: string;
  status: RealEstateContractModelStatus;
  witness1Name: string;
  witness1Document: string;
  witness2Name: string;
  witness2Document: string;
  clauses: RealEstateContractModelClause[];
};

const emptyForm: ContractModelForm = {
  name: "",
  contractPurpose: "rental",
  propertyUsage: "residential",
  description: "",
  notes: "",
  status: "active",
  witness1Name: "",
  witness1Document: "",
  witness2Name: "",
  witness2Document: "",
  clauses: [],
};

const purposeLabels: Record<RealEstateContractModelPurpose, string> = {
  rental: "Locação",
  sale: "Venda",
};

const usageLabels: Record<RealEstateContractModelUsage, string> = {
  residential: "Residencial",
  commercial: "Comercial",
};

function ContractPurposeBadge({
  purpose,
}: {
  purpose: RealEstateContractModelPurpose;
}) {
  return (
    <Badge
      className={
        purpose === "rental"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }
      variant="outline"
    >
      {purposeLabels[purpose]}
    </Badge>
  );
}

function PropertyUsageBadge({
  usage,
}: {
  usage: RealEstateContractModelUsage;
}) {
  return (
    <Badge
      className={
        usage === "residential"
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }
      variant="outline"
    >
      {usageLabels[usage]}
    </Badge>
  );
}

function ContractModelStatusBadge({
  status,
}: {
  status: RealEstateContractModelStatus;
}) {
  return (
    <SemanticStatusBadge tone={status === "active" ? "success" : "neutral"}>
      {status === "active" ? "Ativo" : "Inativo"}
    </SemanticStatusBadge>
  );
}

function getFormFromModel(model: RealEstateContractModel): ContractModelForm {
  return {
    name: model.name,
    contractPurpose: model.contractPurpose,
    propertyUsage: model.propertyUsage,
    description: model.description ?? "",
    notes: model.notes ?? "",
    status: model.status,
    witness1Name: model.witness1Name ?? "",
    witness1Document: model.witness1Document ?? "",
    witness2Name: model.witness2Name ?? "",
    witness2Document: model.witness2Document ?? "",
    clauses: model.clauses,
  };
}

function getResponseMessage(payload: unknown, fallback: string) {
  return payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
    ? payload.message
    : fallback;
}

export function RealEstateContractModelsSettings() {
  const [models, setModels] = useState<RealEstateContractModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [witnessSheetOpen, setWitnessSheetOpen] = useState(false);
  const [clausesSheetOpen, setClausesSheetOpen] = useState(false);
  const [editingModel, setEditingModel] =
    useState<RealEstateContractModel | null>(null);
  const [witnessModel, setWitnessModel] =
    useState<RealEstateContractModel | null>(null);
  const [clausesModel, setClausesModel] =
    useState<RealEstateContractModel | null>(null);
  const [form, setForm] = useState<ContractModelForm>(emptyForm);

  const activeModels = useMemo(
    () => models.filter((model) => model.status === "active").length,
    [models]
  );

  async function fetchModels() {
    const response = await fetch("/api/real-estate/contract-models");
    const payload = (await response.json()) as
      | RealEstateContractModelsResponse
      | { message?: string };

    if (!response.ok || !("models" in payload)) {
      throw new Error(
        getResponseMessage(payload, "Não foi possível carregar modelos.")
      );
    }

    return payload.models;
  }

  async function loadModels() {
    setIsLoading(true);

    try {
      setModels(await fetchModels());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar modelos."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialModels() {
      try {
        const nextModels = await fetchModels();

        if (isMounted) {
          setModels(nextModels);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar modelos."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialModels();

    return () => {
      isMounted = false;
    };
  }, []);

  function openCreateSheet() {
    setEditingModel(null);
    setForm(emptyForm);
    setSheetOpen(true);
  }

  function openEditSheet(model: RealEstateContractModel) {
    setEditingModel(model);
    setForm(getFormFromModel(model));
    setSheetOpen(true);
  }

  function openWitnessSheet(model: RealEstateContractModel) {
    setWitnessModel(model);
    setForm(getFormFromModel(model));
    setWitnessSheetOpen(true);
  }

  function openClausesSheet(model: RealEstateContractModel) {
    setClausesModel(model);
    setForm(getFormFromModel(model));
    setClausesSheetOpen(true);
  }

  function addClause() {
    setForm((current) => ({
      ...current,
      clauses: [
        ...current.clauses,
        {
          id: crypto.randomUUID(),
          title: `Cláusula ${current.clauses.length + 1}`,
          text: "",
          order: current.clauses.length + 1,
        },
      ],
    }));
  }

  function updateClause(
    id: string,
    field: "title" | "text",
    value: string
  ) {
    setForm((current) => ({
      ...current,
      clauses: current.clauses.map((clause) =>
        clause.id === id ? { ...clause, [field]: value } : clause
      ),
    }));
  }

  function removeClause(id: string) {
    setForm((current) => ({
      ...current,
      clauses: current.clauses
        .filter((clause) => clause.id !== id)
        .map((clause, index) => ({ ...clause, order: index + 1 })),
    }));
  }

  async function saveModel() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do modelo.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        editingModel
          ? `/api/real-estate/contract-models/${editingModel.id}`
          : "/api/real-estate/contract-models",
        {
          method: editingModel ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            contractPurpose: form.contractPurpose,
            propertyUsage: form.propertyUsage,
            description: form.description,
            notes: form.notes,
            status: form.status,
          }),
        }
      );
      const payload = (await response.json()) as
        | RealEstateContractModel
        | { message?: string };

      if (!response.ok || !("id" in payload)) {
        throw new Error(
          getResponseMessage(payload, "Não foi possível salvar modelo.")
        );
      }

      toast.success(editingModel ? "Modelo atualizado" : "Modelo criado");
      setSheetOpen(false);
      setEditingModel(null);
      setForm(emptyForm);
      await loadModels();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar modelo."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveWitnesses() {
    if (!witnessModel) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/real-estate/contract-models/${witnessModel.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            witness1Name: form.witness1Name,
            witness1Document: form.witness1Document,
            witness2Name: form.witness2Name,
            witness2Document: form.witness2Document,
          }),
        }
      );
      const payload = (await response.json()) as
        | RealEstateContractModel
        | { message?: string };

      if (!response.ok || !("id" in payload)) {
        throw new Error(
          getResponseMessage(payload, "Não foi possível salvar testemunhas.")
        );
      }

      toast.success("Testemunhas atualizadas");
      setWitnessSheetOpen(false);
      setWitnessModel(null);
      setForm(emptyForm);
      await loadModels();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar testemunhas."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveClauses() {
    if (!clausesModel) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/real-estate/contract-models/${clausesModel.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clauses: form.clauses }),
        }
      );
      const payload = (await response.json()) as
        | RealEstateContractModel
        | { message?: string };

      if (!response.ok || !("id" in payload)) {
        throw new Error(
          getResponseMessage(payload, "Não foi possível salvar cláusulas.")
        );
      }

      toast.success("Cláusulas atualizadas");
      setClausesSheetOpen(false);
      setClausesModel(null);
      setForm(emptyForm);
      await loadModels();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar cláusulas."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleModelStatus(model: RealEstateContractModel) {
    const nextStatus: RealEstateContractModelStatus =
      model.status === "active" ? "inactive" : "active";

    try {
      const response = await fetch(
        `/api/real-estate/contract-models/${model.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const payload = (await response.json()) as
        | RealEstateContractModel
        | { message?: string };

      if (!response.ok || !("id" in payload)) {
        throw new Error(
          getResponseMessage(payload, "Não foi possível alterar situação.")
        );
      }

      toast.success(
        nextStatus === "active" ? "Modelo ativado" : "Modelo inativado"
      );
      await loadModels();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar situação."
      );
    }
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="border-b bg-background/70 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" />
                Modelos de contrato
              </CardTitle>
              <CardDescription>
                Configure a base dos contratos de venda e locação antes de
                evoluirmos para cláusulas e geração da minuta.
              </CardDescription>
            </div>
            <Button className="w-full sm:w-auto" onClick={openCreateSheet}>
              <Plus className="size-4" />
              Novo modelo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <ManagementMetricCardsSkeleton
              className="sm:grid-cols-3 xl:grid-cols-3"
              count={3}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                icon={FileText}
                title="Modelos cadastrados"
                value={models.length}
              />
              <MetricCard
                icon={Save}
                title="Ativos"
                tone="success"
                value={activeModels}
              />
              <MetricCard
                icon={UsersRound}
                title="Categorias base"
                tone="neutral"
                value={4}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ManagementDataCard
        className="[&_[data-slot=card-content]]:space-y-3 [&_[data-slot=card-content]]:py-3 [&_[data-slot=card-header]]:py-3"
        count={`${models.length} modelo(s)`}
        title="Biblioteca de modelos"
      >
        {isLoading ? (
          <ManagementTableSkeleton columns={5} rows={4} />
        ) : models.length === 0 ? (
          <ManagementState>Nenhum modelo cadastrado.</ManagementState>
        ) : (
          <ManagementTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="max-w-xl">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <FileText className="size-4" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{model.name}</p>
                            {model.isDefault ? (
                              <Badge variant="secondary">Padrão</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {model.description || "Sem descrição."}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {model.clauses.length} cláusula(s) configurada(s)
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ContractPurposeBadge purpose={model.contractPurpose} />
                    </TableCell>
                    <TableCell>
                      <PropertyUsageBadge usage={model.propertyUsage} />
                    </TableCell>
                    <TableCell>
                      <ContractModelStatusBadge status={model.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              aria-label="Abrir ações do modelo"
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-44">
                          <DropdownMenuItem onClick={() => openEditSheet(model)}>
                            <Edit3 className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openWitnessSheet(model)}
                          >
                            <UsersRound className="size-4" />
                            Testemunhas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openClausesSheet(model)}>
                            <FileText className="size-4" />
                            Cláusulas
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => void toggleModelStatus(model)}
                          >
                            <RotateCcw className="size-4" />
                            {model.status === "active" ? "Inativar" : "Ativar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ManagementTableFrame>
        )}
      </ManagementDataCard>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setSheetOpen(false);
          }
        }}
      >
        <SheetContent className="w-[44rem] overflow-y-auto sm:max-w-[44rem]">
          <SheetHeader>
            <SheetTitle>
              {editingModel ? "Editar modelo" : "Novo modelo"}
            </SheetTitle>
            <SheetDescription>
              Defina a identificação e classificação do modelo.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="contract-model-name">Nome</Label>
              <Input
                id="contract-model-name"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ex: Contrato de locação residencial"
                value={form.name}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="contract-model-purpose">Contrato</Label>
                <NativeSelect
                  id="contract-model-purpose"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contractPurpose: event.target
                        .value as RealEstateContractModelPurpose,
                    }))
                  }
                  value={form.contractPurpose}
                >
                  <NativeSelectOption value="rental">Locação</NativeSelectOption>
                  <NativeSelectOption value="sale">Venda</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contract-model-usage">Uso</Label>
                <NativeSelect
                  id="contract-model-usage"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      propertyUsage: event.target
                        .value as RealEstateContractModelUsage,
                    }))
                  }
                  value={form.propertyUsage}
                >
                  <NativeSelectOption value="residential">
                    Residencial
                  </NativeSelectOption>
                  <NativeSelectOption value="commercial">
                    Comercial
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contract-model-status">Situação</Label>
                <NativeSelect
                  id="contract-model-status"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as RealEstateContractModelStatus,
                    }))
                  }
                  value={form.status}
                >
                  <NativeSelectOption value="active">Ativo</NativeSelectOption>
                  <NativeSelectOption value="inactive">Inativo</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contract-model-description">Descrição</Label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                id="contract-model-description"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Explique quando este modelo deve ser usado."
                value={form.description}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contract-model-notes">Observação do modelo</Label>
              <textarea
                className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                id="contract-model-notes"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Texto livre de observação para este modelo."
                value={form.notes}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              disabled={isSaving}
              onClick={() => void saveModel()}
              type="button"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={witnessSheetOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setWitnessSheetOpen(false);
            setWitnessModel(null);
          }
        }}
      >
        <SheetContent className="!w-[40rem] !max-w-[40rem] sm:!max-w-[40rem]">
          <SheetHeader>
            <SheetTitle>Testemunhas</SheetTitle>
            <SheetDescription>
              Configure as testemunhas padrão do modelo {witnessModel?.name}.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="contract-model-witness-1-name">
                    Testemunha 1
                  </Label>
                  <Input
                    id="contract-model-witness-1-name"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        witness1Name: event.target.value,
                      }))
                    }
                    placeholder="Nome da testemunha"
                    value={form.witness1Name}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contract-model-witness-1-document">
                    Documento
                  </Label>
                  <Input
                    id="contract-model-witness-1-document"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        witness1Document: event.target.value,
                      }))
                    }
                    placeholder="CPF/CNPJ"
                    value={form.witness1Document}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contract-model-witness-2-name">
                    Testemunha 2
                  </Label>
                  <Input
                    id="contract-model-witness-2-name"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        witness2Name: event.target.value,
                      }))
                    }
                    placeholder="Nome da testemunha"
                    value={form.witness2Name}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contract-model-witness-2-document">
                    Documento
                  </Label>
                  <Input
                    id="contract-model-witness-2-document"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        witness2Document: event.target.value,
                      }))
                    }
                    placeholder="CPF/CNPJ"
                    value={form.witness2Document}
                  />
                </div>
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button
              disabled={isSaving}
              onClick={() => void saveWitnesses()}
              type="button"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar testemunhas
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={clausesSheetOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setClausesSheetOpen(false);
            setClausesModel(null);
          }
        }}
      >
        <SheetContent className="!w-[40rem] !max-w-[40rem] overflow-y-auto sm:!max-w-[40rem]">
          <SheetHeader>
            <SheetTitle>Cláusulas</SheetTitle>
            <SheetDescription>
              Cadastre as cláusulas que pertencem ao modelo {clausesModel?.name}.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="flex flex-col gap-3 rounded-2xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Cláusulas do contrato</p>
                <p className="text-xs text-muted-foreground">
                  A ordem abaixo será usada futuramente na montagem da minuta.
                </p>
              </div>
              <Button
                className="w-full sm:w-auto"
                onClick={addClause}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
                Adicionar cláusula
              </Button>
            </div>

            {form.clauses.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-background p-4 text-center text-sm text-muted-foreground">
                Nenhuma cláusula cadastrada neste modelo.
              </div>
            ) : (
              <div className="space-y-3">
                {form.clauses.map((clause, index) => (
                  <div
                    className="rounded-xl border bg-background p-3"
                    key={clause.id}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <Input
                        aria-label={`Título da cláusula ${index + 1}`}
                        onChange={(event) =>
                          updateClause(clause.id, "title", event.target.value)
                        }
                        placeholder="Título da cláusula"
                        value={clause.title}
                      />
                      <Button
                        aria-label="Remover cláusula"
                        onClick={() => removeClause(clause.id)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    <textarea
                      aria-label={`Texto da cláusula ${index + 1}`}
                      className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                      onChange={(event) =>
                        updateClause(clause.id, "text", event.target.value)
                      }
                      placeholder="Texto completo da cláusula."
                      value={clause.text}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <SheetFooter>
            <Button
              disabled={isSaving}
              onClick={() => void saveClauses()}
              type="button"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar cláusulas
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
