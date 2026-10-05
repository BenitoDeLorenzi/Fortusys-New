"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import {
  ArrowLeft,
  Edit3,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type {
  BillingAgreement,
  BillingBankAccount,
} from "@/features/billing/types";

type AccountAgreementsManagementProps = {
  assignorId: string;
  accountId: string;
  document: string;
  name: string;
};

type AgreementFormValues = {
  number: string;
  description: string;
  wallet: string;
  species: string;
  cnabPattern: string;
  remittanceNumber: string;
  restartDaily: boolean;
  manualRemittance: boolean;
  instantRegistration: boolean;
  apiId: string;
  apiKey: string;
  apiSecret: string;
  station: string;
  webserviceType: string;
};

function getEmptyAgreementFormValues(): AgreementFormValues {
  return {
    number: "",
    description: "",
    wallet: "",
    species: "R$",
    cnabPattern: "400",
    remittanceNumber: "1",
    restartDaily: false,
    manualRemittance: false,
    instantRegistration: false,
    apiId: "",
    apiKey: "",
    apiSecret: "",
    station: "",
    webserviceType: "v2",
  };
}

function getAgreementFormValues(
  agreement: BillingAgreement
): AgreementFormValues {
  return {
    number: agreement.number ?? "",
    description: agreement.description ?? "",
    wallet: agreement.wallet ?? "",
    species: agreement.species ?? "R$",
    cnabPattern: agreement.cnabPattern ?? "400",
    remittanceNumber: agreement.remittanceNumber ?? "1",
    restartDaily: false,
    manualRemittance: false,
    instantRegistration: Boolean(agreement.instantRegistration),
    apiId: "",
    apiKey: "",
    apiSecret: "",
    station: "",
    webserviceType: "v2",
  };
}

