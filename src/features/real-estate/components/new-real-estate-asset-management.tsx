"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { mask, unMask } from "remask";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormPageHeader } from "@/components/management/form-page-header";
import { ManagementFormSkeleton } from "@/components/management/management-layout";
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
import type {
  BillingAssignor,
  BillingAssignorsResponse,
} from "@/features/billing/types";
import type { RealEstateAsset } from "@/features/real-estate/types";
import { BRAZIL_STATES } from "@/lib/brazil-states";

type AssetFormValues = {
  motive: string;
  status: string;
  type: string;
  landlordId: string;
  rentAmount: string;
  title: string;
  notes: string;
  zipCode: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number: string;
  area: string;
  bedrooms: string;
  bathrooms: string;
  garage: string;
  energyContract: string;
  energyMeter: string;
  waterContract: string;
  waterMeter: string;
  registrationNumber: string;
  municipalRegistration: string;
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

const defaultValues: AssetFormValues = {
  motive: "aluguel",
  status: "available",
  type: "apartment",
  landlordId: "",
  rentAmount: "",
  title: "",
  notes: "",
  zipCode: "",
  state: "",
  city: "",
  district: "",
  street: "",
  number: "",
  area: "",
  bedrooms: "",
  bathrooms: "",
  garage: "",
  energyContract: "",
  energyMeter: "",
  waterContract: "",
  waterMeter: "",
  registrationNumber: "",
  municipalRegistration: "",
};

const returnTabs = ["resumo", "imoveis", "agenda", "cobrancas"] as const;

function getReturnTab(value?: string | null) {
  return returnTabs.includes(value as (typeof returnTabs)[number])
    ? value
    : "imoveis";
}

const motiveOptions = [
  { value: "aluguel", label: "Aluguel" },
  { value: "venda", label: "Venda" },
];

const statusOptions = [
  { value: "available", label: "Disponível" },
  { value: "rented", label: "Alugado" },
  { value: "renovation", label: "Em reforma" },
  { value: "sold", label: "Vendido" },
  { value: "inactive", label: "Inativo" },
];

const typeOptions = [
  { value: "house", label: "Casa" },
  { value: "apartment", label: "Apartamento" },
  { value: "office", label: "Escritório" },
  { value: "room", label: "Sala" },
  { value: "condominium", label: "Condomínio" },
  { value: "warehouse", label: "Galpão" },
  { value: "commercial", label: "Comercial" },
  { value: "land", label: "Terreno" },
  { value: "residential", label: "Residencial" },
  { value: "seasonal", label: "Temporada" },
  { value: "other", label: "Outro" },
];

const countOptions = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "mais_de_4", label: "Mais de 4" },
];

const selectTriggerClassName =
  "h-10 w-full bg-background text-foreground shadow-xs [&_[data-slot=select-value]]:font-medium";

