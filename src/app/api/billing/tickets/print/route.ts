import { NextResponse } from "next/server";

import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";

type PrintRequest = {
  assignorDocument?: string;
  integrationIds?: string[];
  printType?: string;
  hideDigitableLine?: boolean;
  password?: string;
};

type TecnospeedPrintPayload = {
  _status?: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: {
    situacao?: string;
    protocolo?: string;
  };
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function getBaseUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedHost) {
    return `${forwardedProto ?? url.protocol.replace(":", "")}://${forwardedHost}`;
  }

  return url.origin;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PrintRequest;
    const assignorDocument = onlyDigits(body.assignorDocument);
    const integrationIds = Array.from(
      new Set(
        body.integrationIds
          ?.map((integrationId) => integrationId.trim())
          .filter(Boolean) ?? []
      )
    );
    const printType = body.printType || "0";
    const hideDigitableLine = Boolean(body.hideDigitableLine);
    const password = body.password?.trim();

    if (!assignorDocument) {
      return NextResponse.json(
        { message: "Informe o CPF/CNPJ do cedente." },
        { status: 400 }
      );
    }

    if (!integrationIds.length) {
      return NextResponse.json(
        { message: "Selecione ao menos um boleto." },
        { status: 400 }
      );
    }

    if (integrationIds.length > 100 && printType !== "99") {
      return NextResponse.json(
        { message: "A impressão em lote permite até 100 boletos." },
        { status: 400 }
      );
    }

    if (integrationIds.length > 50 && printType === "99") {
      return NextResponse.json(
        { message: "A impressão personalizada permite até 50 boletos." },
        { status: 400 }
      );
    }

    const response = await tecnospeedRequest<TecnospeedPrintPayload>({
      method: "POST",
      path: "/boletos/impressao/lote",
      body: {
        TipoImpressao: printType,
        Boletos: integrationIds,
        ocultarLinhaCodigo: hideDigitableLine,
        ...(password
          ? {
              senha: password,
              confirmarSenha: password,
            }
          : {}),
      },
      headers: {
        "cnpj-cedente": assignorDocument,
      },
    });

    if (response._status === "erro" || !response._dados?.protocolo) {
      return NextResponse.json(
        {
          message:
            response._mensagem ??
            "Não foi possível solicitar a impressão dos boletos.",
          data: response._dados ?? null,
        },
        { status: 400 }
      );
    }

    const protocol = response._dados.protocolo;
    const printUrl = new URL(
      `/api/billing/tickets/print/${protocol}`,
      getBaseUrl(request)
    );
    printUrl.searchParams.set("document", assignorDocument);

    return NextResponse.json({
      message: response._mensagem ?? "Impressão em processamento.",
      protocol,
      printUrl: printUrl.toString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao solicitar impressão.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
