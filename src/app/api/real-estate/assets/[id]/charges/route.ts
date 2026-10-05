import { NextRequest, NextResponse } from "next/server";

import type {
  RealEstateCharge,
  RealEstateChargeItem,
  RealEstateChargeItemType,
  RealEstateChargesResponse,
} from "@/features/real-estate/charges";
import {
  createEventNotification,
  createInternalActionNotification,
} from "@/features/notifications/server/notification-service";
import { tecnospeedRequest } from "@/features/integrations/tecnospeed/server/client";
import {
  isProviderActiveTicketStatus,
  isProviderDischargedStatus,
} from "@/features/real-estate/server/charge-tickets";
import { createAdminClient } from "@/lib/supabase/admin";

type ChargesRouteProps = {
  params: Promise<{ id: string }>;
};

type AssetRow = {
  id: string;
  code: number | null;
  title: string | null;
  address: string | null;
  status: string;
  landlord_document: string | null;
};

type LeaseRow = {
  id: string;
  code: number | null;
  contract_number: string | null;
  tenant_id: string;
  payment_due_day: number | null;
  rent_amount_cents: number;
};

type PayerRow = {
  id: string;
  name: string;
  document: string;
  phone: string | null;
};

type ChargeRow = {
  id: string;
  asset_id: string;
  lease_id: string;
  tenant_id: string;
  competence_month: number;
  competence_year: number;
  due_date: string;
  rent_amount_cents: number;
  additional_amount_cents: number;
  discount_amount_cents: number;
  total_amount_cents: number;
  status: RealEstateCharge["status"];
  ticket_status: RealEstateCharge["ticketStatus"];
  ticket_integration_id: string | null;
  ticket_assignor_document: string | null;
  ticket_provider_status: string | null;
  ticket_document_number: string | null;
  ticket_our_number: string | null;
  ticket_url: string | null;
  ticket_digitable_line: string | null;
  ticket_pix_url: string | null;
  ticket_error_message: string | null;
  notes: string | null;
  created_at: string;
};

type ChargeItemRow = {
  id: string;
  charge_id: string;
  type: RealEstateChargeItemType;
  description: string | null;
  amount_cents: number;
};

type ChargeTicketSummaryRow = {
  charge_id: string;
};

type CreateChargePayload = {
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

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function moneyTextToCents(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits ? Number(digits) : 0;
}

function getStringField(source: Record<string, unknown>, names: string[]) {
  const normalizedEntries = Object.entries(source).map(([key, value]) => [
    key.toLowerCase().replace(/[^a-z0-9]/g, ""),
    value,
  ]);

  for (const name of names) {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const entry = normalizedEntries.find(([key]) => key === normalizedName);

    if (entry && entry[1] !== undefined && entry[1] !== null) {
      return String(entry[1]);
    }
  }

  return "";
}

function normalizeTicketsPayload(data: unknown): Record<string, unknown>[] {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => {
      return Boolean(item) && typeof item === "object" && !Array.isArray(item);
    });
  }

  if (typeof data === "object") {
    return [data as Record<string, unknown>];
  }

  return [];
}

function normalizeStatus(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mapRealEstateTicketStatus(
  status?: string | null
): ChargeRow["ticket_status"] | null {
  const normalized = normalizeStatus(status);

  if (
    normalized.includes("rejeit") ||
    normalized.includes("falh") ||
    normalized.includes("erro")
  ) {
    return "failed";
  }

  if (
    normalized.includes("baix") ||
    normalized.includes("cancel") ||
    normalized.includes("descart")
  ) {
    return "canceled";
  }

  if (
    normalized.includes("registr") ||
    normalized.includes("emit") ||
    normalized.includes("salv") ||
    normalized.includes("liquid") ||
    normalized.includes("pago") ||
    normalized.includes("venc") ||
    normalized.includes("cartorio") ||
    normalized.includes("protest")
  ) {
    return "registered";
  }

  return null;
}

function isPaidStatus(status?: string | null) {
  const normalized = normalizeStatus(status);
  return normalized.includes("liquid") || normalized.includes("pago");
}

function getTicketStatusNotificationTitle(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized.includes("baix")) {
    return "Boleto baixado";
  }

  if (normalized.includes("liquid") || normalized.includes("pago")) {
    return "Boleto liquidado";
  }

  if (normalized.includes("falh") || normalized.includes("rejeit")) {
    return "Boleto com falha";
  }

  if (normalized.includes("venc")) {
    return "Boleto vencido";
  }

  if (normalized.includes("registr")) {
    return "Boleto registrado";
  }

  return "Status do boleto atualizado";
}

