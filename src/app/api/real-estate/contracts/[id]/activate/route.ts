import { NextRequest, NextResponse } from "next/server";

import type {
  RealEstateLeaseDocumentStatus,
  RealEstateLeaseStatus,
} from "@/features/real-estate/leases";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

type ActivateRouteProps = {
  params: Promise<{ id: string }>;
};

type LeaseRow = {
  id: string;
  asset_id: string;
  status: RealEstateLeaseStatus;
  document_status: RealEstateLeaseDocumentStatus;
  contract_number: string | null;
};

export async function POST(
  _request: NextRequest,
  { params }: ActivateRouteProps
) {
  const { id } = await params;
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

  const leaseRow = lease as LeaseRow;

  if (leaseRow.status === "active") {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }

  if (leaseRow.status === "ended" || leaseRow.status === "canceled") {
    return NextResponse.json(
      { message: "Somente contratos em preparação podem ser ativados." },
      { status: 400 }
    );
  }

  if (leaseRow.document_status !== "signed") {
    return NextResponse.json(
      {
        message:
          "Para ativar o contrato, marque o documento como assinado primeiro.",
      },
      { status: 400 }
    );
  }

  const { data: activeLease, error: activeLeaseError } = await supabase
    .from("real_estate_leases")
    .select("id,contract_number")
    .eq("asset_id", leaseRow.asset_id)
    .eq("status", "active")
    .neq("id", leaseRow.id)
    .maybeSingle();

  if (activeLeaseError) {
    return NextResponse.json(
      { message: activeLeaseError.message },
      { status: 500 }
    );
  }

  if (activeLease) {
    return NextResponse.json(
      {
        message: `Este imóvel já possui um contrato ativo (${activeLease.contract_number ?? activeLease.id}).`,
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const { error: leaseUpdateError } = await supabase
    .from("real_estate_leases")
    .update({
      status: "active",
      updated_at: now,
    })
    .eq("id", leaseRow.id);

  if (leaseUpdateError) {
    return NextResponse.json(
      { message: leaseUpdateError.message },
      { status: 500 }
    );
  }

  const { error: assetUpdateError } = await supabase
    .from("real_estate_assets")
    .update({
      status: "rented",
      updated_at: now,
    })
    .eq("id", leaseRow.asset_id);

  if (assetUpdateError) {
    return NextResponse.json(
      { message: assetUpdateError.message },
      { status: 500 }
    );
  }

  await supabase.from("real_estate_contract_events").insert({
    asset_id: leaseRow.asset_id,
    lease_id: leaseRow.id,
    event_type: "activated",
    title: "Contrato ativado",
    description:
      "Contrato ativado, imóvel marcado como alugado e fluxo financeiro liberado.",
  });

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-contract:${leaseRow.id}:activated`,
    category: "contract",
    type: "contract_activated",
    title: "Contrato ativado",
    message: leaseRow.contract_number
      ? `${leaseRow.contract_number} ativado.`
      : "Contrato ativado.",
    severity: "success",
    entityType: "real_estate_contract",
    entityId: leaseRow.id,
    actionHref: `/imobiliaria/${leaseRow.asset_id}/contratos`,
    metadata: { leaseId: leaseRow.id, assetId: leaseRow.asset_id },
  });

  return NextResponse.json({ ok: true });
}
