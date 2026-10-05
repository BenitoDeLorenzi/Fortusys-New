"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  Edit3,
  FileText,
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
  BillingBankAccount,
  BillingBankAccountsResponse,
} from "@/features/billing/types";

type AssignorAccountsManagementProps = {
  assignorId: string;
  document: string;
  name: string;
};

type AccountFormValues = {
  bankCode: string;
  agency: string;
  agencyDigit: string;
  accountNumber: string;
  accountDigit: string;
  accountType: string;
  beneficiaryCode: string;
  companyCode: string;
  validationActive: boolean;
  updatedPrint: boolean;
};

function getEmptyAccountFormValues(): AccountFormValues {
  return {
    bankCode: "",
    agency: "",
    agencyDigit: "",
    accountNumber: "",
    accountDigit: "",
    accountType: "CORRENTE",
    beneficiaryCode: "",
    companyCode: "",
    validationActive: false,
    updatedPrint: false,
  };
}

function getAccountFormValues(account: BillingBankAccount): AccountFormValues {
  return {
    bankCode: account.bankCode,
    agency: account.agency,
    agencyDigit: account.agencyDigit ?? "",
    accountNumber: account.accountNumber,
    accountDigit: account.accountDigit ?? "",
    accountType: account.accountType || "CORRENTE",
    beneficiaryCode: account.beneficiaryCode ?? "",
    companyCode: account.companyCode ?? "",
    validationActive: Boolean(account.validationActive),
    updatedPrint: Boolean(account.updatedPrint),
  };
}

function accountLabel(account: BillingBankAccount) {
  return `${account.bankCode} / Ag. ${account.agency}-${account.agencyDigit || "0"} / Conta ${account.accountNumber}-${account.accountDigit || "0"}`;
}