function getTicketStatusNotificationSeverity(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (
    normalized.includes("falh") ||
    normalized.includes("rejeit") ||
    normalized.includes("venc")
  ) {
    return "danger" as const;
  }

  if (normalized.includes("liquid") || normalized.includes("pago")) {
    return "success" as const;
  }

  if (normalized.includes("baix")) {
    return "warning" as const;
  }

  return "info" as const;
}

function mapItem(row: ChargeItemRow): RealEstateChargeItem {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    amountCents: row.amount_cents,
  };
}

function mapCharge(
  row: ChargeRow,
  tenant: PayerRow | undefined,
  lease: LeaseRow | undefined,
  items: RealEstateChargeItem[],
  hasTicketAttempts: boolean
): RealEstateCharge {
  return {
    id: row.id,
    assetId: row.asset_id,
    leaseId: row.lease_id,
    tenantId: row.tenant_id,
    tenantName: tenant?.name ?? "Cliente não encontrado",
    tenantDocument: tenant?.document ?? "",
    tenantPhone: tenant?.phone ?? null,
    contractNumber: lease?.contract_number ?? null,
    contractCode: lease?.code ?? null,
    competenceMonth: row.competence_month,
    competenceYear: row.competence_year,
    dueDate: row.due_date,
    rentAmountCents: row.rent_amount_cents,
    additionalAmountCents: row.additional_amount_cents,
    discountAmountCents: row.discount_amount_cents,
    totalAmountCents: row.total_amount_cents,
    status: row.status,
    ticketStatus: row.ticket_status,
    ticketProviderStatus: row.ticket_provider_status,
    ticketIntegrationId: row.ticket_integration_id,
    ticketAssignorDocument: row.ticket_assignor_document,
    ticketDocumentNumber: row.ticket_document_number,
    ticketOurNumber: row.ticket_our_number,
    ticketUrl: row.ticket_url,
    ticketDigitableLine: row.ticket_digitable_line,
    ticketPixUrl: row.ticket_pix_url,
    ticketErrorMessage: row.ticket_error_message,
    hasTicketAttempts,
    notes: row.notes,
    items,
    createdAt: row.created_at,
  };
}

async function getAssetOrResponse(assetId: string) {
  const supabase = createAdminClient();
  const { data: asset, error } = await supabase
    .from("real_estate_assets")
    .select("id,code,title,address,status,landlord_document")
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ message: error.message }, { status: 500 }) };
  }

  if (!asset) {
    return {
      response: NextResponse.json(
        { message: "Imóvel não encontrado." },
        { status: 404 }
      ),
    };
  }

  return { asset: asset as AssetRow };
}

async function loadLiveTicketStatuses(
  assignorDocument: string,
  integrationIds: string[]
) {
  if (!assignorDocument || integrationIds.length === 0) {
    return new Map<string, string>();
  }

  try {
    const query = new URLSearchParams({
      limit: "1000",
      sort: "-TituloDataEmissao",
    });
    const response = await tecnospeedRequest<{
      _status?: "sucesso" | "erro";
      _dados?: unknown;
    }>({
      path: `/boletos?${query.toString()}`,
      headers: {
        "cnpj-cedente": assignorDocument,
      },
    });

    if (response._status === "erro") {
      return new Map<string, string>();
    }

    const wantedIds = new Set(integrationIds);
    const statuses = new Map<string, string>();

    for (const ticket of normalizeTicketsPayload(response._dados)) {
      const integrationId = getStringField(ticket, [
        "IdIntegracao",
        "idintegracao",
        "id",
      ]);
      const status = getStringField(ticket, ["situacao", "Situacao"]);

      if (wantedIds.has(integrationId) && status) {
        statuses.set(integrationId, status);
      }
    }

    return statuses;
  } catch {
    return new Map<string, string>();
  }
}

