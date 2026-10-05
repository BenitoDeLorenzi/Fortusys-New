export type WebhookEvents = {
  registrou: boolean;
  liquidou: boolean;
  baixou: boolean;
  falhou: boolean;
  alterou: boolean;
  protestou: boolean;
  rejeitou: boolean;
  criou_assinatura: boolean;
  cancelou_assinatura: boolean;
};

export type BillingWebhook = {
  active: boolean;
  url: string;
  email: string;
  activationDate: string;
  events: WebhookEvents;
  headerActive: boolean;
  headerKey: string;
  headerValue: string;
  additionalHeaders: string;
};

export type TecnospeedWebhookPayload = {
  _status: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: TecnospeedWebhook | Array<{ _campo?: string; _erro?: string }>;
};

type TecnospeedWebhook = {
  ativo?: boolean;
  url?: string;
  email?: string;
  data_ativacao?: string;
  eventos?: Partial<WebhookEvents>;
  headers?: Record<string, string>;
  headers_adicionais?: Record<string, string>;
  headersAdicionais?: Record<string, string>;
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function getEmptyWebhook(): BillingWebhook {
  return {
    active: false,
    url: "",
    email: "",
    activationDate: "",
    events: {
      registrou: true,
      liquidou: true,
      baixou: true,
      falhou: true,
      alterou: true,
      protestou: true,
      rejeitou: true,
      criou_assinatura: true,
      cancelou_assinatura: true,
    },
    headerActive: false,
    headerKey: "",
    headerValue: "",
    additionalHeaders: "",
  };
}

export function normalizeErrorMessage(response: TecnospeedWebhookPayload) {
  if (Array.isArray(response._dados)) {
    const errors = response._dados
      .map((item) => {
        if (!item._erro) {
          return null;
        }

        const field = item._campo ? getWebhookFieldLabel(item._campo) : null;
        return field ? `${field}: ${item._erro}` : item._erro;
      })
      .filter(Boolean);

    if (errors.length > 0) {
      return errors.join(" ");
    }
  }

  return response._mensagem ?? "Erro ao processar WebHook.";
}

export function getWebhookFieldLabel(value: string) {
  const labels: Record<string, string> = {
    ativo: "Ativo",
    url: "URL",
    eventos: "Eventos",
    headers: "Header",
    headersadicionais: "Headers adicionais",
    dataativacao: "Data de ativação",
  };
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return labels[key] ?? value;
}

export function mapWebhook(data?: TecnospeedWebhook): BillingWebhook {
  const headerEntries = Object.entries(data?.headers ?? {});
  const firstHeader = headerEntries[0];
  const additionalHeaders =
    data?.headers_adicionais ?? data?.headersAdicionais ?? {};
  const empty = getEmptyWebhook();

  return {
    active: Boolean(data?.ativo),
    url: data?.url ?? "",
    email: data?.email ?? "",
    activationDate: data?.data_ativacao ?? "",
    events: {
      ...empty.events,
      ...(data?.eventos ?? {}),
    },
    headerActive: Boolean(firstHeader),
    headerKey: firstHeader?.[0] ?? "",
    headerValue: firstHeader?.[1] ?? "",
    additionalHeaders:
      Object.keys(additionalHeaders).length > 0
        ? JSON.stringify(additionalHeaders, null, 2)
        : "",
  };
}

export function getWebhookBody(payload: BillingWebhook) {
  let additionalHeaders: Record<string, string> | undefined;

  if (payload.additionalHeaders.trim()) {
    additionalHeaders = JSON.parse(payload.additionalHeaders) as Record<
      string,
      string
    >;
  }

  return {
    ativo: payload.active,
    url: payload.url.trim(),
    email: payload.email.trim() || undefined,
    data_ativacao: payload.activationDate || undefined,
    eventos: payload.events,
    headers:
      payload.headerActive &&
      payload.headerKey.trim() &&
      payload.headerValue.trim()
        ? {
            [payload.headerKey.trim()]: payload.headerValue.trim(),
          }
        : undefined,
    headers_adicionais: additionalHeaders,
  };
}
