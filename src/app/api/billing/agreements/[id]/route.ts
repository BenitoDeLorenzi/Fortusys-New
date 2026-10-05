import { NextRequest, NextResponse } from "next/server";

import {
  getAgreementBody,
  getAgreementFieldLabel,
  mapAgreement,
  normalizeErrorMessage,
  normalizePayload,
  onlyDigits,
  type AgreementFormPayload,
  type TecnospeedAgreement,
  type TecnospeedAgreementPayload,
} from "@/features/billing/server/agreements";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";

function getMissingAgreementFields(
  id: string,
  body: ReturnType<typeof getAgreementBody>,
  document: string
) {
  const requiredFields = [
    { label: "Convênio", value: id },
    { label: "CPF/CNPJ do cedente", value: document },
    { label: getAgreementFieldLabel("ConvenioNumero"), value: body.ConvenioNumero },
    {
      label: getAgreementFieldLabel("ConvenioDescricao"),
      value: body.ConvenioDescricao,
    },
    {
      label: getAgreementFieldLabel("ConvenioCarteira"),
      value: body.ConvenioCarteira,
    },
    { label: getAgreementFieldLabel("ConvenioEspecie"), value: body.ConvenioEspecie },
    {
      label: getAgreementFieldLabel("ConvenioPadraoCNAB"),
      value: body.ConvenioPadraoCNAB,
    },
    {
      label: getAgreementFieldLabel("ConvenioNumeroRemessa"),
      value: body.ConvenioNumeroRemessa,
    },
    { label: "Conta", value: body.Conta },
    ...(body.ConvenioRegistroInstantaneo
      ? [
          { label: getAgreementFieldLabel("ConvenioApiId"), value: body.ConvenioApiId },
          { label: getAgreementFieldLabel("ConvenioApiKey"), value: body.ConvenioApiKey },
          {
            label: getAgreementFieldLabel("ConvenioApiSecret"),
            value: body.ConvenioApiSecret,
          },
          {
            label: getAgreementFieldLabel("Conveniotipowebservice"),
            value: body.Conveniotipowebservice,
          },
        ]
      : []),
  ];

  return requiredFields
    .filter((field) => !field.value)
    .map((field) => field.label)
    .filter(Boolean);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const payload = (await request.json()) as AgreementFormPayload;
  const document = onlyDigits(payload.document ?? "");
  const body = getAgreementBody(payload);
  const missingFields = getMissingAgreementFields(id, body, document);

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        message: `Preencha os campos obrigatórios do convênio: ${missingFields.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  try {
    const response = await tecnospeedRequest<TecnospeedAgreementPayload>({
      method: "PUT",
      path: `/cedentes/contas/convenios/${id}`,
      headers: {
        "cnpj-cedente": document,
      },
      body,
    });

    if (response._status === "erro") {
      return NextResponse.json(
        { message: normalizeErrorMessage(response) },
        { status: 400 }
      );
    }

    const agreement = normalizePayload(
      response._dados as TecnospeedAgreement[] | TecnospeedAgreement
    )[0];

    return NextResponse.json(mapAgreement(agreement));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao alterar convênio.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const document = onlyDigits(request.nextUrl.searchParams.get("document") ?? "");

  if (!id || Number.isNaN(Number(id))) {
    return NextResponse.json(
      { message: "Convênio inválido." },
      { status: 400 }
    );
  }

  if (!document) {
    return NextResponse.json(
      { message: "Informe o CPF/CNPJ do cedente." },
      { status: 400 }
    );
  }

  try {
    const response = await tecnospeedRequest<TecnospeedAgreementPayload>({
      method: "DELETE",
      path: `/cedentes/contas/convenios/${id}`,
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
      message: response._mensagem ?? "Convênio excluído.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir convênio.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
