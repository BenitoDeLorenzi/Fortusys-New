import { NextRequest, NextResponse } from "next/server";

import type {
  RealEstateContractDetailsResponse,
  RealEstateContractEvent,
  RealEstateContractEventType,
  RealEstateLease,
  RealEstateLeaseDocumentStatus,
} from "@/features/real-estate/leases";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { withCurrentLandlord } from "@/features/real-estate/server/current-landlord";

type ContractRouteProps = {
  params: Promise<{ id: string }>;
};

type LeaseRow = {
  id: string;
  firestore_id: string | null;
  code: number | null;
  asset_id: string;
  tenant_id: string;
  status: "draft" | "active" | "ended" | "canceled";
  document_status: RealEstateLeaseDocumentStatus;
  contract_number: string | null;
  start_date: string;
  end_date: string;
  payment_due_day: number | null;
  rent_amount_cents: number;
  guarantee_type:
    | "none"
    | "deposit"
    | "guarantor"
    | "insurance"
    | "capitalization";
  guarantee_amount_cents: number | null;
  adjustment_index: "none" | "ipca" | "igpm" | "other";
  next_adjustment_date: string | null;
  guarantor_id: string | null;
  guarantor_name: string | null;
  guarantor_document: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  code: number | null;
  title: string;
  motive: string | null;
  status: string;
  address: string | null;
  landlord_name: string | null;
  landlord_document: string | null;
};

type PayerRow = {
  id: string;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
};

type EventRow = {
  id: string;
  event_type: RealEstateContractEventType;
  title: string;
  description: string | null;
  created_at: string;
};

type PatchPayload = {
  documentStatus?: RealEstateLeaseDocumentStatus;
  status?: "ended";
  endedAt?: string;
  endReason?:
    | "term_finished"
    | "friendly_termination"
    | "default"
    | "property_sale"
    | "tenant_change"
    | "other";
  assetStatusAfterEnd?: "available" | "renovation" | "inactive" | "sold";
  endNotes?: string;
  startDate?: string;
  endDate?: string;
  rentAmount?: string;
  adjustmentIndex?: LeaseRow["adjustment_index"];
  nextAdjustmentDate?: string | null;
};

const documentStatusLabels: Record<RealEstateLeaseDocumentStatus, string> = {
  not_generated: "Minuta não gerada",
  draft_generated: "Minuta gerada",
  pending_signature: "Aguardando assinatura",
  signed: "Contrato assinado",
};

const adjustmentIndexes: LeaseRow["adjustment_index"][] = [
  "none",
  "ipca",
  "igpm",
  "other",
];

const endReasons: NonNullable<PatchPayload["endReason"]>[] = [
  "term_finished",
  "friendly_termination",
  "default",
  "property_sale",
  "tenant_change",
  "other",
];

const endReasonLabels: Record<NonNullable<PatchPayload["endReason"]>, string> = {
  term_finished: "Fim do prazo",
  friendly_termination: "Rescisão amigável",
  default: "Inadimplência",
  property_sale: "Venda do imóvel",
  tenant_change: "Troca de inquilino",
  other: "Outro",
};

const assetStatusesAfterEnd: NonNullable<PatchPayload["assetStatusAfterEnd"]>[] = [
  "available",
  "renovation",
  "inactive",
  "sold",
];

const assetStatusAfterEndLabels: Record<
  NonNullable<PatchPayload["assetStatusAfterEnd"]>,
  string
> = {
  available: "Disponível",
  renovation: "Em reforma",
  inactive: "Inativo",
  sold: "Vendido",
};

function optional(value?: string | null) {
  return value?.trim() || null;
}

function moneyTextToCents(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits ? Number(digits) : 0;
}

