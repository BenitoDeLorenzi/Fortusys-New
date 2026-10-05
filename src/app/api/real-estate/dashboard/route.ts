import { NextRequest, NextResponse } from "next/server";

import type {
  RealEstateDashboardAgendaItem,
  RealEstateDashboardResponse,
} from "@/features/real-estate/types";
import { createAdminClient } from "@/lib/supabase/admin";

type AssetRow = {
  id: string;
  code: number | null;
  title: string;
  status: string;
  motive: string | null;
  metadata: unknown;
  landlord_firestore_id: string | null;
  landlord_document: string | null;
};

type LeaseRow = {
  id: string;
  asset_id: string;
  tenant_id: string;
  status: "draft" | "active" | "ended" | "canceled";
  document_status:
    | "not_generated"
    | "draft_generated"
    | "pending_signature"
    | "signed";
  contract_number: string | null;
  start_date: string;
  end_date: string;
  payment_due_day: number | null;
  rent_amount_cents: number;
  next_adjustment_date: string | null;
  created_at: string;
};

type PayerRow = {
  id: string;
  name: string;
  document: string;
  phone: string | null;
  email: string | null;
};

type ChargeRow = {
  id: string;
  asset_id: string;
  tenant_id: string;
  competence_month: number;
  competence_year: number;
  due_date: string;
  total_amount_cents: number;
  status: "open" | "paid" | "overdue" | "canceled";
  ticket_status: "not_generated" | "registering" | "registered" | "failed" | "canceled";
  ticket_provider_status: string | null;
  created_at: string;
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRentalMotive(asset: AssetRow) {
  const motive = normalizeValue(asset.motive ?? getMetadataString(asset.metadata, "motivo"));
  return motive === "aluguel" || motive === "locacao";
}

function isSaleMotive(asset: AssetRow) {
  return normalizeValue(asset.motive ?? getMetadataString(asset.metadata, "motivo")) === "venda";
}

function isAvailableStatus(status: string) {
  const normalized = normalizeValue(status);
  return normalized === "available" || normalized === "disponivel";
}

function isRentedStatus(status: string) {
  const normalized = normalizeValue(status);
  return normalized === "rented" || normalized === "alugado";
}

function toLocalDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysFrom(reference: Date, value: string) {
  const date = toLocalDate(value);

  if (!date) {
    return null;
  }

  const start = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );

  return Math.ceil((date.getTime() - start.getTime()) / 86_400_000);
}

