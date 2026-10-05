"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { mask, unMask } from "remask";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { ClientRole, Payer } from "@/features/payers/types";
import { BRAZIL_STATES } from "@/lib/brazil-states";

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
};

type PayerSheetProps = {
  defaultRoles?: ClientRole[];
  onOpenChange: (open: boolean) => void;
  onSaved?: (payer: Payer) => void;
  open: boolean;
  title?: string;
};

export const roleLabels: Record<ClientRole, string> = {
  payer: "Pagador",
  tenant: "Inquilino",
  buyer: "Comprador",
  guarantor: "Fiador",
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

function getEmptyPayerFormValues(roles: ClientRole[] = ["payer"]): PayerFormValues {
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
    roles,
  };
}

function getPayerPayload(values: PayerFormValues) {
  return {
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

export function PayerSheet({
  defaultRoles = ["payer"],
  onOpenChange,
  onSaved,
  open,
  title = "Novo cliente",
}: PayerSheetProps) {
  const [isSearchingZipCode, setIsSearchingZipCode] = useState(false);
  const payerForm = useForm<PayerFormValues>({
    defaultValues: getEmptyPayerFormValues(defaultRoles),
  });
  const defaultRolesKey = defaultRoles.join("|");

  useEffect(() => {
    if (open) {
      payerForm.reset(getEmptyPayerFormValues(defaultRoles));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRolesKey, open, payerForm]);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      payerForm.reset(getEmptyPayerFormValues(defaultRoles));
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
    const response = await fetch("/api/payers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(getPayerPayload(values)),
    });

    const data = (await response.json()) as Payer | { message?: string };

    if (!response.ok || !("id" in data)) {
      toast.error(
        "message" in data ? data.message : "Não foi possível salvar cliente."
      );
      return;
    }

    toast.success("Cliente cadastrado");
    payerForm.reset(getEmptyPayerFormValues(defaultRoles));
    onSaved?.(data);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(38rem,calc(100vw-1rem))] overflow-y-auto p-0"
      >
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
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
                      <Input placeholder="Nome completo ou razão social" {...field} />
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

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={payerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input placeholder="cliente@email.com" type="email" {...field} />
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
              </div>

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
                        <Input placeholder="Sala, bloco, referência" {...field} />
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
                      <Select value={field.value} onValueChange={field.onChange}>
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
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(Object.keys(roleLabels) as ClientRole[]).map((role) => (
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
                                  : field.value.filter((item) => item !== role)
                              )
                            }
                          />
                          {roleLabels[role]}
                        </label>
                      ))}
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
                Cadastrar cliente
              </Button>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
