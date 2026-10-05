"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Edit3,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash,
  Trash2,
  UserRound,
} from "lucide-react";
import { mask, unMask } from "remask";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDocument } from "@/features/billing/utils";
import type {
  ClientRole,
  Payer,
  PayersResponse,
} from "@/features/payers/types";
import { BRAZIL_STATES } from "@/lib/brazil-states";

type PayerSearchForm = {
  search: string;
};

type PayerFormValues = {
  name: string;
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
  active: boolean;
  roles: ClientRole[];
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

function documentMask(value: string) {
  return mask(unMask(value), ["999.999.999-99", "99.999.999/9999-99"]);
}

function phoneMask(value: string) {
  return mask(unMask(value), ["(99) 9999-9999", "(99) 99999-9999"]);
}

function capitalizeName(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1))
    .join(" ");
}

function zipCodeMask(value: string) {
  return mask(unMask(value), "99999-999");
}

function getEmptyPayerFormValues(): PayerFormValues {
  return {
    name: "",
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
    active: true,
    roles: ["payer"],
  };
}

function getPayerFormValues(payer: Payer): PayerFormValues {
  return {
    name: payer.name,
    document: documentMask(payer.document),
    email: payer.email ?? "",
    phone: phoneMask(payer.phone ?? ""),
    zipCode: zipCodeMask(payer.zipCode ?? ""),
    street: payer.street ?? "",
    number: payer.number ?? "",
    complement: payer.complement ?? "",
    district: payer.district ?? "",
    city: payer.city ?? "",
    state: payer.state ?? "",
    active: payer.status === "active",
    roles: payer.roles,
  };
}

function getPayerPayload(values: PayerFormValues, id?: string) {
  return {
    id,
    name: values.name.trim(),
    document: unMask(values.document),
    email: values.email.trim().toLowerCase(),
    phone: unMask(values.phone),
    zipCode: unMask(values.zipCode),
    street: values.street.trim(),
    number: values.number.trim(),
    complement: values.complement.trim(),
    district: values.district.trim(),
    city: values.city.trim(),
    state: values.state.trim().toUpperCase(),
    status: values.active ? "active" : "inactive",
    roles: values.roles,
  };
}

const roleLabels: Record<ClientRole, string> = {
  payer: "Pagador",
  tenant: "Inquilino",
  buyer: "Comprador",
  guarantor: "Fiador",
};

function ClientRoleBadges({ roles }: { roles: ClientRole[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant={role === "tenant" ? "default" : "secondary"}>
          {roleLabels[role]}
        </Badge>
      ))}
    </div>
  );
}