async function syncChargesWithTicketStatus(
  supabase: ReturnType<typeof createAdminClient>,
  asset: AssetRow,
  charges: ChargeRow[]
) {
  const integrationIds = charges
    .map((charge) => charge.ticket_integration_id)
    .filter((value): value is string => Boolean(value));

  if (integrationIds.length === 0) {
    return charges;
  }

  const { data: cacheData } = await supabase
    .from("billing_ticket_status_cache")
    .select("integration_id,status")
    .in("integration_id", integrationIds);

  const statusByIntegrationId = new Map(
    (cacheData ?? []).map((item) => [item.integration_id, item.status])
  );
  const missingLiveIds = integrationIds.filter((id) => !statusByIntegrationId.get(id));
  const liveStatuses = await loadLiveTicketStatuses(
    onlyDigits(asset.landlord_document),
    missingLiveIds
  );

  for (const [integrationId, status] of liveStatuses) {
    statusByIntegrationId.set(integrationId, status);
  }

  const now = new Date().toISOString();

  await Promise.all(
    charges.map(async (charge) => {
      if (!charge.ticket_integration_id) {
        return;
      }

      const providerStatus = statusByIntegrationId.get(charge.ticket_integration_id);
      const mappedStatus = mapRealEstateTicketStatus(providerStatus);

      if (!providerStatus && !mappedStatus) {
        return;
      }

      const nextTicketStatus = mappedStatus ?? charge.ticket_status;
      const nextChargeStatus = isPaidStatus(providerStatus)
        ? "paid"
        : isProviderDischargedStatus(providerStatus)
          ? "canceled"
          : charge.status;

      if (
        charge.ticket_provider_status === providerStatus &&
        charge.ticket_status === nextTicketStatus &&
        charge.status === nextChargeStatus
      ) {
        return;
      }

      const { error } = await supabase
        .from("real_estate_charges")
        .update({
          ticket_provider_status: providerStatus,
          ticket_status: nextTicketStatus,
          status: nextChargeStatus,
          updated_at: now,
        })
        .eq("id", charge.id);

      if (!error) {
        await supabase
          .from("real_estate_charge_tickets")
          .update({
            provider_status: providerStatus,
            ticket_status: nextTicketStatus,
            is_active: isProviderActiveTicketStatus(providerStatus),
            updated_at: now,
          })
          .eq("integration_id", charge.ticket_integration_id);

        charge.ticket_provider_status = providerStatus ?? null;
        charge.ticket_status = nextTicketStatus;
        charge.status = nextChargeStatus;

        if (providerStatus) {
          const competence = `${String(charge.competence_month).padStart(
            2,
            "0"
          )}/${charge.competence_year}`;
          const assetTitle = `${asset.code ? `${asset.code} · ` : ""}${
            asset.title ?? "Imóvel"
          }`;

          await createEventNotification(supabase, {
            sourceKey: `tecnospeed:${charge.ticket_integration_id}:${providerStatus}`,
            category: "billing",
            type: "ticket_status",
            title: getTicketStatusNotificationTitle(providerStatus),
            message: `${assetTitle} · Competência ${competence} · ${providerStatus}`,
            severity: getTicketStatusNotificationSeverity(providerStatus),
            entityType: "real_estate_charge",
            entityId: charge.id,
            actionHref: `/imobiliaria/${asset.id}/financeiro`,
            metadata: {
              integrationId: charge.ticket_integration_id,
              status: providerStatus,
              provider: "tecnospeed",
              source: "finance_sync",
            },
            notifyActiveUsers: true,
          });
        }
      }
    })
  );

  return charges;
}

