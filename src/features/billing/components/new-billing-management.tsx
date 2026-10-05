"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import {
  Building2,
  FileText,
  Landmark,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { unMask } from "remask";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormPageHeader } from "@/components/management/form-page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import {
  getBrazilianBankName,
  normalizeBankCode,
} from "@/features/billing/banks";
import {
  BILLING_REVIEW_DRAFT_KEY,
  getAgreementDraftLabel,
  type BillingReviewDraft,
} from "@/features/billing/billing-draft";
import type {
  BillingBankAccount,
  BillingBankAccountsResponse,
} from "@/features/billing/types";
import {
  formatDocument,
  generateBillingOurNumber,
  isValidBillingOurNumber,
} from "@/features/billing/utils";
import type { Payer, PayersResponse } from "@/features/payers/types";

type NewBillingManagementProps = {
  assignorId: string;
  document: string;
  name: string;
};

const billingActiveAssignorStorageKey = "fortusys:billing:active-assignor";

function getStoredBillingAssignor() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedAssignor = window.sessionStorage.getItem(
    billingActiveAssignorStorageKey
  );

  if (!storedAssignor) {
    return null;
  }

  try {
    const parsedAssignor = JSON.parse(storedAssignor) as {
      id?: string;
      document?: string;
      name?: string;
    };

    if (parsedAssignor.id && parsedAssignor.document) {
      return {
        id: parsedAssignor.id,
        document: parsedAssignor.document,
        name: parsedAssignor.name ?? "Cedente",
      };
    }
  } catch {
    window.sessionStorage.removeItem(billingActiveAssignorStorageKey);
  }

  return null;
}

type NewBillingFormValues = {
  accountId: string;
  agreementId: string;
  isHybrid: boolean;
  payerId: string;
  payerSearch: string;
  documentNumber: string;
  ourNumber: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  documentSpecies: string;
  accept: string;
  paymentPlace: string;
  installmentEnabled: boolean;
  installmentCount: string;
  installmentInterval: string;
  interestCode: string;
  interestDate: string;
  interestValue: string;
  fineCode: string;
  fineDate: string;
  fineValue: string;
  discountCode: string;
  discountDate: string;
  discountValue: string;
  protestCode: string;
  protestDays: string;
  writeOffCode: string;
  writeOffDays: string;
  message1: string;
  message2: string;
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  if (!date) {
    return "";
  }

  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function generateShortSequence() {
  return generateBillingOurNumber();
}

function generateAccountBillingIdentifiers(account: BillingBankAccount) {
  const year = String(new Date().getFullYear()).slice(-2);
  const bankCode = normalizeBankCode(account.bankCode);
  const sequence = generateShortSequence();

  return {
    documentNumber: `${year}${bankCode}${sequence}`.slice(0, 10),
    ourNumber: sequence,
  };
}

function getEmptyBillingFormValues(): NewBillingFormValues {
  const year = String(new Date().getFullYear()).slice(-2);
  const sequence = generateShortSequence();
  const issueDate = getToday();
  const dueDate = addDays(issueDate, 30);

  return {
    accountId: "",
    agreementId: "",
    isHybrid: true,
    payerId: "",
    payerSearch: "",
    documentNumber: `${year}${sequence}`.slice(0, 10),
    ourNumber: sequence,
    issueDate,
    dueDate,
    amount: "",
    documentSpecies: "01",
    accept: "S",
    paymentPlace: "Pagável em qualquer banco até o vencimento.",
    installmentEnabled: false,
    installmentCount: "1",
    installmentInterval: "30",
    interestCode: "2",
    interestDate: addDays(dueDate, 1),
    interestValue: "0,03",
    fineCode: "2",
    fineDate: addDays(dueDate, 1),
    fineValue: "10,00",
    discountCode: "0",
    discountDate: "",
    discountValue: "",
    protestCode: "1",
    protestDays: "30",
    writeOffCode: "2",
    writeOffDays: "",
    message1: "",
    message2: "",
  };
}

function formatCurrencyInput(value: string) {
  const digits = unMask(value);

  if (!digits) {
    return "";
  }

  const numericValue = Number(digits) / 100;
  return numericValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function capitalizeName(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)(\S)/g, (match) => match.toLocaleUpperCase("pt-BR"));
}

