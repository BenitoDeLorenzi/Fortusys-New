import { NextRequest, NextResponse } from "next/server";

import type { RealEstateChargeItemType } from "@/features/real-estate/charges";
import {
  getActiveChargeTicket,
  isProviderActiveTicketStatus,
} from "@/features/real-estate/server/charge-tickets";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

type ChargeRouteProps = {
  params: Promise<{ chargeId: string }>;
};

type ChargeRow = {
  id: string;
  asset_id: string;
  competence_month: number;
  competence_year: number;
  ticket_status: "not_generated" | "registering" | "registered" | "failed" | "canceled";
  ticket_provider_status: string | null;
  ticket_error_message: string | null;
  status: "open" | "paid" | "overdue" | "canceled";
};

type PatchChargePayload = {
  action?: "update" | "cancel";
  competenceMonth?: number;
  competenceYear?: number;
  dueDate?: string;
  rentAmount?: string;
  discountAmount?: string;
  notes?: string;
  items?: Array<{
    type?: RealEstateChargeItemType;
    description?: string;
    amount?: string;
  }>;
};

const chargeItemTypes: RealEstateChargeItemType[] = [
  "rent",
  "iptu",
  "condominium",
  "reserve_fund",
  "water",
  "energy",
  "trash",
  "gas",
  "other",
  "discount",
];

function optional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function moneyTextToCents(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits ? Number(digits) : 0;
}

function canDeleteChargeWithoutActiveTicket(charge: ChargeRow) {
  return charge.status !== "paid";
}

async function hasChargeTicketAttempts(
  supabase: ReturnType<typeof createAdminClient>,
  chargeId: string
) {
  const { data, error } = await supabase
    .from("real_estate_charge_tickets")
    .select("id")
    .eq("charge_id", chargeId)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.length);
}

