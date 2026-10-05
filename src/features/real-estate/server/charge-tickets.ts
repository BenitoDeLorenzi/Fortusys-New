import type { Json } from "@/features/database/types";
import type { createAdminClient } from "@/lib/supabase/admin";

export type RealEstateTicketStatus =
  | "not_generated"
  | "registering"
  | "registered"
  | "failed"
  | "canceled";

export type RealEstateChargeTicketRow = {
  id: string;
  charge_id: string;
  provider: string;
  integration_id: string | null;
  print_id: string | null;
  document_number: string | null;
  our_number: string | null;
  bank_code: string | null;
  account_number: string | null;
  agreement_number: string | null;
  reference_code: string | null;
  assignor_document: string | null;
  provider_status: string | null;
  ticket_status: RealEstateTicketStatus;
  url: string | null;
  pix_url: string | null;
  digitable_line: string | null;
  error_message: string | null;
  provider_payload: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export function normalizeProviderStatus(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function mapRealEstateTicketStatus(
  status?: string | null
): RealEstateTicketStatus | null {
  const normalized = normalizeProviderStatus(status);

  if (
    normalized.includes("REJEIT") ||
    normalized.includes("FALH") ||
    normalized.includes("ERRO")
  ) {
    return "failed";
  }

  if (
    normalized.includes("BAIX") ||
    normalized.includes("CANCEL") ||
    normalized.includes("DESCART")
  ) {
    return "canceled";
  }

  if (
    normalized.includes("REGISTR") ||
    normalized.includes("EMIT") ||
    normalized.includes("SALV") ||
    normalized.includes("LIQUID") ||
    normalized.includes("PAGO") ||
    normalized.includes("VENC") ||
    normalized.includes("CARTORIO") ||
    normalized.includes("PROTEST")
  ) {
    return "registered";
  }

  return null;
}

export function isProviderPaidStatus(status?: string | null) {
  const normalized = normalizeProviderStatus(status);
  return normalized.includes("LIQUID") || normalized.includes("PAGO");
}

export function isProviderOverdueStatus(status?: string | null) {
  return normalizeProviderStatus(status).includes("VENC");
}

export function isProviderDischargedStatus(status?: string | null) {
  return normalizeProviderStatus(status).includes("BAIX");
}

export function isProviderActiveTicketStatus(status?: string | null) {
  const normalized = normalizeProviderStatus(status);

  if (!normalized) {
    return true;
  }

  return ![
    "BAIXA",
    "BAIXADO",
    "CANCELADO",
    "DESCARTADO",
    "FALHA",
    "REJEITADO",
  ].some((item) => normalized.includes(item));
}

export function isTicketActive(status: RealEstateTicketStatus, providerStatus?: string | null) {
  return ["registering", "registered"].includes(status) && isProviderActiveTicketStatus(providerStatus);
}

export function canDiscardProviderTicket(status?: string | null) {
  return ["EMITIDO", "FALHA", "REJEITADO"].includes(normalizeProviderStatus(status));
}

export function canDischargeProviderTicket(status?: string | null) {
  return normalizeProviderStatus(status) === "REGISTRADO";
}

export async function getActiveChargeTicket(
  supabase: SupabaseAdmin,
  chargeId: string
) {
  const { data, error } = await supabase
    .from("real_estate_charge_tickets")
    .select("*")
    .eq("charge_id", chargeId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as RealEstateChargeTicketRow | null) ?? null;
}

export async function deactivateChargeTickets(
  supabase: SupabaseAdmin,
  chargeId: string
) {
  const { error } = await supabase
    .from("real_estate_charge_tickets")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("charge_id", chargeId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncChargeTicketMirror(
  supabase: SupabaseAdmin,
  chargeId: string,
  ticket: Partial<RealEstateChargeTicketRow> | null,
  options?: {
    chargeStatus?: "open" | "paid" | "overdue" | "canceled";
  }
) {
  const update = ticket
    ? {
        ticket_status: ticket.ticket_status ?? "not_generated",
        ticket_provider: ticket.provider ?? "tecnospeed",
        ticket_integration_id: ticket.integration_id ?? null,
        ticket_print_id: ticket.print_id ?? null,
        ticket_document_number: ticket.document_number ?? null,
        ticket_our_number: ticket.our_number ?? null,
        ticket_bank_code: ticket.bank_code ?? null,
        ticket_account_number: ticket.account_number ?? null,
        ticket_agreement_number: ticket.agreement_number ?? null,
        ticket_reference_code: ticket.reference_code ?? null,
        ticket_assignor_document: ticket.assignor_document ?? null,
        ticket_provider_status: ticket.provider_status ?? null,
        ticket_url: ticket.url ?? null,
        ticket_digitable_line: ticket.digitable_line ?? null,
        ticket_pix_url: ticket.pix_url ?? null,
        ticket_error_message: ticket.error_message ?? null,
        ticket_generated_at: ticket.created_at ?? new Date().toISOString(),
        ticket_provider_payload: ticket.provider_payload ?? {},
        ...(options?.chargeStatus ? { status: options.chargeStatus } : {}),
        updated_at: new Date().toISOString(),
      }
    : {
        ticket_status: "not_generated" as const,
        ticket_provider: null,
        ticket_integration_id: null,
        ticket_print_id: null,
        ticket_document_number: null,
        ticket_our_number: null,
        ticket_bank_code: null,
        ticket_account_number: null,
        ticket_agreement_number: null,
        ticket_reference_code: null,
        ticket_assignor_document: null,
        ticket_provider_status: null,
        ticket_url: null,
        ticket_digitable_line: null,
        ticket_pix_url: null,
        ticket_error_message: null,
        ticket_provider_payload: {},
        ...(options?.chargeStatus ? { status: options.chargeStatus } : {}),
        updated_at: new Date().toISOString(),
      };

  const { error } = await supabase
    .from("real_estate_charges")
    .update(update)
    .eq("id", chargeId);

  if (error) {
    throw new Error(error.message);
  }
}