function getAccountLabel(account: BillingBankAccount) {
  const bankCode = normalizeBankCode(account.bankCode);
  const bankName = getBrazilianBankName(account.bankCode);
  const agencyDigit = account.agencyDigit ? `-${account.agencyDigit}` : "";
  const accountDigit = account.accountDigit ? `-${account.accountDigit}` : "";

  return `${bankName} (${bankCode}) | Conta ${account.accountNumber}${accountDigit} | Ag. ${account.agency}${agencyDigit}`;
}

function getAgreementLabel(
  agreement: BillingBankAccount["agreements"][number]
) {
  return getAgreementDraftLabel(agreement);
}

function getPayerLabel(payer: Payer) {
  const document = payer.document ? ` | ${formatDocument(payer.document)}` : "";
  return `${capitalizeName(payer.name)}${document}`;
}

const documentSpeciesOptions = [
  { value: "01", label: "Duplicata mercantil" },
  { value: "02", label: "Nota promissória" },
  { value: "03", label: "Nota de seguro" },
  { value: "04", label: "Mensalidade escolar" },
  { value: "05", label: "Recibo" },
  { value: "99", label: "Outros" },
];

const acceptOptions = [
  { value: "N", label: "Não aceito" },
  { value: "S", label: "Aceito" },
];

const interestOptions = [
  { value: "3", label: "Isento" },
  { value: "1", label: "Valor por dia" },
  { value: "2", label: "Taxa mensal" },
];

const fineOptions = [
  { value: "0", label: "Não registrar" },
  { value: "1", label: "Valor fixo" },
  { value: "2", label: "Percentual" },
];

const discountOptions = [
  { value: "0", label: "Sem desconto" },
  { value: "1", label: "Valor fixo até a data" },
  { value: "2", label: "Percentual até a data" },
  { value: "3", label: "Valor por antecipação em dias corridos" },
  { value: "4", label: "Valor por antecipação em dias úteis" },
  { value: "5", label: "Percentual por dia corrido" },
  { value: "6", label: "Percentual por dia útil" },
];

const protestOptions = [
  { value: "3", label: "Não protestar" },
  { value: "1", label: "Dias corridos" },
  { value: "2", label: "Dias úteis" },
  { value: "4", label: "Fim falimentar em dias úteis" },
  { value: "5", label: "Fim falimentar em dias corridos" },
  { value: "8", label: "Negativação sem protesto" },
  { value: "9", label: "Cancelar protesto automático" },
];

const writeOffOptions = [
  { value: "2", label: "Não baixar / não devolver" },
  { value: "1", label: "Baixar / devolver" },
  { value: "3", label: "Cancelar prazo" },
];

function getOptionLabel(
  options: Array<{ value: string; label: string }>,
  value: string
) {
  return options.find((option) => option.value === value)?.label ?? "";
}

function getInterestValueLabel(code: string) {
  if (code === "1") {
    return "Valor por dia";
  }

  if (code === "2") {
    return "Taxa mensal (%)";
  }

  return "Valor/taxa de juros";
}

function getFineValueLabel(code: string) {
  if (code === "1") {
    return "Valor da multa";
  }

  if (code === "2") {
    return "Percentual da multa (%)";
  }

  return "Valor/taxa de multa";
}

function getDiscountValueLabel(code: string) {
  if (["2", "5", "6"].includes(code)) {
    return "Percentual do desconto (%)";
  }

  return "Valor do desconto";
}

function usesProtestDays(code: string) {
  return !["3", "9"].includes(code);
}

function usesWriteOffDays(code: string) {
  return code === "1";
}

