import { NextRequest, NextResponse } from "next/server";

import {
  getEmptyWebhook,
  getWebhookBody,
  mapWebhook,
  normalizeErrorMessage,
  onlyDigits,
  type BillingWebhook,
  type TecnospeedWebhookPayload,
} from "@/features/billing/server/webhooks";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";

function getDocument(request: NextRequest) {
  return onlyDigits(request.nextUrl.searchParams.get("document") ?? "");
}

function validateDocument(document: string) {
  if (!document) {
    return NextResponse.json(
      { message: "Informe o CPF/CNPJ do cedente." },
      { status: 400 }
    );
  }

  return null;
}

function buildWebhookBodyOrResponse(payload: BillingWebhook) {
  try {
    return { body: getWebhookBody(payload) };
  } catch {
    return {
      response: NextResponse.json(
        { message: "Headers adicionais precisam estar em formato JSON válido." },
        { status: 400 }
      ),
    };
  }
}

export async function GET(request: NextRequest) {
  const document = getDocument(request);
  const documentError = validateDocument(document);

  if (documentError) {
    return documentError;
  }

  try {
    const response = await tecnospeedRequest<TecnospeedWebhookPayload>({
      path: "/webhooks",
      headers: {
        "cnpj-cedente": document,
      },
    });

    if (response._status === "erro") {
      return NextResponse.json(
        { message: normalizeErrorMessage(response) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      webhook: mapWebhook(
        Array.isArray(response._dados) ? undefined : response._dados
      ),
    });
  } catch (error) {
    if (error instanceof TecnospeedRequestError && error.status === 404) {
      return NextResponse.json({ webhook: getEmptyWebhook() });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao consultar WebHook.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const document = getDocument(request);
  const documentError = validateDocument(document);
  const payload = (await request.json()) as BillingWebhook;

  if (documentError) {
    return documentError;
  }

  if (payload.active && !payload.url) {
    return NextResponse.json(
      { message: "Informe a URL do WebHook." },
      { status: 400 }
    );
  }

  const bodyResult = buildWebhookBodyOrResponse(payload);

  if (bodyResult.response) {
    return bodyResult.response;
  }

  try {
    const response = await tecnospeedRequest<TecnospeedWebhookPayload>({
      method: "POST",
      path: "/webhooks",
      headers: {
        "cnpj-cedente": document,
      },
      body: bodyResult.body,
    });

    if (response._status === "erro") {
      return NextResponse.json(
        { message: normalizeErrorMessage(response) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: response._mensagem ?? "WebHook salvo.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao salvar WebHook.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const document = getDocument(request);
  const documentError = validateDocument(document);
  const payload = (await request.json()) as BillingWebhook;

  if (documentError) {
    return documentError;
  }

  if (payload.active && !payload.url) {
    return NextResponse.json(
      { message: "Informe a URL do WebHook." },
      { status: 400 }
    );
  }

  const bodyResult = buildWebhookBodyOrResponse(payload);

  if (bodyResult.response) {
    return bodyResult.response;
  }

  try {
    const response = await tecnospeedRequest<TecnospeedWebhookPayload>({
      method: "PUT",
      path: "/webhooks",
      headers: {
        "cnpj-cedente": document,
      },
      body: bodyResult.body,
    });

    if (response._status === "erro") {
      return NextResponse.json(
        { message: normalizeErrorMessage(response) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: response._mensagem ?? "WebHook salvo.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao salvar WebHook.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
