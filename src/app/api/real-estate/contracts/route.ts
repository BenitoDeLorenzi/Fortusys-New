import { NextRequest, NextResponse } from "next/server";

import type { Json } from "@/features/database/types";
import {
  REAL_ESTATE_DOCUMENTS_BUCKET,
  type RealEstateDocument,
} from "@/features/real-estate/documents";
import type {
  RealEstateContractEventType,
  RealEstateLeaseAdjustment,
  RealEstateLeaseGuarantee,
  RealEstateLeaseStatus,
} from "@/features/real-estate/leases";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

type ContractPayload = {
  assetId?: string;
  tenantId?: string;
  guarantorId?: string | null;
  startDate?: string;
  endDate?: string;
  rentAmount?: string;
  adjustmentIndex?: RealEstateLeaseAdjustment;
  nextAdjustmentDate?: string;
};

type AssetRow = {
  id: string;
  code?: number | null;
  title?: string;
  address?: string | null;
  status: string;
  motive: string | null;
  rent_amount: string | null;
  landlord_document: string | null;
  documents?: Json;
};

type LeaseListRow = {
  id: string;
  code: number | null;
  asset_id: string;
  tenant_id: string;
  status: RealEstateLeaseStatus;
  document_status: string;
  contract_number: string | null;
  start_date: string;
  end_date: string;
  payment_due_day: number | null;
  rent_amount_cents: number;
  adjustment_index: RealEstateLeaseAdjustment;
  next_adjustment_date: string | null;
  created_at: string;
};

type PayerRow = {
  id: string;
  name: string;
  document: string;
};

type StoredDocument = {
  id: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  leaseId?: string | null;
  scope?: string | null;
  documentType?: string | null;
  templateType?: string | null;
};

function optional(value?: string | null) {
  return value?.trim() || null;
}

function moneyTextToCents(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits ? Number(digits) : 0;
}

function normalizeMotive(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStoredDocuments(value?: Json): StoredDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): StoredDocument | null => {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        typeof item.storagePath !== "string" ||
        typeof item.originalName !== "string" ||
        typeof item.mimeType !== "string" ||
        typeof item.sizeBytes !== "number" ||
        typeof item.createdAt !== "string"
      ) {
        return null;
      }

      return {
        id: item.id,
        storagePath: item.storagePath,
        originalName: item.originalName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        createdAt: item.createdAt,
        leaseId: typeof item.leaseId === "string" ? item.leaseId : null,
        scope: typeof item.scope === "string" ? item.scope : null,
        documentType:
          typeof item.documentType === "string" ? item.documentType : null,
        templateType:
          typeof item.templateType === "string" ? item.templateType : null,
      };
    })
    .filter((document): document is StoredDocument => Boolean(document));
}

async function mapDocument(document: StoredDocument): Promise<RealEstateDocument> {
  const supabase = createAdminClient();
  const [{ data: viewData }, { data: downloadData }] = await Promise.all([
    supabase.storage
      .from(REAL_ESTATE_DOCUMENTS_BUCKET)
      .createSignedUrl(document.storagePath, 60 * 60),
    supabase.storage
      .from(REAL_ESTATE_DOCUMENTS_BUCKET)
      .createSignedUrl(document.storagePath, 60 * 60, {
        download: document.originalName,
      }),
  ]);

  return {
    id: document.id,
    url: viewData?.signedUrl ?? "",
    downloadUrl: downloadData?.signedUrl ?? "",
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt,
    leaseId: document.leaseId ?? null,
    scope: document.scope ?? null,
    documentType: document.documentType ?? null,
    templateType: document.templateType ?? null,
  };
}

