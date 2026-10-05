import { NextResponse } from "next/server";

import type { Json } from "@/features/database/types";
import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import {
  createEventNotification,
  getAppUserForAuthUser,
} from "@/features/notifications/server/notification-service";
import {
  canDischargeProviderTicket,
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

type TecnospeedDischargePayload = {
  _status?: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: unknown;
};

export async function POST(_request: Request, { params }: RouteProps) {
  const { chargeId } = await params;
  const supabase = createAdminClient();
  const authUser = await requireAuthenticatedUser();
  const appUser = authUser
    ? await getAppUserForAuthUser(supabase, authUser)
    : null;

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
        { message: "Cobrança paga ou cancelada não pode receber baixa de boleto." },
        { status: 400 }
      );
    }

    const ticket = await getActiveChargeTicket(supabase, chargeId);

    if (!ticket?.integration_id || !ticket.assignor_document) {
      return NextResponse.json(
        { message: "Esta cobrança não possui boleto ativo para baixa." },
        { status: 400 }
      );
    }

    if (!canDischargeProviderTicket(ticket.provider_status)) {
      return NextResponse.json(
        { message: "Só é possível solicitar baixa de boletos registrados." },
        { status: 400 }
      );
    }

    const response = await tecnospeedRequest<TecnospeedDischargePayload>({
      method: "POST",
      path: "/boletos/baixa/lote",
      body: [ticket.integration_id],
      headers: {
        "cnpj-cedente": ticket.assignor_document,
      },
    });

    if (response._status === "erro") {
      return NextResponse.json(
        {
          message: response._mensagem ?? "Não foi possível solicitar a baixa.",
          data: response._dados ?? null,
        },
        { status: 400 }
      );
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from("real_estate_charge_tickets")
      .update({
        ticket_status: "canceled",
        provider_status: "BAIXA_SOLICITADA",
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
      { chargeStatus: "canceled" }
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

    await createEventNotification(supabase, {
      sourceKey: `real-estate-ticket:${ticket.integration_id}:BAIXA_SOLICITADA`,
      actorUserId: appUser?.id ?? null,
      category: "billing",
      type: "ticket_discharge_requested",
      title: "Pedido de baixa solicitado",
      message: `${assetTitle} · Competência ${competence} · Aguardando confirmação da TecnoSpeed`,
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
      notifyActiveUsers: true,
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
