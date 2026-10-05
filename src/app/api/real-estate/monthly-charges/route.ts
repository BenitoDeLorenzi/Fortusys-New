import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import type { Database } from "@/features/database/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import type {
  RealEstateMonthlyChargePreviewItem,
  RealEstateMonthlyChargesPreviewResponse,
} from "@/features/real-estate/monthly-charges";
import { createAdminClient } from "@/lib/supabase/admin";

type LeaseRow = Pick<
  Database["public"]["Tables"]["real_estate_leases"]["Row"],
  | "id"
  | "asset_id"
  | "tenant_id"
  | "status"
  | "contract_number"
  | "start_date"
  | "end_date"
  | "payment_due_day"
  | "rent_amount_cents"
  | "created_at"
>;

type AssetRow = Pick<
  Database["public"]["Tables"]["real_estate_assets"]["Row"],
  "id" | "code" | "title" | "landlord_document"
>;

type PayerRow = Pick<
  Database["public"]["Tables"]["payers"]["Row"],
  "id" | "name" | "document"
>;

type ChargeRow = Pick<
  Database["public"]["Tables"]["real_estate_charges"]["Row"],
  | "id"
  | "lease_id"
  | "status"
  | "ticket_status"
  | "ticket_provider_status"
  | "due_date"
  | "total_amount_cents"
  | "created_at"
>;

