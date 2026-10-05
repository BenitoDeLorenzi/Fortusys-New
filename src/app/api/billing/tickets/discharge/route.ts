import { NextResponse } from "next/server";

import type { Json } from "@/features/database/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";
import { createAdminClient } from "@/lib/supabase/admin";

type DischargeRequest = {
  assignorDocument?: string;
  integrationId?: string;
  integrationIds?: string[];
};

type TecnospeedDischargePayload = {
  _status?: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: unknown;
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DischargeRequest;
    const assignorDocument = onlyDigits(body.assignorDocument);
    const integrationIds = Array.from(
      new Set([
        ...(body.integrationId ? [body.integrationId] : []),
        ...(Array.isArray(body.integrationIds) ? body.integrationIds : []),
      ])
    )
      .map((integrationId) => integrationId.trim())
      .filter(Boolean);

    if (!assignorDocument) {
      return NextResponse.json(
        { message: "Informe o CPF/CNPJ do cedente." },
        { status: 400 }
      );
    }

    if (!integrationIds.length) {
      return NextResponse.json(
        { message: "Informe o Id integração do boleto." },
        { status: 400 }
      );
    }

    const response = await tecnospeedRequest<TecnospeedDischargePayload>({
      method: "POST",
      path: "/boletos/baixa/lote",
      body: integrationIds,
      headers: {
        "cnpj-cedente": assignorDocument,
      },
    });

    if (response._status === "erro") {
      return NextResponse.json(
        {
          message: response._mensagem ?? "Não foi possível solicitar a baixa.",
          details: response._dados ?? null,
        },
        { status: 400 }
      );
    }

    const ticketLabel =
      integrationIds.length === 1
        ? `Boleto ${integrationIds[0]}`
        : `${integrationIds.length} boletos`;
    const supabase = createAdminClient();

    await createInternalActionNotification(supabase, {
      sourceKey: `billing-ticket-discharge-requested:${integrationIds.join(",")}:${Date.now()}`,
      category: "billing",
      type: "billing_ticket_discharge_requested",
      title: "Pedido de baixa solicitado",
      message: `${ticketLabel} · Aguardando confirmação da TecnoSpeed`,
      severity: "warning",
      entityType: "billing_ticket",
      entityId: integrationIds[0] ?? null,
      actionHref: "/cobranca",
      metadata: {
        assignorDocument,
        integrationIds,
        response: response as Json,
      },
    });

    return NextResponse.json({
      message: response._mensagem ?? "Pedido de baixa solicitado.",
      data: response._dados ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao solicitar baixa.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