export async function GET(_request: NextRequest, { params }: ChargesRouteProps) {
  const { id: assetId } = await params;
  const supabase = createAdminClient();
  const assetResult = await getAssetOrResponse(assetId);

  if (assetResult.response) {
    return assetResult.response;
  }

  const asset = assetResult.asset;
  const { data: leasesData, error: leasesError } = await supabase
    .from("real_estate_leases")
    .select("id,code,contract_number,tenant_id,payment_due_day,rent_amount_cents")
    .eq("asset_id", assetId)
    .in("status", ["active"])
    .order("created_at", { ascending: false });

  if (leasesError) {
    return NextResponse.json({ message: leasesError.message }, { status: 500 });
  }

  const activeContract = ((leasesData ?? []) as LeaseRow[])[0] ?? null;
  const { data: chargesData, error: chargesError } = await supabase
    .from("real_estate_charges")
    .select(
      "id,asset_id,lease_id,tenant_id,competence_month,competence_year,due_date,rent_amount_cents,additional_amount_cents,discount_amount_cents,total_amount_cents,status,ticket_status,ticket_integration_id,ticket_assignor_document,ticket_provider_status,ticket_document_number,ticket_our_number,ticket_url,ticket_digitable_line,ticket_pix_url,ticket_error_message,notes,created_at"
    )
    .eq("asset_id", assetId)
    .order("competence_year", { ascending: false })
    .order("competence_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (chargesError) {
    return NextResponse.json({ message: chargesError.message }, { status: 500 });
  }

  const charges = await syncChargesWithTicketStatus(
    supabase,
    asset,
    (chargesData ?? []) as ChargeRow[]
  );
  const tenantIds = Array.from(
    new Set([
      ...charges.map((charge) => charge.tenant_id),
      ...(activeContract ? [activeContract.tenant_id] : []),
    ])
  );
  const leaseIds = Array.from(new Set(charges.map((charge) => charge.lease_id)));
  const chargeIds = charges.map((charge) => charge.id);

  const [
    { data: payersData, error: payersError },
    { data: leasesListData, error: leasesListError },
    { data: itemsData, error: itemsError },
    { data: ticketsData, error: ticketsError },
  ] = await Promise.all([
    tenantIds.length
      ? supabase.from("payers").select("id,name,document,phone").in("id", tenantIds)
      : Promise.resolve({ data: [], error: null }),
    leaseIds.length
      ? supabase
          .from("real_estate_leases")
          .select("id,code,contract_number,tenant_id,payment_due_day,rent_amount_cents")
          .in("id", leaseIds)
      : Promise.resolve({ data: [], error: null }),
    chargeIds.length
      ? supabase
          .from("real_estate_charge_items")
          .select("id,charge_id,type,description,amount_cents")
          .in("charge_id", chargeIds)
      : Promise.resolve({ data: [], error: null }),
    chargeIds.length
      ? supabase
          .from("real_estate_charge_tickets")
          .select("charge_id")
          .in("charge_id", chargeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const linkedError = payersError ?? leasesListError ?? itemsError ?? ticketsError;

  if (linkedError) {
    return NextResponse.json({ message: linkedError.message }, { status: 500 });
  }

  const payerById = new Map(
    ((payersData ?? []) as PayerRow[]).map((payer) => [payer.id, payer])
  );
  const leaseById = new Map(
    ((leasesListData ?? []) as LeaseRow[]).map((lease) => [lease.id, lease])
  );
  const itemsByChargeId = new Map<string, RealEstateChargeItem[]>();
  const chargeIdsWithTickets = new Set(
    ((ticketsData ?? []) as ChargeTicketSummaryRow[]).map(
      (ticket) => ticket.charge_id
    )
  );

  ((itemsData ?? []) as ChargeItemRow[]).forEach((item) => {
    itemsByChargeId.set(item.charge_id, [
      ...(itemsByChargeId.get(item.charge_id) ?? []),
      mapItem(item),
    ]);
  });

  const activeTenant = activeContract
    ? payerById.get(activeContract.tenant_id)
    : undefined;

  return NextResponse.json({
    asset: {
      id: asset.id,
      code: asset.code,
      title: asset.title ?? "Imóvel",
      address: asset.address,
      status: asset.status,
    },
    activeContract: activeContract
      ? {
          id: activeContract.id,
          code: activeContract.code,
          contractNumber: activeContract.contract_number,
          tenantId: activeContract.tenant_id,
          tenantName: activeTenant?.name ?? "Cliente não encontrado",
          tenantDocument: activeTenant?.document ?? "",
          paymentDueDay: activeContract.payment_due_day,
          rentAmountCents: activeContract.rent_amount_cents,
        }
      : null,
    charges: charges.map((charge) =>
      mapCharge(
        charge,
        payerById.get(charge.tenant_id),
        leaseById.get(charge.lease_id),
        itemsByChargeId.get(charge.id) ?? [],
        chargeIdsWithTickets.has(charge.id)
      )
    ),
  } satisfies RealEstateChargesResponse);
}

export async function POST(request: NextRequest, { params }: ChargesRouteProps) {
  const { id: assetId } = await params;
  const payload = (await request.json()) as CreateChargePayload;
  const supabase = createAdminClient();
  const assetResult = await getAssetOrResponse(assetId);

  if (assetResult.response) {
    return assetResult.response;
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

  const { data: lease, error: leaseError } = await supabase
    .from("real_estate_leases")
    .select("id,code,contract_number,tenant_id,payment_due_day,rent_amount_cents")
    .eq("asset_id", assetId)
    .eq("status", "active")
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ message: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json(
      { message: "Este imóvel não possui contrato ativo para gerar cobrança." },
      { status: 400 }
    );
  }

  const leaseRow = lease as LeaseRow;
  const rentAmountCents =
    payload.rentAmount !== undefined
      ? moneyTextToCents(payload.rentAmount)
      : leaseRow.rent_amount_cents;

  if (rentAmountCents <= 0) {
    return NextResponse.json(
      { message: "Informe o valor do aluguel." },
      { status: 400 }
    );
  }

  const rawItems = payload.items ?? [];
  const additionalItems = rawItems
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

  const { data: charge, error: chargeError } = await supabase
    .from("real_estate_charges")
    .insert({
      asset_id: assetId,
      lease_id: leaseRow.id,
      tenant_id: leaseRow.tenant_id,
      competence_month: competenceMonth,
      competence_year: competenceYear,
      due_date: payload.dueDate,
      rent_amount_cents: rentAmountCents,
      additional_amount_cents: additionalAmountCents,
      discount_amount_cents: discountAmountCents,
      total_amount_cents: totalAmountCents,
      status: "open",
      ticket_status: "not_generated",
      notes: optional(payload.notes),
    })
    .select("id")
    .single();

  if (chargeError) {
    const isDuplicate =
      chargeError.code === "23505" ||
      chargeError.message.toLowerCase().includes("duplicate");

    return NextResponse.json(
      {
        message: isDuplicate
          ? "Já existe uma cobrança para esta competência neste contrato."
          : chargeError.message,
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  const itemsToInsert = [
    {
      charge_id: charge.id,
      type: "rent" as const,
      description: "Aluguel",
      amount_cents: rentAmountCents,
    },
    ...additionalItems.map((item) => ({
      charge_id: charge.id,
      type: item.type,
      description: item.description,
      amount_cents: item.amount_cents,
    })),
    ...(discountAmountCents > 0
      ? [
          {
            charge_id: charge.id,
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
    sourceKey: `real-estate-charge:${charge.id}:created`,
    category: "billing",
    type: "real_estate_charge_created",
    title: "Cobrança criada",
    message: `${assetResult.asset.code ? `${assetResult.asset.code} · ` : ""}${
      assetResult.asset.title ?? "Imóvel"
    } · Competência ${String(competenceMonth).padStart(2, "0")}/${competenceYear}`,
    severity: "info",
    entityType: "real_estate_charge",
    entityId: charge.id,
    actionHref: `/imobiliaria/${assetId}/financeiro`,
    metadata: { chargeId: charge.id, assetId, competenceMonth, competenceYear },
  });

  return NextResponse.json({ id: charge.id }, { status: 201 });
}
