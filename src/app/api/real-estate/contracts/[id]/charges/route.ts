import { NextRequest, NextResponse } from "next/server";

import type {
  LocalBillingCharge,
  LocalBillingChargesResponse,
  LocalBillingChargeStatus,
} from "@/features/billing/types";
import type { Json } from "@/features/database/types";
import { createAdminClient } from "@/lib/supabase/admin";

type ChargesRouteProps = {
  params: Promise<{ id: string }>;
};

type LeaseRow = {
  id: string;
  asset_id: string;
  tenant_id: string;
  status: "draft" | "active" | "ended" | "canceled";
  contract_number: string | null;
  start_date: string;
  end_date: string;
  payment_due_day: number | null;
  rent_amount_cents: number;
};

type AssetRow = {
  id: string;
  title: string;
  landlord_name: string | null;
  landlord_document: string | null;
};

type PayerRow = {
  id: string;
  name: string;
  document: string;
};

type ChargeLineItem = {
  key: string;
  label: string;
  amountCents: number;
  description?: string | null;
};

type ChargeRow = {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: LocalBillingChargeStatus;
  charge_type: string;
  installment_number: number | null;
  installment_total: number | null;
  payer_profile_id: string | null;
  assignor_name: string | null;
  assignor_document: string | null;
  provider: "tecnospeed" | null;
  provider_reference: string | null;
  provider_status: string | null;
  provider_error: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

type CreateMonthlyChargePayload = {
  competence?: string;
  dueDate?: string;
  lineItems?: Array<{
    key?: string;
    label?: string;
    amountCents?: number;
    description?: string | null;
  }>;
};

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() < day) {
    next.setDate(0);
  }

  return next;
}

function getMonthDiffInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 +
      end.getMonth() -
      start.getMonth() +
      1
  );
}

