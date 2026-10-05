"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getEmptyWebhook,
  type BillingWebhook,
  type WebhookEvents,
} from "@/features/billing/server/webhooks";

type AssignorWebhookManagementProps = {
  assignorId: string;
  document: string;
  name: string;
};

type WebhookResponse = {
  webhook: BillingWebhook;
};

const webhookEvents: Array<{
  key: keyof WebhookEvents;
  label: string;
}> = [
  { key: "registrou", label: "Notificar ao Registrar" },
  { key: "liquidou", label: "Notificar ao Liquidar" },
  { key: "baixou", label: "Notificar ao Baixar" },
  { key: "rejeitou", label: "Notificar ao Rejeitar" },
  { key: "falhou", label: "Notificar ao Falhar" },
  { key: "protestou", label: "Notificar ao Protestar" },
  { key: "alterou", label: "Notificar ao Alterar informação" },
  { key: "criou_assinatura", label: "Notificar ao Criar Assinatura" },
  { key: "cancelou_assinatura", label: "Notificar ao Cancelar assinatura" },
];

export function AssignorWebhookManagement({
  assignorId,
  document,
  name,
}: AssignorWebhookManagementProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [hasWebhookConfig, setHasWebhookConfig] = useState(false);
  const webhookForm = useForm<BillingWebhook>({
    defaultValues: getEmptyWebhook(),
  });
  const webhookActive = useWatch({
    control: webhookForm.control,
    name: "active",
  });
  const headerActive = useWatch({
    control: webhookForm.control,
    name: "headerActive",
  });

  async function loadWebhook() {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/billing/assignors/${assignorId}/webhook?document=${document}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as WebhookResponse | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data ? data.message : "Não foi possível carregar WebHook."
        );
      }

      if (!("webhook" in data)) {
        throw new Error("Não foi possível carregar WebHook.");
      }

      webhookForm.reset(data.webhook);
      setHasWebhookConfig(Boolean(data.webhook.url));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar WebHook."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWebhook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignorId, document]);

  async function handleSaveWebhook(values: BillingWebhook) {
    const response = await fetch(
      `/api/billing/assignors/${assignorId}/webhook?document=${document}`,
      {
        method: hasWebhookConfig ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      }
    );

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível salvar WebHook.");
      return;
    }

    setHasWebhookConfig(Boolean(values.url));
    toast.success("WebHook salvo");
  }

  async function handleTestWebhook() {
    setIsTesting(true);

    try {
      const response = await fetch(
        `/api/billing/assignors/${assignorId}/webhook/test?document=${document}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(webhookForm.getValues()),
        }
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível testar o WebHook.");
      }

      toast.success("WebHook testado com sucesso");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível testar o WebHook."
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-3">
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
            WebHook
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{name}</p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Configuração do WebHook</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Carregando WebHook...
            </div>
          ) : (
            <Form {...webhookForm}>
              <form
                className="space-y-5"
                onSubmit={webhookForm.handleSubmit(handleSaveWebhook)}
              >
                <FormField
                  control={webhookForm.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <FormLabel>Ativar WebHook</FormLabel>
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
                  control={webhookForm.control}
                  name="url"
                  rules={{
                    required: webhookActive
                      ? "Informe a URL do WebHook."
                      : false,
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://seu-dominio.com/api/webhooks/tecnospeed/boletos"
                          type="url"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={webhookForm.control}
                  name="activationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de ativação</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={webhookForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="email@dominio.com"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={webhookForm.control}
                  name="headerActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <FormLabel>Header</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={webhookForm.control}
                    name="headerKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Campo</FormLabel>
                        <FormControl>
                          <Input
                            disabled={!headerActive}
                            placeholder="x-fortusys-webhook-token"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={webhookForm.control}
                    name="headerValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor do header</FormLabel>
                        <FormControl>
                          <Input
                            disabled={!headerActive}
                            placeholder="Token configurado no .env"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={webhookForm.control}
                  name="additionalHeaders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headers adicionais</FormLabel>
                      <FormControl>
                        <textarea
                          className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          placeholder={'{\n  "x-outro-header": "valor"\n}'}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 rounded-lg border p-3">
                  <p className="font-medium">Eventos</p>
                  {webhookEvents.map((event) => (
                    <FormField
                      control={webhookForm.control}
                      key={event.key}
                      name={`events.${event.key}`}
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-3">
                          <FormLabel>{event.label}</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="w-full md:w-auto"
                    disabled={webhookForm.formState.isSubmitting}
                    type="submit"
                  >
                    {webhookForm.formState.isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Salvar WebHook
                  </Button>
                  <Button
                    className="w-full md:w-auto"
                    disabled={isTesting}
                    onClick={() => void handleTestWebhook()}
                    type="button"
                    variant="outline"
                  >
                    {isTesting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Testar
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
