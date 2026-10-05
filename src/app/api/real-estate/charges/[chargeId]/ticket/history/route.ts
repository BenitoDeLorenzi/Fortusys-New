import { NextResponse } from "next/server";

import { tecnospeedRequest } from "@/features/integrations/tecnospeed/server/client";
import { createAdminClient } from "@/lib/supabase/admin";

type TicketHistoryRouteProps = {
  params: Promise<{ chargeId: string }>;
};

type ChargeRow = {
  id: string;
  asset_id: string;
  tenant_id: string;
  due_date: string;
  total_amount_cents: number;
};

type TicketRow = {
  id: string;
  integration_id: string | null;
  provider_status: string | null;
  ticket_status: string;
  document_number: string | null;
  our_number: string | null;
  assignor_document: string | null;
  url: string | null;
  pix_url: string | null;
  digitable_line: string | null;
  error_message: string | null;
  provider_payload: unknown;
  is_active: boolean;
  created_at: string;
};

type AssetRow = {
  landlord_document: string | null;
};

type PayerRow = {
  name: string;
  document: string;
  phone: string | null;
  email: string | null;
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

function getObjectField(source: Record<string, unknown>, names: string[]) {
  const normalizedEntries = Object.entries(source).map(([key, value]) => [
    key.toLowerCase().replace(/[^a-z0-9]/g, ""),
    value,
  ]);

  for (const name of names) {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const entry = normalizedEntries.find(([key]) => key === normalizedName);

    if (entry && isRecord(entry[1])) {
      return entry[1];
    }
  }

  return null;
}

function normalizeRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => isRecord(item));
}

function normalizeTicketsPayload(data: unknown): Record<string, unknown>[] {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => isRecord(item));
  }

  if (isRecord(data)) {
    return [data];
  }

  return [];
}

function getMovements(source: Record<string, unknown>) {
  return normalizeRecordArray(
    getObjectField(source, ["TituloMovimentos", "titulomovimentos"])
  ).map((movement) => {
    const returns = getObjectField(movement, ["retornos"]);

    return {
      code: getStringField(movement, ["codigo", "Codigo", "code"]),
      message: getStringField(movement, ["mensagem", "Mensagem", "message"]),
      date: getStringField(movement, ["data", "Data", "date"]),
      origin: returns ? getStringField(returns, ["origem", "Origem"]) || null : null,
    };
  });
}

function getOccurrences(source: Record<string, unknown>) {
  return normalizeRecordArray(
    getObjectField(source, ["TituloOcorrencias", "tituloocorrencias"])
  ).map((occurrence) => ({
    code: getStringField(occurrence, ["codigo", "Codigo", "code"]),
    message: getStringField(occurrence, ["mensagem", "Mensagem", "message"]),
    date: getStringField(occurrence, ["data", "Data", "date"]) || null,
  }));
}

function getPayloadTicketRecord(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const title = getObjectField(value, ["titulo"]);
  if (title) {
    return title;
  }

  const data = getObjectField(value, ["_dados", "dados"]);
  const success = normalizeRecordArray(data?._sucesso).at(0);
  const failure = normalizeRecordArray(data?._falha).at(0);

  return success ?? failure ?? value;
}

async function loadTicketFromTecnospeed(assignorDocument: string, integrationId: string) {
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
      return null;
    }

    return (
      normalizeTicketsPayload(response._dados).find((ticket) => {
        return (
          getStringField(ticket, ["IdIntegracao", "idintegracao", "id"]) ===
          integrationId
        );
      }) ?? null
    );
  } catch {
    return null;
  }
}

function formatAmountFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function GET(_request: Request, { params }: TicketHistoryRouteProps) {
  const { chargeId } = await params;
  const supabase = createAdminClient();
  const { data: charge, error: chargeError } = await supabase
    .from("real_estate_charges")
    .select("id,asset_id,tenant_id,due_date,total_amount_cents")
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
  const [
    { data: asset, error: assetError },
    { data: payer, error: payerError },
    { data: tickets, error: ticketsError },
  ] = await Promise.all([
    supabase
      .from("real_estate_assets")
      .select("landlord_document")
      .eq("id", chargeRow.asset_id)
      .maybeSingle(),
    supabase
      .from("payers")
      .select("name,document,phone,email")
      .eq("id", chargeRow.tenant_id)
      .maybeSingle(),
    supabase
      .from("real_estate_charge_tickets")
      .select("*")
      .eq("charge_id", chargeId)
      .order("created_at", { ascending: false }),
  ]);

  const linkedError = assetError ?? payerError ?? ticketsError;
  if (linkedError) {
    return NextResponse.json({ message: linkedError.message }, { status: 500 });
  }

  const ticketRows = (tickets ?? []) as TicketRow[];
  const selectedTicket =
    ticketRows.find((ticket) => ticket.is_active) ?? ticketRows[0] ?? null;

  if (!selectedTicket) {
    return NextResponse.json(
      { message: "Esta cobrança ainda não possui histórico de boleto." },
      { status: 404 }
    );
  }

  const assetRow = asset as AssetRow | null;
  const payerRow = payer as PayerRow | null;
  const assignorDocument = onlyDigits(
    selectedTicket.assignor_document ?? assetRow?.landlord_document
  );
  const liveTicket =
    assignorDocument && selectedTicket.integration_id
      ? await loadTicketFromTecnospeed(assignorDocument, selectedTicket.integration_id)
      : null;
  const payloadTicket = getPayloadTicketRecord(selectedTicket.provider_payload);
  const source = liveTicket ?? payloadTicket ?? {};

  return NextResponse.json({
    ticket: {
      integrationId:
        selectedTicket.integration_id ??
        getStringField(source, ["IdIntegracao", "idintegracao", "id"]),
      status:
        getStringField(source, ["situacao", "Situacao"]) ||
        selectedTicket.provider_status ||
        "Não informado",
      documentNumber:
        getStringField(source, [
          "TituloNumeroDocumento",
          "titulonumerodocumento",
        ]) || selectedTicket.document_number,
      ourNumber:
        getStringField(source, ["TituloNossoNumero", "titulonossonumero"]) ||
        selectedTicket.our_number,
      payerName:
        getStringField(source, ["SacadoNome", "sacadonome"]) ||
        payerRow?.name ||
        "",
      payerDocument:
        getStringField(source, ["SacadoCPFCNPJ", "sacadocpfcnpj"]) ||
        payerRow?.document ||
        "",
      payerPhone:
        getStringField(source, [
          "SacadoCelular",
          "sacadocelular",
          "SacadoTelefone",
          "sacadotelefone",
        ]) || payerRow?.phone,
      payerEmail:
        getStringField(source, ["SacadoEmail", "sacadoemail"]) ||
        payerRow?.email,
      dueDate:
        getStringField(source, [
          "TituloDataVencimento",
          "titulodatavencimento",
        ]) || chargeRow.due_date,
      amount:
        getStringField(source, ["TituloValor", "titulovalor"]) ||
        formatAmountFromCents(chargeRow.total_amount_cents),
      boletoUrl:
        getStringField(source, ["UrlBoleto", "urlboleto"]) || selectedTicket.url,
      pixUrl:
        getStringField(source, ["UrlPix", "urlpix"]) || selectedTicket.pix_url,
      digitableLine:
        getStringField(source, [
          "TituloLinhaDigitavel",
          "titulolinhadigitavel",
        ]) || selectedTicket.digitable_line,
      failureMessage:
        getStringField(source, ["motivo", "mensagem", "_erro", "_mensagem"]) ||
        selectedTicket.error_message,
      movements: getMovements(source),
      occurrences: getOccurrences(source),
      attempts: ticketRows.map((ticket) => ({
        id: ticket.id,
        integrationId: ticket.integration_id,
        status: ticket.provider_status ?? ticket.ticket_status,
        isActive: ticket.is_active,
        errorMessage: ticket.error_message,
        createdAt: ticket.created_at,
      })),
    },
  });
}