type CreateMonthlyChargePayload = {
  leaseId?: string;
  competenceMonth?: number;
  competenceYear?: number;
  dueDate?: string;
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function parseCompetence(searchParams: URLSearchParams) {
  const now = new Date();
  const competenceMonth = Number(
    searchParams.get("month") ?? now.getMonth() + 1
  );
  const competenceYear = Number(searchParams.get("year") ?? now.getFullYear());

  if (
    !Number.isInteger(competenceMonth) ||
    competenceMonth < 1 ||
    competenceMonth > 12 ||
    !Number.isInteger(competenceYear) ||
    competenceYear < 2000 ||
    competenceYear > 2100
  ) {
    return null;
  }

  return { competenceMonth, competenceYear };
}

function validateCompetence(month: unknown, year: unknown) {
  const competenceMonth = Number(month);
  const competenceYear = Number(year);

  if (
    !Number.isInteger(competenceMonth) ||
    competenceMonth < 1 ||
    competenceMonth > 12 ||
    !Number.isInteger(competenceYear) ||
    competenceYear < 2000 ||
    competenceYear > 2100
  ) {
    return null;
  }

  return { competenceMonth, competenceYear };
}

function toDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function buildDueDate(year: number, month: number, dueDay?: number | null) {
  if (!dueDay || dueDay < 1) {
    return null;
  }

  const safeDay = Math.min(dueDay, getLastDayOfMonth(year, month));

  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(
    2,
    "0"
  )}`;
}

function isValidDateString(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = toDate(value);

  return !Number.isNaN(date.getTime());
}

function isCompetenceInsideLease(
  lease: Pick<LeaseRow, "start_date" | "end_date">,
  year: number,
  month: number
) {
  const competenceStart = new Date(year, month - 1, 1);
  const competenceEnd = new Date(year, month, 0);
  const startDate = toDate(lease.start_date);
  const endDate = toDate(lease.end_date);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return false;
  }

  return competenceEnd >= startDate && competenceStart <= endDate;
}

function getPreviewStatus(input: {
  lease: LeaseRow;
  existingCharge: ChargeRow | null;
  insidePeriod: boolean;
}): Pick<
  RealEstateMonthlyChargePreviewItem,
  "status" | "statusLabel" | "reason"
> {
  if (input.existingCharge) {
    return {
      status: "launched",
      statusLabel:
        input.existingCharge.status === "canceled" ? "Cancelada" : "Lançada",
      reason:
        input.existingCharge.status === "canceled"
          ? "Cobrança cancelada nesta competência."
          : null,
    };
  }

  if (!input.insidePeriod) {
    return {
      status: "outside_period",
      statusLabel: "Fora da vigência",
      reason: "A competência está fora da vigência do contrato.",
    };
  }

  if (input.lease.rent_amount_cents <= 0) {
    return {
      status: "missing_data",
      statusLabel: "Dados incompletos",
      reason: "Contrato sem valor de aluguel definido.",
    };
  }

  return {
    status: "not_launched",
    statusLabel: "Não lançada",
    reason: "Abra o financeiro do imóvel para lançar a cobrança.",
  };
}

async function buildPreview(input: {
  competenceMonth: number;
  competenceYear: number;
  landlordDocument?: string | null;
}) {
  const supabase = createAdminClient();
  const landlordDocument = onlyDigits(input.landlordDocument);
  const { data: leasesData, error: leasesError } = await supabase
    .from("real_estate_leases")
    .select(
      "id,asset_id,tenant_id,status,contract_number,start_date,end_date,payment_due_day,rent_amount_cents,created_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (leasesError) {
    throw new Error(leasesError.message);
  }

  const leases = (leasesData ?? []) as LeaseRow[];
  const assetIds = Array.from(new Set(leases.map((lease) => lease.asset_id)));
  const tenantIds = Array.from(new Set(leases.map((lease) => lease.tenant_id)));
  const leaseIds = leases.map((lease) => lease.id);

  const [
    { data: assetsData, error: assetsError },
    { data: payersData, error: payersError },
    { data: chargesData, error: chargesError },
  ] = await Promise.all([
    assetIds.length
      ? supabase
          .from("real_estate_assets")
          .select("id,code,title,landlord_document")
          .in("id", assetIds)
      : Promise.resolve({ data: [], error: null }),
    tenantIds.length
      ? supabase.from("payers").select("id,name,document").in("id", tenantIds)
      : Promise.resolve({ data: [], error: null }),
    leaseIds.length
      ? supabase
          .from("real_estate_charges")
          .select(
            "id,lease_id,status,ticket_status,ticket_provider_status,due_date,total_amount_cents,created_at"
          )
          .in("lease_id", leaseIds)
          .eq("competence_month", input.competenceMonth)
          .eq("competence_year", input.competenceYear)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const linkedError = assetsError ?? payersError ?? chargesError;

  if (linkedError) {
    throw new Error(linkedError.message);
  }

  const assetById = new Map(
    ((assetsData ?? []) as AssetRow[]).map((asset) => [asset.id, asset])
  );
  const payerById = new Map(
    ((payersData ?? []) as PayerRow[]).map((payer) => [payer.id, payer])
  );
  const chargesByLeaseId = new Map<string, ChargeRow[]>();

  ((chargesData ?? []) as ChargeRow[]).forEach((charge) => {
    chargesByLeaseId.set(charge.lease_id, [
      ...(chargesByLeaseId.get(charge.lease_id) ?? []),
      charge,
    ]);
  });

  const items = leases
    .flatMap((lease): RealEstateMonthlyChargePreviewItem[] => {
      const asset = assetById.get(lease.asset_id);

      if (!asset) {
        return [];
      }

      if (
        landlordDocument &&
        onlyDigits(asset.landlord_document) !== landlordDocument
      ) {
        return [];
      }

      const payer = payerById.get(lease.tenant_id);
      const charges = chargesByLeaseId.get(lease.id) ?? [];
      const existingCharge =
        charges.find((charge) => charge.status !== "canceled") ??
        charges[0] ??
        null;
      const dueDate = buildDueDate(
        input.competenceYear,
        input.competenceMonth,
        lease.payment_due_day
      );
      const insidePeriod = isCompetenceInsideLease(
        lease,
        input.competenceYear,
        input.competenceMonth
      );
      const status = getPreviewStatus({
        lease,
        existingCharge,
        insidePeriod,
      });

      return [
        {
          leaseId: lease.id,
          assetId: lease.asset_id,
          assetCode: asset.code,
          assetTitle: asset.title,
          tenantId: lease.tenant_id,
          tenantName: payer?.name ?? "Cliente não encontrado",
          tenantDocument: payer?.document ?? "",
          contractNumber: lease.contract_number,
          startDate: lease.start_date,
          endDate: lease.end_date,
          dueDate: existingCharge?.due_date ?? dueDate,
          paymentDueDay: lease.payment_due_day,
          rentAmountCents: lease.rent_amount_cents,
          chargeId: existingCharge?.id ?? null,
          chargeStatus: existingCharge?.status ?? null,
          ticketStatus: existingCharge?.ticket_status ?? null,
          ticketProviderStatus: existingCharge?.ticket_provider_status ?? null,
          totalAmountCents: existingCharge?.total_amount_cents ?? null,
          ...status,
        },
      ];
    })
    .sort((a, b) => {
      const codeDiff = (b.assetCode ?? 0) - (a.assetCode ?? 0);

      if (codeDiff !== 0) {
        return codeDiff;
      }

      return a.assetTitle.localeCompare(b.assetTitle);
    });

  const response: RealEstateMonthlyChargesPreviewResponse = {
    competenceMonth: input.competenceMonth,
    competenceYear: input.competenceYear,
    summary: {
      totalContracts: items.length,
      launched: items.filter((item) => item.status === "launched").length,
      notLaunched: items.filter((item) => item.status === "not_launched")
        .length,
      missingData: items.filter((item) => item.status === "missing_data")
        .length,
      outsidePeriod: items.filter((item) => item.status === "outside_period")
        .length,
      open: items.filter((item) => item.chargeStatus === "open").length,
      paid: items.filter((item) => item.chargeStatus === "paid").length,
      overdue: items.filter((item) => item.chargeStatus === "overdue").length,
      canceled: items.filter((item) => item.chargeStatus === "canceled").length,
      expectedRentCents: items.reduce(
        (total, item) => total + item.rentAmountCents,
        0
      ),
      launchedAmountCents: items.reduce(
        (total, item) => total + (item.totalAmountCents ?? 0),
        0
      ),
      paidAmountCents: items
        .filter((item) => item.chargeStatus === "paid")
        .reduce((total, item) => total + (item.totalAmountCents ?? 0), 0),
    },
    items,
  };

  return response;
}

export async function GET(request: NextRequest) {
  if (!(await requireAuthenticatedUser())) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  try {
    const competence = parseCompetence(request.nextUrl.searchParams);

    if (!competence) {
      return NextResponse.json(
        { message: "Informe uma competência válida." },
        { status: 400 }
      );
    }

    const preview = await buildPreview({
      ...competence,
      landlordDocument: request.nextUrl.searchParams.get("landlordDocument"),
    });

    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a prévia mensal.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAuthenticatedUser())) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const payload = (await request.json()) as CreateMonthlyChargePayload;
  const competence = validateCompetence(
    payload.competenceMonth,
    payload.competenceYear
  );

  if (!payload.leaseId || !competence) {
    return NextResponse.json(
      { message: "Informe contrato e competência." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  try {
    const { data: lease, error: leaseError } = await supabase
      .from("real_estate_leases")
      .select(
        "id,asset_id,tenant_id,status,contract_number,start_date,end_date,payment_due_day,rent_amount_cents,created_at"
      )
      .eq("id", payload.leaseId)
      .maybeSingle();

    if (leaseError) {
      throw new Error(leaseError.message);
    }

    if (!lease || lease.status !== "active") {
      return NextResponse.json(
        { message: "Contrato ativo não encontrado." },
        { status: 404 }
      );
    }

    const leaseRow = lease as LeaseRow;
    const { data: existingCharges, error: existingChargesError } = await supabase
      .from("real_estate_charges")
      .select(
        "id,lease_id,status,ticket_status,ticket_provider_status,due_date,total_amount_cents,created_at"
      )
      .eq("lease_id", leaseRow.id)
      .eq("competence_month", competence.competenceMonth)
      .eq("competence_year", competence.competenceYear)
      .order("created_at", { ascending: false });

    if (existingChargesError) {
      throw new Error(existingChargesError.message);
    }

    const blockingCharge = ((existingCharges ?? []) as ChargeRow[]).find(
      (charge) => charge.status !== "canceled"
    );

    if (blockingCharge) {
      return NextResponse.json(
        { message: "Já existe cobrança ativa para esta competência." },
        { status: 409 }
      );
    }

    const dueDate = isValidDateString(payload.dueDate)
      ? payload.dueDate
      : null;

    if (!dueDate) {
      return NextResponse.json(
        { message: "Informe a data de vencimento da cobrança." },
        { status: 400 }
      );
    }

    if (leaseRow.rent_amount_cents <= 0) {
      return NextResponse.json(
        { message: "Contrato sem valor de aluguel definido." },
        { status: 400 }
      );
    }

    if (
      !isCompetenceInsideLease(
        leaseRow,
        competence.competenceYear,
        competence.competenceMonth
      )
    ) {
      return NextResponse.json(
        { message: "A competência está fora da vigência do contrato." },
        { status: 400 }
      );
    }

    const { data: charge, error: chargeError } = await supabase
      .from("real_estate_charges")
      .insert({
        asset_id: leaseRow.asset_id,
        lease_id: leaseRow.id,
        tenant_id: leaseRow.tenant_id,
        competence_month: competence.competenceMonth,
        competence_year: competence.competenceYear,
        due_date: dueDate,
        rent_amount_cents: leaseRow.rent_amount_cents,
        additional_amount_cents: 0,
        discount_amount_cents: 0,
        total_amount_cents: leaseRow.rent_amount_cents,
        status: "open",
        ticket_status: "not_generated",
        notes: "Cobrança gerada pela rotina mensal.",
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
            ? "Já existe cobrança ativa para esta competência."
            : chargeError.message,
        },
        { status: isDuplicate ? 409 : 500 }
      );
    }

    const { error: itemsError } = await supabase
      .from("real_estate_charge_items")
      .insert({
        charge_id: charge.id,
        type: "rent",
        description: "Aluguel",
        amount_cents: leaseRow.rent_amount_cents,
      });

    if (itemsError) {
      await supabase.from("real_estate_charges").delete().eq("id", charge.id);
      throw new Error(itemsError.message);
    }

    const { data: asset } = await supabase
      .from("real_estate_assets")
      .select("code,title")
      .eq("id", leaseRow.asset_id)
      .maybeSingle();

    await createInternalActionNotification(supabase, {
      sourceKey: `real-estate-monthly-charge:${charge.id}:created`,
      category: "billing",
      type: "real_estate_monthly_charge_created",
      title: "Cobrança mensal criada",
      message: `${asset?.code ? `${asset.code} · ` : ""}${
        asset?.title ?? "Imóvel"
      } · Competência ${String(competence.competenceMonth).padStart(2, "0")}/${
        competence.competenceYear
      }`,
      severity: "info",
      entityType: "real_estate_charge",
      entityId: charge.id,
      actionHref: `/imobiliaria/${leaseRow.asset_id}/financeiro`,
      metadata: {
        chargeId: charge.id,
        assetId: leaseRow.asset_id,
        leaseId: leaseRow.id,
        competenceMonth: competence.competenceMonth,
        competenceYear: competence.competenceYear,
        source: "monthly_routine",
      },
    });

    return NextResponse.json({ chargeId: charge.id }, { status: 201 });
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