export async function GET(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get("assetId")?.trim();
  const supabase = createAdminClient();

  if (!assetId) {
    return NextResponse.json(
      { message: "Informe o imóvel para listar os contratos." },
      { status: 400 }
    );
  }

  const { data: asset, error: assetError } = await supabase
    .from("real_estate_assets")
    .select("id,code,title,address,status,motive,rent_amount,landlord_document,documents")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) {
    return NextResponse.json({ message: assetError.message }, { status: 500 });
  }

  if (!asset) {
    return NextResponse.json(
      { message: "Imóvel não encontrado." },
      { status: 404 }
    );
  }

  const assetRow = asset as AssetRow;
  const { data: leasesData, error: leasesError } = await supabase
    .from("real_estate_leases")
    .select(
      "id,code,asset_id,tenant_id,status,document_status,contract_number,start_date,end_date,payment_due_day,rent_amount_cents,adjustment_index,next_adjustment_date,created_at"
    )
    .eq("asset_id", assetId)
    .order("code", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (leasesError) {
    return NextResponse.json({ message: leasesError.message }, { status: 500 });
  }

  const leases = (leasesData ?? []) as LeaseListRow[];
  const tenantIds = Array.from(new Set(leases.map((lease) => lease.tenant_id)));
  const { data: payersData, error: payersError } = tenantIds.length
    ? await supabase
        .from("payers")
        .select("id,name,document")
        .in("id", tenantIds)
    : { data: [], error: null };

  if (payersError) {
    return NextResponse.json({ message: payersError.message }, { status: 500 });
  }

  const payerById = new Map(
    ((payersData ?? []) as PayerRow[]).map((payer) => [payer.id, payer])
  );
  const documentsByLeaseId = new Map<string, RealEstateDocument[]>();
  const contractDocuments = normalizeStoredDocuments(assetRow.documents).filter(
    (document) => document.scope === "contract" && document.leaseId
  );

  await Promise.all(
    contractDocuments.map(async (document) => {
      if (!document.leaseId) {
        return;
      }

      const mappedDocument = await mapDocument(document);
      documentsByLeaseId.set(document.leaseId, [
        mappedDocument,
        ...(documentsByLeaseId.get(document.leaseId) ?? []),
      ]);
    })
  );

  return NextResponse.json({
    asset: {
      id: assetRow.id,
      code: assetRow.code ?? null,
      title: assetRow.title ?? "Imóvel",
      address: assetRow.address ?? null,
      status: assetRow.status,
      motive: assetRow.motive,
      rentAmount: assetRow.rent_amount,
    },
    contracts: leases.map((lease) => {
      const tenant = payerById.get(lease.tenant_id);

      return {
        id: lease.id,
        code: lease.code,
        contractNumber: lease.contract_number,
        status: lease.status,
        documentStatus: lease.document_status,
        tenantName: tenant?.name ?? "Cliente não encontrado",
        tenantDocument: tenant?.document ?? "",
        startDate: lease.start_date,
        endDate: lease.end_date,
        paymentDueDay: lease.payment_due_day,
        rentAmountCents: lease.rent_amount_cents,
        adjustmentIndex: lease.adjustment_index,
        nextAdjustmentDate: lease.next_adjustment_date,
        documents: (documentsByLeaseId.get(lease.id) ?? []).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        ),
        createdAt: lease.created_at,
      };
    }),
  });
}