function getMonthIndex(startDate: string, competence: string) {
  const start = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
  const current = new Date(`${competence}-01T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) {
    return 1;
  }

  return Math.max(
    1,
    (current.getFullYear() - start.getFullYear()) * 12 +
      current.getMonth() -
      start.getMonth() +
      1
  );
}

function getDueDate(
  startDate: string,
  paymentDueDay: number | null,
  installmentIndex: number
) {
  const start = new Date(`${startDate}T00:00:00`);
  const due = addMonths(start, installmentIndex);

  if (paymentDueDay && paymentDueDay >= 1 && paymentDueDay <= 31) {
    const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
    due.setDate(Math.min(paymentDueDay, lastDay));
  }

  return toDateOnly(due);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatCurrencyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeLineItems(value: unknown): ChargeLineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): ChargeLineItem | null => {
      if (
        !isRecord(item) ||
        typeof item.key !== "string" ||
        typeof item.label !== "string" ||
        typeof item.amountCents !== "number"
      ) {
        return null;
      }

      return {
        key: item.key,
        label: item.label,
        amountCents: item.amountCents,
        description:
          typeof item.description === "string" ? item.description : null,
      };
    })
    .filter((item): item is ChargeLineItem => Boolean(item));
}

function buildTecnospeedMessages(lineItems: ChargeLineItem[]) {
  const lines = lineItems
    .filter((item) => item.amountCents > 0)
    .map(
      (item) =>
        `${item.label}${item.description ? ` (${item.description})` : ""}: ${formatCurrencyFromCents(item.amountCents)}`
    );

  return {
    message1: lines.slice(0, 4).join(" | "),
    message2: lines.slice(4).join(" | "),
  };
}

function getCurrentChargeStatus(row: ChargeRow): LocalBillingChargeStatus {
  if (
    row.status === "paid" ||
    row.status === "canceled" ||
    row.status === "emitted" ||
    row.status === "emission_failed"
  ) {
    return row.status;
  }

  const today = toDateOnly(new Date());
  return row.due_date < today ? "overdue" : row.status;
}

function mapCharge(row: ChargeRow, payer: PayerRow | null): LocalBillingCharge {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const tecnospeedMessages = isRecord(metadata.tecnospeedMessages)
    ? {
        message1:
          typeof metadata.tecnospeedMessages.message1 === "string"
            ? metadata.tecnospeedMessages.message1
            : "",
        message2:
          typeof metadata.tecnospeedMessages.message2 === "string"
            ? metadata.tecnospeedMessages.message2
            : "",
      }
    : null;

  return {
    id: row.id,
    description: row.description,
    amountCents: row.amount_cents,
    dueDate: row.due_date,
    status: getCurrentChargeStatus(row),
    chargeType: row.charge_type,
    installmentNumber: row.installment_number,
    installmentTotal: row.installment_total,
    payerId: row.payer_profile_id,
    payerName: payer?.name ?? null,
    payerDocument: payer?.document ?? null,
    assignorName: row.assignor_name,
    assignorDocument: row.assignor_document,
    provider: row.provider,
    providerReference: row.provider_reference,
    providerStatus: row.provider_status,
    providerError: row.provider_error,
    competence: typeof metadata.competence === "string" ? metadata.competence : null,
    lineItems: normalizeLineItems(metadata.lineItems),
    tecnospeedMessages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getLeaseBundle(id: string) {
  const supabase = createAdminClient();
  const { data: lease, error: leaseError } = await supabase
    .from("real_estate_leases")
    .select(
      "id,asset_id,tenant_id,status,contract_number,start_date,end_date,payment_due_day,rent_amount_cents"
    )
    .eq("id", id)
    .maybeSingle();

  if (leaseError) {
    throw new Error(leaseError.message);
  }

  if (!lease) {
    return null;
  }

  const leaseRow = lease as LeaseRow;
  const [
    { data: asset, error: assetError },
    { data: tenant, error: tenantError },
  ] = await Promise.all([
    supabase
      .from("real_estate_assets")
      .select("id,title,landlord_name,landlord_document")
      .eq("id", leaseRow.asset_id)
      .maybeSingle(),
    supabase
      .from("payers")
      .select("id,name,document")
      .eq("id", leaseRow.tenant_id)
      .maybeSingle(),
  ]);

  const linkedError = assetError ?? tenantError ?? null;

  if (linkedError) {
    throw new Error(linkedError.message);
  }

  if (!asset || !tenant) {
    throw new Error("Dados vinculados ao contrato não encontrados.");
  }

  return {
    lease: leaseRow,
    asset: asset as AssetRow,
    tenant: tenant as PayerRow,
  };
}

async function loadCharges(leaseId: string, tenant: PayerRow) {
  const supabase = createAdminClient();
  const { data: charges, error } = await supabase
    .from("billing_charges")
    .select(
      "id,description,amount_cents,due_date,status,charge_type,installment_number,installment_total,payer_profile_id,assignor_name,assignor_document,provider,provider_reference,provider_status,provider_error,metadata,created_at,updated_at"
    )
    .eq("real_estate_lease_id", leaseId)
    .order("due_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    charges: ((charges ?? []) as ChargeRow[]).map((charge) =>
      mapCharge(charge, tenant)
    ),
    total: charges?.length ?? 0,
  } satisfies LocalBillingChargesResponse;
}

export async function GET(_request: NextRequest, { params }: ChargesRouteProps) {
  const { id } = await params;

  try {
    const bundle = await getLeaseBundle(id);

    if (!bundle) {
      return NextResponse.json(
        { message: "Contrato não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(await loadCharges(id, bundle.tenant));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as cobranças locais.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: ChargesRouteProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  try {
    const bundle = await getLeaseBundle(id);

    if (!bundle) {
      return NextResponse.json(
        { message: "Contrato não encontrado." },
        { status: 404 }
      );
    }

    const { lease, asset, tenant } = bundle;

    if (lease.status !== "active") {
      return NextResponse.json(
        { message: "Ative o contrato antes de gerar a cobrança mensal." },
        { status: 400 }
      );
    }

    const payload = (await request.json().catch(() => ({}))) as
      CreateMonthlyChargePayload;
    const competence = payload.competence?.match(/^\d{4}-\d{2}$/)
      ? payload.competence
      : new Date().toISOString().slice(0, 7);
    const totalInstallments = getMonthDiffInclusive(
      lease.start_date,
      lease.end_date
    );
    const installment = getMonthIndex(lease.start_date, competence);

    if (installment > totalInstallments) {
      return NextResponse.json(
        { message: "A competência informada está fora da vigência do contrato." },
        { status: 400 }
      );
    }

    const extraLineItems = (payload.lineItems ?? [])
      .map((item): ChargeLineItem | null => {
        if (!item.key || !item.label || !item.amountCents) {
          return null;
        }

        return {
          key: item.key,
          label: item.label,
          amountCents: Math.max(0, Math.round(item.amountCents)),
          description: item.description?.trim() || null,
        };
      })
      .filter((item): item is ChargeLineItem => Boolean(item))
      .filter((item) => item.amountCents > 0);
    const lineItems: ChargeLineItem[] = [
      {
        key: "rent",
        label: "Aluguel",
        amountCents: lease.rent_amount_cents,
      },
      ...extraLineItems,
    ];
    const amountCents = lineItems.reduce(
      (total, item) => total + item.amountCents,
      0
    );
    const dueDate =
      payload.dueDate && payload.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)
        ? payload.dueDate
        : getDueDate(lease.start_date, lease.payment_due_day, installment - 1);
    const tecnospeedMessages = buildTecnospeedMessages(lineItems);
    const now = new Date().toISOString();

    const chargePayload = {
      payer_profile_id: tenant.id,
      real_estate_lease_id: lease.id,
      real_estate_asset_id: asset.id,
      assignor_name: asset.landlord_name,
      assignor_document: asset.landlord_document,
      description: `Aluguel ${competence} - ${asset.title}`,
      amount_cents: amountCents,
      due_date: dueDate,
      status: "pending_emission" as const,
      provider: "tecnospeed" as const,
      charge_type: "real_estate_rent" as const,
      installment_number: installment,
      installment_total: totalInstallments,
      issue_date: toDateOnly(new Date()),
      metadata: {
        competence,
        contractNumber: lease.contract_number,
        assetTitle: asset.title,
        tenantName: tenant.name,
        tenantDocument: tenant.document,
        lineItems,
        tecnospeedMessages,
      } satisfies Json,
      updated_at: now,
    };
    const { data: existingCharge, error: existingChargeError } = await supabase
      .from("billing_charges")
      .select("id")
      .eq("real_estate_lease_id", lease.id)
      .eq("charge_type", "real_estate_rent")
      .eq("installment_number", installment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingChargeError) {
      throw new Error(existingChargeError.message);
    }

    if (existingCharge?.id) {
      const { error: updateError } = await supabase
        .from("billing_charges")
        .update(chargePayload)
        .eq("id", existingCharge.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from("billing_charges")
        .insert({
          ...chargePayload,
          created_at: now,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    await supabase.from("real_estate_contract_events").insert({
      asset_id: asset.id,
      lease_id: lease.id,
      event_type: "updated",
      title: existingCharge?.id
        ? "Cobrança mensal atualizada"
        : "Cobrança mensal gerada",
      description: `Competência ${competence} ${existingCharge?.id ? "atualizada" : "criada"} localmente com valor total de ${formatCurrencyFromCents(amountCents)}.`,
    });

    return NextResponse.json(await loadCharges(id, tenant), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar a cobrança mensal.",
      },
      { status: 500 }
    );
  }
}
