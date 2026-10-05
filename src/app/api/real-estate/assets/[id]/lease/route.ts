import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import type { Database } from "@/features/database/types";
import type {
  RealEstateContractEvent,
  RealEstateContractEventType,
  RealEstateLease,
  RealEstateLeaseAdjustment,
  RealEstateLeaseGuarantee,
  RealEstateLeaseManagementResponse,
  RealEstateLeaseStatus,
} from "@/features/real-estate/leases";
import { createAdminClient } from "@/lib/supabase/admin";

type LeaseRouteContext = {
  params: Promise<{ id: string }>;
};

type LeaseRow = Database["public"]["Tables"]["real_estate_leases"]["Row"];

type ContractEventRow = {
  id: string;
  event_type: RealEstateContractEventType;
  title: string;
  description: string | null;
  created_at: string;
};

type LeasePayload = {
  tenantId?: string;
  status?: RealEstateLeaseStatus;
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  paymentDueDay?: number | null;
  rentAmountCents?: number;
  guaranteeType?: RealEstateLeaseGuarantee;
  guaranteeAmountCents?: number | null;
  guarantorId?: string | null;
  adjustmentIndex?: RealEstateLeaseAdjustment;
  nextAdjustmentDate?: string;
  notes?: string;
};

function optional(value?: string | null) {
  return value?.trim() || null;
}

function moneyTextToCents(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");

  return digits ? Number(digits) : 0;
}

