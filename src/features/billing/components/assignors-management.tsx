"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  Copy,
  Edit3,
  ExternalLink,
  Landmark,
  Loader2,
  LogIn,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Webhook,
} from "lucide-react";
import { mask, unMask } from "remask";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ManagementDataCard,
  ManagementFilters,
  ManagementPage,
  ManagementPageHeader,
  ManagementPagination,
  ManagementState,
  ManagementTableFrame,
  ManagementTableSkeleton,
} from "@/components/management/management-layout";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BRAZIL_STATES } from "@/lib/brazil-states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
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
import { Switch } from "@/components/ui/switch";
import type {
  BillingAssignor,
  BillingAssignorsResponse,
} from "@/features/billing/types";
import type { TecnospeedConfigStatus } from "@/features/integrations/tecnospeed/types";
import { formatDocument } from "@/features/billing/utils";

type AssignorSearchForm = {
  document: string;
};

type AssignorFormValues = {
  corporateName: string;
  tradeName: string;
  document: string;
  email: string;
  phone: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  cityIbgeCode: string;
};

type CepResponse = {
  message?: string;
  zipCode: string;
  street: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  cityIbgeCode: string;
};

type AssignorPortalAccess = {
  assignor: BillingAssignor;
  token: string | null;
};

function documentMask(value: string) {
  return mask(unMask(value), ["999.999.999-99", "99.999.999/9999-99"]);
}

function phoneMask(value: string) {
  return mask(unMask(value), ["(99) 9999-9999", "(99) 99999-9999"]);
}

function zipCodeMask(value: string) {
  return mask(unMask(value), "99999-999");
}

function getEmptyAssignorFormValues(): AssignorFormValues {
  return {
    corporateName: "",
    tradeName: "",
    document: "",
    email: "",
    phone: "",
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    cityIbgeCode: "",
  };
}

function getAssignorFormValues(assignor: BillingAssignor): AssignorFormValues {
  return {
    corporateName: assignor.corporateName,
    tradeName: assignor.tradeName ?? "",
    document: documentMask(assignor.document),
    email: assignor.email ?? "",
    phone: phoneMask(assignor.phone ?? ""),
    zipCode: zipCodeMask(assignor.zipCode ?? ""),
    street: assignor.street ?? "",
    number: assignor.number ?? "",
    complement: assignor.complement ?? "",
    district: assignor.district ?? "",
    city: assignor.city ?? "",
    state: assignor.state ?? "",
    cityIbgeCode: assignor.cityIbgeCode ?? "",
  };
}

function isAssignorActive(status: string) {
  return status.toUpperCase() === "ATIVO";
}

