import { NextResponse } from "next/server";

import type { Json } from "@/features/database/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";
import { createAdminClient } from "@/lib/supabase/admin";

type DiscardRequest = {
  assignorDocument?: string;
  integrationId?: string;
  integrationIds?: string[];
};

type TecnospeedDiscardPayload = {
  _status?: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: {
    _sucesso?: Array<{ idintegracao?: string }>;
    _falha?: Array<{
      idintegracao?: string;
      _erro?: string;
      _status_http?: number;
    }>;
  };
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DiscardRequest;
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

    const response = await tecnospeedRequest<TecnospeedDiscardPayload>({
      method: "POST",
      path: "/boletos/descarta/lote",
      body: integrationIds,
      headers: {
        "cnpj-cedente": assignorDocument,
      },
    });

    const failures = response._dados?._falha ?? [];

    if (response._status === "erro" || failures.length === integrationIds.length) {
      return NextResponse.json(
        {
          message: response._mensagem ?? "Não foi possível descartar os boletos.",
          data: response._dados ?? null,
        },
        { status: 400 }
      );
    }

    const successes = response._dados?._sucesso ?? [];
    const successCount =
      successes.length > 0
        ? successes.length
        : Math.max(0, integrationIds.length - failures.length);
    const ticketLabel =
      successCount === 1
        ? `Boleto ${integrationIds[0]}`
        : `${successCount} boletos`;
    const supabase = createAdminClient();

    await createInternalActionNotification(supabase, {
      sourceKey: `billing-ticket-discard-requested:${integrationIds.join(",")}:${Date.now()}`,
      category: "billing",
      type: "billing_ticket_discard_requested",
      title: "Descarte de boleto solicitado",
      message:
        failures.length > 0
          ? `${ticketLabel} · ${failures.length} falha(s)`
          : `${ticketLabel} · TecnoSpeed`,
      severity: failures.length > 0 ? "warning" : "info",
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
      message: response._mensagem ?? "Descarte solicitado.",
      data: response._dados ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao descartar boletos.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
