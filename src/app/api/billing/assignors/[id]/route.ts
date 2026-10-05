import { NextRequest, NextResponse } from "next/server";

import type { BillingAssignor } from "@/features/billing/types";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

type TecnospeedAssignor = {
  id: number;
  razaosocial?: string;
  nomefantasia?: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  cidadeibge?: string | number;
  situacao?: string;
  contas?: unknown[];
  criado?: string;
  token?: string;
  token_cedente?: string;
  tokencedente?: string;
  CedenteToken?: string;
  TokenCedente?: string;
};

type TecnospeedError = {
  _erro?: string;
};

type TecnospeedAssignorPayload = {
  _status: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: TecnospeedAssignor | TecnospeedAssignor[] | TecnospeedError[];
};

type UpdateAssignorPayload = {
  corporateName?: string;
  tradeName?: string;
  document?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  zipCode?: string;
  cityIbgeCode?: string;
  phone?: string;
  email?: string;
};

type DeleteAssignorPayload = {
  document?: string;
  reason?: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const payload = (await request.json()) as DeleteAssignorPayload;
  const document = onlyDigits(payload.document ?? "");

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
    const response = await tecnospeedRequest<TecnospeedAssignorPayload>({
      method: "PUT",
      path: `/cedentes/${id}`,
      headers: {
        "cnpj-cedente": document,
      },
      body: {
        ativo: false,
        motivoInativacao:
          payload.reason?.trim() || "Cedente removido pelo Fortusys.",
      },
    });

    if (response._status === "erro") {
      return NextResponse.json(
        { message: normalizeErrorMessage(response) },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    await createInternalActionNotification(supabase, {
      sourceKey: `assignor:${id}:disabled:${Date.now()}`,
      category: "billing",
      type: "assignor_disabled",
      title: "Cedente inativado",
      message: `Cedente ${document} inativado.`,
      severity: "warning",
      entityType: "billing_assignor",
      entityId: String(id),
      actionHref: "/cedentes",
      metadata: { assignorId: id, document },
    });

    return NextResponse.json({
      message: "Cedente inativado.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir cedente.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

function normalizePayload(data?: TecnospeedAssignor[] | TecnospeedAssignor) {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : [data];
}

function normalizeErrorMessage(response: TecnospeedAssignorPayload) {
  if (Array.isArray(response._dados)) {
    const errors = response._dados
      .map((item) => ("_erro" in item ? item._erro : null))
      .filter(Boolean);

    if (errors.length > 0) {
      return errors.join(" ");
    }
  }

  return response._mensagem ?? "Erro ao alterar cedente.";
}

function mapAssignor(assignor: TecnospeedAssignor): BillingAssignor {
  return {
    id: assignor.id,
    corporateName: assignor.razaosocial ?? "Sem razão social",
    tradeName: assignor.nomefantasia ?? null,
    document: assignor.cpf_cnpj ?? "",
    email: assignor.email ?? null,
    phone: assignor.telefone ?? null,
    street: assignor.logradouro ?? null,
    number: assignor.numero ?? null,
    complement: assignor.complemento ?? null,
    district: assignor.bairro ?? null,
    zipCode: assignor.cep ?? null,
    city: assignor.cidade ?? null,
    state: assignor.uf ?? null,
    cityIbgeCode: assignor.cidadeibge ? String(assignor.cidadeibge) : null,
    status: assignor.situacao ?? "DESCONHECIDO",
    accountsCount: assignor.contas?.length ?? 0,
    createdAt: assignor.criado ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function findToken(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const token = findToken(item);

      if (token) {
        return token;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const preferredKeys = [
    "token",
    "token_cedente",
    "tokencedente",
    "cedente_token",
    "CedenteToken",
    "TokenCedente",
    "tokenAcesso",
    "TokenAcesso",
  ];

  for (const key of preferredKeys) {
    const token = value[key];

    if (typeof token === "string" && token.trim()) {
      return token.trim();
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      key.toLowerCase().includes("token") &&
      typeof nestedValue === "string" &&
      nestedValue.trim()
    ) {
      return nestedValue.trim();
    }
  }

  for (const nestedValue of Object.values(value)) {
    const token = findToken(nestedValue);

    if (token) {
      return token;
    }
  }

  return null;
}

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
    const response = await tecnospeedRequest<TecnospeedAssignorPayload>({
      path: `/cedentes?cpf_cnpj=${document}`,
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

    const assignor = normalizePayload(
      response._dados as TecnospeedAssignor[] | TecnospeedAssignor | undefined
    )[0];

    if (!assignor) {
      return NextResponse.json(
        { message: "Cedente não encontrado na TecnoSpeed." },
        { status: 404 }
      );
    }

    const mappedAssignor = mapAssignor(assignor);

    return NextResponse.json({
      assignor: mappedAssignor,
      token: findToken(response._dados),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao consultar acesso do cedente.",
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
  const payload = (await request.json()) as UpdateAssignorPayload;
  const document = onlyDigits(payload.document ?? "");
  const body = {
    CedenteRazaoSocial: payload.corporateName?.trim(),
    CedenteNomeFantasia: payload.tradeName?.trim() || undefined,
    CedenteEnderecoLogradouro: payload.street?.trim(),
    CedenteEnderecoNumero: payload.number?.trim(),
    CedenteEnderecoComplemento: payload.complement?.trim() || undefined,
    CedenteEnderecoBairro: payload.district?.trim(),
    CedenteEnderecoCEP: onlyDigits(payload.zipCode ?? ""),
    CedenteEnderecoCidadeIBGE: onlyDigits(payload.cityIbgeCode ?? ""),
    CedenteTelefone: onlyDigits(payload.phone ?? ""),
    CedenteEmail: payload.email?.trim().toLowerCase(),
  };

  const requiredFields = [
    id,
    document,
    body.CedenteRazaoSocial,
    body.CedenteEnderecoLogradouro,
    body.CedenteEnderecoNumero,
    body.CedenteEnderecoBairro,
    body.CedenteEnderecoCEP,
    body.CedenteEnderecoCidadeIBGE,
    body.CedenteTelefone,
    body.CedenteEmail,
  ];

  if (requiredFields.some((field) => !field)) {
    return NextResponse.json(
      { message: "Preencha todos os campos obrigatórios." },
      { status: 400 }
    );
  }

  try {
    const response = await tecnospeedRequest<TecnospeedAssignorPayload>({
      method: "PUT",
      path: `/cedentes/${id}`,
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

    const assignor = normalizePayload(
      response._dados as TecnospeedAssignor[] | TecnospeedAssignor | undefined
    )[0];
    const mappedAssignor = mapAssignor(assignor);
    const supabase = createAdminClient();

    await createInternalActionNotification(supabase, {
      sourceKey: `assignor:${id}:updated:${Date.now()}`,
      category: "billing",
      type: "assignor_updated",
      title: "Cedente atualizado",
      message: mappedAssignor.corporateName,
      severity: "info",
      entityType: "billing_assignor",
      entityId: String(id),
      actionHref: "/cedentes",
      metadata: { assignorId: id, document },
    });

    return NextResponse.json(mappedAssignor);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao alterar cedente.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