export function NewBillingManagement({
  assignorId,
  document,
  name,
}: NewBillingManagementProps) {
  const router = useRouter();
  const [activeAssignor] = useState(
    () => getStoredBillingAssignor() ?? { id: assignorId, document, name }
  );
  const [accounts, setAccounts] = useState<BillingBankAccount[]>([]);
  const [payerResults, setPayerResults] = useState<Payer[]>([]);
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null);
  const [isPayerDropdownOpen, setIsPayerDropdownOpen] = useState(false);
  const [hasSearchedPayers, setHasSearchedPayers] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isSearchingPayers, setIsSearchingPayers] = useState(false);
  const billingForm = useForm<NewBillingFormValues>({
    defaultValues: getEmptyBillingFormValues(),
  });
  const selectedAccountId = useWatch({
    control: billingForm.control,
    name: "accountId",
  });
  const selectedAgreementId = useWatch({
    control: billingForm.control,
    name: "agreementId",
  });
  const dueDate = useWatch({
    control: billingForm.control,
    name: "dueDate",
  });
  const payerSearch = useWatch({
    control: billingForm.control,
    name: "payerSearch",
  });
  const installmentEnabled = useWatch({
    control: billingForm.control,
    name: "installmentEnabled",
  });
  const interestCode = useWatch({
    control: billingForm.control,
    name: "interestCode",
  });
  const fineCode = useWatch({
    control: billingForm.control,
    name: "fineCode",
  });
  const discountCode = useWatch({
    control: billingForm.control,
    name: "discountCode",
  });
  const protestCode = useWatch({
    control: billingForm.control,
    name: "protestCode",
  });
  const writeOffCode = useWatch({
    control: billingForm.control,
    name: "writeOffCode",
  });

  const selectedAccount = useMemo(
    () =>
      accounts.find((account) => String(account.id) === selectedAccountId) ??
      null,
    [accounts, selectedAccountId]
  );
  const selectedAgreement = useMemo(
    () =>
      selectedAccount?.agreements.find(
        (agreement) => String(agreement.id) === selectedAgreementId
      ) ?? null,
    [selectedAccount, selectedAgreementId]
  );

  useEffect(() => {
    if (!activeAssignor.id || !activeAssignor.document) {
      return;
    }

    window.sessionStorage.setItem(
      billingActiveAssignorStorageKey,
      JSON.stringify(activeAssignor)
    );
  }, [activeAssignor]);

  const searchPayers = useCallback(
    async (
      search: string,
      shouldApplyResults: () => boolean = () => true
    ) => {
      setIsSearchingPayers(true);
      setHasSearchedPayers(false);
      setIsPayerDropdownOpen(true);

      try {
        const params = new URLSearchParams({
          search,
          page: "1",
          limit: "8",
          role: "payer",
        });
        const response = await fetch(`/api/payers?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | PayersResponse
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível buscar os pagadores."
          );
        }

        if (!("payers" in data)) {
          throw new Error("Não foi possível buscar os pagadores.");
        }

        if (!shouldApplyResults()) {
          return;
        }

        setPayerResults(data.payers);
        setHasSearchedPayers(true);
        setIsPayerDropdownOpen(true);
      } catch (error) {
        if (!shouldApplyResults()) {
          return;
        }

        setPayerResults([]);
        setHasSearchedPayers(true);
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível buscar os pagadores."
        );
      } finally {
        if (shouldApplyResults()) {
          setIsSearchingPayers(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    async function loadAccounts() {
      if (!activeAssignor.id || !activeAssignor.document) {
        setAccounts([]);
        setIsLoadingAccounts(false);
        return;
      }

      setIsLoadingAccounts(true);

      try {
        const params = new URLSearchParams({
          document: activeAssignor.document,
        });
        const response = await fetch(
          `/api/billing/assignors/${activeAssignor.id}/accounts?${params.toString()}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as
          | BillingBankAccountsResponse
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível carregar as contas."
          );
        }

        if (!("accounts" in data)) {
          throw new Error("Não foi possível carregar as contas.");
        }

        setAccounts(data.accounts);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as contas."
        );
      } finally {
        setIsLoadingAccounts(false);
      }
    }

    void loadAccounts();
  }, [activeAssignor.id, activeAssignor.document]);

  useEffect(() => {
    window.queueMicrotask(() => {
      const storedDraft = window.sessionStorage.getItem(BILLING_REVIEW_DRAFT_KEY);

      if (!storedDraft) {
        return;
      }

      try {
        const draft = JSON.parse(storedDraft) as BillingReviewDraft;

        billingForm.reset(draft.values);

        if (draft.payer) {
          setSelectedPayer({
            ...draft.payer,
            firestoreId: null,
            code: null,
            status: "active",
            roles: ["payer"],
            createdAt: "",
          });
        }
      } catch {
        window.sessionStorage.removeItem(BILLING_REVIEW_DRAFT_KEY);
      }
    });
  }, [billingForm]);

  useEffect(() => {
    const search = payerSearch.trim();

    if (selectedPayer && search === getPayerLabel(selectedPayer)) {
      return;
    }

    if (search.length < 3) {
      return;
    }

    let isCurrentSearch = true;
    const timeout = window.setTimeout(() => {
      void searchPayers(search, () => isCurrentSearch);
    }, 350);

    return () => {
      isCurrentSearch = false;
      window.clearTimeout(timeout);
    };
  }, [payerSearch, searchPayers, selectedPayer]);

  useEffect(() => {
    const instructionDate = addDays(dueDate, 1);

    billingForm.setValue("interestDate", instructionDate, {
      shouldDirty: true,
      shouldValidate: true,
    });
    billingForm.setValue("fineDate", instructionDate, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [billingForm, dueDate]);

  function handleAccountChange(value: string | null) {
    if (!value) {
      billingForm.setValue("accountId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      billingForm.setValue("agreementId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }

    const nextAccount =
      accounts.find((account) => String(account.id) === value) ?? null;

    billingForm.setValue("accountId", value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    billingForm.setValue("agreementId", "", {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (!nextAccount) {
      return;
    }

    const identifiers = generateAccountBillingIdentifiers(nextAccount);
    billingForm.setValue("documentNumber", identifiers.documentNumber, {
      shouldDirty: true,
      shouldValidate: true,
    });
    billingForm.setValue("ourNumber", identifiers.ourNumber, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (nextAccount.agreements.length === 1) {
      billingForm.setValue("agreementId", String(nextAccount.agreements[0].id), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }

  function handleSelectPayer(payer: Payer) {
    setSelectedPayer(payer);
    setPayerResults([]);
    setHasSearchedPayers(false);
    setIsPayerDropdownOpen(false);
    billingForm.setValue("payerId", payer.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    billingForm.setValue("payerSearch", getPayerLabel(payer), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleClearPayer() {
    setSelectedPayer(null);
    setPayerResults([]);
    setHasSearchedPayers(false);
    setIsPayerDropdownOpen(false);
    billingForm.setValue("payerId", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    billingForm.setValue("payerSearch", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handlePrepareBilling(values: NewBillingFormValues) {
    if (!values.payerId) {
      toast.error("Selecione um pagador.");
      return;
    }

    const draft: BillingReviewDraft = {
      assignor: {
        id: activeAssignor.id,
        document: activeAssignor.document,
        name: activeAssignor.name,
      },
      account: selectedAccount
        ? {
            id: String(selectedAccount.id),
            label: getAccountLabel(selectedAccount),
            bankCode: selectedAccount.bankCode,
            accountNumber: selectedAccount.accountNumber,
            accountDigit: selectedAccount.accountDigit,
          }
        : null,
      agreement: selectedAgreement
        ? {
            id: String(selectedAgreement.id),
            label: getAgreementLabel(selectedAgreement),
            number: selectedAgreement.number,
            wallet: selectedAgreement.wallet,
          }
        : null,
      payer: selectedPayer
        ? {
            id: selectedPayer.id,
            name: selectedPayer.name,
            document: selectedPayer.document,
            email: selectedPayer.email,
            phone: selectedPayer.phone,
            zipCode: selectedPayer.zipCode,
            street: selectedPayer.street,
            number: selectedPayer.number,
            complement: selectedPayer.complement,
            district: selectedPayer.district,
            city: selectedPayer.city,
            state: selectedPayer.state,
          }
        : null,
      values,
    };

    window.sessionStorage.setItem(
      BILLING_REVIEW_DRAFT_KEY,
      JSON.stringify(draft)
    );
    router.push("/cobranca/nova/resumo");
  }

  function handleCancelBilling() {
    window.sessionStorage.removeItem(BILLING_REVIEW_DRAFT_KEY);
    router.push("/cobranca");
  }

  return (
    <div className="space-y-6">
      <FormPageHeader
        backLabel="Voltar para cobranças"
        badge="Cobrança"
        onBack={handleCancelBilling}
        title="Nova cobrança"
      />

      <Form {...billingForm}>
        <form
          className="space-y-6 [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:bg-gradient-to-br [&>[data-slot=card]]:from-card [&>[data-slot=card]]:via-card [&>[data-slot=card]]:to-primary/[0.025] [&>[data-slot=card]]:shadow-[0_14px_36px_-26px_rgba(15,23,42,0.7)] [&>[data-slot=card]]:ring-1 [&>[data-slot=card]]:ring-border/70 [&>[data-slot=card]>[data-slot=card-header]]:border-b [&>[data-slot=card]>[data-slot=card-header]]:border-border/60 [&>[data-slot=card]>[data-slot=card-header]]:bg-gradient-to-r [&>[data-slot=card]>[data-slot=card-header]]:from-muted/45 [&>[data-slot=card]>[data-slot=card-header]]:via-card [&>[data-slot=card]>[data-slot=card-header]]:to-primary/[0.035] dark:[&>[data-slot=card]]:to-primary/[0.05] dark:[&>[data-slot=card]>[data-slot=card-header]]:to-primary/[0.06]"
          onSubmit={billingForm.handleSubmit(handlePrepareBilling)}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Dados bancários</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr_1.25fr]">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Building2 className="size-4 text-primary" />
                    Cedente
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">
                    {activeAssignor.name}
                  </p>
                </div>

                <FormField
                  control={billingForm.control}
                  name="accountId"
                  rules={{ required: "Selecione a conta." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Landmark className="size-4 text-primary" />
                        Conta
                      </FormLabel>
                      <Select
                        onValueChange={handleAccountChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 w-full">
                            <SelectValue
                              placeholder={
                                isLoadingAccounts
                                  ? "Carregando contas..."
                                  : "Selecione"
                              }
                            >
                              {selectedAccount
                                ? getAccountLabel(selectedAccount)
                                : null}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem
                              key={account.id}
                              value={String(account.id)}
                            >
                              {getAccountLabel(account)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="agreementId"
                  rules={{ required: "Selecione o convênio." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        Convênio
                      </FormLabel>
                      <Select
                        disabled={!selectedAccount}
                        onValueChange={(value) => {
                          if (!value) {
                            billingForm.setValue("agreementId", "", {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            return;
                          }

                          billingForm.setValue("agreementId", value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 w-full">
                            <SelectValue placeholder="Selecione">
                              {selectedAgreement
                                ? getAgreementLabel(selectedAgreement)
                                : null}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(selectedAccount?.agreements ?? []).map(
                            (agreement) => (
                              <SelectItem
                                key={agreement.id}
                                value={String(agreement.id)}
                              >
                                {getAgreementLabel(agreement)}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle>Pagador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField
                control={billingForm.control}
                name="payerSearch"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>Buscar pagador</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          autoComplete="off"
                          className="pr-11 pl-9"
                          onFocus={() => {
                            if (payerResults.length > 0 || hasSearchedPayers) {
                              setIsPayerDropdownOpen(true);
                            }
                          }}
                          placeholder="Digite o nome, CPF ou CNPJ"
                          {...field}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            field.onChange(event);
                            setSelectedPayer(null);
                            if (nextValue.trim().length < 3) {
                              setPayerResults([]);
                              setHasSearchedPayers(false);
                              setIsPayerDropdownOpen(false);
                            } else {
                              setIsPayerDropdownOpen(true);
                            }
                            billingForm.setValue("payerId", "", {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }}
                        />
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                          {isSearchingPayers ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          ) : null}
                          {selectedPayer ? (
                            <button
                              aria-label="Limpar pagador"
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={handleClearPayer}
                              type="button"
                            >
                              <X className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </FormControl>

                    {isPayerDropdownOpen ? (
                      <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                        {payerResults.length > 0 ? (
                          <div className="max-h-72 overflow-y-auto p-1">
                            {payerResults.map((payer) => (
                              <button
                                className="flex w-full flex-col gap-0.5 rounded-sm px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                key={payer.id}
                                onClick={() => handleSelectPayer(payer)}
                                type="button"
                              >
                                <span className="font-medium">
                                  {capitalizeName(payer.name)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDocument(payer.document)}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {isSearchingPayers ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Buscando pagadores...
                          </div>
                        ) : null}

                        {!isSearchingPayers &&
                        hasSearchedPayers &&
                        payerResults.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-muted-foreground">
                            Nenhum pagador encontrado.
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedPayer ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Pagador selecionado:
                  </span>
                  <Badge variant="secondary">{capitalizeName(selectedPayer.name)}</Badge>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados da cobrança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_0.8fr]">
                <FormField
                  control={billingForm.control}
                  name="amount"
                  rules={{ required: "Informe o valor." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          onBlur={field.onBlur}
                          onChange={(event) =>
                            field.onChange(
                              formatCurrencyInput(event.target.value)
                            )
                          }
                          placeholder="0,00"
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="issueDate"
                  rules={{ required: "Informe a data de emissão." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de emissão</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="dueDate"
                  rules={{ required: "Informe a data de pagamento." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de pagamento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="documentSpecies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Espécie</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione">
                              {getOptionLabel(
                                documentSpeciesOptions,
                                field.value
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentSpeciesOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="accept"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aceite</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {getOptionLabel(acceptOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {acceptOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1fr_2fr_0.9fr]">
                <FormField
                  control={billingForm.control}
                  name="documentNumber"
                  rules={{
                    required: "Informe o número do documento.",
                    maxLength: {
                      value: 10,
                      message: "Use no máximo 10 caracteres.",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do documento</FormLabel>
                      <FormControl>
                        <Input
                          maxLength={10}
                          placeholder="Ex: 26001042"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="ourNumber"
                  rules={{
                    required: "Informe o nosso número.",
                    minLength: {
                      value: 1,
                      message: "Informe pelo menos 1 dígito.",
                    },
                    maxLength: {
                      value: 6,
                      message: "Use no máximo 6 dígitos.",
                    },
                    validate: (value) =>
                      isValidBillingOurNumber(value) ||
                      "O primeiro dígito deve estar entre 2 e 9.",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nosso número</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Ex: 102042"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="paymentPlace"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local de pagamento</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="isHybrid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="opacity-0">Híbrido</FormLabel>
                      <div className="flex h-8 w-full items-center gap-2 rounded-lg border border-input px-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true)
                            }
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer text-sm font-normal">
                          Híbrido
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parcelamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={billingForm.control}
                name="installmentEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <FormLabel>Gerar cobrança parcelada</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {installmentEnabled ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={billingForm.control}
                    name="installmentCount"
                    rules={{
                      required: "Informe a quantidade de parcelas.",
                      min: {
                        value: 2,
                        message: "Use pelo menos 2 parcelas.",
                      },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade de parcelas</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="3" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={billingForm.control}
                    name="installmentInterval"
                    rules={{ required: "Informe o intervalo." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intervalo em dias</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="30" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instruções do boleto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 border-b pb-5 lg:grid-cols-[220px_1fr]">
                <div>
                  <h3 className="text-sm font-medium">Juros</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mora cobrada após a data inicial informada.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={billingForm.control}
                  name="interestCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Juros</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {getOptionLabel(interestOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {interestOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {interestCode !== "3" ? (
                  <>
                    <FormField
                      control={billingForm.control}
                      name="interestDate"
                      rules={{ required: "Informe a data dos juros." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Início da cobrança</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={billingForm.control}
                      name="interestValue"
                      rules={{ required: "Informe o valor/taxa." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {getInterestValueLabel(interestCode)}
                          </FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              onBlur={field.onBlur}
                              onChange={(event) =>
                                field.onChange(
                                  formatCurrencyInput(event.target.value)
                                )
                              }
                              placeholder="0,00"
                              value={field.value}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <div className="md:col-span-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Sem juros para esta cobrança.
                  </div>
                )}
                </div>
              </div>

              <div className="grid gap-4 border-b pb-5 lg:grid-cols-[220px_1fr]">
                <div>
                  <h3 className="text-sm font-medium">Multa</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Multa aplicada a partir da data definida.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={billingForm.control}
                  name="fineCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Multa</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {getOptionLabel(fineOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fineOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {fineCode !== "0" ? (
                  <>
                    <FormField
                      control={billingForm.control}
                      name="fineDate"
                      rules={{ required: "Informe a data da multa." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Início da multa</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={billingForm.control}
                      name="fineValue"
                      rules={{ required: "Informe o valor/taxa." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{getFineValueLabel(fineCode)}</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              onBlur={field.onBlur}
                              onChange={(event) =>
                                field.onChange(
                                  formatCurrencyInput(event.target.value)
                                )
                              }
                              placeholder="0,00"
                              value={field.value}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <div className="md:col-span-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Sem multa para esta cobrança.
                  </div>
                )}
                </div>
              </div>

              <div className="grid gap-4 border-b pb-5 lg:grid-cols-[220px_1fr]">
                <div>
                  <h3 className="text-sm font-medium">Desconto</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Desconto aplicado até a data limite ou por antecipação.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={billingForm.control}
                  name="discountCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {getOptionLabel(discountOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {discountOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {discountCode !== "0" ? (
                  <>
                    <FormField
                      control={billingForm.control}
                      name="discountDate"
                      rules={{ required: "Informe a data do desconto." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data limite</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={billingForm.control}
                      name="discountValue"
                      rules={{ required: "Informe o valor/taxa do desconto." }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {getDiscountValueLabel(discountCode)}
                          </FormLabel>
                          <FormControl>
                            <Input
                              inputMode="numeric"
                              onBlur={field.onBlur}
                              onChange={(event) =>
                                field.onChange(
                                  formatCurrencyInput(event.target.value)
                                )
                              }
                              placeholder="0,00"
                              value={field.value}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <div className="md:col-span-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Sem desconto para esta cobrança.
                  </div>
                )}
                </div>
              </div>

              <div className="grid gap-4 border-b pb-5 lg:grid-cols-[220px_1fr]">
                <div>
                  <h3 className="text-sm font-medium">Protesto</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Instrução enviada ao banco após o vencimento.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={billingForm.control}
                  name="protestCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protesto</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {getOptionLabel(protestOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {protestOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="protestDays"
                  rules={{
                    required:
                      usesProtestDays(protestCode)
                        ? "Informe o prazo de protesto."
                        : false,
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo de protesto</FormLabel>
                      <FormControl>
                        <Input
                          disabled={!usesProtestDays(protestCode)}
                          inputMode="numeric"
                          placeholder="30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <div>
                  <h3 className="text-sm font-medium">Baixa/devolução</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prazo automático para baixar ou devolver o título.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={billingForm.control}
                  name="writeOffCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Baixa/devolução</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {getOptionLabel(writeOffOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {writeOffOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={billingForm.control}
                  name="writeOffDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo de baixa</FormLabel>
                      <FormControl>
                        <Input
                          disabled={!usesWriteOffDays(writeOffCode)}
                          inputMode="numeric"
                          placeholder="30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagens</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={billingForm.control}
                name="message1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem 1</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Pagável em qualquer banco até o vencimento"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={billingForm.control}
                name="message2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Instruções adicionais" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <Button
              onClick={handleCancelBilling}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={billingForm.formState.isSubmitting} type="submit">
              {billingForm.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Preparar cobrança
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