function PayerActions({
  onEdit,
  onRequestDelete,
}: {
  onEdit: () => void;
  onRequestDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Abrir ações do cliente"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onEdit}>
            <Edit3 className="size-4" />
            Editar cliente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRequestDelete} variant="destructive">
            <Trash2 className="size-4" />
            Excluir cliente
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PayersManagement() {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null);
  const [payerToDelete, setPayerToDelete] = useState<Payer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingZipCode, setIsSearchingZipCode] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPayers, setTotalPayers] = useState(0);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | ClientRole>("all");
  const searchForm = useForm<PayerSearchForm>({
    defaultValues: { search: "" },
  });
  const payerForm = useForm<PayerFormValues>({
    defaultValues: getEmptyPayerFormValues(),
  });
  const isEditing = Boolean(selectedPayer);

  async function loadPayers(
    search?: string,
    page = 1,
    role: "all" | ClientRole = roleFilter
  ) {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "8");

      if (search?.trim()) {
        params.set("search", search.trim());
      }

      if (role !== "all") {
        params.set("role", role);
      }

      const response = await fetch(`/api/payers?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as PayersResponse | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data ? data.message : "Não foi possível carregar clientes."
        );
      }

      if (!("payers" in data)) {
        throw new Error("Não foi possível carregar clientes.");
      }

      setPayers(data.payers);
      setCurrentPage(page);
      setTotalPayers(data.total);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar clientes."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPayers();
    // The initial load intentionally uses the default, unfiltered role state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSheetOpenChange(open: boolean) {
    setIsSheetOpen(open);

    if (!open) {
      payerForm.reset(getEmptyPayerFormValues());
      setSelectedPayer(null);
    }
  }

  function handleNewPayer() {
    setSelectedPayer(null);
    payerForm.reset(getEmptyPayerFormValues());
    setIsSheetOpen(true);
  }

  function handleEditPayer(payer: Payer) {
    setSelectedPayer(payer);
    payerForm.reset(getPayerFormValues(payer));
    setIsSheetOpen(true);
  }

  function handleSearch() {
    const nextSearch = searchForm.getValues("search").trim();

    if (!nextSearch) {
      toast.info("Informe o nome, CPF ou CNPJ para filtrar.");
    }

    setAppliedSearch(nextSearch);
    void loadPayers(nextSearch, 1, roleFilter);
  }

  function handleClearSearch() {
    searchForm.reset({ search: "" });
    setAppliedSearch("");
    setRoleFilter("all");
    void loadPayers("", 1, "all");
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

      payerForm.setValue("zipCode", zipCodeMask(data.zipCode), {
        shouldDirty: true,
        shouldValidate: true,
      });
      payerForm.setValue("street", data.street, { shouldDirty: true });
      payerForm.setValue("district", data.district, { shouldDirty: true });
      payerForm.setValue("city", data.city, { shouldDirty: true });
      payerForm.setValue("state", data.state, { shouldDirty: true });

      if (data.complement) {
        payerForm.setValue("complement", data.complement, {
          shouldDirty: true,
        });
      }
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setIsSearchingZipCode(false);
    }
  }

  async function handleSavePayer(values: PayerFormValues) {
    const payload = getPayerPayload(values, selectedPayer?.id);
    const response = await fetch("/api/payers", {
      method: selectedPayer ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível salvar cliente.");
      return;
    }

    toast.success(selectedPayer ? "Cliente alterado" : "Cliente cadastrado");
    setIsSheetOpen(false);
    payerForm.reset(getEmptyPayerFormValues());
    setSelectedPayer(null);
    await loadPayers(appliedSearch, selectedPayer ? currentPage : 1);
  }

  async function handleDeletePayer() {
    if (!payerToDelete) {
      return;
    }

    const response = await fetch(`/api/payers?id=${payerToDelete.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível excluir cliente.");
      return;
    }

    setPayerToDelete(null);
    toast.success("Cliente excluído");
    await loadPayers(appliedSearch, currentPage);
  }

  return (
    <ManagementPage className="space-y-3">
      <ManagementPageHeader
        badge="Clientes"
        compact
        hideTitle
        icon={UserRound}
        title="Gestão de clientes"
        actions={
        <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
          <Button onClick={handleNewPayer} type="button">
            <Plus className="size-4" />
            Novo cliente
          </Button>
          <SheetContent
            side="right"
            className="w-[min(38rem,calc(100vw-1rem))] overflow-y-auto p-0"
          >
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>
                {isEditing ? "Editar cliente" : "Novo cliente"}
              </SheetTitle>
            </SheetHeader>
            <div className="p-5">
              <Form {...payerForm}>
                <form
                  className="space-y-4"
                  onSubmit={payerForm.handleSubmit(handleSavePayer)}
                >
                  <FormField
                    control={payerForm.control}
                    name="name"
                    rules={{ required: "Informe o nome do cliente." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nome completo ou razão social"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={payerForm.control}
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
                    control={payerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="cliente@email.com"
                            type="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={payerForm.control}
                    name="phone"
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
                    control={payerForm.control}
                    name="zipCode"
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
                      control={payerForm.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logradouro</FormLabel>
                          <FormControl>
                            <Input placeholder="Rua, avenida" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={payerForm.control}
                      name="number"
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
                      control={payerForm.control}
                      name="district"
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
                      control={payerForm.control}
                      name="complement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Sala, bloco, referência"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_5rem]">
                    <FormField
                      control={payerForm.control}
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
                      control={payerForm.control}
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
                  </div>

                  <FormField
                    control={payerForm.control}
                    name="roles"
                    rules={{
                      validate: (roles) =>
                        roles.length > 0 || "Selecione ao menos uma função.",
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Funções do cliente</FormLabel>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {(Object.keys(roleLabels) as ClientRole[]).map(
                            (role) => (
                              <label
                                className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"
                                key={role}
                              >
                                <Checkbox
                                  checked={field.value.includes(role)}
                                  onCheckedChange={(checked) =>
                                    field.onChange(
                                      checked
                                        ? [...field.value, role]
                                        : field.value.filter(
                                            (item) => item !== role
                                          )
                                    )
                                  }
                                />
                                {roleLabels[role]}
                              </label>
                            )
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={payerForm.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <FormLabel>Cliente ativo</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button
                    className="w-full"
                    disabled={payerForm.formState.isSubmitting}
                    type="submit"
                  >
                    {payerForm.formState.isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {isEditing ? "Salvar alterações" : "Cadastrar cliente"}
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
            className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_12rem_auto] md:items-end"
            onSubmit={searchForm.handleSubmit(handleSearch)}
          >
          <div className="w-full">
            <FormField
              control={searchForm.control}
              name="search"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    Nome ou CPF/CNPJ
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Buscar cliente"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="w-full">
            <FormLabel className="text-xs font-medium text-muted-foreground">
              Função
            </FormLabel>
            <Select
              value={roleFilter}
              onValueChange={(value) => {
                const role = value as "all" | ClientRole;
                setRoleFilter(role);
                void loadPayers(appliedSearch, 1, role);
              }}
            >
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue>
                  {roleFilter === "all"
                    ? "Todas"
                    : roleLabels[roleFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="payer">Pagadores</SelectItem>
                <SelectItem value="tenant">Inquilinos</SelectItem>
                <SelectItem value="buyer">Compradores</SelectItem>
                <SelectItem value="guarantor">Fiadores</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 md:justify-end">
            <Button className="h-8 min-w-24" type="submit">
              <Search className="size-4" />
              Filtrar
            </Button>
            <Button
              className="h-8 min-w-24"
              onClick={handleClearSearch}
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
        count={`${totalPayers} cliente(s)`}
        title="Clientes cadastrados"
      >
          {isLoading ? (
            <ManagementTableSkeleton columns={8} rows={8} />
          ) : payers.length === 0 ? (
            <ManagementState>Nenhum cliente encontrado.</ManagementState>
          ) : (
            <>
              <div className="hidden">
                {payers.map((payer) => (
                  <div className="rounded-lg border p-3" key={payer.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {payer.code ?? "-"}
                        </p>
                        <p className="font-medium">{capitalizeName(payer.name)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDocument(payer.document)}
                        </p>
                        <div className="mt-2">
                          <ClientRoleBadges roles={payer.roles} />
                        </div>
                      </div>
                      <PayerActions
                        onEdit={() => handleEditPayer(payer)}
                        onRequestDelete={() => setPayerToDelete(payer)}
                      />
                    </div>
                    <div className="mt-4 grid gap-1 text-sm text-muted-foreground">
                      <p>
                        {payer.phone
                          ? phoneMask(payer.phone)
                          : "Telefone não informado"}
                      </p>
                      <p>
                        {[payer.city, payer.state].filter(Boolean).join(" - ") ||
                          "Cidade n?o informada"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <ManagementTableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Funções</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead className="w-12 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payers.map((payer) => (
                      <TableRow key={payer.id}>
                        <TableCell className="font-medium">
                          {capitalizeName(payer.name)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {payer.code ?? "-"}
                        </TableCell>
                        <TableCell>{formatDocument(payer.document)}</TableCell>
                        <TableCell>
                          <ClientRoleBadges roles={payer.roles} />
                        </TableCell>
                        <TableCell>
                          {payer.phone ? phoneMask(payer.phone) : "Não informado"}
                        </TableCell>
                        <TableCell>
                          {[payer.city, payer.state].filter(Boolean).join(" - ") ||
                            "Não informado"}
                        </TableCell>
                        <TableCell className="text-right">
                          <PayerActions
                            onEdit={() => handleEditPayer(payer)}
                            onRequestDelete={() => setPayerToDelete(payer)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ManagementTableFrame>

              <ManagementPagination
                isLoading={isLoading}
                itemLabel="cliente(s)"
                onPageChange={(page) =>
                  void loadPayers(appliedSearch, page)
                }
                page={currentPage}
                pageSize={8}
                total={totalPayers}
                visible={payers.length}
              />
            </>
          )}
      </ManagementDataCard>

      <AlertDialog
        open={Boolean(payerToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPayerToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash className="size-5" />
            </div>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o cliente da sua lista. Clientes vinculados a
              contratos não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>Cancelar</AlertDialogClose>
            <AlertDialogAction onClick={() => void handleDeletePayer()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementPage>
  );
}