function AccountActions({
  onEdit,
  onAgreements,
  onRequestDelete,
}: {
  onEdit: () => void;
  onAgreements: () => void;
  onRequestDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Abrir ações da conta"
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
            Editar conta
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAgreements}>
            <FileText className="size-4" />
            Convênios
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onRequestDelete} variant="destructive">
            <Trash2 className="size-4" />
            Excluir conta
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssignorAccountsManagement({
  assignorId,
  document,
  name,
}: AssignorAccountsManagementProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BillingBankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );
  const [accountToDelete, setAccountToDelete] =
    useState<BillingBankAccount | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const accountForm = useForm<AccountFormValues>({
    defaultValues: getEmptyAccountFormValues(),
  });

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  function agreementsUrl(accountId: number) {
    return `/cedentes/${assignorId}/contas/${accountId}/convenios?document=${document}&name=${encodeURIComponent(name)}`;
  }

  async function loadAccounts() {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/billing/assignors/${assignorId}/accounts?document=${document}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as
        | BillingBankAccountsResponse
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data
            ? data.message
            : "Não foi possível carregar contas."
        );
      }

      if (!("accounts" in data)) {
        throw new Error("Não foi possível carregar contas.");
      }

      setAccounts(data.accounts);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar contas."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignorId, document]);

  function resetSheetState() {
    setSelectedAccountId(null);
    setIsCreatingAccount(false);
    accountForm.reset(getEmptyAccountFormValues());
  }

  function handleSheetOpenChange(open: boolean) {
    setIsSheetOpen(open);

    if (!open) {
      resetSheetState();
    }
  }

  function handleNewAccount() {
    setSelectedAccountId(null);
    setIsCreatingAccount(true);
    accountForm.reset(getEmptyAccountFormValues());
    setIsSheetOpen(true);
  }

  function handleEditAccount(account: BillingBankAccount) {
    setSelectedAccountId(account.id);
    setIsCreatingAccount(false);
    accountForm.reset(getAccountFormValues(account));
    setIsSheetOpen(true);
  }

  async function handleCreateAccount(values: AccountFormValues) {
    const response = await fetch(`/api/billing/assignors/${assignorId}/accounts`, {
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
      toast.error(data.message ?? "Não foi possível cadastrar conta.");
      return;
    }

    const createdAccount = (await response.json()) as BillingBankAccount;
    setAccounts((currentAccounts) => [...currentAccounts, createdAccount]);
    toast.success("Conta cadastrada");
    setIsSheetOpen(false);
    resetSheetState();
  }

  async function handleUpdateAccount(values: AccountFormValues) {
    if (!selectedAccount) {
      return;
    }

    const response = await fetch(`/api/billing/accounts/${selectedAccount.id}`, {
      method: "PUT",
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
      toast.error(data.message ?? "Não foi possível alterar conta.");
      return;
    }

    const updatedAccount = (await response.json()) as BillingBankAccount;
    setAccounts((currentAccounts) =>
      currentAccounts.map((account) =>
        account.id === updatedAccount.id ? updatedAccount : account
      )
    );
    toast.success("Conta alterada");
    setIsSheetOpen(false);
    resetSheetState();
  }

  async function handleDeleteAccount(account: BillingBankAccount) {
    const response = await fetch(
      `/api/billing/accounts/${account.id}?document=${document}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível excluir conta.");
      return;
    }

    setAccounts((currentAccounts) =>
      currentAccounts.filter((currentAccount) => currentAccount.id !== account.id)
    );
    setAccountToDelete(null);
    toast.success("Conta excluída");
  }

  async function handleSaveAccount(values: AccountFormValues) {
    if (isCreatingAccount) {
      await handleCreateAccount(values);
      return;
    }

    await handleUpdateAccount(values);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            aria-label="Voltar para cedentes"
            onClick={() => router.push("/cedentes")}
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
              Contas bancárias
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{name}</p>
          </div>
        </div>

        <Button onClick={handleNewAccount} type="button">
          <Plus className="size-4" />
          Nova conta
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Contas cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Carregando contas...
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Nenhuma conta encontrada para este cedente.
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {accounts.map((account) => (
                  <div className="rounded-lg border p-3" key={account.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{accountLabel(account)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {account.accountType}
                        </p>
                      </div>
                      <AccountActions
                        onAgreements={() => router.push(agreementsUrl(account.id))}
                        onEdit={() => handleEditAccount(account)}
                        onRequestDelete={() => setAccountToDelete(account)}
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Situação</span>
                      <Badge variant={account.active ? "default" : "secondary"}>
                        {account.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banco</TableHead>
                      <TableHead>Agência</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Código beneficiário</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="w-12 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>{account.bankCode}</TableCell>
                        <TableCell>
                          {account.agency}
                          {account.agencyDigit ? `-${account.agencyDigit}` : ""}
                        </TableCell>
                        <TableCell>
                          {account.accountNumber}
                          {account.accountDigit ? `-${account.accountDigit}` : ""}
                        </TableCell>
                        <TableCell>{account.accountType}</TableCell>
                        <TableCell>
                          {account.beneficiaryCode || "Não informado"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={account.active ? "default" : "secondary"}
                          >
                            {account.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <AccountActions
                            onAgreements={() =>
                              router.push(agreementsUrl(account.id))
                            }
                            onEdit={() => handleEditAccount(account)}
                            onRequestDelete={() => setAccountToDelete(account)}
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
              {isCreatingAccount ? "Nova conta" : "Editar conta"}
            </SheetTitle>
          </SheetHeader>
          <div className="p-5">
            <Form {...accountForm}>
              <form
                className="space-y-4"
                onSubmit={accountForm.handleSubmit(handleSaveAccount)}
              >
                <div className="grid gap-4 md:grid-cols-[8rem_1fr_5rem]">
                  <FormField
                    control={accountForm.control}
                    name="bankCode"
                    rules={{ required: "Informe o banco." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banco</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="341" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="agency"
                    rules={{ required: "Informe a agência." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agência</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="1234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="agencyDigit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DV</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_5rem]">
                  <FormField
                    control={accountForm.control}
                    name="accountNumber"
                    rules={{ required: "Informe a conta." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="59698" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="accountDigit"
                    rules={{ required: "Informe o DV." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DV</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="3" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={accountForm.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione">
                                {field.value === "POUPANÇA"
                                  ? "Poupança"
                                  : "Corrente"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CORRENTE">Corrente</SelectItem>
                            <SelectItem value="POUPANÇA">Poupança</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="beneficiaryCode"
                    rules={{ required: "Informe o código beneficiário." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código beneficiário</FormLabel>
                        <FormControl>
                          <Input placeholder="60473" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={accountForm.control}
                  name="companyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Obrigatório para alguns bancos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 rounded-lg border p-3">
                  <FormField
                    control={accountForm.control}
                    name="validationActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3">
                        <FormLabel>Validação ativa</FormLabel>
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
                    control={accountForm.control}
                    name="updatedPrint"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3">
                        <FormLabel>Impressão atualizada</FormLabel>
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

                <Button
                  className="w-full"
                  disabled={accountForm.formState.isSubmitting}
                  type="submit"
                >
                  {accountForm.formState.isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {isCreatingAccount ? "Cadastrar conta" : "Salvar conta"}
                </Button>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={Boolean(accountToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setAccountToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash className="size-5" />
            </div>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente a conta{" "}
              {accountToDelete ? accountLabel(accountToDelete) : "selecionada"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>Cancelar</AlertDialogClose>
            <AlertDialogAction
              onClick={() => {
                if (accountToDelete) {
                  void handleDeleteAccount(accountToDelete);
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