function AgreementActions({
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
            aria-label="Abrir ações do convênio"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onEdit}>
            <Edit3 className="size-4" />
            Editar convênio
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onRequestDelete} variant="destructive">
            <Trash2 className="size-4" />
            Excluir convênio
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AccountAgreementsManagement({
  assignorId,
  accountId,
  document,
  name,
}: AccountAgreementsManagementProps) {
  const router = useRouter();
  const [account, setAccount] = useState<BillingBankAccount | null>(null);
  const [selectedAgreement, setSelectedAgreement] =
    useState<BillingAgreement | null>(null);
  const [agreementToDelete, setAgreementToDelete] =
    useState<BillingAgreement | null>(null);
  const [isCreatingAgreement, setIsCreatingAgreement] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const agreementForm = useForm<AgreementFormValues>({
    defaultValues: getEmptyAgreementFormValues(),
  });
  const usesInstantRegistration = useWatch({
    control: agreementForm.control,
    name: "instantRegistration",
  });

  async function loadAccount() {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/billing/accounts/${accountId}?document=${document}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as
        | BillingBankAccount
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data
            ? data.message
            : "Não foi possível carregar convênios."
        );
      }

      if (!("agreements" in data)) {
        throw new Error("Não foi possível carregar convênios.");
      }

      setAccount(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar convênios."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, document]);

  function resetSheetState() {
    setSelectedAgreement(null);
    setIsCreatingAgreement(false);
    agreementForm.reset(getEmptyAgreementFormValues());
  }

  function handleSheetOpenChange(open: boolean) {
    setIsSheetOpen(open);

    if (!open) {
      resetSheetState();
    }
  }

  function handleNewAgreement() {
    setSelectedAgreement(null);
    setIsCreatingAgreement(true);
    agreementForm.reset(getEmptyAgreementFormValues());
    setIsSheetOpen(true);
  }

  function handleEditAgreement(agreement: BillingAgreement) {
    setSelectedAgreement(agreement);
    setIsCreatingAgreement(false);
    agreementForm.reset(getAgreementFormValues(agreement));
    setIsSheetOpen(true);
  }

  async function handleCreateAgreement(values: AgreementFormValues) {
    const response = await fetch(`/api/billing/accounts/${accountId}/agreements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...values,
        document,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível cadastrar convênio.");
      return;
    }

    const createdAgreement = (await response.json()) as BillingAgreement;
    setAccount((currentAccount) =>
      currentAccount
        ? {
            ...currentAccount,
            agreements: [...currentAccount.agreements, createdAgreement],
          }
        : currentAccount
    );
    toast.success("Convênio cadastrado");
    setIsSheetOpen(false);
    resetSheetState();
  }

  async function handleUpdateAgreement(values: AgreementFormValues) {
    if (!selectedAgreement) {
      return;
    }

    const response = await fetch(
      `/api/billing/agreements/${selectedAgreement.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          accountId,
          document,
        }),
      }
    );

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível alterar convênio.");
      return;
    }

    const updatedAgreement = (await response.json()) as BillingAgreement;
    setAccount((currentAccount) =>
      currentAccount
        ? {
            ...currentAccount,
            agreements: currentAccount.agreements.map((agreement) =>
              agreement.id === updatedAgreement.id ? updatedAgreement : agreement
            ),
          }
        : currentAccount
    );
    toast.success("Convênio alterado");
    setIsSheetOpen(false);
    resetSheetState();
  }

  async function handleDeleteAgreement(agreement: BillingAgreement) {
    const response = await fetch(
      `/api/billing/agreements/${agreement.id}?document=${document}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível excluir convênio.");
      return;
    }

    setAccount((currentAccount) =>
      currentAccount
        ? {
            ...currentAccount,
            agreements: currentAccount.agreements.filter(
              (currentAgreement) => currentAgreement.id !== agreement.id
            ),
          }
        : currentAccount
    );
    setAgreementToDelete(null);
    toast.success("Convênio excluído");
  }

  async function handleSaveAgreement(values: AgreementFormValues) {
    if (isCreatingAgreement) {
      await handleCreateAgreement(values);
      return;
    }

    await handleUpdateAgreement(values);
  }

  const agreements = account?.agreements ?? [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            aria-label="Voltar para contas"
            onClick={() =>
              router.push(
                `/cedentes/${assignorId}/contas?document=${document}&name=${encodeURIComponent(name)}`
              )
            }
            size="icon"
            type="button"
            variant="outline"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <Badge className="mb-3 bg-primary/10 text-primary hover:bg-primary/10">
              Cedentes
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Convênios
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{name}</p>
          </div>
        </div>

        <Button onClick={handleNewAgreement} type="button">
          <Plus className="size-4" />
          Novo convênio
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Convênios cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Carregando convênios...
            </div>
          ) : agreements.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Nenhum convênio encontrado para esta conta.
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {agreements.map((agreement) => (
                  <div className="rounded-lg border p-3" key={agreement.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {agreement.description || "Convênio sem descrição"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Nº {agreement.number || "não informado"}
                        </p>
                      </div>
                      <AgreementActions
                        onEdit={() => handleEditAgreement(agreement)}
                        onRequestDelete={() => setAgreementToDelete(agreement)}
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Situação</span>
                      <Badge variant={agreement.active ? "default" : "secondary"}>
                        {agreement.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Carteira</TableHead>
                      <TableHead>CNAB</TableHead>
                      <TableHead>Espécie</TableHead>
                      <TableHead>Remessa</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="w-12 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreements.map((agreement) => (
                      <TableRow key={agreement.id}>
                        <TableCell>{agreement.number || "Não informado"}</TableCell>
                        <TableCell>
                          {agreement.description || "Não informado"}
                        </TableCell>
                        <TableCell>{agreement.wallet || "Não informado"}</TableCell>
                        <TableCell>
                          {agreement.cnabPattern || "Não informado"}
                        </TableCell>
                        <TableCell>{agreement.species || "Não informado"}</TableCell>
                        <TableCell>
                          {agreement.remittanceNumber || "Não informado"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={agreement.active ? "default" : "secondary"}
                          >
                            {agreement.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <AgreementActions
                            onEdit={() => handleEditAgreement(agreement)}
                            onRequestDelete={() =>
                              setAgreementToDelete(agreement)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="right"
          className="w-[min(38rem,calc(100vw-1rem))] overflow-y-auto p-0"
        >
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>
              {isCreatingAgreement ? "Novo convênio" : "Editar convênio"}
            </SheetTitle>
          </SheetHeader>
          <div className="p-5">
            <Form {...agreementForm}>
              <form
                className="space-y-4"
                onSubmit={agreementForm.handleSubmit(handleSaveAgreement)}
              >
                <FormField
                  control={agreementForm.control}
                  name="number"
                  rules={{ required: "Informe o número do convênio." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do convênio</FormLabel>
                      <FormControl>
                        <Input placeholder="7889604745" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={agreementForm.control}
                  name="description"
                  rules={{ required: "Informe a descrição." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Convênio principal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={agreementForm.control}
                    name="wallet"
                    rules={{ required: "Informe a carteira." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carteira</FormLabel>
                        <FormControl>
                          <Input placeholder="109" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={agreementForm.control}
                    name="species"
                    rules={{ required: "Informe a espécie." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Espécie</FormLabel>
                        <FormControl>
                          <Input placeholder="R$" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={agreementForm.control}
                    name="cnabPattern"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNAB</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione">
                                {field.value}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="240">240</SelectItem>
                            <SelectItem value="400">400</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={agreementForm.control}
                    name="remittanceNumber"
                    rules={{ required: "Informe a remessa." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número da remessa</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 rounded-lg border p-3">
                  <FormField
                    control={agreementForm.control}
                    name="restartDaily"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3">
                        <FormLabel>Reiniciar remessa diariamente</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={agreementForm.control}
                    name="manualRemittance"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3">
                        <FormLabel>Controle manual da remessa</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={agreementForm.control}
                    name="instantRegistration"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3">
                        <FormLabel>Registro instantâneo</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {usesInstantRegistration ? (
                  <div className="space-y-4 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">Registro instantâneo</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={agreementForm.control}
                        name="apiId"
                        rules={{
                          required: usesInstantRegistration
                            ? "Informe o API ID."
                            : false,
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API ID</FormLabel>
                            <FormControl>
                              <Input placeholder="Client ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={agreementForm.control}
                        name="apiKey"
                        rules={{
                          required: usesInstantRegistration
                            ? "Informe a API Key."
                            : false,
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key</FormLabel>
                            <FormControl>
                              <Input placeholder="Workspace ID ou chave" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={agreementForm.control}
                      name="apiSecret"
                      rules={{
                        required: usesInstantRegistration
                          ? "Informe o API Secret."
                          : false,
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Secret</FormLabel>
                          <FormControl>
                            <Input placeholder="Client secret" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={agreementForm.control}
                        name="webserviceType"
                        rules={{
                          required: usesInstantRegistration
                            ? "Informe o tipo do webservice."
                            : false,
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo do webservice</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione">
                                    {field.value}
                                  </SelectValue>
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="v1">v1</SelectItem>
                                <SelectItem value="v2">v2</SelectItem>
                                <SelectItem value="v2.2">v2.2</SelectItem>
                                <SelectItem value="v3">v3</SelectItem>
                                <SelectItem value="NORMAL">Normal</SelectItem>
                                <SelectItem value="SHOP FACIL">Shop Fácil</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={agreementForm.control}
                        name="station"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estação</FormLabel>
                            <FormControl>
                              <Input placeholder="Opcional" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ) : null}

                <Button
                  className="w-full"
                  disabled={agreementForm.formState.isSubmitting}
                  type="submit"
                >
                  {agreementForm.formState.isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {isCreatingAgreement
                    ? "Cadastrar convênio"
                    : "Salvar convênio"}
                </Button>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={Boolean(agreementToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setAgreementToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash className="size-5" />
            </div>
            <AlertDialogTitle>Excluir convênio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente o convênio{" "}
              {agreementToDelete?.description ||
                agreementToDelete?.number ||
                "selecionado"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>Cancelar</AlertDialogClose>
            <AlertDialogAction
              onClick={() => {
                if (agreementToDelete) {
                  void handleDeleteAgreement(agreementToDelete);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
