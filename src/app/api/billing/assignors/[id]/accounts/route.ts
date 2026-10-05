import { NextRequest, NextResponse } from "next/server";

import type { BillingBankAccountsResponse } from "@/features/billing/types";
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

type CreateAccountPayload = {
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const document = onlyDigits(request.nextUrl.searchParams.get("document") ?? "");

  if (!id || Number.isNaN(Number(id))) {
    return NextResponse.json(
      { message: "Cedente inválido." },
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

    const accounts = normalizePayload(
      response._dados as TecnospeedBankAccount[] | TecnospeedBankAccount
    )
      .map(mapBankAccount)
      .filter((account) => account.assignorId === Number(id));

    return NextResponse.json({
      accounts,
    } satisfies BillingBankAccountsResponse);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao consultar contas.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const payload = (await request.json()) as CreateAccountPayload;
  const document = onlyDigits(payload.document ?? "");
  const body = {
    ContaCodigoBanco: onlyDigits(payload.bankCode ?? ""),
    ContaAgencia: onlyDigits(payload.agency ?? ""),
    ContaAgenciaDV: onlyDigits(payload.agencyDigit ?? ""),
    ContaNumero: onlyDigits(payload.accountNumber ?? ""),
    ContaNumeroDV: onlyDigits(payload.accountDigit ?? ""),
    ContaTipo: payload.accountType,
    ContaCodigoBeneficiario: payload.beneficiaryCode?.trim() || undefined,
    ContaCodigoEmpresa: payload.companyCode?.trim() || undefined,
    ContaValidacaoAtiva: Boolean(payload.validationActive),
    ContaImpressaoAtualizada: Boolean(payload.updatedPrint),
  };

  const requiredFields = [
    { label: "Cedente", value: id },
    { label: "CPF/CNPJ do cedente", value: document },
    {
      label: getAccountFieldLabel("ContaCodigoBanco"),
      value: body.ContaCodigoBanco,
    },
    { label: getAccountFieldLabel("ContaAgencia"), value: body.ContaAgencia },
    { label: getAccountFieldLabel("ContaNumero"), value: body.ContaNumero },
    { label: getAccountFieldLabel("ContaNumeroDV"), value: body.ContaNumeroDV },
    { label: getAccountFieldLabel("ContaTipo"), value: body.ContaTipo },
    {
      label: getAccountFieldLabel("ContaCodigoBeneficiario"),
      value: body.ContaCodigoBeneficiario,
    },
  ];
  const missingFields = requiredFields
    .filter((field) => !field.value)
    .map((field) => field.label);

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
      method: "POST",
      path: "/cedentes/contas",
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

    return NextResponse.json(mapBankAccount(account), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao cadastrar conta.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