function AssignorActions({
  isLoadingPortalAccess,
  onEdit,
  onManageAccounts,
  onManageWebhook,
  onOpenPortalAccess,
}: {
  isLoadingPortalAccess?: boolean;
  onEdit: () => void;
  onManageAccounts: () => void;
  onManageWebhook: () => void;
  onOpenPortalAccess: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Abrir ações do cedente"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onEdit}>
            <Edit3 className="size-4" />
            Editar cedente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onManageAccounts}>
            <Landmark className="size-4" />
            Listar contas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onManageWebhook}>
            <Webhook className="size-4" />
            Personalizar WebHook
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isLoadingPortalAccess}
            onClick={onOpenPortalAccess}
          >
            {isLoadingPortalAccess ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            {isLoadingPortalAccess ? "Consultando acesso..." : "Acesso PlugBoleto"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssignorsManagement() {
  const router = useRouter();
  const [assignors, setAssignors] = useState<BillingAssignor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingZipCode, setIsSearchingZipCode] = useState(false);
  const [updatingAssignorId, setUpdatingAssignorId] = useState<number | null>(
    null
  );
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [portalUrl, setPortalUrl] = useState("https://plugboleto.com.br");
  const [portalAccess, setPortalAccess] = useState<AssignorPortalAccess | null>(
    null
  );
  const [loadingPortalAccessId, setLoadingPortalAccessId] = useState<
    number | null
  >(null);
  const [selectedAssignor, setSelectedAssignor] =
    useState<BillingAssignor | null>(null);
  const isEditing = Boolean(selectedAssignor);
  const pageSize = 8;
  const visibleAssignors = assignors.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const searchForm = useForm<AssignorSearchForm>({
    defaultValues: {
      document: "",
    },
  });
  const createForm = useForm<AssignorFormValues>({
    defaultValues: getEmptyAssignorFormValues(),
  });

  function handleSheetOpenChange(open: boolean) {
    setIsSheetOpen(open);

    if (!open) {
      createForm.reset();
      setSelectedAssignor(null);
    }
  }

  function handleNewAssignor() {
    setSelectedAssignor(null);
    createForm.reset(getEmptyAssignorFormValues());
    setIsSheetOpen(true);
  }

  function handleEditAssignor(assignor: BillingAssignor) {
    setSelectedAssignor(assignor);
    createForm.reset(getAssignorFormValues(assignor));
    setIsSheetOpen(true);
  }

  function handleManageAccounts(assignor: BillingAssignor) {
    const params = new URLSearchParams({
      document: assignor.document,
      name: assignor.corporateName,
    });
    router.push(`/cedentes/${assignor.id}/contas?${params.toString()}`);
  }

  function handleManageWebhook(assignor: BillingAssignor) {
    const params = new URLSearchParams({
      document: assignor.document,
      name: assignor.corporateName,
    });
    router.push(`/cedentes/${assignor.id}/webhook?${params.toString()}`);
  }

  async function handleCopyPortalValue(value: string, label: string) {
    if (!value) {
      toast.warning(`${label} não informado.`);
      return;
    }

    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado.`);
  }

  async function handleOpenPortalAccess(assignor: BillingAssignor) {
    setLoadingPortalAccessId(assignor.id);

    try {
      const params = new URLSearchParams({
        document: assignor.document,
      });
      const response = await fetch(
        `/api/billing/assignors/${assignor.id}?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as
        | AssignorPortalAccess
        | { message?: string };

      if (!response.ok || !("assignor" in data)) {
        throw new Error(
          "message" in data
            ? data.message
            : "Não foi possível consultar o acesso do cedente."
        );
      }

      setPortalAccess(data);

      if (!data.token) {
        toast.warning("Token do cedente não localizado no retorno.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar o acesso do cedente."
      );
    } finally {
      setLoadingPortalAccessId(null);
    }
  }

  async function fetchAssignors(document?: string) {
    const params = new URLSearchParams();

    if (document) {
      params.set("document", document);
    }

    const response = await fetch(`/api/billing/assignors?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      throw new Error(data.message ?? "Não foi possível consultar cedentes.");
    }

    return ((await response.json()) as BillingAssignorsResponse).assignors;
  }

  async function loadAssignors(document?: string) {
    setIsLoading(true);

    try {
      const data = await fetchAssignors(document);
      setAssignors(data);
      setCurrentPage(1);
      setHasSearched(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar cedentes."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Sincroniza a lista inicial com a API de cedentes da TecnoSpeed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAssignors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadPortalUrl() {
      const response = await fetch("/api/integrations/tecnospeed/status", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as TecnospeedConfigStatus;
      setPortalUrl(data.guiUrl);
    }

    loadPortalUrl().catch(() => {
      setPortalUrl("https://plugboleto.com.br");
    });
  }, []);

  async function handleSearch(values: AssignorSearchForm) {
    await loadAssignors(unMask(values.document));
  }

  async function handleClearSearch() {
    searchForm.reset({ document: "" });
    await loadAssignors();
  }

  async function handleUpdateAssignorStatus(
    assignor: BillingAssignor,
    active: boolean
  ) {
    const previousStatus = assignor.status;
    const nextStatus = active ? "ATIVO" : "INATIVO";

    setUpdatingAssignorId(assignor.id);
    setAssignors((currentAssignors) =>
      currentAssignors.map((currentAssignor) =>
        currentAssignor.id === assignor.id
          ? { ...currentAssignor, status: nextStatus }
          : currentAssignor
      )
    );

    try {
      const response = await fetch(
        `/api/billing/assignors/${assignor.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active,
            document: assignor.document,
            reason: "Situação alterada pelo Fortusys.",
          }),
        }
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível alterar o cedente.");
      }

      toast.success(active ? "Cedente ativado" : "Cedente inativado");
    } catch (error) {
      setAssignors((currentAssignors) =>
        currentAssignors.map((currentAssignor) =>
          currentAssignor.id === assignor.id
            ? { ...currentAssignor, status: previousStatus }
            : currentAssignor
        )
      );
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o cedente."
      );
    } finally {
      setUpdatingAssignorId(null);
    }
  }

  async function handleZipCodeLookup(value: string) {
    const zipCode = unMask(value);

    if (zipCode.length !== 8) {
      return;
    }

    setIsSearchingZipCode(true);

    try {
      const response = await fetch(`/api/address/cep?cep=${zipCode}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as CepResponse;

      if (!response.ok) {
        toast.error(data.message ?? "Não foi possível consultar o CEP.");
        return;
      }

      createForm.setValue("zipCode", zipCodeMask(data.zipCode), {
        shouldDirty: true,
        shouldValidate: true,
      });
      createForm.setValue("street", data.street, { shouldDirty: true });
      createForm.setValue("district", data.district, { shouldDirty: true });
      createForm.setValue("city", data.city, { shouldDirty: true });
      createForm.setValue("state", data.state, { shouldDirty: true });
      createForm.setValue("cityIbgeCode", data.cityIbgeCode, {
        shouldDirty: true,
        shouldValidate: true,
      });

      if (data.complement) {
        createForm.setValue("complement", data.complement, {
          shouldDirty: true,
        });
      }
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setIsSearchingZipCode(false);
    }
  }

  async function handleCreateAssignor(values: AssignorFormValues) {
    const response = await fetch("/api/billing/assignors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível cadastrar cedente.");
      return;
    }

    toast.success("Cedente cadastrado");
    createForm.reset();
    setIsSheetOpen(false);
    await loadAssignors();
  }

  async function handleUpdateAssignor(values: AssignorFormValues) {
    if (!selectedAssignor) {
      return;
    }

    const response = await fetch(`/api/billing/assignors/${selectedAssignor.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível alterar cedente.");
      return;
    }

    const updatedAssignor = (await response.json()) as BillingAssignor;
    toast.success("Cedente alterado");
    setAssignors((currentAssignors) =>
      currentAssignors.map((assignor) =>
        assignor.id === updatedAssignor.id ? updatedAssignor : assignor
      )
    );
    createForm.reset();
    setSelectedAssignor(null);
    setIsSheetOpen(false);
  }

  async function handleSaveAssignor(values: AssignorFormValues) {
    if (selectedAssignor) {
      await handleUpdateAssignor(values);
      return;
    }

    await handleCreateAssignor(values);
  }

  return (
    <>
    <ManagementPage className="space-y-3">
      <ManagementPageHeader
        badge="Cedentes"
        compact
        hideTitle
        icon={Landmark}
        title="Gestão de cedentes"
        actions={
        <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
          <Button onClick={handleNewAssignor}>
            <Plus className="size-4" />
            Novo cedente
          </Button>
          <SheetContent
            side="right"
            className="w-[min(38rem,calc(100vw-1rem))] overflow-y-auto p-0"
          >
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>
                {isEditing ? "Editar cedente" : "Novo cedente"}
              </SheetTitle>
            </SheetHeader>
            <div className="p-5">
              <Form {...createForm}>
                <form
                  className="space-y-4"
                  onSubmit={createForm.handleSubmit(handleSaveAssignor)}
                >
                  <FormField
                    control={createForm.control}
                    name="corporateName"
                    rules={{ required: "Informe a razão social." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão social</FormLabel>
                        <FormControl>
                          <Input placeholder="Empresa Ltda" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="tradeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome fantasia</FormLabel>
                        <FormControl>
                          <Input placeholder="Empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="document"
                    rules={{ required: "Informe o CPF/CNPJ." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF/CNPJ</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                            value={field.value}
                            disabled={isEditing}
                            onBlur={field.onBlur}
                            onChange={(event) =>
                              field.onChange(documentMask(event.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="email"
                    rules={{
                      required: "Informe o e-mail.",
                      pattern: {
                        value: /^\S+@\S+\.\S+$/,
                        message: "Informe um e-mail válido.",
                      },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="cobranca@empresa.com.br"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="phone"
                    rules={{ required: "Informe o telefone." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="numeric"
                            placeholder="(44) 99999-9999"
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={(event) =>
                              field.onChange(phoneMask(event.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="zipCode"
                    rules={{ required: "Informe o CEP." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              inputMode="numeric"
                              placeholder="00000-000"
                              value={field.value}
                              onBlur={() => {
                                field.onBlur();
                                void handleZipCodeLookup(field.value);
                              }}
                              onChange={(event) => {
                                const nextValue = zipCodeMask(
                                  event.target.value
                                );
                                field.onChange(nextValue);

                                if (unMask(nextValue).length === 8) {
                                  void handleZipCodeLookup(nextValue);
                                }
                              }}
                            />
                            {isSearchingZipCode ? (
                              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                            ) : null}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-[1fr_8rem]">
                    <FormField
                      control={createForm.control}
                      name="street"
                      rules={{ required: "Informe o logradouro." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logradouro</FormLabel>
                          <FormControl>
                            <Input placeholder="Av. Brasil" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="number"
                      rules={{ required: "Informe o número." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input placeholder="123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={createForm.control}
                      name="district"
                      rules={{ required: "Informe o bairro." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input placeholder="Centro" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="complement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input placeholder="Sala 123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_5rem_8rem]">
                    <FormField
                      control={createForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="UF" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BRAZIL_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="cityIbgeCode"
                      rules={{ required: "Informe o código IBGE." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade IBGE</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              placeholder="4115200"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={createForm.formState.isSubmitting}
                    type="submit"
                  >
                    {createForm.formState.isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {isEditing ? "Salvar alterações" : "Cadastrar cedente"}
                  </Button>
                </form>
              </Form>
            </div>
          </SheetContent>
        </Sheet>
        }
      />

      <ManagementFilters className="gap-2 p-2.5 pl-4 shadow-sm before:inset-y-2">
        <Form {...searchForm}>
          <form
            className="grid gap-3 md:grid-cols-[minmax(220px,24rem)_auto] md:items-end"
            onSubmit={searchForm.handleSubmit(handleSearch)}
          >
          <div className="w-full">
            <FormField
              control={searchForm.control}
              name="document"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    CPF/CNPJ do cedente
                  </FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder="Buscar por CPF/CNPJ"
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(event) =>
                        field.onChange(documentMask(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-2 md:justify-end">
            <Button
              className="h-8 min-w-24"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Filtrar
            </Button>
            <Button
              disabled={isLoading}
              onClick={() => void handleClearSearch()}
              className="h-8 min-w-24"
              type="button"
              variant="outline"
            >
              <RotateCcw className="size-4" />
              Limpar
            </Button>
          </div>
          </form>
        </Form>
      </ManagementFilters>

      <ManagementDataCard
        className="[&_[data-slot=card-content]]:space-y-3 [&_[data-slot=card-content]]:py-3 [&_[data-slot=card-header]]:py-3"
        count={`${assignors.length} cedente(s)`}
        title="Cedentes cadastrados"
      >
          {isLoading ? (
            <ManagementTableSkeleton columns={9} rows={8} />
          ) : !hasSearched || assignors.length === 0 ? (
            <ManagementState>
              Nenhum cedente encontrado para os filtros informados.
            </ManagementState>
          ) : (
            <>
              <div className="hidden">
                {visibleAssignors.map((assignor) => (
                  <div className="rounded-lg border p-3" key={assignor.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{assignor.corporateName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDocument(assignor.document)}
                        </p>
                      </div>
                      <AssignorActions
                        isLoadingPortalAccess={
                          loadingPortalAccessId === assignor.id
                        }
                        onEdit={() => handleEditAssignor(assignor)}
                        onManageAccounts={() => handleManageAccounts(assignor)}
                        onManageWebhook={() => handleManageWebhook(assignor)}
                        onOpenPortalAccess={() =>
                          void handleOpenPortalAccess(assignor)
                        }
                      />
                    </div>
                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Situação</span>
                        <div className="flex items-center gap-2">
                          <Switch
                            aria-label={`Alterar situação de ${assignor.corporateName}`}
                            checked={isAssignorActive(assignor.status)}
                            disabled={updatingAssignorId === assignor.id}
                            onCheckedChange={(checked) =>
                              void handleUpdateAssignorStatus(assignor, checked)
                            }
                          />
                          <span className="font-medium">
                            {isAssignorActive(assignor.status)
                              ? "Ativo"
                              : "Inativo"}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Contas</span>
                        <span className="font-medium">
                          {assignor.accountsCount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <ManagementTableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Razão social</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Contas</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="w-12 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleAssignors.map((assignor) => (
                      <TableRow key={assignor.id}>
                        <TableCell>{assignor.id}</TableCell>
                        <TableCell className="font-medium">
                          {assignor.corporateName}
                          {assignor.tradeName ? (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {assignor.tradeName}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>{formatDocument(assignor.document)}</TableCell>
                        <TableCell>
                          {[assignor.city, assignor.state]
                            .filter(Boolean)
                            .join(" - ") || "Não informado"}
                        </TableCell>
                        <TableCell>{assignor.accountsCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              aria-label={`Alterar situação de ${assignor.corporateName}`}
                              checked={isAssignorActive(assignor.status)}
                              disabled={updatingAssignorId === assignor.id}
                              onCheckedChange={(checked) =>
                                void handleUpdateAssignorStatus(
                                  assignor,
                                  checked
                                )
                              }
                            />
                            <span className="text-sm">
                              {isAssignorActive(assignor.status)
                                ? "Ativo"
                                : "Inativo"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <AssignorActions
                            isLoadingPortalAccess={
                              loadingPortalAccessId === assignor.id
                            }
                            onEdit={() => handleEditAssignor(assignor)}
                            onManageAccounts={() =>
                              handleManageAccounts(assignor)
                            }
                            onManageWebhook={() =>
                              handleManageWebhook(assignor)
                            }
                            onOpenPortalAccess={() =>
                              void handleOpenPortalAccess(assignor)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ManagementTableFrame>
              <ManagementPagination
                isLoading={isLoading}
                itemLabel="cedente(s)"
                onPageChange={setCurrentPage}
                page={currentPage}
                pageSize={pageSize}
                total={assignors.length}
                visible={visibleAssignors.length}
              />
            </>
          )}
      </ManagementDataCard>
    </ManagementPage>
    <AlertDialog
      open={Boolean(portalAccess)}
      onOpenChange={(open) => {
        if (!open) {
          setPortalAccess(null);
        }
      }}
    >
      <AlertDialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <AlertDialogHeader className="border-b bg-muted/30 px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LogIn className="size-5" />
            </span>
            <div className="min-w-0">
              <AlertDialogTitle className="text-base font-semibold">
                Acesso PlugBoleto do cedente
              </AlertDialogTitle>
              <AlertDialogDescription>
                Dados rápidos para acessar ou conferir este cedente no portal
                da TecnoSpeed.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border bg-card p-4">
            <p className="truncate text-sm font-semibold">
              {portalAccess?.assignor.corporateName ?? "Cedente"}
            </p>
            {portalAccess?.assignor.tradeName ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {portalAccess.assignor.tradeName}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">CPF/CNPJ do cedente</p>
            <div className="flex gap-2">
              <Input
                className="h-10 rounded-xl"
                readOnly
                value={formatDocument(portalAccess?.assignor.document ?? "")}
              />
              <Button
                className="h-10 shrink-0 rounded-xl"
                onClick={() =>
                  void handleCopyPortalValue(
                    portalAccess?.assignor.document ?? "",
                    "CPF/CNPJ do cedente"
                  )
                }
                size="icon"
                title="Copiar CPF/CNPJ do cedente"
                type="button"
                variant="outline"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Token do cedente</p>
            <div className="flex gap-2">
              <Input
                className="h-10 rounded-xl"
                readOnly
                type="password"
                value={portalAccess?.token ?? ""}
              />
              <Button
                className="h-10 shrink-0 rounded-xl"
                disabled={!portalAccess?.token}
                onClick={() =>
                  void handleCopyPortalValue(
                    portalAccess?.token ?? "",
                    "Token do cedente"
                  )
                }
                size="icon"
                title="Copiar token do cedente"
                type="button"
                variant="outline"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
            O token é consultado diretamente na TecnoSpeed no momento em que
            você abre este acesso, evitando depender de dados antigos salvos no
            Fortusys.
          </div>
        </div>

        <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-6 py-4 sm:space-x-0">
          <AlertDialogClose className="h-9 rounded-lg">
            Fechar
          </AlertDialogClose>
          <Button
            className="h-9 rounded-lg"
            onClick={() => window.open(portalUrl, "_blank", "noreferrer")}
            type="button"
          >
            Abrir portal
            <ExternalLink className="size-4" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
