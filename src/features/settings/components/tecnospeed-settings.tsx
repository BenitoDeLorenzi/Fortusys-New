"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  DatabaseZap,
  ExternalLink,
  KeyRound,
  Loader2,
  PlugZap,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { DatabaseStatus } from "@/features/database/status";
import type {
  TecnospeedConfigStatus,
  TecnospeedEnvironment,
} from "@/features/integrations/tecnospeed/types";
import { cn } from "@/lib/utils";

type TecnospeedSettingsFormValues = {
  environment: TecnospeedEnvironment;
  softwareHouseDocument: string;
  softwareHouseToken: string;
};

const environments = [
  {
    value: "homologation",
    label: "Homologação",
    description: "Ambiente seguro para testes e validações.",
    apiUrl: "https://homologacao.plugboleto.com.br/api/v1",
  },
  {
    value: "production",
    label: "Produção",
    description: "Ambiente real usado para emissão dos boletos.",
    apiUrl: "https://plugboleto.com.br/api/v1",
  },
] satisfies Array<{
  value: TecnospeedEnvironment;
  label: string;
  description: string;
  apiUrl: string;
}>;

function StatusBadge({ ready }: { ready: boolean }) {
  return ready ? (
    <Badge className="rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-600">
      Configurada
    </Badge>
  ) : (
    <Badge className="rounded-full px-3" variant="secondary">
      Pendente
    </Badge>
  );
}

function ReadinessIcon({ ready }: { ready: boolean }) {
  return ready ? (
    <CheckCircle2 className="size-4 text-emerald-600" />
  ) : (
    <ShieldCheck className="size-4 text-muted-foreground" />
  );
}