function mapLease(row: LeaseRow, tenant: PayerRow, guarantor: PayerRow | null): RealEstateLease {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: tenant.name,
    tenantDocument: tenant.document,
    status: row.status,
    documentStatus: row.document_status,
    contractNumber: row.contract_number,
    startDate: row.start_date,
    endDate: row.end_date,
    paymentDueDay: row.payment_due_day,
    rentAmountCents: row.rent_amount_cents,
    guaranteeType: row.guarantee_type,
    guaranteeAmountCents: row.guarantee_amount_cents,
    guarantorId: row.guarantor_id,
    guarantorName: guarantor?.name ?? row.guarantor_name,
    guarantorDocument: guarantor?.document ?? row.guarantor_document,
    adjustmentIndex: row.adjustment_index,
    nextAdjustmentDate: row.next_adjustment_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): RealEstateContractEvent {
  return {
    id: row.id,
    type: row.event_type,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
  };
}

export async function GET(_request: NextRequest, { params }: ContractRouteProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: lease, error: leaseError } = await supabase
    .from("real_estate_leases")
    .select(
      "id,firestore_id,code,asset_id,tenant_id,status,document_status,contract_number,start_date,end_date,payment_due_day,rent_amount_cents,guarantee_type,guarantee_amount_cents,adjustment_index,next_adjustment_date,guarantor_id,guarantor_name,guarantor_document,notes,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ message: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json(
      { message: "Contrato não encontrado." },
      { status: 404 }
    );
  }

  const leaseRow = lease as LeaseRow;

  const [
    { data: asset, error: assetError },
    { data: tenant, error: tenantError },
    { data: guarantor, error: guarantorError },
    { data: events, error: eventsError },
  ] = await Promise.all([
    supabase
      .from("real_estate_assets")
      .select(
        "id,code,title,motive,status,address,landlord_name,landlord_document"
      )
      .eq("id", leaseRow.asset_id)
      .maybeSingle(),
    supabase
      .from("payers")
      .select("id,name,document,email,phone")
      .eq("id", leaseRow.tenant_id)
      .maybeSingle(),
    leaseRow.guarantor_id
      ? supabase
          .from("payers")
          .select("id,name,document,email,phone")
          .eq("id", leaseRow.guarantor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("real_estate_contract_events")
      .select("id,event_type,title,description,created_at")
      .eq("lease_id", leaseRow.id)
      .order("created_at", { ascending: false }),
  ]);

  const error =
    assetError ?? tenantError ?? guarantorError ?? eventsError ?? null;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (!asset || !tenant) {
    return NextResponse.json(
      { message: "Dados vinculados ao contrato não encontrados." },
      { status: 404 }
    );
  }

  let assetRow: AssetRow;
  try {
    assetRow = await withCurrentLandlord(asset as AssetRow);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível atualizar os dados do cedente." }, { status: 502 });
  }
  const tenantRow = tenant as PayerRow;
  const guarantorRow = guarantor as PayerRow | null;

  return NextResponse.json({
    asset: {
      id: assetRow.id,
      code: assetRow.code,
      title: assetRow.title,
      motive: assetRow.motive,
      status: assetRow.status,
      address: assetRow.address,
      landlordName: assetRow.landlord_name,
      landlordDocument: assetRow.landlord_document,
    },
    lease: mapLease(leaseRow, tenantRow, guarantorRow),
    landlord: {
      name: assetRow.landlord_name,
      document: assetRow.landlord_document,
    },
    tenant: tenantRow,
    guarantor: guarantorRow,
    events: ((events ?? []) as EventRow[]).map(mapEvent),
  } satisfies RealEstateContractDetailsResponse);
}

