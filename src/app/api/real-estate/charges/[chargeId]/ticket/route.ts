import { getBankTicketFields } from "@/features/billing/server/bank-ticket-fields";
import { NextResponse } from "next/server";

import {
  mapBankAccount,
  normalizePayload,
  type TecnospeedAccountsPayload,
  type TecnospeedBankAccount,
} from "@/features/billing/server/accounts";
import { generateBillingOurNumber, isValidBillingOurNumber } from "@/features/billing/utils";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";
import type { Json } from "@/features/database/types";
import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import {
  createEventNotification,
  getAppUserForAuthUser,
} from "@/features/notifications/server/notification-service";
import {
  deactivateChargeTickets,
  getActiveChargeTicket,
  syncChargeTicketMirror,
  type RealEstateChargeTicketRow,
} from "@/features/real-estate/server/charge-tickets";
import { createAdminClient } from "@/lib/supabase/admin";

type TicketRouteProps = {
  params: Promise<{ chargeId: string }>;
};

type TecnospeedTicketPayload = {
  _status?: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: {
    _sucesso?: Array<Record<string, unknown>>;
    _falha?: Array<Record<string, unknown>>;
  };
};

type ChargeRow = {
  id: string;
  asset_id: string;
  lease_id: string;
  tenant_id: string;
  competence_month: number;
  competence_year: number;
  due_date: string;
  total_amount_cents: number;
  status: "open" | "paid" | "overdue" | "canceled";
  ticket_status: "not_generated" | "registering" | "registered" | "failed" | "canceled";
};

type TicketPayload = {
  accountId?: string;
  agreementId?: string;
};

type ChargeTicketInsert = {
  charge_id: string;
  provider: string;
  integration_id?: string | null;
  print_id?: string | null;
  document_number?: string | null;
  our_number?: string | null;
  bank_code?: string | null;
  account_number?: string | null;
  agreement_number?: string | null;
  reference_code?: string | null;
  assignor_document?: string | null;
  provider_status?: string | null;
  ticket_status: "registering" | "registered" | "failed" | "canceled";
  url?: string | null;
  pix_url?: string | null;
  digitable_line?: string | null;
  error_message?: string | null;
  provider_payload?: Json;
  is_active: boolean;
};

type ChargeItemRow = {
  type: string;
  description: string | null;
  amount_cents: number;
};

type AssetRow = {
  id: string;
  code: number | null;
  title: string;
  landlord_document: string | null;
};

type LeaseRow = {
  id: string;
  code: number | null;
  contract_number: string | null;
};