export async function GET(request: NextRequest) {
  const landlordDocument = onlyDigits(
    request.nextUrl.searchParams.get("landlordDocument")
  );
  const landlordId = request.nextUrl.searchParams.get("landlordId")?.trim();
  const now = new Date();
  const currentCompetenceMonth = now.getMonth() + 1;
  const currentCompetenceYear = now.getFullYear();

  if (!landlordDocument && !landlordId) {
    return NextResponse.json({
      summary: {
        totalAssets: 0,
        availableAssets: 0,
        rentedAssets: 0,
        saleAssets: 0,
        rentalAssets: 0,
        activeContracts: 0,
        draftContracts: 0,
        endedContracts: 0,
        tenants: 0,
        monthlyRentCents: 0,
        currentCompetenceMonth,
        currentCompetenceYear,
        expectedChargesCents: 0,
        paidChargesCents: 0,
        openChargesCents: 0,
        overdueChargesCents: 0,
        canceledChargesCents: 0,
        openCharges: 0,
        paidCharges: 0,
        overdueCharges: 0,
        canceledCharges: 0,
        activeTickets: 0,
        pendingTickets: 0,
        failedTickets: 0,
      },
      contracts: [],
      tenants: [],
      charges: [],
      agenda: [],
    } satisfies RealEstateDashboardResponse);
  }

  const supabase = createAdminClient();
  let assetsQuery = supabase
    .from("real_estate_assets")
    .select(
      "id,code,title,status,motive,metadata,landlord_firestore_id,landlord_document"
    )
    .order("code", { ascending: false, nullsFirst: false })
    .limit(1000);

  if (landlordDocument && landlordId) {
    assetsQuery = assetsQuery.or(
      `landlord_document.eq.${landlordDocument},landlord_firestore_id.eq.${landlordId}`
    );
  } else if (landlordDocument) {
    assetsQuery = assetsQuery.eq("landlord_document", landlordDocument);
  } else if (landlordId) {
    assetsQuery = assetsQuery.eq("landlord_firestore_id", landlordId);
  }

  const { data: assetsData, error: assetsError } = await assetsQuery;

  if (assetsError) {
    return NextResponse.json({ message: assetsError.message }, { status: 500 });
  }

  const assets = (assetsData ?? []) as AssetRow[];
  const assetIds = assets.map((asset) => asset.id);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  const { data: leasesData, error: leasesError } = assetIds.length
    ? await supabase
        .from("real_estate_leases")
        .select(
          "id,asset_id,tenant_id,status,document_status,contract_number,start_date,end_date,payment_due_day,rent_amount_cents,next_adjustment_date,created_at"
        )
        .in("asset_id", assetIds)
        .order("contract_number", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [], error: null };

  if (leasesError) {
    return NextResponse.json({ message: leasesError.message }, { status: 500 });
  }

  const leases = (leasesData ?? []) as LeaseRow[];
  const tenantIds = Array.from(new Set(leases.map((lease) => lease.tenant_id)));

  const { data: payersData, error: payersError } = tenantIds.length
    ? await supabase
        .from("payers")
        .select("id,name,document,phone,email")
        .in("id", tenantIds)
        .order("name")
    : { data: [], error: null };

  if (payersError) {
    return NextResponse.json({ message: payersError.message }, { status: 500 });
  }

  const payers = (payersData ?? []) as PayerRow[];
  const payerById = new Map(payers.map((payer) => [payer.id, payer]));
  const { data: chargesData, error: chargesError } = assetIds.length
    ? await supabase
        .from("real_estate_charges")
        .select(
          "id,asset_id,tenant_id,competence_month,competence_year,due_date,total_amount_cents,status,ticket_status,ticket_provider_status,created_at"
        )
        .in("asset_id", assetIds)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false })
        .order("due_date", { ascending: true })
        .limit(1000)
    : { data: [], error: null };

  if (chargesError) {
    return NextResponse.json({ message: chargesError.message }, { status: 500 });
  }

  const charges = (chargesData ?? []) as ChargeRow[];
  const currentCharges = charges.filter(
    (charge) =>
      charge.competence_month === currentCompetenceMonth &&
      charge.competence_year === currentCompetenceYear
  );
  const nonCanceledCurrentCharges = currentCharges.filter(
    (charge) => charge.status !== "canceled"
  );
  const attentionCharges = charges
    .filter(
      (charge) =>
        charge.status === "overdue" ||
        charge.ticket_status === "failed" ||
        charge.ticket_status === "registering" ||
        charge.ticket_status === "not_generated"
    )
    .slice(0, 8)
    .map((charge) => {
      const asset = assetById.get(charge.asset_id);
      const tenant = payerById.get(charge.tenant_id);

      return {
        id: charge.id,
        assetId: charge.asset_id,
        assetCode: asset?.code ?? null,
        assetTitle: asset?.title ?? "Imóvel não encontrado",
        tenantName: tenant?.name ?? "Cliente não encontrado",
        competenceMonth: charge.competence_month,
        competenceYear: charge.competence_year,
        dueDate: charge.due_date,
        totalAmountCents: charge.total_amount_cents,
        status: charge.status,
        ticketStatus: charge.ticket_status,
        ticketProviderStatus: charge.ticket_provider_status,
      };
    });
  const tenantCounters = new Map<
    string,
    { activeContracts: number; totalContracts: number }
  >();

  for (const lease of leases) {
    const current = tenantCounters.get(lease.tenant_id) ?? {
      activeContracts: 0,
      totalContracts: 0,
    };

    current.totalContracts += 1;

    if (lease.status === "active") {
      current.activeContracts += 1;
    }

    tenantCounters.set(lease.tenant_id, current);
  }

  const contracts = leases.map((lease) => {
    const asset = assetById.get(lease.asset_id);
    const tenant = payerById.get(lease.tenant_id);

    return {
      id: lease.id,
      assetId: lease.asset_id,
      assetCode: asset?.code ?? null,
      assetTitle: asset?.title ?? "Imóvel não encontrado",
      tenantId: lease.tenant_id,
      tenantName: tenant?.name ?? "Cliente não encontrado",
      tenantDocument: tenant?.document ?? "",
      status: lease.status,
      contractNumber: lease.contract_number,
      startDate: lease.start_date,
      endDate: lease.end_date,
      paymentDueDay: lease.payment_due_day,
      rentAmountCents: lease.rent_amount_cents,
      createdAt: lease.created_at,
    };
  });

  const tenants = payers.map((payer) => {
    const counter = tenantCounters.get(payer.id) ?? {
      activeContracts: 0,
      totalContracts: 0,
    };

    return {
      id: payer.id,
      name: payer.name,
      document: payer.document,
      phone: payer.phone,
      email: payer.email,
      activeContracts: counter.activeContracts,
      totalContracts: counter.totalContracts,
    };
  });
  const currentChargeKeys = new Set(
    currentCharges
      .filter((charge) => charge.status !== "canceled")
      .map((charge) => charge.asset_id)
  );
  const chargeAgendaItems: RealEstateDashboardAgendaItem[] = charges.flatMap(
    (charge): RealEstateDashboardAgendaItem[] => {
      const asset = assetById.get(charge.asset_id);
      const tenant = payerById.get(charge.tenant_id);
      const dueInDays = daysFrom(now, charge.due_date);
      const base = {
        assetId: charge.asset_id,
        assetCode: asset?.code ?? null,
        assetTitle: asset?.title ?? "Imóvel não encontrado",
        tenantName: tenant?.name ?? "Cliente não encontrado",
        actionHref: `/imobiliaria/${charge.asset_id}/financeiro`,
        actionLabel: "Abrir financeiro",
      };

      if (charge.status === "overdue") {
        return [
          {
            id: `charge-overdue-${charge.id}`,
            date: charge.due_date,
            type: "charge_overdue" as const,
            priority: "high" as const,
            title: "Cobrança vencida",
            description: `Competência ${String(charge.competence_month).padStart(2, "0")}/${charge.competence_year}.`,
            ...base,
          },
        ];
      }

      if (charge.ticket_status === "failed") {
        return [
          {
            id: `ticket-failed-${charge.id}`,
            date: charge.due_date,
            type: "ticket_failed" as const,
            priority: "high" as const,
            title: "Boleto com falha",
            description: charge.ticket_provider_status
              ? `Status TecnoSpeed: ${charge.ticket_provider_status}.`
              : "Verifique o erro do boleto no financeiro.",
            ...base,
          },
        ];
      }

      if (charge.ticket_status === "registering") {
        return [
          {
            id: `ticket-registering-${charge.id}`,
            date: charge.due_date,
            type: "ticket_registering" as const,
            priority: "medium" as const,
            title: "Boleto registrando",
            description: "Aguardando retorno de registro da TecnoSpeed.",
            ...base,
          },
        ];
      }

      if (charge.status === "open" && dueInDays !== null && dueInDays >= 0 && dueInDays <= 7) {
        return [
          {
            id: `charge-due-${charge.id}`,
            date: charge.due_date,
            type: "charge_due" as const,
            priority: dueInDays <= 2 ? ("high" as const) : ("medium" as const),
            title: dueInDays === 0 ? "Cobrança vence hoje" : "Cobrança a vencer",
            description: `Vence em ${dueInDays} dia(s). Competência ${String(charge.competence_month).padStart(2, "0")}/${charge.competence_year}.`,
            ...base,
          },
        ];
      }

      return [];
    }
  );
  const leaseAgendaItems: RealEstateDashboardAgendaItem[] = leases.flatMap(
    (lease): RealEstateDashboardAgendaItem[] => {
      if (lease.status !== "active" && lease.status !== "draft") {
        return [];
      }

      const asset = assetById.get(lease.asset_id);
      const tenant = payerById.get(lease.tenant_id);
      const base = {
        assetId: lease.asset_id,
        assetCode: asset?.code ?? null,
        assetTitle: asset?.title ?? "Imóvel não encontrado",
        tenantName: tenant?.name ?? "Cliente não encontrado",
        actionHref: `/imobiliaria/${lease.asset_id}/contratos`,
        actionLabel: "Abrir contratos",
      };
      const items: RealEstateDashboardAgendaItem[] = [];
      const endInDays = daysFrom(now, lease.end_date);

      if (lease.status === "active" && endInDays !== null && endInDays >= 0 && endInDays <= 60) {
        items.push({
          id: `contract-ending-${lease.id}`,
          date: lease.end_date,
          type: "contract_ending" as const,
          priority: endInDays <= 15 ? ("high" as const) : ("medium" as const),
          title: "Contrato próximo do fim",
          description: `Encerra em ${endInDays} dia(s).`,
          ...base,
        });
      }

      const adjustmentInDays = lease.next_adjustment_date
        ? daysFrom(now, lease.next_adjustment_date)
        : null;

      if (
        lease.status === "active" &&
        lease.next_adjustment_date &&
        adjustmentInDays !== null &&
        adjustmentInDays >= 0 &&
        adjustmentInDays <= 45
      ) {
        items.push({
          id: `adjustment-${lease.id}`,
          date: lease.next_adjustment_date,
          type: "adjustment" as const,
          priority: adjustmentInDays <= 15 ? ("high" as const) : ("medium" as const),
          title: "Reajuste próximo",
          description: `Reajuste previsto em ${adjustmentInDays} dia(s).`,
          ...base,
        });
      }

      if (lease.status === "draft" && lease.document_status !== "signed") {
        items.push({
          id: `contract-document-${lease.id}`,
          date: lease.created_at,
          type: "contract_document" as const,
          priority: "medium" as const,
          title:
            lease.document_status === "not_generated"
              ? "Contrato sem minuta"
              : "Contrato aguardando assinatura",
          description:
            lease.document_status === "not_generated"
              ? "Gere a minuta para iniciar o processo."
              : "Anexe o contrato assinado para liberar ativação.",
          ...base,
        });
      }

      if (
        lease.status === "active" &&
        !currentChargeKeys.has(lease.asset_id)
      ) {
        items.push({
          id: `missing-charge-${lease.id}`,
          date: dateKey(now),
          type: "missing_charge" as const,
          priority: "medium" as const,
          title: "Cobrança do mês não gerada",
          description: `Competência ${String(currentCompetenceMonth).padStart(2, "0")}/${currentCompetenceYear}.`,
          actionHref: `/imobiliaria/${lease.asset_id}/financeiro`,
          actionLabel: "Abrir financeiro",
          assetId: lease.asset_id,
          assetCode: asset?.code ?? null,
          assetTitle: asset?.title ?? "Imóvel não encontrado",
          tenantName: tenant?.name ?? "Cliente não encontrado",
        });
      }

      return items;
    }
  );
  const agenda = [...chargeAgendaItems, ...leaseAgendaItems]
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        a.date.localeCompare(b.date)
      );
    })
    .slice(0, 50);

  return NextResponse.json({
    summary: {
      totalAssets: assets.length,
      availableAssets: assets.filter((asset) => isAvailableStatus(asset.status))
        .length,
      rentedAssets: assets.filter((asset) => isRentedStatus(asset.status))
        .length,
      saleAssets: assets.filter(isSaleMotive).length,
      rentalAssets: assets.filter(isRentalMotive).length,
      activeContracts: leases.filter((lease) => lease.status === "active")
        .length,
      draftContracts: leases.filter((lease) => lease.status === "draft").length,
      endedContracts: leases.filter((lease) => lease.status === "ended").length,
      tenants: tenants.length,
      monthlyRentCents: leases
        .filter((lease) => lease.status === "active")
        .reduce((total, lease) => total + lease.rent_amount_cents, 0),
      currentCompetenceMonth,
      currentCompetenceYear,
      expectedChargesCents: nonCanceledCurrentCharges.reduce(
        (total, charge) => total + charge.total_amount_cents,
        0
      ),
      paidChargesCents: currentCharges
        .filter((charge) => charge.status === "paid")
        .reduce((total, charge) => total + charge.total_amount_cents, 0),
      openChargesCents: currentCharges
        .filter((charge) => charge.status === "open")
        .reduce((total, charge) => total + charge.total_amount_cents, 0),
      overdueChargesCents: currentCharges
        .filter((charge) => charge.status === "overdue")
        .reduce((total, charge) => total + charge.total_amount_cents, 0),
      canceledChargesCents: currentCharges
        .filter((charge) => charge.status === "canceled")
        .reduce((total, charge) => total + charge.total_amount_cents, 0),
      openCharges: currentCharges.filter((charge) => charge.status === "open")
        .length,
      paidCharges: currentCharges.filter((charge) => charge.status === "paid")
        .length,
      overdueCharges: currentCharges.filter((charge) => charge.status === "overdue")
        .length,
      canceledCharges: currentCharges.filter((charge) => charge.status === "canceled")
        .length,
      activeTickets: currentCharges.filter((charge) =>
        ["registering", "registered"].includes(charge.ticket_status)
      ).length,
      pendingTickets: currentCharges.filter(
        (charge) => charge.ticket_status === "not_generated"
      ).length,
      failedTickets: currentCharges.filter(
        (charge) => charge.ticket_status === "failed"
      ).length,
    },
    contracts,
    tenants,
    charges: attentionCharges,
    agenda,
  } satisfies RealEstateDashboardResponse);
}