export function TecnospeedSettings() {
  const [status, setStatus] = useState<TecnospeedConfigStatus | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<TecnospeedSettingsFormValues>({
    defaultValues: {
      environment: "homologation",
      softwareHouseDocument: "",
      softwareHouseToken: "",
    },
  });

  const activeEnvironment = useMemo(
    () =>
      environments.find((environment) => environment.value === status?.environment) ??
      environments[0],
    [status?.environment]
  );

  useEffect(() => {
    async function loadStatus() {
      const [tecnospeedResponse, databaseResponse] = await Promise.all([
        fetch("/api/integrations/tecnospeed/status"),
        fetch("/api/database/status"),
      ]);
      const data =
        (await tecnospeedResponse.json()) as TecnospeedConfigStatus;
      const databaseData = (await databaseResponse.json()) as DatabaseStatus;

      setStatus(data);
      setDatabaseStatus(databaseData);
      form.reset({
        environment: data.environment,
        softwareHouseDocument: data.softwareHouseDocument ?? "",
        softwareHouseToken: data.hasSoftwareHouseToken ? "********" : "",
      });
      setIsLoading(false);
    }

    loadStatus().catch(() => {
      setIsLoading(false);
      toast.error("Não foi possível carregar as configurações.");
    });
  }, [form]);

  async function handleSubmit(values: TecnospeedSettingsFormValues) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/integrations/tecnospeed/status", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as
        | TecnospeedConfigStatus
        | { message?: string };

      if (!response.ok || !("environment" in data)) {
        throw new Error(
          "message" in data
            ? data.message
            : "Não foi possível salvar a configuração."
        );
      }

      setStatus(data);
      form.reset({
        environment: data.environment,
        softwareHouseDocument: data.softwareHouseDocument ?? "",
        softwareHouseToken: data.hasSoftwareHouseToken ? "********" : "",
      });
      toast.success("Configuração salva", {
        description:
          data.environment === "homologation"
            ? "As próximas chamadas usarão o ambiente de homologação."
            : "As próximas chamadas usarão o ambiente de produção.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a configuração."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleConnectionTest() {
    if (!status?.isReady) {
      toast.warning("Credenciais pendentes", {
        description: "Configure CNPJ/CPF e token da Software House.",
      });
      return;
    }

    toast.success("Integração pronta", {
      description: "As credenciais da Software House estão presentes.",
    });
  }

  async function copyToClipboard(value: string | null | undefined, label: string) {
    if (!value) {
      toast.warning(`${label} não informado.`);
      return;
    }

    if (value === "********") {
      toast.warning(`${label} não está disponível para cópia.`);
      return;
    }

    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado.`);
  }

  const statusCards = [
    {
      title: "Integração",
      value: status?.isReady ? "Pronta" : "Pendente",
      description: status?.isReady
        ? "Credenciais disponíveis para emissão."
        : "Complete as credenciais para emitir boletos.",
      icon: PlugZap,
      ready: Boolean(status?.isReady),
    },
    {
      title: "Ambiente",
      value: activeEnvironment.label,
      description: activeEnvironment.description,
      icon: ServerCog,
      ready: Boolean(status),
    },
    {
      title: "Sistema",
      value: databaseStatus?.schemaApplied ? "Operacional" : "Atenção",
      description: databaseStatus?.schemaApplied
        ? "Base principal respondendo normalmente."
        : "Há pendências técnicas no ambiente.",
      icon: DatabaseZap,
      ready: Boolean(databaseStatus?.schemaApplied),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/40 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Badge className="mb-3 rounded-full bg-primary/10 px-3 text-primary hover:bg-primary/10">
              Configurações
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Central de integrações
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Configure os serviços externos usados pelo sistema sem sair do
              padrão operacional do Fortusys.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge ready={Boolean(status?.isReady)} />
            {isLoading ? (
              <Badge className="rounded-full px-3" variant="secondary">
                <Loader2 className="size-3.5 animate-spin" />
                Carregando
              </Badge>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {statusCards.map((item) => (
          <Card
            className="border-border/70 bg-card/90 shadow-sm"
            key={item.title}
            size="sm"
          >
            <CardContent className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                  item.ready
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/10 text-amber-600"
                )}
              >
                <item.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {item.title}
                </p>
                <p className="truncate text-lg font-semibold">{item.value}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="border-b">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <PlugZap className="size-5" />
                </span>
                TecnoSpeed PlugBoleto
              </CardTitle>
              <CardDescription>
                Defina o ambiente e as credenciais usadas para geração e gestão
                dos boletos.
              </CardDescription>
            </div>
            <CardAction>
              <StatusBadge ready={Boolean(status?.isReady)} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit(handleSubmit)}
              >
                <FormField
                  control={form.control}
                  name="environment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ambiente</FormLabel>
                      <FormControl>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {environments.map((environment) => (
                            <button
                              className={cn(
                                "rounded-2xl border border-border/70 bg-background/70 p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-muted/55",
                                field.value === environment.value &&
                                  "border-primary/50 bg-primary/10 text-primary ring-2 ring-primary/10"
                              )}
                              key={environment.value}
                              onClick={() => field.onChange(environment.value)}
                              type="button"
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className="font-semibold">
                                  {environment.label}
                                </span>
                                {field.value === environment.value ? (
                                  <CheckCircle2 className="size-4" />
                                ) : null}
                              </span>
                              <span className="mt-1 block text-sm text-muted-foreground">
                                {environment.description}
                              </span>
                              <span className="mt-3 block break-all rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                                {environment.apiUrl}
                              </span>
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="softwareHouseDocument"
                    rules={{
                      required: "Informe o CNPJ/CPF da Software House.",
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ/CPF Software House</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input
                              autoComplete="off"
                              className="h-10 rounded-xl"
                              placeholder="00.000.000/0000-00"
                              {...field}
                            />
                            <Button
                              className="h-10 shrink-0 rounded-xl"
                              onClick={() =>
                                void copyToClipboard(
                                  status?.softwareHouseDocument ?? field.value,
                                  "CNPJ/CPF Software House"
                                )
                              }
                              size="icon"
                              title="Copiar CNPJ/CPF"
                              type="button"
                              variant="outline"
                            >
                              <Copy className="size-4" />
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="softwareHouseToken"
                    rules={{
                      required: "Informe o token da Software House.",
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Software House</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="relative min-w-0 flex-1">
                              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                autoComplete="off"
                                className="h-10 rounded-xl pl-9"
                                placeholder="Token de integração"
                                type="password"
                                {...field}
                              />
                            </div>
                            <Button
                              className="h-10 shrink-0 rounded-xl"
                              onClick={() =>
                                void copyToClipboard(
                                  status?.softwareHouseToken ?? field.value,
                                  "Token Software House"
                                )
                              }
                              size="icon"
                              title="Copiar token"
                              type="button"
                              variant="outline"
                            >
                              <Copy className="size-4" />
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          O token fica protegido no backend e não é exibido em
                          texto aberto.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Salvar configuração
                  </Button>
                  <Button
                    onClick={handleConnectionTest}
                    type="button"
                    variant="outline"
                  >
                    Testar conexão
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>Status atual</CardTitle>
              <CardDescription>
                Resumo rápido do que está pronto para operar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Ambiente ativo",
                  value: activeEnvironment.label,
                  ready: Boolean(status),
                },
                {
                  label: "Documento da Software House",
                  value:
                    status?.softwareHouseDocumentPreview ?? "Não definido",
                  ready: Boolean(status?.hasSoftwareHouseDocument),
                },
                {
                  label: "Token da Software House",
                  value: status?.hasSoftwareHouseToken
                    ? "Configurado"
                    : "Não definido",
                  ready: Boolean(status?.hasSoftwareHouseToken),
                },
                {
                  label: "Base do sistema",
                  value: databaseStatus?.schemaApplied
                    ? "Operacional"
                    : "Pendente",
                  ready: Boolean(databaseStatus?.schemaApplied),
                },
              ].map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/65 p-3"
                  key={item.label}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {item.value}
                    </p>
                  </div>
                  <ReadinessIcon ready={item.ready} />
                </div>
              ))}

              {databaseStatus?.error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {databaseStatus.error}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Portal PlugBoleto
              </CardTitle>
              <CardDescription>
                Acesse o painel externo da TecnoSpeed quando precisar conferir
                eventos, webhooks ou boletos diretamente por lá.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                className={buttonVariants({
                  className: "w-full rounded-xl",
                  variant: "outline",
                })}
                href={status?.guiUrl ?? "http://homologacao.plugboleto.com.br"}
                rel="noreferrer"
                target="_blank"
              >
                Abrir portal PlugBoleto
                <ExternalLink className="size-4" />
              </a>
              {!status?.isReady ? (
                <div className="flex gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Complete as credenciais antes de emitir boletos em qualquer
                    módulo do sistema.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