type PayerRow = {
  id: string;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function optional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function formatDateToTecnospeed(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function addDaysToIsoDate(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function formatAmountFromCents(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

function getStringField(source: Record<string, unknown> | undefined, keys: string[]) {
  if (!source) {
    return "";
  }

  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function extractMessages(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(extractMessages);
  if (typeof value !== "object") return [String(value)];

  const record = value as Record<string, unknown>;
  return [
    record._mensagem,
    record.mensagem,
    record.message,
    record._erro,
    record.erro,
    record.error,
    record.erros,
  ].flatMap(extractMessages);
}

function normalizeTecnospeedMessage(response: TecnospeedTicketPayload) {
  const failures = response._dados?._falha ?? [];
  const messages = [
    ...extractMessages(failures),
    ...extractMessages(response._mensagem),
  ].filter(Boolean);

  return messages.join(" ") || "Não foi possível registrar o boleto.";
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function getItemLabel(item: ChargeItemRow) {
  const labels: Record<string, string> = {
    rent: "Aluguel",
    iptu: "IPTU",
    condominium: "Condomínio",
    reserve_fund: "Fundo reserva",
    water: "Água",
    energy: "Energia",
    trash: "Lixo",
    gas: "Gás",
    other: item.description ?? "Outros",
    discount: "Desconto",
  };

  return labels[item.type] ?? item.description ?? item.type;
}

function getCompactItemLabel(item: ChargeItemRow) {
  const labels: Record<string, string> = {
    rent: "Aluguel",
    iptu: "IPTU",
    condominium: "Cond",
    reserve_fund: "Fundo",
    water: "Água",
    energy: "Luz",
    trash: "Lixo",
    gas: "Gás",
    other: item.description ?? "Outros",
    discount: "Desc",
  };

  return (labels[item.type] ?? item.description ?? item.type)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

function compactMoneyFromCents(value: number) {
  return formatAmountFromCents(value).replace(/^0,/, ",");
}

function getTicketNotificationTitle(status?: string | null, failed?: boolean) {
  if (failed) {
    return "Boleto com falha";
  }

  const normalized = (status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (normalized.includes("REGISTR")) {
    return "Boleto registrado";
  }

  if (normalized.includes("EMIT")) {
    return "Boleto emitido";
  }

  return "Boleto gerado";
}

function formatCompetence(month: number, year: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function limitTicketMessage(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

function joinLimitedTicketParts(prefix: string, parts: string[]) {
  const limit = 80;
  const selected: string[] = [];

  for (const part of parts) {
    const candidate = `${prefix}${selected.length ? " " : ""}${[
      ...selected,
      part,
    ].join(" ")}`;

    if (candidate.length <= limit) {
      selected.push(part);
      continue;
    }

    const remaining = parts.length - selected.length;
    const suffix = `+${remaining} item${remaining > 1 ? "s" : ""}`;
    const candidateWithSuffix = `${prefix}${selected.length ? " " : ""}${[
      ...selected,
      suffix,
    ].join(" ")}`;

    if (candidateWithSuffix.length <= limit) {
      selected.push(suffix);
    }

    break;
  }

  return limitTicketMessage(`${prefix}${selected.length ? " " : ""}${selected.join(" ")}`);
}

function buildTicketMessages(
  charge: ChargeRow,
  lease: LeaseRow,
  items: ChargeItemRow[]
) {
  const competence = `${String(charge.competence_month).padStart(2, "0")}/${
    charge.competence_year
  }`;
  const order = [
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
  const orderedItems = [...items].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type)
  );
  const rentItem = orderedItems.find((item) => item.type === "rent");
  const additionalParts = orderedItems
    .filter((item) => item.type !== "rent")
    .map((item) => {
      const prefix = item.type === "discount" ? "-" : "";
      return `${prefix}${getCompactItemLabel(item)} ${compactMoneyFromCents(item.amount_cents)}`;
    });
  const contractReference = lease.code
    ? `Contrato ${lease.code}`
    : lease.contract_number
      ? `Contrato ${lease.contract_number}`
      : "Contrato -";
  const rentAmount = rentItem?.amount_cents ?? charge.total_amount_cents;
  const message1 = [
    `Comp. ${competence}`,
    contractReference,
    `Aluguel ${compactMoneyFromCents(rentAmount)}`,
    `Total ${compactMoneyFromCents(charge.total_amount_cents)}`,
  ].join(" | ");

  return {
    message1: limitTicketMessage(message1),
    message2: additionalParts.length
      ? joinLimitedTicketParts("Adic.:", additionalParts)
      : "",
  };
}

async function loadBankOptions(assignorDocument: string) {
  const response = await tecnospeedRequest<TecnospeedAccountsPayload>({
    path: "/cedentes/contas",
    headers: {
      "cnpj-cedente": assignorDocument,
    },
  });

  return normalizePayload(
    response._dados as TecnospeedBankAccount[] | TecnospeedBankAccount
  ).map(mapBankAccount);
}

export async function GET(_request: Request, { params }: TicketRouteProps) {
  const { chargeId } = await params;
  const supabase = createAdminClient();

  try {
    const { data: charge, error: chargeError } = await supabase
      .from("real_estate_charges")
      .select(
        "id,asset_id,lease_id,tenant_id,competence_month,competence_year,due_date,total_amount_cents,status,ticket_status"
      )
      .eq("id", chargeId)
      .maybeSingle();

    if (chargeError) throw new Error(chargeError.message);
    if (!charge) {
      return NextResponse.json({ message: "Cobrança não encontrada." }, { status: 404 });
    }

    const chargeRow = charge as ChargeRow;
    const [
      { data: asset, error: assetError },
      { data: lease, error: leaseError },
      { data: payer, error: payerError },
      { data: items, error: itemsError },
    ] = await Promise.all([
      supabase
        .from("real_estate_assets")
        .select("id,code,title,landlord_document")
        .eq("id", chargeRow.asset_id)
        .maybeSingle(),
      supabase
        .from("real_estate_leases")
        .select("id,code,contract_number")
        .eq("id", chargeRow.lease_id)
        .maybeSingle(),
      supabase
        .from("payers")
        .select("id,name,document,email,phone,zip_code,street,number,complement,district,city,state")
        .eq("id", chargeRow.tenant_id)
        .maybeSingle(),
      supabase
        .from("real_estate_charge_items")
        .select("type,description,amount_cents")
        .eq("charge_id", chargeId),
    ]);
    const linkedError = assetError ?? leaseError ?? payerError ?? itemsError;
    if (linkedError) throw new Error(linkedError.message);
    if (!asset || !lease || !payer) {
      return NextResponse.json(
        { message: "Dados vinculados à cobrança não encontrados." },
        { status: 404 }
      );
    }

    const assetRow = asset as AssetRow;
    const leaseRow = lease as LeaseRow;
    const payerRow = payer as PayerRow;
    const itemRows = (items ?? []) as ChargeItemRow[];
    const assignorDocument = onlyDigits(assetRow.landlord_document);
    const accounts = assignorDocument ? await loadBankOptions(assignorDocument) : [];

    return NextResponse.json({
      charge: {
        id: chargeRow.id,
        competence: `${String(chargeRow.competence_month).padStart(2, "0")}/${chargeRow.competence_year}`,
        dueDate: chargeRow.due_date,
        totalAmountCents: chargeRow.total_amount_cents,
        ticketStatus: chargeRow.ticket_status,
      },
      asset: {
        id: assetRow.id,
        code: assetRow.code,
        title: assetRow.title,
        assignorDocument,
      },
      lease: {
        id: leaseRow.id,
        code: leaseRow.code,
        contractNumber: leaseRow.contract_number,
      },
      payer: {
        id: payerRow.id,
        name: payerRow.name,
        document: payerRow.document,
      },
      items: itemRows.map((item) => ({
        type: item.type,
        description: item.description,
        amountCents: item.amount_cents,
        label: getItemLabel(item),
      })),
      accounts: accounts.map((account) => ({
        id: String(account.id),
        label: `${account.bankCode} · Conta ${account.accountNumber}${account.accountDigit ? `-${account.accountDigit}` : ""}`,
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        accountDigit: account.accountDigit,
        agreements: account.agreements.map((agreement) => ({
          id: String(agreement.id),
          label: `${agreement.number ?? "Sem número"}${agreement.wallet ? ` · Carteira ${agreement.wallet}` : ""}`,
          number: agreement.number,
          wallet: agreement.wallet,
        })),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a emissão do boleto.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

export async function POST(_request: Request, { params }: TicketRouteProps) {
  const { chargeId } = await params;
  const payload = (await _request.json().catch(() => ({}))) as TicketPayload;
  const supabase = createAdminClient();
  const authUser = await requireAuthenticatedUser();
  const appUser = authUser
    ? await getAppUserForAuthUser(supabase, authUser)
    : null;
  let ticketId: string | null = null;

  try {
    const { data: charge, error: chargeError } = await supabase
      .from("real_estate_charges")
      .select(
        "id,asset_id,lease_id,tenant_id,competence_month,competence_year,due_date,total_amount_cents,status,ticket_status"
      )
      .eq("id", chargeId)
      .maybeSingle();

    if (chargeError) throw new Error(chargeError.message);
    if (!charge) {
      return NextResponse.json({ message: "Cobrança não encontrada." }, { status: 404 });
    }

    const chargeRow = charge as ChargeRow;

    if (chargeRow.status === "canceled") {
      return NextResponse.json(
        { message: "Cobrança cancelada não pode gerar boleto." },
        { status: 400 }
      );
    }

    if (chargeRow.status === "paid") {
      return NextResponse.json(
        { message: "Cobrança paga não pode gerar novo boleto." },
        { status: 400 }
      );
    }

    const activeTicket = await getActiveChargeTicket(supabase, chargeId);

    if (activeTicket) {
      return NextResponse.json(
        { message: "Esta cobrança já possui boleto ativo em processamento ou registrado." },
        { status: 400 }
      );
    }

    const [
      { data: asset, error: assetError },
      { data: lease, error: leaseError },
      { data: payer, error: payerError },
      { data: items, error: itemsError },
    ] = await Promise.all([
      supabase
        .from("real_estate_assets")
        .select("id,code,title,landlord_document")
        .eq("id", chargeRow.asset_id)
        .maybeSingle(),
      supabase
        .from("real_estate_leases")
        .select("id,code,contract_number")
        .eq("id", chargeRow.lease_id)
        .maybeSingle(),
      supabase
        .from("payers")
        .select("id,name,document,email,phone,zip_code,street,number,complement,district,city,state")
        .eq("id", chargeRow.tenant_id)
        .maybeSingle(),
      supabase
        .from("real_estate_charge_items")
        .select("type,description,amount_cents")
        .eq("charge_id", chargeId),
    ]);
    const linkedError = assetError ?? leaseError ?? payerError ?? itemsError;
    if (linkedError) throw new Error(linkedError.message);
    if (!asset || !lease || !payer) {
      return NextResponse.json(
        { message: "Dados vinculados à cobrança não encontrados." },
        { status: 404 }
      );
    }

    const assetRow = asset as AssetRow;
    const leaseRow = lease as LeaseRow;
    const payerRow = payer as PayerRow;
    const itemRows = (items ?? []) as ChargeItemRow[];
    const assignorDocument = onlyDigits(assetRow.landlord_document);
    const ourNumber = generateBillingOurNumber();
    const documentNumber = `IMB${assetRow.code ?? ""}${String(
      chargeRow.competence_month
    ).padStart(2, "0")}${String(chargeRow.competence_year).slice(-2)}`.slice(0, 10);
    const accounts = assignorDocument ? await loadBankOptions(assignorDocument) : [];
    const account =
      accounts.find((item) => String(item.id) === payload.accountId) ??
      accounts.find((item) => item.active !== false) ??
      accounts[0] ??
      null;
    const agreement =
      account?.agreements.find((item) => String(item.id) === payload.agreementId) ??
      account?.agreements.find((item) => item.active !== false) ??
      account?.agreements[0] ??
      null;
    const bankFields = getBankTicketFields(account?.bankCode);
    const messages = buildTicketMessages(chargeRow, leaseRow, itemRows);
    const penaltyStartDate = formatDateToTecnospeed(addDaysToIsoDate(chargeRow.due_date, 1));
    const body: Record<string, unknown> = {
      CedenteContaCodigoBanco: onlyDigits(account?.bankCode),
      CedenteContaNumero: onlyDigits(account?.accountNumber),
      CedenteContaNumeroDV: onlyDigits(account?.accountDigit),
      CedenteConvenioNumero: onlyDigits(agreement?.number),
      TituloCarteira: optional(agreement?.wallet),
      ...bankFields,
      SacadoCPFCNPJ: onlyDigits(payerRow.document),
      SacadoNome: optional(payerRow.name),
      SacadoEmail: optional(payerRow.email),
      SacadoTelefone: onlyDigits(payerRow.phone),
      SacadoEnderecoLogradouro: optional(payerRow.street),
      SacadoEnderecoNumero: optional(payerRow.number),
      SacadoEnderecoBairro: optional(payerRow.district),
      SacadoEnderecoCEP: onlyDigits(payerRow.zip_code),
      SacadoEnderecoCidade: optional(payerRow.city),
      SacadoEnderecoComplemento: optional(payerRow.complement),
      SacadoEnderecoPais: "Brasil",
      SacadoEnderecoUF: optional(payerRow.state),
      TituloDataEmissao: formatDateToTecnospeed(new Date().toISOString().slice(0, 10)),
      TituloDataVencimento: formatDateToTecnospeed(chargeRow.due_date),
      TituloNossoNumero: ourNumber,
      TituloNumeroDocumento: documentNumber,
      TituloValor: formatAmountFromCents(chargeRow.total_amount_cents),
      TituloLocalPagamento: "Pagável em qualquer banco até o vencimento.",
      TituloDocEspecie: "01",
      TituloAceite: "N",
      TituloMensagem01: messages.message1,
      TituloMensagem02: messages.message2,
      TituloCodigoJuros: "2",
      TituloDataJuros: penaltyStartDate,
      TituloValorJuros: "0,03",
      TituloCodigoMulta: "2",
      TituloDataMulta: penaltyStartDate,
      TituloValorMultaTaxa: "10,00",
      TituloCodProtesto: "1",
      TituloPrazoProtesto: "30",
      hibrido: true,
    };
    const requiredFields = [
      { label: "CPF/CNPJ do cedente", value: assignorDocument },
      { label: "Banco", value: body.CedenteContaCodigoBanco },
      { label: "Conta", value: body.CedenteContaNumero },
      { label: "Convênio", value: body.CedenteConvenioNumero },
      { label: "CPF/CNPJ do pagador", value: body.SacadoCPFCNPJ },
      { label: "Nome do pagador", value: body.SacadoNome },
      { label: "Logradouro do pagador", value: body.SacadoEnderecoLogradouro },
      { label: "Número do endereço", value: body.SacadoEnderecoNumero },
      { label: "Bairro do pagador", value: body.SacadoEnderecoBairro },
      { label: "CEP do pagador", value: body.SacadoEnderecoCEP },
      { label: "Cidade do pagador", value: body.SacadoEnderecoCidade },
      { label: "UF do pagador", value: body.SacadoEnderecoUF },
    ];
    const missingFields = requiredFields
      .filter((field) => !field.value)
      .map((field) => field.label);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { message: `Antes de registrar, preencha: ${missingFields.join(", ")}.` },
        { status: 400 }
      );
    }

    if (!isValidBillingOurNumber(ourNumber)) {
      return NextResponse.json(
        { message: "Nosso número inválido para registro do boleto." },
        { status: 400 }
      );
    }

    await deactivateChargeTickets(supabase, chargeId);

    const registeringTicket: ChargeTicketInsert = {
      charge_id: chargeId,
      provider: "tecnospeed",
      document_number: documentNumber,
      our_number: ourNumber,
      bank_code: String(body.CedenteContaCodigoBanco ?? ""),
      account_number: String(body.CedenteContaNumero ?? ""),
      agreement_number: String(body.CedenteConvenioNumero ?? ""),
      assignor_document: assignorDocument,
      ticket_status: "registering",
      provider_payload: toJson({ request: body }),
      is_active: true,
    };
    const { data: insertedTicket, error: insertTicketError } = await supabase
      .from("real_estate_charge_tickets")
      .insert(registeringTicket)
      .select("*")
      .single();

    if (insertTicketError) {
      throw new Error(insertTicketError.message);
    }

    const ticketRow = insertedTicket as RealEstateChargeTicketRow;
    ticketId = ticketRow.id;
    await syncChargeTicketMirror(supabase, chargeId, ticketRow);

    const response = await tecnospeedRequest<TecnospeedTicketPayload>({
      method: "POST",
      path: "/boletos/lote",
      headers: {
        "cnpj-cedente": assignorDocument,
      },
      body: [body],
    });
    const success = response._dados?._sucesso?.[0];
    const failure = response._dados?._falha?.[0];

    if (!success || response._status === "erro") {
      const message = normalizeTecnospeedMessage(response);
      const failedTicketUpdate = {
        ticket_status: "failed" as const,
        error_message: message,
        provider_payload: toJson(response),
        is_active: false,
        updated_at: new Date().toISOString(),
      };
      const { data: failedTicket, error: failedTicketError } = await supabase
        .from("real_estate_charge_tickets")
        .update({
          ...failedTicketUpdate,
        })
        .eq("id", ticketId)
        .select("*")
        .single();

      if (failedTicketError) {
        throw new Error(failedTicketError.message);
      }

      await syncChargeTicketMirror(
        supabase,
        chargeId,
        failedTicket as RealEstateChargeTicketRow,
        { chargeStatus: "open" }
      );

      await createEventNotification(supabase, {
        sourceKey: `real-estate-ticket:${ticketId}:failed`,
        actorUserId: appUser?.id ?? null,
        category: "billing",
        type: "ticket_generation_failed",
        title: getTicketNotificationTitle(null, true),
        message: `${assetRow.code ? `${assetRow.code} · ` : ""}${assetRow.title} · Competência ${formatCompetence(chargeRow.competence_month, chargeRow.competence_year)} · ${message}`,
        severity: "danger",
        entityType: "real_estate_charge",
        entityId: chargeId,
        actionHref: `/imobiliaria/${chargeRow.asset_id}/financeiro`,
        metadata: {
          chargeId,
          ticketId,
          provider: "tecnospeed",
          response: response as Json,
        },
        notifyActiveUsers: true,
      });

      return NextResponse.json({ message, response, failure }, { status: 400 });
    }

    const providerStatus = getStringField(success, [
      "situacao",
      "Situacao",
      "status",
      "Status",
    ]);
    const registeredTicketUpdate = {
      ticket_status: "registered" as const,
      integration_id: getStringField(success, ["IdIntegracao", "idintegracao", "id"]),
      print_id: getStringField(success, ["idImpressao", "IdImpressao"]),
      document_number: documentNumber,
      our_number: ourNumber,
      bank_code: String(body.CedenteContaCodigoBanco ?? ""),
      account_number: String(body.CedenteContaNumero ?? ""),
      agreement_number: String(body.CedenteConvenioNumero ?? ""),
      reference_code: getStringField(success, [
        "TituloCodigoReferencia",
        "tituloCodigoReferencia",
      ]),
      assignor_document: assignorDocument,
      provider_status: providerStatus,
      url: getStringField(success, ["UrlBoleto", "urlboleto"]) || null,
      digitable_line:
        getStringField(success, ["TituloLinhaDigitavel", "titulolinhadigitavel"]) ||
        null,
      pix_url: getStringField(success, ["UrlPix", "urlpix"]) || null,
      error_message: null,
      provider_payload: toJson(response),
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const { data: registeredTicket, error: registeredTicketError } = await supabase
      .from("real_estate_charge_tickets")
      .update({
        ...registeredTicketUpdate,
      })
      .eq("id", ticketId)
      .select("*")
      .single();

    if (registeredTicketError) {
      throw new Error(registeredTicketError.message);
    }

    await syncChargeTicketMirror(
      supabase,
      chargeId,
      registeredTicket as RealEstateChargeTicketRow
    );

    await createEventNotification(supabase, {
      sourceKey: `real-estate-ticket:${registeredTicketUpdate.integration_id ?? ticketId}:${providerStatus || "registered"}`,
      actorUserId: appUser?.id ?? null,
      category: "billing",
      type: "ticket_registered",
      title: getTicketNotificationTitle(providerStatus),
      message: `${assetRow.code ? `${assetRow.code} · ` : ""}${assetRow.title} · Competência ${formatCompetence(chargeRow.competence_month, chargeRow.competence_year)}${providerStatus ? ` · ${providerStatus}` : ""}`,
      severity: "success",
      entityType: "real_estate_charge",
      entityId: chargeId,
      actionHref: `/imobiliaria/${chargeRow.asset_id}/financeiro`,
      metadata: {
        chargeId,
        ticketId,
        integrationId: registeredTicketUpdate.integration_id,
        providerStatus,
        provider: "tecnospeed",
      },
      notifyActiveUsers: true,
    });

    return NextResponse.json({ ok: true, response }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao registrar boleto.";

    if (ticketId) {
      const { data: failedTicket } = await supabase
        .from("real_estate_charge_tickets")
        .update({
          ticket_status: "failed",
          error_message: message,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId)
        .select("*")
        .maybeSingle();

      if (failedTicket) {
        await syncChargeTicketMirror(
          supabase,
          chargeId,
          failedTicket as RealEstateChargeTicketRow,
          { chargeStatus: "open" }
        ).catch(() => undefined);
      }
    }

    await supabase
      .from("real_estate_charges")
      .update({
        ticket_status: "failed",
        ticket_provider: "tecnospeed",
        ticket_error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chargeId);

    return NextResponse.json(
      { message },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
