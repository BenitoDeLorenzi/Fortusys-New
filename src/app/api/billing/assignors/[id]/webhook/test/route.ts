import { NextRequest, NextResponse } from "next/server";

import {
  getWebhookBody,
  onlyDigits,
  type BillingWebhook,
} from "@/features/billing/server/webhooks";

function getDocument(request: NextRequest) {
  return onlyDigits(request.nextUrl.searchParams.get("document") ?? "");
}

function getHeaders(value: unknown) {
  const body = value as {
    headers?: Record<string, string>;
    headers_adicionais?: Record<string, string>;
  };

  return {
    "Content-Type": "application/json",
    ...(body.headers_adicionais ?? {}),
    ...(body.headers ?? {}),
  };
}

export async function POST(request: NextRequest) {
  const document = getDocument(request);
  const payload = (await request.json()) as BillingWebhook;

  if (!payload.url) {
    return NextResponse.json(
      { message: "Informe a URL do WebHook para testar." },
      { status: 400 }
    );
  }

  let body: ReturnType<typeof getWebhookBody>;

  try {
    body = getWebhookBody(payload);
  } catch {
    return NextResponse.json(
      { message: "Headers adicionais precisam estar em formato JSON válido." },
      { status: 400 }
    );
  }

  const testPayload = {
    tipoWH: "notifica_registrou",
    dataHoraEnvio: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date()),
    titulo: {
      situacao: "REGISTRADO",
      idintegracao: "fortusys-teste-webhook",
      TituloNossoNumero: "10",
      TituloMovimentos: [
        {
          codigo: "02",
          mensagem: "Teste de WebHook Fortusys",
          data: new Intl.DateTimeFormat("pt-BR").format(new Date()),
          ocorrencias: [],
        },
      ],
    },
    CpfCnpjCedente: document,
  };

  try {
    const response = await fetch(body.url, {
      method: "POST",
      headers: getHeaders(body),
      body: JSON.stringify(testPayload),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          message: `A URL respondeu com HTTP ${response.status}.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível testar o WebHook.",
      },
      { status: 400 }
    );
  }
}