function normalizeMotive(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getEventCopy(
  eventType: RealEstateContractEventType
): Pick<RealEstateContractEvent, "title" | "description"> {
  const copy: Record<
    RealEstateContractEventType,
    Pick<RealEstateContractEvent, "title" | "description">
  > = {
    created: {
      title: "Contrato cadastrado",
      description: "A ficha contratual foi criada para este imóvel.",
    },
    updated: {
      title: "Contrato atualizado",
      description: "Os dados contratuais foram revisados.",
    },
    activated: {
      title: "Contrato ativado",
      description: "A locação foi ativada e o imóvel passou para alugado.",
    },
    ended: {
      title: "Contrato encerrado",
      description: "A locação foi encerrada e o imóvel voltou para disponível.",
    },
    canceled: {
      title: "Contrato cancelado",
      description: "O contrato foi cancelado antes da conclusão do ciclo.",
    },
    renewed: {
      title: "Renovação registrada",
      description: "A renovação do contrato foi registrada no histórico.",
    },
  };

  return copy[eventType];
}

async function getAsset(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_assets")
    .select(
      "id,code,title,motive,status,address,landlord_name,landlord_document,rent_amount,metadata"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const metadata =
    data.metadata &&
    typeof data.metadata === "object" &&
    !Array.isArray(data.metadata)
      ? data.metadata
      : {};
  const metadataMotive =
    "motivo" in metadata && typeof metadata.motivo === "string"
      ? metadata.motivo
      : null;

  return {
    id: data.id,
    code: data.code,
    title: data.title,
    motive: data.motive ?? metadataMotive,
    status: data.status,
    address: data.address,
    landlordName: data.landlord_name,
    landlordDocument: data.landlord_document,
    rentAmount: data.rent_amount,
  };
}

async function mapLease(row: LeaseRow): Promise<RealEstateLease> {
  const supabase = createAdminClient();
  const { data: tenant, error } = await supabase
    .from("payers")
    .select("name,document")
    .eq("id", row.tenant_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const { data: guarantor, error: guarantorError } = row.guarantor_id
    ? await supabase
        .from("payers")
        .select("name,document")
        .eq("id", row.guarantor_id)
        .maybeSingle()
    : { data: null, error: null };

  if (guarantorError) {
    throw new Error(guarantorError.message);
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: tenant?.name ?? "Inquilino não encontrado",
    tenantDocument: tenant?.document ?? "",
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

function mapEvent(row: ContractEventRow): RealEstateContractEvent {
  return {
    id: row.id,
    type: row.event_type,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
  };
}

async function listContractEvents(assetId: string, leaseId?: string | null) {
  const supabase = createAdminClient();
  let query = supabase
    .from("real_estate_contract_events")
    .select("id,event_type,title,description,created_at")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (leaseId) {
    query = query.eq("lease_id", leaseId);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return ((data ?? []) as ContractEventRow[]).map(mapEvent);
}

async function appendContractEvent(input: {
  assetId: string;
  leaseId: string;
  eventType: RealEstateContractEventType;
}) {
  const supabase = createAdminClient();
  const copy = getEventCopy(input.eventType);

  await supabase.from("real_estate_contract_events").insert({
    asset_id: input.assetId,
    lease_id: input.leaseId,
    event_type: input.eventType,
    title: copy.title,
    description: copy.description,
  });
}

async function unauthorizedResponse() {
  return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
}

export async function GET(_request: Request, context: LeaseRouteContext) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const asset = await getAsset(id);

    if (!asset) {
      return NextResponse.json(
        { message: "Imóvel não encontrado." },
        { status: 404 }
      );
    }

    const supabase = createAdminClient();
    const { data: lease, error } = await supabase
      .from("real_estate_leases")
      .select("*")
      .eq("asset_id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      asset,
      lease: lease ? await mapLease(lease) : null,
      events: lease ? await listContractEvents(id, lease.id) : [],
    } satisfies RealEstateLeaseManagementResponse);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o contrato do imóvel.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: LeaseRouteContext) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as LeasePayload;
    const asset = await getAsset(id);

    if (!asset) {
      return NextResponse.json(
        { message: "Imóvel não encontrado." },
        { status: 404 }
      );
    }

    if (!["aluguel", "locacao"].includes(normalizeMotive(asset.motive))) {
      return NextResponse.json(
        { message: "Este imóvel não está configurado para aluguel." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const dueDay =
      payload.paymentDueDay === undefined ||
      payload.paymentDueDay === null ||
      payload.paymentDueDay === 0
        ? null
        : Number(payload.paymentDueDay);
    const { data: existingLeaseForValues } = await supabase
      .from("real_estate_leases")
      .select("rent_amount_cents,payment_due_day")
      .eq("asset_id", id)
      .maybeSingle();
    const rentAmountCents =
      Number(payload.rentAmountCents) > 0
        ? Number(payload.rentAmountCents)
        : existingLeaseForValues?.rent_amount_cents ||
          moneyTextToCents("rentAmount" in asset ? asset.rentAmount : null) ||
          1;

    if (
      !payload.tenantId ||
      !payload.startDate ||
      !payload.endDate ||
      (dueDay !== null &&
        (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) ||
      !Number.isInteger(rentAmountCents) ||
      rentAmountCents <= 0
    ) {
      return NextResponse.json(
        { message: "Preencha os dados obrigatórios do contrato." },
        { status: 400 }
      );
    }

    if (payload.endDate < payload.startDate) {
      return NextResponse.json(
        { message: "O término deve ser posterior ao início do contrato." },
        { status: 400 }
      );
    }

    const status = payload.status ?? "draft";
    const { data: tenant } = await supabase
      .from("payers")
      .select("id,status")
      .eq("id", payload.tenantId)
      .maybeSingle();

    if (!tenant || tenant.status !== "active") {
      return NextResponse.json(
        { message: "Selecione um pagador ativo como inquilino." },
        { status: 400 }
      );
    }

    if (payload.guaranteeType === "guarantor") {
      const { data: guarantor } = await supabase
        .from("payers")
        .select("id,status")
        .eq("id", payload.guarantorId ?? "")
        .maybeSingle();

      if (!guarantor || guarantor.status !== "active") {
        return NextResponse.json(
          { message: "Selecione um cliente ativo como fiador." },
          { status: 400 }
        );
      }
    }

    const { data: existingLease } = await supabase
      .from("real_estate_leases")
      .select("id,status,code,contract_number")
      .eq("asset_id", id)
      .maybeSingle();
    const { data: lastLease, error: lastLeaseError } = !existingLease
      ? await supabase
          .from("real_estate_leases")
          .select("code")
          .not("code", "is", null)
          .order("code", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };

    if (lastLeaseError) {
      throw new Error(lastLeaseError.message);
    }

    const leaseCode =
      existingLease?.code ?? ((lastLease?.code as number | null) ?? 0) + 1;
    const contractNumber =
      existingLease?.contract_number ??
      optional(payload.contractNumber) ??
      `LOC-${new Date().getFullYear()}-${String(leaseCode).padStart(4, "0")}`;

    const { data: lease, error } = await supabase
      .from("real_estate_leases")
      .upsert(
        {
          asset_id: id,
          code: leaseCode,
          tenant_id: payload.tenantId,
          status,
          document_status: "not_generated",
          contract_number: contractNumber,
          start_date: payload.startDate,
          end_date: payload.endDate,
          payment_due_day: dueDay ?? existingLeaseForValues?.payment_due_day ?? null,
          rent_amount_cents: rentAmountCents,
          guarantee_type: payload.guaranteeType ?? "none",
          guarantee_amount_cents:
            payload.guaranteeType === "deposit"
              ? Math.max(Number(payload.guaranteeAmountCents) || 0, 0)
              : null,
          guarantor_id:
            payload.guaranteeType === "guarantor"
              ? payload.guarantorId ?? null
              : null,
          adjustment_index: payload.adjustmentIndex ?? "ipca",
          next_adjustment_date: optional(payload.nextAdjustmentDate),
          notes: optional(payload.notes),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "asset_id" }
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const eventType: RealEstateContractEventType = !existingLease
      ? "created"
      : existingLease.status !== status
        ? status === "active"
          ? "activated"
          : status === "ended"
            ? "ended"
            : status === "canceled"
              ? "canceled"
              : "updated"
        : "updated";

    await appendContractEvent({
      assetId: id,
      leaseId: lease.id,
      eventType,
    });

    const nextAssetStatus =
      status === "active"
        ? "rented"
        : status === "ended" || status === "canceled"
          ? "available"
          : asset.status;

    if (nextAssetStatus !== asset.status) {
      const { error: assetError } = await supabase
        .from("real_estate_assets")
        .update({
          status: nextAssetStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (assetError) {
        throw new Error(assetError.message);
      }
    }

    return NextResponse.json({
      asset: { ...asset, status: nextAssetStatus },
      lease: await mapLease(lease),
      events: await listContractEvents(id, lease.id),
    } satisfies RealEstateLeaseManagementResponse);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o contrato do imóvel.",
      },
      { status: 500 }
    );
  }
}
