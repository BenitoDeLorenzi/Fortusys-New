import { getTecnospeedConfigStatus, getTecnospeedHeaders } from "./config";

type TecnospeedRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};

type TecnospeedErrorPayload = {
  _mensagem?: string;
  _dados?: Array<{
    _campo?: string;
    _erro?: string;
  }>;
};

export class TecnospeedRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "TecnospeedRequestError";
  }
}

const tecnospeedFieldLabels: Record<string, string> = {
  contacodigobanco: "Banco",
  contaagencia: "Agência",
  contaagenciadv: "Dígito da agência",
  contanumero: "Conta",
  contanumerodv: "Dígito da conta",
  contatipo: "Tipo da conta",
  contacodigobeneficiario: "Código beneficiário",
  contacodigoempresa: "Código empresa",
  cedentecpfcnpj: "CPF/CNPJ",
  cedenterazaosocial: "Razão social",
  cedenteenderecocep: "CEP",
  convenionumero: "Número do convênio",
  conveniodescricao: "Descrição do convênio",
  conveniocarteira: "Carteira",
  convenioespecie: "Espécie",
  conveniopadraocnab: "CNAB",
  convenionumeroremessa: "Número da remessa",
  convenioregistroinstantaneo: "Registro instantâneo",
  convenioapiid: "API ID",
  convenioapikey: "API Key",
  convenioapisecret: "API Secret",
  convenioestacao: "Estação",
  conveniotipowebservice: "Tipo do webservice",
};

function formatTecnospeedField(value?: string) {
  if (!value) {
    return null;
  }

  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return tecnospeedFieldLabels[key] ?? value;
}

function getTecnospeedErrorMessage(status: number, rawMessage: string) {
  const trimmedMessage = rawMessage.trim();

  if (status === 503) {
    return "TecnoSpeed temporariamente indisponível. Tente novamente em alguns instantes.";
  }

  if (/^\s*</.test(rawMessage)) {
    return `TecnoSpeed retornou uma resposta indisponível ou inválida. Código ${status}.`;
  }

  try {
    const payload = JSON.parse(rawMessage) as TecnospeedErrorPayload;
    const fieldErrors = payload._dados
      ?.map((item) => {
        if (!item._erro) {
          return null;
        }

        const field = formatTecnospeedField(item._campo);
        return field ? `${field}: ${item._erro}` : item._erro;
      })
      .filter(Boolean);

    if (fieldErrors?.length) {
      return fieldErrors.join(" ");
    }

    if (payload._mensagem) {
      return payload._mensagem;
    }
  } catch {
    if (trimmedMessage) {
      return trimmedMessage;
    }
  }

  return `Não foi possível processar a solicitação na TecnoSpeed. Código ${status}.`;
}

export async function tecnospeedRequest<TResponse>({
  method = "GET",
  path,
  body,
  headers,
}: TecnospeedRequestOptions): Promise<TResponse> {
  const config = await getTecnospeedConfigStatus();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      ...(await getTecnospeedHeaders()),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = getTecnospeedErrorMessage(
      response.status,
      await response.text()
    );
    throw new TecnospeedRequestError(message, response.status);
  }

  return response.json() as Promise<TResponse>;
}