export async function PATCH(
  request: NextRequest,
  { params }: ChargeRouteProps
) {
  const { chargeId } = await params;
  const payload = (await request.json()) as PatchChargePayload;
  const supabase = createAdminClient();
  const { data: charge, error: chargeError } = await supabase
    .from("real_estate_charges")
    .select("id,asset_id,competence_month,competence_year,ticket_status,ticket_provider_status,ticket_error_message,status")
    .eq("id", chargeId)
    .maybeSingle();

  if (chargeError) {
    return NextResponse.json({ message: chargeError.message }, { status: 500 });
  }

  if (!charge) {
    return NextResponse.json(
      { message: "Cobrança não encontrada." },
      { status: 404 }
    );
  }

  const chargeRow = charge as ChargeRow;
  const activeTicket = await getActiveChargeTicket(supabase, chargeId);

  if (chargeRow.status === "paid") {
    return NextResponse.json(
      {
        message: "Cobrança paga não pode ser alterada.",
      },
      { status: 400 }
    );
  }

  if (payload.action === "cancel") {
    const hasValidActiveTicket =
      activeTicket && isProviderActiveTicketStatus(activeTicket.provider_status);

    if (hasValidActiveTicket) {
      return NextResponse.json(
        {
          message:
            "Esta cobrança possui boleto ativo. Solicite baixa ou descarte o boleto antes de cancelar a cobrança.",
        },
        { status: 400 }
      );
    }

    if (activeTicket) {
      const { error: ticketUpdateError } = await supabase
        .from("real_estate_charge_tickets")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeTicket.id);

      if (ticketUpdateError) {
        return NextResponse.json(
          { message: ticketUpdateError.message },
          { status: 500 }
        );
      }
    }

    if (chargeRow.status === "canceled") {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("real_estate_charges")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", chargeId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    await createInternalActionNotification(supabase, {
      sourceKey: `real-estate-charge:${chargeId}:canceled:${Date.now()}`,
      category: "billing",
      type: "real_estate_charge_canceled",
      title: "Cobrança cancelada",
      message: `Competência ${String(chargeRow.competence_month).padStart(2, "0")}/${
        chargeRow.competence_year
      } cancelada.`,
      severity: "warning",
      entityType: "real_estate_charge",
      entityId: chargeId,
      actionHref: `/imobiliaria/${chargeRow.asset_id}/financeiro`,
      metadata: { chargeId, assetId: chargeRow.asset_id },
    });

    return NextResponse.json({ ok: true });
  }

  if (activeTicket) {
    return NextResponse.json(
      {
        message:
          "Esta cobrança possui boleto ativo e não pode ser alterada nesta etapa.",
      },
      { status: 400 }
    );
  }

  const competenceMonth = Number(payload.competenceMonth);
  const competenceYear = Number(payload.competenceYear);

  if (
    !Number.isInteger(competenceMonth) ||
    competenceMonth < 1 ||
    competenceMonth > 12 ||
    !Number.isInteger(competenceYear) ||
    competenceYear < 2000 ||
    competenceYear > 2100 ||
    !payload.dueDate
  ) {
    return NextResponse.json(
      { message: "Informe competência e vencimento da cobrança." },
      { status: 400 }
    );
  }

  const rentAmountCents = moneyTextToCents(payload.rentAmount);

  if (rentAmountCents <= 0) {
    return NextResponse.json(
      { message: "Informe o valor do aluguel." },
      { status: 400 }
    );
  }

  const additionalItems = (payload.items ?? [])
    .filter((item) => item.type && item.type !== "rent" && item.type !== "discount")
    .map((item) => ({
      type: item.type as RealEstateChargeItemType,
      description: optional(item.description),
      amount_cents: moneyTextToCents(item.amount),
    }))
    .filter((item) => item.amount_cents > 0);

  const invalidItem = additionalItems.find(
    (item) => !chargeItemTypes.includes(item.type)
  );

  if (invalidItem) {
    return NextResponse.json(
      { message: "Existe um item de cobrança inválido." },
      { status: 400 }
    );
  }

  const discountAmountCents = moneyTextToCents(payload.discountAmount);
  const additionalAmountCents = additionalItems.reduce(
    (total, item) => total + item.amount_cents,
    0
  );
  const totalAmountCents = Math.max(
    rentAmountCents + additionalAmountCents - discountAmountCents,
    0
  );

  if (totalAmountCents <= 0) {
    return NextResponse.json(
      { message: "O total da cobrança precisa ser maior que zero." },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("real_estate_charges")
    .update({
      competence_month: competenceMonth,
      competence_year: competenceYear,
      due_date: payload.dueDate,
      rent_amount_cents: rentAmountCents,
      additional_amount_cents: additionalAmountCents,
      discount_amount_cents: discountAmountCents,
      total_amount_cents: totalAmountCents,
      notes: optional(payload.notes),
      updated_at: new Date().toISOString(),
    })
    .eq("id", chargeId);

  if (updateError) {
    const isDuplicate =
      updateError.code === "23505" ||
      updateError.message.toLowerCase().includes("duplicate");

    return NextResponse.json(
      {
        message: isDuplicate
          ? "Já existe uma cobrança para esta competência neste contrato."
          : updateError.message,
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  const { error: deleteItemsError } = await supabase
    .from("real_estate_charge_items")
    .delete()
    .eq("charge_id", chargeId);

  if (deleteItemsError) {
    return NextResponse.json(
      { message: deleteItemsError.message },
      { status: 500 }
    );
  }

  const itemsToInsert = [
    {
      charge_id: chargeId,
      type: "rent" as const,
      description: "Aluguel",
      amount_cents: rentAmountCents,
    },
    ...additionalItems.map((item) => ({
      charge_id: chargeId,
      type: item.type,
      description: item.description,
      amount_cents: item.amount_cents,
    })),
    ...(discountAmountCents > 0
      ? [
          {
            charge_id: chargeId,
            type: "discount" as const,
            description: "Desconto",
            amount_cents: discountAmountCents,
          },
        ]
      : []),
  ];

  const { error: itemsInsertError } = await supabase
    .from("real_estate_charge_items")
    .insert(itemsToInsert);

  if (itemsInsertError) {
    return NextResponse.json(
      { message: itemsInsertError.message },
      { status: 500 }
    );
  }

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-charge:${chargeId}:updated:${Date.now()}`,
    category: "billing",
    type: "real_estate_charge_updated",
    title: "Cobrança atualizada",
    message: `Competência ${String(competenceMonth).padStart(2, "0")}/${competenceYear} atualizada.`,
    severity: "info",
    entityType: "real_estate_charge",
    entityId: chargeId,
    actionHref: `/imobiliaria/${chargeRow.asset_id}/financeiro`,
    metadata: { chargeId, assetId: chargeRow.asset_id },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: ChargeRouteProps
) {
  const { chargeId } = await params;
  const supabase = createAdminClient();
  const { data: charge, error: chargeError } = await supabase
    .from("real_estate_charges")
    .select("id,asset_id,competence_month,competence_year,ticket_status,ticket_provider_status,ticket_error_message,status")
    .eq("id", chargeId)
    .maybeSingle();

  if (chargeError) {
    return NextResponse.json({ message: chargeError.message }, { status: 500 });
  }

  if (!charge) {
    return NextResponse.json(
      { message: "Cobrança não encontrada." },
      { status: 404 }
    );
  }

  const chargeRow = charge as ChargeRow;
  const activeTicket = await getActiveChargeTicket(supabase, chargeId);
  const hasTicketAttempts = await hasChargeTicketAttempts(supabase, chargeId);

  if (activeTicket || hasTicketAttempts || !canDeleteChargeWithoutActiveTicket(chargeRow)) {
    return NextResponse.json(
      {
        message:
          "Esta cobrança não pode ser excluída porque já possui boleto vinculado ou já foi paga. Use o descarte/baixa do boleto quando aplicável.",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("real_estate_charges")
    .delete()
    .eq("id", chargeId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-charge:${chargeId}:deleted:${Date.now()}`,
    category: "billing",
    type: "real_estate_charge_deleted",
    title: "Cobrança excluída",
    message: `Competência ${String(chargeRow.competence_month).padStart(2, "0")}/${
      chargeRow.competence_year
    } excluída.`,
    severity: "warning",
    entityType: "real_estate_charge",
    entityId: chargeId,
    actionHref: `/imobiliaria/${chargeRow.asset_id}/financeiro`,
    metadata: { chargeId, assetId: chargeRow.asset_id },
  });

  return NextResponse.json({ ok: true });
}
