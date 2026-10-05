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

function getMissingAgreementFields(body: ReturnType<typeof getAgreementBody>, document: string) {
  const requiredFields = [
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const payload = (await request.json()) as AgreementFormPayload;
  const document = onlyDigits(payload.document ?? "");
  const body = getAgreementBody({ ...payload, accountId: id });
  const missingFields = getMissingAgreementFields(body, document);

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
      method: "POST",
      path: "/cedentes/contas/convenios",
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

    return NextResponse.json(mapAgreement(agreement), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao cadastrar convênio.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