export async function PATCH(request: NextRequest, { params }: ContractRouteProps) {
  const { id } = await params;
  const payload = (await request.json()) as PatchPayload;
  const updates: Partial<{
    document_status: RealEstateLeaseDocumentStatus;
    status: "ended";
    start_date: string;
    end_date: string;
    rent_amount_cents: number;
    adjustment_index: LeaseRow["adjustment_index"];
    next_adjustment_date: string | null;
  }> = {};

  if (payload.documentStatus) {
    if (!Object.keys(documentStatusLabels).includes(payload.documentStatus)) {
      return NextResponse.json(
        { message: "Status documental inválido." },
        { status: 400 }
      );
    }

    updates.document_status = payload.documentStatus;
  }

  if (payload.startDate !== undefined) {
    if (!payload.startDate) {
      return NextResponse.json(
        { message: "Informe a data inicial." },
        { status: 400 }
      );
    }

    updates.start_date = payload.startDate;
  }

  if (payload.endDate !== undefined) {
    if (!payload.endDate) {
      return NextResponse.json(
        { message: "Informe a data final." },
        { status: 400 }
      );
    }

    updates.end_date = payload.endDate;
  }

  if (
    payload.startDate &&
    payload.endDate &&
    payload.endDate < payload.startDate
  ) {
    return NextResponse.json(
      { message: "A data final deve ser posterior à data inicial." },
      { status: 400 }
    );
  }

  if (payload.rentAmount !== undefined) {
    const rentAmountCents = moneyTextToCents(payload.rentAmount);

    if (rentAmountCents <= 0) {
      return NextResponse.json(
        { message: "Informe o valor do contrato." },
        { status: 400 }
      );
    }

    updates.rent_amount_cents = rentAmountCents;
  }

  if (payload.adjustmentIndex !== undefined) {
    if (!adjustmentIndexes.includes(payload.adjustmentIndex)) {
      return NextResponse.json(
        { message: "Tipo de reajuste inválido." },
        { status: 400 }
      );
    }

    updates.adjustment_index = payload.adjustmentIndex;
  }

  if (payload.nextAdjustmentDate !== undefined) {
    updates.next_adjustment_date = optional(payload.nextAdjustmentDate);
  }

  if (payload.status === "ended") {
    if (!payload.endedAt) {
      return NextResponse.json(
        { message: "Informe a data de encerramento." },
        { status: 400 }
      );
    }

    if (!payload.endReason || !endReasons.includes(payload.endReason)) {
      return NextResponse.json(
        { message: "Informe o motivo do encerramento." },
        { status: 400 }
      );
    }

    if (
      payload.assetStatusAfterEnd &&
      !assetStatusesAfterEnd.includes(payload.assetStatusAfterEnd)
    ) {
      return NextResponse.json(
        { message: "Situação do imóvel após encerramento inválida." },
        { status: 400 }
      );
    }

    updates.status = "ended";
    updates.end_date = payload.endedAt;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { message: "Informe os dados para atualizar o contrato." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: lease, error: leaseError } = await supabase
    .from("real_estate_leases")
    .select("id,asset_id,status,document_status,contract_number")
    .eq("id", id)
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ message: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json(
      { message: "Contrato não encontrado." },
      { status: 404 }
    );
  }

  const leaseRow = lease as {
    id: string;
    asset_id: string;
    status: LeaseRow["status"];
    document_status: RealEstateLeaseDocumentStatus;
    contract_number: string | null;
  };

  if (payload.status === "ended") {
    if (leaseRow.status !== "active") {
      return NextResponse.json(
        { message: "Somente contratos ativos podem ser encerrados." },
        { status: 400 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("real_estate_leases")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  if (payload.status === "ended") {
    const { data: otherActiveLease, error: activeLeaseError } = await supabase
      .from("real_estate_leases")
      .select("id")
      .eq("asset_id", leaseRow.asset_id)
      .eq("status", "active")
      .neq("id", id)
      .limit(1)
      .maybeSingle();

    if (activeLeaseError) {
      return NextResponse.json(
        { message: activeLeaseError.message },
        { status: 500 }
      );
    }

    if (!otherActiveLease) {
      const { error: assetUpdateError } = await supabase
        .from("real_estate_assets")
        .update({
          status: payload.assetStatusAfterEnd ?? "available",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaseRow.asset_id);

      if (assetUpdateError) {
        return NextResponse.json(
          { message: assetUpdateError.message },
          { status: 500 }
        );
      }
    }
  }

  const endReasonLabel = payload.endReason
    ? endReasonLabels[payload.endReason]
    : null;
  const assetStatusLabel = payload.assetStatusAfterEnd
    ? assetStatusAfterEndLabels[payload.assetStatusAfterEnd]
    : assetStatusAfterEndLabels.available;
  const endDescription =
    payload.status === "ended"
      ? [
          `Encerrado em ${payload.endedAt}.`,
          endReasonLabel ? `Motivo: ${endReasonLabel}.` : null,
          `Imóvel marcado como ${assetStatusLabel.toLowerCase()}.`,
          optional(payload.endNotes) ? `Observação: ${optional(payload.endNotes)}.` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

  await supabase.from("real_estate_contract_events").insert({
    asset_id: lease.asset_id,
    lease_id: id,
    event_type: payload.status === "ended" ? "ended" : "updated",
    title: payload.documentStatus
      ? "Status documental atualizado"
      : payload.status === "ended"
        ? "Contrato encerrado"
      : "Contrato atualizado",
    description: payload.documentStatus
      ? `Status alterado para ${documentStatusLabels[payload.documentStatus]}.`
      : payload.status === "ended"
        ? endDescription
      : "Dados do contrato foram atualizados.",
    metadata:
      payload.status === "ended"
        ? {
            endedAt: payload.endedAt,
            endReason: payload.endReason,
            endReasonLabel,
            assetStatusAfterEnd: payload.assetStatusAfterEnd ?? "available",
            assetStatusAfterEndLabel: assetStatusLabel,
            notes: optional(payload.endNotes),
          }
        : {},
  });

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-contract:${id}:${
      payload.status === "ended" ? "ended" : "updated"
    }:${Date.now()}`,
    category: "contract",
    type: payload.status === "ended" ? "contract_ended" : "contract_updated",
    title:
      payload.status === "ended" ? "Contrato encerrado" : "Contrato atualizado",
    message:
      leaseRow.contract_number ??
      `Contrato ${payload.status === "ended" ? "encerrado" : "atualizado"}.`,
    severity: payload.status === "ended" ? "warning" : "info",
    entityType: "real_estate_contract",
    entityId: id,
    actionHref: `/imobiliaria/${leaseRow.asset_id}/contratos`,
    metadata: { leaseId: id, assetId: leaseRow.asset_id },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: ContractRouteProps
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: lease, error: leaseError } = await supabase
    .from("real_estate_leases")
    .select("id,asset_id,status,contract_number")
    .eq("id", id)
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ message: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json(
      { message: "Contrato não encontrado." },
      { status: 404 }
    );
  }

  const leaseRow = lease as {
    id: string;
    asset_id: string;
    status: "draft" | "active" | "ended" | "canceled";
    contract_number: string | null;
  };

  if (leaseRow.status !== "draft") {
    return NextResponse.json(
      {
        message:
          "Somente contratos em preparação podem ser excluídos. Para contratos ativos, use Encerrar contrato.",
      },
      { status: 409 }
    );
  }

  const { error: chargesError } = await supabase
    .from("billing_charges")
    .delete()
    .eq("real_estate_lease_id", leaseRow.id);

  if (chargesError) {
    return NextResponse.json({ message: chargesError.message }, { status: 500 });
  }

  const { error: eventsError } = await supabase
    .from("real_estate_contract_events")
    .delete()
    .eq("lease_id", leaseRow.id);

  if (eventsError) {
    return NextResponse.json({ message: eventsError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("real_estate_leases")
    .delete()
    .eq("id", leaseRow.id);

  if (deleteError) {
    return NextResponse.json({ message: deleteError.message }, { status: 500 });
  }

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-contract:${id}:deleted:${Date.now()}`,
    category: "contract",
    type: "contract_deleted",
    title: "Contrato excluído",
    message: leaseRow.contract_number ?? "Contrato em preparação excluído.",
    severity: "warning",
    entityType: "real_estate_contract",
    entityId: id,
    actionHref: `/imobiliaria/${leaseRow.asset_id}/contratos`,
    metadata: { leaseId: id, assetId: leaseRow.asset_id },
  });

  return NextResponse.json({ ok: true });
}
