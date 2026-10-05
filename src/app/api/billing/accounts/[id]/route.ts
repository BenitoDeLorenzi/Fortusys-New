import { NextRequest, NextResponse } from "next/server";

import {
  getAccountFieldLabel,
  mapBankAccount,
  normalizeErrorMessage,
  normalizePayload,
  onlyDigits,
  type TecnospeedAccountsPayload,
  type TecnospeedBankAccount,
} from "@/features/billing/server/accounts";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";

type UpdateAccountPayload = {
  document?: string;
  bankCode?: string;
  agency?: string;
  agencyDigit?: string;
  accountNumber?: string;
  accountDigit?: string;
  accountType?: string;
  beneficiaryCode?: string;
  companyCode?: string;
  validationActive?: boolean;
  updatedPrint?: boolean;
};

function getRequiredAccountFields(params: {
  id: string;
  document: string;
  body: {
    ContaCodigoBanco: string;
    ContaAgencia: string;
    ContaNumero: string;
    ContaNumeroDV: string;
    ContaTipo?: string;
    ContaCodigoBeneficiario?: string;
  };
}) {
  return [
    { label: "Conta", value: params.id },
    { label: "CPF/CNPJ do cedente", value: params.document },
    {
      label: getAccountFieldLabel("ContaCodigoBanco"),
      value: params.body.ContaCodigoBanco,
    },
    {
      label: getAccountFieldLabel("ContaAgencia"),
      value: params.body.ContaAgencia,
    },
    {
      label: getAccountFieldLabel("ContaNumero"),
      value: params.body.ContaNumero,
    },
    {
      label: getAccountFieldLabel("ContaNumeroDV"),
      value: params.body.ContaNumeroDV,
    },
    { label: getAccountFieldLabel("ContaTipo"), value: params.body.ContaTipo },
    {
      label: getAccountFieldLabel("ContaCodigoBeneficiario"),
      value: params.body.ContaCodigoBeneficiario,
    },
  ];
}

function validateRequiredFields(fields: Array<{ label: string | null; value?: unknown }>) {
  return fields
    .filter((field) => !field.value)
    .map((field) => field.label)
    .filter(Boolean);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const document = onlyDigits(request.nextUrl.searchParams.get("document") ?? "");

  if (!id || Number.isNaN(Number(id))) {
    return NextResponse.json(
      { message: "Conta inválida." },
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
    const response = await tecnospeedRequest<TecnospeedAccountsPayload>({
      path: "/cedentes/contas",
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

    const account = normalizePayload(
      response._dados as TecnospeedBankAccount[] | TecnospeedBankAccount
    )
      .map(mapBankAccount)
      .find((currentAccount) => currentAccount.id === Number(id));

    if (!account) {
      return NextResponse.json(
        { message: "Conta não encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json(account);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao consultar conta.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const payload = (await request.json()) as UpdateAccountPayload;
  const document = onlyDigits(payload.document ?? "");
  const body = {
    ContaCodigoBanco: onlyDigits(payload.bankCode ?? ""),
    ContaAgencia: onlyDigits(payload.agency ?? ""),
    ContaAgenciaDV: onlyDigits(payload.agencyDigit ?? ""),
    ContaNumero: onlyDigits(payload.accountNumber ?? ""),
    ContaNumeroDV: onlyDigits(payload.accountDigit ?? ""),
    ContaTipo: payload.accountType,
    ContaCodigoBeneficiario: payload.beneficiaryCode?.trim(),
    ContaCodigoEmpresa: payload.companyCode?.trim() || undefined,
    ContaValidacaoAtiva: Boolean(payload.validationActive),
    ContaImpressaoAtualizada: Boolean(payload.updatedPrint),
  };
  const missingFields = validateRequiredFields(
    getRequiredAccountFields({ id, document, body })
  );

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        message: `Preencha os campos obrigatórios da conta: ${missingFields.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  try {
    const response = await tecnospeedRequest<TecnospeedAccountsPayload>({
      method: "PUT",
      path: `/cedentes/contas/${id}`,
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

    const account = normalizePayload(
      response._dados as TecnospeedBankAccount[] | TecnospeedBankAccount
    )[0];

    return NextResponse.json(mapBankAccount(account));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao alterar conta.",
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
      { message: "Conta inválida." },
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
    const response = await tecnospeedRequest<TecnospeedAccountsPayload>({
      method: "DELETE",
      path: `/cedentes/contas/${id}`,
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
      message: response._mensagem ?? "Conta excluída.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir conta.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
