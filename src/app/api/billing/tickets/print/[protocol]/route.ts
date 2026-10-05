import { NextResponse } from "next/server";

import { getTecnospeedConfigStatus, getTecnospeedHeaders } from "@/features/integrations/tecnospeed/server/config";

type RouteContext = {
  params: Promise<{
    protocol: string;
  }>;
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getTecnospeedPdf(protocol: string, assignorDocument: string) {
  const config = await getTecnospeedConfigStatus();
  const headers = await getTecnospeedHeaders();

  return fetch(`${config.apiBaseUrl}/boletos/impressao/lote/${protocol}`, {
    headers: {
      ...headers,
      "cnpj-cedente": assignorDocument,
    },
    cache: "no-store",
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { protocol } = await context.params;
  const { searchParams } = new URL(request.url);
  const assignorDocument = onlyDigits(searchParams.get("document"));

  if (!protocol) {
    return NextResponse.json(
      { message: "Informe o protocolo de impressão." },
      { status: 400 }
    );
  }

  if (!assignorDocument) {
    return NextResponse.json(
      { message: "Informe o CPF/CNPJ do cedente." },
      { status: 400 }
    );
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await getTecnospeedPdf(protocol, assignorDocument);
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const data = (await response.json()) as {
        _status?: string;
        _mensagem?: string;
        _dados?: { situacao?: string } | Array<{ situacao?: string }>;
      };
      const rawData = Array.isArray(data._dados) ? data._dados[0] : data._dados;
      const situation = rawData?.situacao?.toUpperCase();

      if (
        response.ok &&
        data._status === "sucesso" &&
        situation === "PROCESSANDO"
      ) {
        await sleep(2500);
        continue;
      }

      return NextResponse.json(
        {
          message:
            data._mensagem ??
            "Não foi possível consultar a impressão dos boletos.",
        },
        { status: response.ok ? 400 : response.status }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: "Não foi possível carregar o PDF dos boletos." },
        { status: response.status }
      );
    }

    const pdf = await response.arrayBuffer();

    return new Response(pdf, {
      headers: {
        "Content-Disposition": `inline; filename="boletos-${protocol}.pdf"`,
        "Content-Type": contentType || "application/pdf",
      },
    });
  }

  return NextResponse.json(
    {
      message:
        "A impressão ainda está em processamento. Tente abrir o link novamente em alguns instantes.",
    },
    { status: 202 }
  );
}