function getContractEventPresentation(
  eventType: RealEstateContractEventType
): { title: string; description: string } {
  const presentations: Record<
    RealEstateContractEventType,
    { title: string; description: string }
  > = {
    created: {
      title: "Contrato criado",
      description: "Contrato cadastrado pela gestão imobiliária.",
    },
    updated: {
      title: "Contrato atualizado",
      description: "Dados do contrato foram revisados.",
    },
    activated: {
      title: "Contrato ativado",
      description: "Contrato ativado e imóvel marcado como alugado.",
    },
    ended: {
      title: "Contrato encerrado",
      description: "Contrato encerrado e imóvel liberado.",
    },
    canceled: {
      title: "Contrato cancelado",
      description: "Contrato cancelado.",
    },
    renewed: {
      title: "Contrato renovado",
      description: "Contrato renovado.",
    },
  };

  return presentations[eventType];
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as ContractPayload;
  const supabase = createAdminClient();

  if (!payload.assetId || !payload.tenantId || !payload.startDate || !payload.endDate) {
    return NextResponse.json(
      { message: "Preencha imóvel, cliente e duração do contrato." },
      { status: 400 }
    );
  }

  if (payload.endDate < payload.startDate) {
    return NextResponse.json(
      { message: "A data final deve ser posterior à data inicial." },
      { status: 400 }
    );
  }

  const rentAmountCents = moneyTextToCents(payload.rentAmount);

  if (rentAmountCents <= 0) {
    return NextResponse.json(
      { message: "Informe o valor do contrato." },
      { status: 400 }
    );
  }

  const { data: asset, error: assetError } = await supabase
    .from("real_estate_assets")
    .select("id,status,motive,rent_amount,landlord_document")
    .eq("id", payload.assetId)
    .maybeSingle();

  if (assetError) {
    return NextResponse.json({ message: assetError.message }, { status: 500 });
  }

  if (!asset) {
    return NextResponse.json(
      { message: "Imóvel não encontrado." },
      { status: 404 }
    );
  }

  const assetRow = asset as AssetRow;

  if (!["aluguel", "locacao"].includes(normalizeMotive(assetRow.motive))) {
    return NextResponse.json(
      { message: "Somente imóveis de aluguel podem receber contrato de locação." },
      { status: 400 }
    );
  }

  const { data: activeLease, error: activeLeaseError } = await supabase
    .from("real_estate_leases")
    .select("id,contract_number")
    .eq("asset_id", payload.assetId)
    .eq("status", "active")
    .maybeSingle();

  if (activeLeaseError) {
    return NextResponse.json({ message: activeLeaseError.message }, { status: 500 });
  }

  if (activeLease) {
    return NextResponse.json(
      {
        message:
          "Este imóvel já possui um contrato ativo. Encerre o contrato atual antes de criar outro.",
      },
      { status: 409 }
    );
  }

  const { data: tenant } = await supabase
    .from("payers")
    .select("id,status")
    .eq("id", payload.tenantId)
    .maybeSingle();

  if (!tenant || tenant.status !== "active") {
    return NextResponse.json(
      { message: "Selecione um cliente ativo." },
      { status: 400 }
    );
  }

  if (payload.guarantorId) {
    const { data: guarantor } = await supabase
      .from("payers")
      .select("id,status")
      .eq("id", payload.guarantorId)
      .maybeSingle();

    if (!guarantor || guarantor.status !== "active") {
      return NextResponse.json(
        { message: "Selecione um fiador ativo." },
        { status: 400 }
      );
    }
  }

  const { data: lastLease, error: lastLeaseError } = await supabase
    .from("real_estate_leases")
    .select("code")
    .not("code", "is", null)
    .order("code", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastLeaseError) {
    return NextResponse.json({ message: lastLeaseError.message }, { status: 500 });
  }

  const leaseCode = ((lastLease?.code as number | null) ?? 0) + 1;
  const status: RealEstateLeaseStatus = "draft";
  const guaranteeType: RealEstateLeaseGuarantee = payload.guarantorId
    ? "guarantor"
    : "none";
  const eventType: RealEstateContractEventType = "created";

  const { data: lease, error: leaseError } = await supabase
    .from("real_estate_leases")
    .insert({
      asset_id: payload.assetId,
      code: leaseCode,
      tenant_id: payload.tenantId,
      status,
      document_status: "not_generated",
      contract_number: `LOC-${new Date().getFullYear()}-${String(leaseCode).padStart(4, "0")}`,
      start_date: payload.startDate,
      end_date: payload.endDate,
      payment_due_day: null,
      rent_amount_cents: rentAmountCents,
      guarantee_type: guaranteeType,
      guarantee_amount_cents: null,
      guarantor_id: payload.guarantorId || null,
      adjustment_index: payload.adjustmentIndex ?? "ipca",
      next_adjustment_date: optional(payload.nextAdjustmentDate),
      notes: null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (leaseError) {
    return NextResponse.json({ message: leaseError.message }, { status: 500 });
  }

  const eventPresentation = getContractEventPresentation(eventType);

  await supabase.from("real_estate_contract_events").insert({
    asset_id: payload.assetId,
    lease_id: lease.id,
    event_type: eventType,
    title: eventPresentation.title,
    description: eventPresentation.description,
  });

  if (moneyTextToCents(assetRow.rent_amount) !== rentAmountCents) {
    await supabase
      .from("real_estate_assets")
      .update({
        rent_amount: payload.rentAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.assetId);
  }

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-contract:${lease.id}:created`,
    category: "contract",
    type: "contract_created",
    title: "Contrato criado",
    message: `Contrato ${`LOC-${new Date().getFullYear()}-${String(leaseCode).padStart(4, "0")}`} criado para o imóvel.`,
    severity: "info",
    entityType: "real_estate_contract",
    entityId: lease.id,
    actionHref: `/imobiliaria/${payload.assetId}/contratos`,
    metadata: { leaseId: lease.id, assetId: payload.assetId, code: leaseCode },
  });

  return NextResponse.json({ id: lease.id }, { status: 201 });
}
