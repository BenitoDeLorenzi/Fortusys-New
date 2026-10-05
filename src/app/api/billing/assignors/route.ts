import { NextRequest, NextResponse } from "next/server";

import type {
  BillingAssignor,
  BillingAssignorsResponse,
} from "@/features/billing/types";
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
};

type TecnospeedAssignorsPayload = {
  _status: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: TecnospeedAssignor[] | TecnospeedAssignor | TecnospeedError[];
};

type TecnospeedError = {
  _campo?: string;
  _erro?: string;
};

type CreateAssignorPayload = {
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

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePayload(data?: TecnospeedAssignor[] | TecnospeedAssignor) {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : [data];
}

function normalizeErrorMessage(response: TecnospeedAssignorsPayload) {
  if (Array.isArray(response._dados)) {
    const errors = response._dados
      .map((item) => "_erro" in item ? item._erro : null)
      .filter(Boolean);

    if (errors.length > 0) {
      return errors.join(" ");
    }
  }

  return response._mensagem ?? "Erro ao processar cedente.";
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

export async function GET(request: NextRequest) {
  const document = onlyDigits(request.nextUrl.searchParams.get("document") ?? "");
  const search = document ? `?cpf_cnpj=${document}` : "";

  try {
    const response = await tecnospeedRequest<TecnospeedAssignorsPayload>({
      path: `/cedentes${search}`,
    });

    if (response._status === "erro") {
      return NextResponse.json(
        { message: response._mensagem ?? "Erro ao consultar cedentes." },
        { status: 400 }
      );
    }

    const assignors = normalizePayload(
      response._dados as TecnospeedAssignor[] | TecnospeedAssignor | undefined
    ).map(mapAssignor);

    return NextResponse.json({
      assignors,
    } satisfies BillingAssignorsResponse);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao consultar cedentes.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as CreateAssignorPayload;
  const body = {
    CedenteRazaoSocial: payload.corporateName?.trim(),
    CedenteNomeFantasia: payload.tradeName?.trim() || undefined,
    CedenteCPFCNPJ: onlyDigits(payload.document ?? ""),
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
    body.CedenteRazaoSocial,
    body.CedenteCPFCNPJ,
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
    const response = await tecnospeedRequest<TecnospeedAssignorsPayload>({
      method: "POST",
      path: "/cedentes",
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
      sourceKey: `assignor:${mappedAssignor.id}:created`,
      category: "billing",
      type: "assignor_created",
      title: "Cedente criado",
      message: mappedAssignor.corporateName,
      severity: "info",
      entityType: "billing_assignor",
      entityId: String(mappedAssignor.id),
      actionHref: "/cedentes",
      metadata: { assignorId: mappedAssignor.id, document: mappedAssignor.document },
    });

    return NextResponse.json(mappedAssignor, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao cadastrar cedente.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
