import { NextResponse } from "next/server";

import type { Json } from "@/features/database/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import {
  canDiscardProviderTicket,
  getActiveChargeTicket,
  syncChargeTicketMirror,
  type RealEstateChargeTicketRow,
} from "@/features/real-estate/server/charge-tickets";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteProps = {
  params: Promise<{ chargeId: string }>;
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

export async function POST(_request: Request, { params }: RouteProps) {
  const { chargeId } = await params;
  const supabase = createAdminClient();

  try {
    const { data: charge, error: chargeError } = await supabase
      .from("real_estate_charges")
      .select("id,asset_id,competence_month,competence_year,status")
      .eq("id", chargeId)
      .maybeSingle();

    if (chargeError) throw new Error(chargeError.message);
    if (!charge) {
      return NextResponse.json({ message: "Cobrança não encontrada." }, { status: 404 });
    }
    if (charge.status === "paid" || charge.status === "canceled") {
      return NextResponse.json(
        { message: "Cobrança paga ou cancelada não pode descartar boleto." },
        { status: 400 }
      );
    }

    const activeTicket = await getActiveChargeTicket(supabase, chargeId);
    const { data: latestTickets, error: latestTicketError } = activeTicket
      ? { data: null, error: null }
      : await supabase
          .from("real_estate_charge_tickets")
          .select("*")
          .eq("charge_id", chargeId)
          .order("created_at", { ascending: false })
          .limit(5);

    if (latestTicketError) throw new Error(latestTicketError.message);

    const ticket =
      activeTicket ??
      ((latestTickets ?? []) as RealEstateChargeTicketRow[]).find((item) =>
        canDiscardProviderTicket(item.provider_status)
      ) ??
      null;

    if (!ticket?.integration_id || !ticket.assignor_document) {
      return NextResponse.json(
        { message: "Esta cobrança não possui boleto ativo para descarte." },
        { status: 400 }
      );
    }

    if (!canDiscardProviderTicket(ticket.provider_status)) {
      return NextResponse.json(
        { message: "Só é possível descartar boletos emitidos, com falha ou rejeitados." },
        { status: 400 }
      );
    }

    const response = await tecnospeedRequest<TecnospeedDiscardPayload>({
      method: "POST",
      path: "/boletos/descarta/lote",
      body: [ticket.integration_id],
      headers: {
        "cnpj-cedente": ticket.assignor_document,
      },
    });
    const failures = response._dados?._falha ?? [];

    if (response._status === "erro" || failures.length > 0) {
      return NextResponse.json(
        {
          message: response._mensagem ?? "Não foi possível descartar o boleto.",
          data: response._dados ?? null,
        },
        { status: 400 }
      );
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from("real_estate_charge_tickets")
      .update({
        ticket_status: "canceled",
        provider_status: "DESCARTADO",
        provider_payload: response as Json,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);

    await syncChargeTicketMirror(
      supabase,
      chargeId,
      updatedTicket as RealEstateChargeTicketRow,
      { chargeStatus: "open" }
    );

    const { data: asset } = await supabase
      .from("real_estate_assets")
      .select("code,title")
      .eq("id", charge.asset_id)
      .maybeSingle();
    const competence = `${String(charge.competence_month).padStart(2, "0")}/${
      charge.competence_year
    }`;
    const assetTitle = asset
      ? `${asset.code ? `${asset.code} · ` : ""}${asset.title}`
      : "Imóvel";

    await createInternalActionNotification(supabase, {
      sourceKey: `real-estate-ticket:${ticket.integration_id}:DESCARTADO`,
      category: "billing",
      type: "ticket_discarded",
      title: "Boleto descartado",
      message: `${assetTitle} · Competência ${competence}`,
      severity: "warning",
      entityType: "real_estate_charge",
      entityId: chargeId,
      actionHref: `/imobiliaria/${charge.asset_id}/financeiro`,
      metadata: {
        chargeId,
        ticketId: ticket.id,
        integrationId: ticket.integration_id,
        provider: "tecnospeed",
        response: response as Json,
      },
    });

    return NextResponse.json({
      message: response._mensagem ?? "Boleto descartado.",
      data: response._dados ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao descartar boleto.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