function getOptionLabel(options: { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? "";
}

function zipCodeMask(value: string) {
  return mask(unMask(value), "99999-999");
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

function normalizeOptionValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function normalizeMotive(value?: string | null) {
  const normalized = normalizeOptionValue(value);
  const values: Record<string, string> = {
    aluguel: "aluguel",
    locacao: "aluguel",
    venda: "venda",
  };

  return values[normalized] ?? defaultValues.motive;
}

function normalizeStatus(value?: string | null) {
  const normalized = normalizeOptionValue(value);
  const values: Record<string, string> = {
    available: "available",
    disponivel: "available",
    rented: "rented",
    alugado: "rented",
    renovation: "renovation",
    emreforma: "renovation",
    sold: "sold",
    vendido: "sold",
    inactive: "inactive",
    inativo: "inactive",
  };

  return values[normalized] ?? defaultValues.status;
}

function normalizeType(value?: string | null) {
  const normalized = normalizeOptionValue(value);
  const option = typeOptions.find(
    (item) => normalizeOptionValue(item.value) === normalized
  );

  return option?.value ?? defaultValues.type;
}

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function getAssetFormValues(
  asset: RealEstateAsset,
  landlordId: string
): AssetFormValues {
  return {
    motive: normalizeMotive(asset.motive),
    status: normalizeStatus(asset.status),
    type: normalizeType(asset.type),
    landlordId,
    rentAmount: normalizeStoredCurrency(asset.rentAmount),
    title: asset.title,
    notes: asset.notes ?? "",
    zipCode: zipCodeMask(asset.zipCode ?? ""),
    state: asset.state ?? "",
    city: asset.city ?? "",
    district: asset.district ?? "",
    street: asset.street ?? "",
    number: asset.number ?? "",
    area: asset.area ?? "",
    bedrooms: asset.bedrooms ?? "",
    bathrooms: asset.bathrooms ?? "",
    garage: asset.garage ?? "",
    energyContract: asset.energyContract ?? "",
    energyMeter: asset.energyMeter ?? "",
    waterContract: asset.waterContract ?? "",
    waterMeter: asset.waterMeter ?? "",
    registrationNumber: asset.registrationNumber ?? "",
    municipalRegistration: asset.municipalRegistration ?? "",
  };
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-0 bg-gradient-to-br from-card via-card to-primary/[0.025] shadow-[0_14px_36px_-26px_rgba(15,23,42,0.7)] ring-1 ring-border/70 dark:to-primary/[0.05]">
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-muted/45 via-card to-primary/[0.035] pb-3 dark:to-primary/[0.06]">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function NewRealEstateAssetManagement({
  assetId,
}: {
  assetId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTab = getReturnTab(searchParams.get("returnTab"));
  const returnHref = `/imobiliaria?tab=${returnTab}`;
  const [landlords, setLandlords] = useState<BillingAssignor[]>([]);
  const [isLoadingLandlords, setIsLoadingLandlords] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAsset, setIsLoadingAsset] = useState(Boolean(assetId));
  const [isSearchingZipCode, setIsSearchingZipCode] = useState(false);
  const form = useForm<AssetFormValues>({ defaultValues });

  useEffect(() => {
    let isCurrent = true;

    async function loadFormData() {
      let loadedLandlords: BillingAssignor[] = [];

      try {
        const response = await fetch("/api/billing/assignors", {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | BillingAssignorsResponse
          | { message?: string };

        if (!response.ok || !("assignors" in data)) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível carregar proprietários."
          );
        }

        loadedLandlords = data.assignors;
        if (isCurrent) {
          setLandlords(data.assignors);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar proprietários."
        );
      } finally {
        if (isCurrent) {
          setIsLoadingLandlords(false);
        }
      }

      if (!assetId) {
        return;
      }

      try {
        const response = await fetch(
          `/api/real-estate/assets?id=${encodeURIComponent(assetId)}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as
          | RealEstateAsset
          | { message?: string };

        if (!response.ok || !("id" in data)) {
          throw new Error(
            "message" in data
              ? data.message
              : "Não foi possível carregar o imóvel."
          );
        }

        if (isCurrent) {
          const landlord =
            loadedLandlords.find(
              (item) =>
                String(item.id) === String(data.landlordFirestoreId ?? "")
            ) ??
            loadedLandlords.find(
              (item) =>
                onlyDigits(item.document) === onlyDigits(data.landlordDocument)
            );

          form.reset(
            getAssetFormValues(data, landlord ? String(landlord.id) : "")
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o imóvel."
        );
      } finally {
        if (isCurrent) {
          setIsLoadingAsset(false);
        }
      }
    }

    void loadFormData();

    return () => {
      isCurrent = false;
    };
  }, [assetId, form]);

  async function handleZipCodeLookup(value: string) {
    const zipCode = unMask(value);

    if (zipCode.length !== 8) {
      return;
    }

    setIsSearchingZipCode(true);

    try {
      const response = await fetch(`/api/address/cep?cep=${zipCode}`);
      const data = (await response.json()) as CepResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível consultar o CEP.");
      }

      form.setValue("zipCode", zipCodeMask(data.zipCode), {
        shouldValidate: true,
      });
      form.setValue("street", data.street, { shouldValidate: true });
      form.setValue("district", data.district, { shouldValidate: true });
      form.setValue("city", data.city, { shouldValidate: true });
      form.setValue("state", data.state, { shouldValidate: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível consultar o CEP."
      );
    } finally {
      setIsSearchingZipCode(false);
    }
  }

  async function handleSave(values: AssetFormValues) {
    const landlord = landlords.find(
      (item) => String(item.id) === values.landlordId
    );

    if (!landlord) {
      toast.warning("Selecione o proprietário.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/real-estate/assets", {
        method: assetId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          id: assetId,
          zipCode: unMask(values.zipCode),
          landlordId: String(landlord.id),
          landlordDocument: landlord.document,
          landlordName: landlord.corporateName,
          landlordTradeName: landlord.tradeName,
          landlordEmail: landlord.email,
          landlordPhone: landlord.phone,
          landlordZipCode: landlord.zipCode,
          landlordStreet: landlord.street,
          landlordNumber: landlord.number,
          landlordComplement: landlord.complement,
          landlordDistrict: landlord.district,
          landlordCity: landlord.city,
          landlordState: landlord.state,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível salvar o imóvel.");
      }

      toast.success(assetId ? "Imóvel atualizado" : "Imóvel cadastrado");
      router.push(returnHref);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar o imóvel."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <FormPageHeader
        backLabel="Voltar para imóveis"
        badge="Imobiliária"
        onBack={() => router.push(returnHref)}
        title={assetId ? "Editar imóvel" : "Novo imóvel"}
        actions={
          <Button
            disabled={isSaving || isLoadingAsset}
            onClick={form.handleSubmit(handleSave)}
            type="button"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {assetId ? "Salvar alterações" : "Salvar imóvel"}
          </Button>
        }
      />

      {isLoadingAsset ? (
        <ManagementFormSkeleton sections={3} fieldsPerSection={8} />
      ) : (
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSave)}>
          <FormSection title="Dados gerais">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <FormField
                control={form.control}
                name="motive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={selectTriggerClassName}>
                          <SelectValue placeholder="Selecione">
                            {getOptionLabel(motiveOptions, field.value)}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {motiveOptions.map((option) => (
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
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Situação</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={selectTriggerClassName}>
                          <SelectValue placeholder="Selecione">
                            {getOptionLabel(statusOptions, field.value)}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((option) => (
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
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={selectTriggerClassName}>
                          <SelectValue placeholder="Selecione">
                            {getOptionLabel(typeOptions, field.value)}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {typeOptions.map((option) => (
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
                control={form.control}
                name="landlordId"
                rules={{ required: "Selecione o proprietário." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proprietário</FormLabel>
                    <Select
                      disabled={isLoadingLandlords}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className={selectTriggerClassName}>
                          <SelectValue placeholder="Selecione">
                            {landlords.find(
                              (landlord) => String(landlord.id) === field.value
                            )?.corporateName ?? ""}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {landlords.map((landlord) => (
                          <SelectItem
                            key={landlord.id}
                            value={String(landlord.id)}
                          >
                            {landlord.corporateName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        onChange={(event) =>
                          field.onChange(currencyMask(event.target.value))
                        }
                        placeholder="R$ 0,00"
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection title="Dados do imóvel">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                rules={{ required: "Informe o nome do imóvel." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do imóvel</FormLabel>
                    <FormControl>
                      <Input placeholder="Sala comercial, apartamento..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <textarea
                        className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        placeholder="Informações internas sobre o imóvel"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection title="Endereço">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormField
                control={form.control}
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
                            const nextValue = zipCodeMask(event.target.value);
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
              <FormField
                control={form.control}
                name="state"
                rules={{ required: "Informe a UF." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={selectTriggerClassName}>
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
                control={form.control}
                name="city"
                rules={{ required: "Informe a cidade." }}
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
                control={form.control}
                name="district"
                rules={{ required: "Informe o bairro." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Bairro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="street"
                rules={{ required: "Informe o endereço." }}
                render={({ field }) => (
                  <FormItem className="xl:col-span-3">
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, avenida" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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
          </FormSection>

          <FormSection title="Características">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metragem</FormLabel>
                    <FormControl>
                      <Input placeholder="34,90" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(["bedrooms", "bathrooms", "garage"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {name === "bedrooms"
                          ? "Quartos"
                          : name === "bathrooms"
                            ? "Banheiros"
                            : "Garagem"}
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className={selectTriggerClassName}>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countOptions.map((option) => (
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
              ))}
            </div>
          </FormSection>

          <div className="grid gap-4 xl:grid-cols-2">
            <FormSection title="Energia">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="energyContract"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contrato de energia</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="energyMeter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contador de energia</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>
            <FormSection title="Água">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="waterContract"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contrato de água</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="waterMeter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contador de água</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>
          </div>

          <FormSection title="Matrículas">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="registrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula do imóvel</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="municipalRegistration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insc. imobiliária</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

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
              {assetId ? "Salvar alterações" : "Salvar imóvel"}
            </Button>
          </div>
        </form>
      </Form>
      )}
    </div>
  );
}
