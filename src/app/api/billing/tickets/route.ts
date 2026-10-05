import { NextResponse } from "next/server";

import type {
  BillingRegistrationItem,
  BillingRegistrationResult,
  BillingReviewDraft,
} from "@/features/billing/billing-draft";
import {
  mapBankAccount,
  normalizePayload,
  type TecnospeedAccountsPayload,
  type TecnospeedBankAccount,
} from "@/features/billing/server/accounts";
import {
  getBrazilianBankName,
  hasBrazilianBankCode,
  normalizeBankCode,
} from "@/features/billing/banks";
import type {
  BillingTicket,
  BillingTicketsResponse,
} from "@/features/billing/types";
import type { Json } from "@/features/database/types";
import { isValidBillingOurNumber } from "@/features/billing/utils";
import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

type TecnospeedTicketPayload = {
  _status?: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: {
    _sucesso?: Array<Record<string, unknown>>;
    _falha?: Array<{
      erros?: Record<string, string[] | string>;
      erro?: string;
      mensagem?: string;
      [key: string]: unknown;
    }>;
  };
};

type TecnospeedTicketsQueryPayload = {
  _status?: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: unknown;
  _meta?: {
    _total?: number;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const document = onlyDigits(searchParams.get("document"));
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const requestedLimit = Number(searchParams.get("limit") ?? "8") || 8;
  const limit = Math.min(1000, Math.max(1, requestedLimit));
  const skip = (page - 1) * limit;

  if (!document) {
    return NextResponse.json(
      { message: "Informe o CPF/CNPJ do cedente." },
      { status: 400 }
    );
  }

  try {
    const query = new URLSearchParams({
      limit: "1000",
      sort: "-TituloDataEmissao",
    });
    const status = searchParams.get("status")?.trim();
    const payerName = searchParams.get("payerName")?.trim();
    const payerDocument = onlyDigits(searchParams.get("payerDocument"));
    const issueDateFrom = searchParams.get("issueDateFrom")?.trim();
    const issueDateTo = searchParams.get("issueDateTo")?.trim();
    const dueDateFrom = searchParams.get("dueDateFrom")?.trim();
    const dueDateTo = searchParams.get("dueDateTo")?.trim();

    const response = await tecnospeedRequest<TecnospeedTicketsQueryPayload>({
      path: `/boletos?${query.toString()}`,
      headers: {
        "cnpj-cedente": document,
      },
    });

    if (response._status === "erro") {
      return NextResponse.json(
        {
          message: response._mensagem ?? "Não foi possível consultar boletos.",
        },
        { status: 400 }
      );
    }

    const allTickets = enrichInstallmentTotals(
      normalizeTicketsPayload(response._dados).map(mapTicket)
    ).sort(compareTicketsByIssueDateDesc);
    const filteredTickets = filterTickets(allTickets, {
      status,
      payerName,
      payerDocument,
      issueDateFrom,
      issueDateTo,
      dueDateFrom,
      dueDateTo,
    });
    const tickets = filteredTickets.slice(skip, skip + limit);
    const total = filteredTickets.length;

    return NextResponse.json({
      tickets,
      total,
      page,
      limit,
      hasNext: skip + tickets.length < total,
    } satisfies BillingTicketsResponse);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao consultar boletos.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function formatDateToTecnospeed(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

type TicketFilterValues = {
  status?: string;
  payerName?: string;
  payerDocument?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
};

function normalizeText(value?: string | null) {
  return (
    value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim() ?? ""
  );
}

function parseTicketDate(value?: string | null) {
  if (!value) {
    return 0;
  }

  const rawDate = value.split(" ")[0];

  if (rawDate.includes("/")) {
    const [day, month, year] = rawDate.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00`).getTime();
  }

  return new Date(`${rawDate}T00:00:00`).getTime();
}

function parseInputDate(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`).getTime();
}

function getTodayTime() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function isTicketOverdue(ticket: BillingTicket) {
  const status = ticket.status.toUpperCase();
  const settledStatuses = new Set(["LIQUIDADO", "BAIXADO"]);
  const overdueEligibleStatuses = new Set([
    "SALVO",
    "EMITIDO",
    "REGISTRADO",
    "PENDENTE_RETENTATIVA",
  ]);

  return (
    !settledStatuses.has(status) &&
    overdueEligibleStatuses.has(status) &&
    parseTicketDate(ticket.dueDate) < getTodayTime()
  );
}

function filterTickets(tickets: BillingTicket[], filters: TicketFilterValues) {
  const status = filters.status?.trim();
  const payerName = normalizeText(filters.payerName);
  const payerDocument = onlyDigits(filters.payerDocument);
  const issueDateFrom = parseInputDate(filters.issueDateFrom);
  const issueDateTo = parseInputDate(filters.issueDateTo);
  const dueDateFrom = parseInputDate(filters.dueDateFrom);
  const dueDateTo = parseInputDate(filters.dueDateTo);

  return tickets.filter((ticket) => {
    if (status && status !== "Todas") {
      if (status === "VENCIDO") {
        if (!isTicketOverdue(ticket)) {
          return false;
        }
      } else if (ticket.status !== status) {
        return false;
      }
    }

    if (payerName && !normalizeText(ticket.payerName).includes(payerName)) {
      return false;
    }

    if (
      payerDocument &&
      !onlyDigits(ticket.payerDocument).includes(payerDocument)
    ) {
      return false;
    }

    const issueDate = parseTicketDate(ticket.issueDate);
    if (issueDateFrom !== null && issueDate < issueDateFrom) {
      return false;
    }

    if (issueDateTo !== null && issueDate > issueDateTo) {
      return false;
    }

    const dueDate = parseTicketDate(ticket.dueDate);
    if (dueDateFrom !== null && dueDate < dueDateFrom) {
      return false;
    }

    if (dueDateTo !== null && dueDate > dueDateTo) {
      return false;
    }

    return true;
  });
}

function addDaysToDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateToInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function splitAmount(total: string, count: number) {
  const totalCents = Math.round(parseCurrency(total) * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  return Array.from({ length: count }, (_, index) => {
    const cents = baseCents + (index < remainder ? 1 : 0);
    return formatCurrency(cents / 100);
  });
}

function optional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
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

    if (entry && entry[1] && typeof entry[1] === "object") {
      return entry[1];
    }
  }

  return null;
}

function normalizeRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => {
    return Boolean(item) && typeof item === "object" && !Array.isArray(item);
  });
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

function getInstallmentLabel(source: Record<string, unknown>) {
  const installment = getStringField(source, [
    "TituloParcela",
    "TituloParcelaNumero",
    "parcela",
  ]);
  return installment || "1/1";
}

function enrichInstallmentTotals(tickets: BillingTicket[]) {
  const groups = new Map<string, BillingTicket[]>();

  for (const ticket of tickets) {
    const key =
      ticket.documentNumber.replace(/\d{2}$/, "") ||
      ticket.ourNumber.replace(/\d{2}$/, "") ||
      ticket.payerDocument;
    groups.set(key, [...(groups.get(key) ?? []), ticket]);
  }

  return tickets.map((ticket) => {
    if (ticket.installment.includes("/")) {
      return ticket;
    }

    const key =
      ticket.documentNumber.replace(/\d{2}$/, "") ||
      ticket.ourNumber.replace(/\d{2}$/, "") ||
      ticket.payerDocument;
    const total = groups.get(key)?.length ?? 1;

    return {
      ...ticket,
      installment: `${ticket.installment}/${total}`,
    };
  });
}

function getTicketFailureMessage(source: Record<string, unknown>) {
  const messages = [
    getStringField(source, ["motivo", "Motivo", "mensagem", "Mensagem"]),
    getStringField(source, ["erro", "Erro", "_erro", "_mensagem"]),
    getStringField(source, ["retorno", "Retorno", "situacao_motivo"]),
  ].filter(Boolean);

  return messages.length ? messages.join(" ") : null;
}

function getTicketMovements(source: Record<string, unknown>) {
  return normalizeRecordArray(
    getObjectField(source, ["TituloMovimentos", "titulomovimentos"])
  ).map((movement) => {
    const returns = getObjectField(movement, ["retornos"]);

    return {
      code: getStringField(movement, ["codigo", "Codigo", "code"]),
      message: getStringField(movement, ["mensagem", "Mensagem", "message"]),
      date: getStringField(movement, ["data", "Data", "date"]),
      origin:
        returns && !Array.isArray(returns)
          ? getStringField(returns as Record<string, unknown>, [
              "origem",
              "Origem",
            ]) || null
          : null,
    };
  });
}

function getTicketOccurrences(source: Record<string, unknown>) {
  return normalizeRecordArray(
    getObjectField(source, ["TituloOcorrencias", "tituloocorrencias"])
  ).map((occurrence) => ({
    code: getStringField(occurrence, ["codigo", "Codigo", "code"]),
    message: getStringField(occurrence, ["mensagem", "Mensagem", "message"]),
    date: getStringField(occurrence, ["data", "Data", "date"]) || null,
  }));
}

function getTicketBank(source: Record<string, unknown>) {
  const bankCodeValue = getStringField(source, [
    "CedenteContaCodigoBanco",
    "CedenteCodigoBanco",
    "contacodigobanco",
    "ContaCodigoBanco",
    "codigo_banco",
    "CodigoBanco",
    "BancoCodigo",
    "bancocodigo",
    "bankCode",
    "bank_code",
  ]);
  const bankNameValue = getStringField(source, [
    "Banco",
    "banco",
    "NomeBanco",
    "BancoNome",
    "CedenteContaBanco",
    "contabanco",
  ]);
  const bankCodeDigits = onlyDigits(bankCodeValue || bankNameValue);
  const documentNumber = getStringField(source, [
    "TituloNumeroDocumento",
    "titulonumerodocumento",
  ]);
  const documentBankCode = normalizeBankCode(
    onlyDigits(documentNumber).slice(0, 3)
  );
  const bankCode = bankCodeDigits
    ? normalizeBankCode(bankCodeDigits)
    : hasBrazilianBankCode(documentBankCode)
      ? documentBankCode
      : "";

  return {
    bankCode,
    bankName: bankCode
      ? getBrazilianBankName(bankCode)
      : bankNameValue || "Não informado",
  };
}

function mapTicket(source: Record<string, unknown>): BillingTicket {
  const bank = getTicketBank(source);

  return {
    integrationId: getStringField(source, ["IdIntegracao", "idintegracao", "id"]),
    status: getStringField(source, ["situacao", "Situacao"]) || "Não informado",
    bankCode: bank.bankCode,
    bankName: bank.bankName,
    ourNumber: getStringField(source, ["TituloNossoNumero", "titulonossonumero"]),
    documentNumber: getStringField(source, [
      "TituloNumeroDocumento",
      "titulonumerodocumento",
    ]),
    installment: getInstallmentLabel(source),
    payerName: getStringField(source, ["SacadoNome", "sacadonome"]),
    payerDocument: getStringField(source, ["SacadoCPFCNPJ", "sacadocpfcnpj"]),
    payerPhone: getStringField(source, [
      "SacadoCelular",
      "sacadocelular",
      "SacadoTelefone",
      "sacadotelefone",
    ]),
    payerEmail: getStringField(source, ["SacadoEmail", "sacadoemail"]),
    issueDate: getStringField(source, [
      "TituloDataEmissao",
      "titulodataemissao",
    ]),
    dueDate: getStringField(source, [
      "TituloDataVencimento",
      "titulodatavencimento",
    ]),
    amount: getStringField(source, ["TituloValor", "titulovalor"]),
    boletoUrl: getStringField(source, ["UrlBoleto", "urlboleto"]) || null,
    pixUrl: getStringField(source, ["UrlPix", "urlpix"]) || null,
    digitableLine:
      getStringField(source, ["TituloLinhaDigitavel", "titulolinhadigitavel"]) ||
      null,
    failureMessage: getTicketFailureMessage(source),
    movements: getTicketMovements(source),
    occurrences: getTicketOccurrences(source),
  };
}

function getTicketDateTime(value: string) {
  const rawDate = value;

  if (!rawDate) {
    return 0;
  }

  if (rawDate.includes("/")) {
    const [day, month, year] = rawDate.split(" ")[0].split("/");
    return new Date(`${year}-${month}-${day}T00:00:00`).getTime();
  }

  return new Date(`${rawDate.split(" ")[0]}T00:00:00`).getTime();
}

function getInstallmentSortNumber(ticket: BillingTicket) {
  const [currentInstallment] = ticket.installment.split("/");
  return Number(currentInstallment.replace(/\D/g, "")) || 0;
}

function compareTicketsByIssueDateDesc(a: BillingTicket, b: BillingTicket) {
  const issueDateDiff =
    getTicketDateTime(b.issueDate) - getTicketDateTime(a.issueDate);

  if (issueDateDiff !== 0) {
    return issueDateDiff;
  }

  const dueDateDiff = getTicketDateTime(b.dueDate) - getTicketDateTime(a.dueDate);

  if (dueDateDiff !== 0) {
    return dueDateDiff;
  }

  const installmentDiff =
    getInstallmentSortNumber(a) - getInstallmentSortNumber(b);

  if (installmentDiff !== 0) {
    return installmentDiff;
  }

  return a.integrationId.localeCompare(b.integrationId);
}

function normalizeTecnospeedMessage(response: TecnospeedTicketPayload) {
  const responseMessages = extractTecnospeedMessages(response).filter(
    (message) =>
      message !== "sucesso" &&
      message !== "erro" &&
      message !== response._mensagem
  );
  const failures = response._dados?._falha;

  if (failures?.length) {
    const messages = failures.flatMap(extractTecnospeedMessages);

    if (messages.length) {
      return messages.join(" ");
    }
  }

  if (response._mensagem) {
    return response._mensagem;
  }

  if (responseMessages.length) {
    return responseMessages.join(" ");
  }

  return "Não foi possível registrar a cobrança.";
}

function findRequestBody(
  bodies: Record<string, unknown>[],
  item: Record<string, unknown>,
  index: number
) {
  const documentNumber = getStringField(item, [
    "TituloNumeroDocumento",
    "tituloNumeroDocumento",
    "titulo_numero_documento",
  ]);
  const ourNumber = getStringField(item, [
    "TituloNossoNumero",
    "tituloNossoNumero",
    "titulo_nosso_numero",
  ]);

  return (
    bodies.find((body) => {
      return (
        (documentNumber &&
          String(body.TituloNumeroDocumento) === documentNumber) ||
        (ourNumber && String(body.TituloNossoNumero) === ourNumber)
      );
    }) ??
    bodies[index] ??
    bodies[0]
  );
}

function getBodyInstallment(body: Record<string, unknown>, fallbackIndex: number) {
  return String(body.TituloParcela ?? `${fallbackIndex + 1}/1`);
}

function mapRegistrationItem(
  item: Record<string, unknown>,
  body: Record<string, unknown>,
  index: number,
  isFailure: boolean
): BillingRegistrationItem {
  return {
    integrationId: getStringField(item, ["IdIntegracao", "idintegracao", "id"]),
    status:
      getStringField(item, ["situacao", "Situacao", "status", "Status"]) ||
      (isFailure ? "FALHA" : "CRIADO"),
    documentNumber: String(body.TituloNumeroDocumento ?? ""),
    installment: getBodyInstallment(body, index),
    payerName: String(body.SacadoNome ?? ""),
    payerDocument: String(body.SacadoCPFCNPJ ?? ""),
    amount: String(body.TituloValor ?? ""),
    dueDate: String(body.TituloDataVencimento ?? ""),
    message: isFailure ? extractTecnospeedMessages(item).join(" ") || null : null,
  };
}

function buildRegistrationResult(
  response: TecnospeedTicketPayload,
  bodies: Record<string, unknown>[],
  draft: BillingReviewDraft
): BillingRegistrationResult {
  const successes = (response._dados?._sucesso ?? []).map((item, index) =>
    mapRegistrationItem(item, findRequestBody(bodies, item, index), index, false)
  );
  const failures = (response._dados?._falha ?? []).map((item, index) =>
    mapRegistrationItem(item, findRequestBody(bodies, item, index), index, true)
  );

  return {
    createdAt: new Date().toISOString(),
    payerPhone: draft.payer?.phone ?? null,
    successes,
    failures,
  };
}

function extractTecnospeedMessages(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractTecnospeedMessages);
  }

  if (typeof value !== "object") {
    return [String(value)];
  }

  const record = value as Record<string, unknown>;
  const directMessages = [
    record._mensagem,
    record.mensagem,
    record.message,
    record._erro,
    record.erro,
    record.error,
  ].flatMap(extractTecnospeedMessages);
  const validationMessages =
    record.erros && typeof record.erros === "object"
      ? Object.entries(record.erros as Record<string, unknown>).map(
          ([field, errors]) => {
            const message = extractTecnospeedMessages(errors).join(" ");
            return `${field}: ${message}`;
          }
        )
      : [];
  const fieldMessages =
    record._campo || record.campo
      ? [
          `${String(record._campo ?? record.campo)}: ${extractTecnospeedMessages(
            record._erro ?? record.erro ?? record.mensagem
          ).join(" ")}`,
        ]
      : [];

  return [...directMessages, ...validationMessages, ...fieldMessages].filter(
    Boolean
  );
}

function hasCompleteBankData(draft: BillingReviewDraft) {
  return Boolean(
    onlyDigits(draft.account?.bankCode) &&
      onlyDigits(draft.account?.accountNumber) &&
      onlyDigits(draft.agreement?.number)
  );
}

async function enrichDraftBankData(draft: BillingReviewDraft) {
  if (hasCompleteBankData(draft)) {
    return draft;
  }

  const response = await tecnospeedRequest<TecnospeedAccountsPayload>({
    path: "/cedentes/contas",
    headers: {
      "cnpj-cedente": onlyDigits(draft.assignor.document),
    },
  });
  const accounts = normalizePayload(
    response._dados as TecnospeedBankAccount[] | TecnospeedBankAccount
  ).map(mapBankAccount);
  const account =
    accounts.find((item) => String(item.id) === draft.values.accountId) ?? null;
  const agreement =
    account?.agreements.find(
      (item) => String(item.id) === draft.values.agreementId
    ) ?? null;

  return {
    ...draft,
    account: account
      ? {
          id: String(account.id),
          label: draft.account?.label ?? String(account.id),
          bankCode: account.bankCode,
          accountNumber: account.accountNumber,
          accountDigit: account.accountDigit,
        }
      : draft.account,
    agreement: agreement
      ? {
          id: String(agreement.id),
          label: draft.agreement?.label ?? String(agreement.id),
          number: agreement.number,
          wallet: agreement.wallet,
        }
      : draft.agreement,
  } satisfies BillingReviewDraft;
}

function buildTicketBody(draft: BillingReviewDraft) {
  const { values, account, agreement, payer } = draft;
  const body: Record<string, unknown> = {
    CedenteContaCodigoBanco: onlyDigits(account?.bankCode),
    CedenteContaNumero: onlyDigits(account?.accountNumber),
    CedenteContaNumeroDV: onlyDigits(account?.accountDigit),
    CedenteConvenioNumero: onlyDigits(agreement?.number),
    TituloCarteira: optional(agreement?.wallet),

    SacadoCPFCNPJ: onlyDigits(payer?.document),
    SacadoNome: optional(payer?.name),
    SacadoEmail: optional(payer?.email),
    SacadoTelefone: onlyDigits(payer?.phone),
    SacadoEnderecoLogradouro: optional(payer?.street),
    SacadoEnderecoNumero: optional(payer?.number),
    SacadoEnderecoBairro: optional(payer?.district),
    SacadoEnderecoCEP: onlyDigits(payer?.zipCode),
    SacadoEnderecoCidade: optional(payer?.city),
    SacadoEnderecoComplemento: optional(payer?.complement),
    SacadoEnderecoPais: "Brasil",
    SacadoEnderecoUF: optional(payer?.state),

    TituloDataEmissao: formatDateToTecnospeed(values.issueDate),
    TituloDataVencimento: formatDateToTecnospeed(values.dueDate),
    TituloNossoNumero: onlyDigits(values.ourNumber).slice(0, 6),
    TituloNumeroDocumento: values.documentNumber.slice(0, 10),
    TituloValor: values.amount,
    TituloLocalPagamento: values.paymentPlace,
    TituloDocEspecie: values.documentSpecies,
    TituloAceite: values.accept,
    TituloMensagem01: optional(values.message1),
    TituloMensagem02: optional(values.message2),
    hibrido: values.isHybrid,
  };

  if (values.interestCode) {
    body.TituloCodigoJuros = values.interestCode;
  }
  if (values.interestCode !== "3") {
    body.TituloDataJuros = formatDateToTecnospeed(values.interestDate);
    body.TituloValorJuros = values.interestValue;
  }

  if (values.fineCode) {
    body.TituloCodigoMulta = values.fineCode;
  }
  if (values.fineCode !== "0") {
    body.TituloDataMulta = formatDateToTecnospeed(values.fineDate);
    body.TituloValorMultaTaxa = values.fineValue;
  }

  if (values.discountCode) {
    body.TituloCodDesconto = values.discountCode;
  }
  if (values.discountCode !== "0") {
    body.TituloDataDesconto = formatDateToTecnospeed(values.discountDate);
    body.TituloValorDescontoTaxa = values.discountValue;
    body.TituloValorDesconto = values.discountValue;
  }

  if (values.protestCode) {
    body.TituloCodProtesto = values.protestCode;
  }
  if (!["3", "9"].includes(values.protestCode)) {
    body.TituloPrazoProtesto = values.protestDays;
  }

  if (values.writeOffCode) {
    body.TituloCodBaixaDevolucao = values.writeOffCode;
  }
  if (values.writeOffCode === "1") {
    body.TituloPrazoBaixa = values.writeOffDays;
  }

  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined && value !== "")
  );
}

function buildTicketBodies(draft: BillingReviewDraft) {
  const { values } = draft;
  const installmentCount = values.installmentEnabled
    ? Math.max(1, Number.parseInt(values.installmentCount, 10) || 1)
    : 1;
  const interval = Math.max(
    1,
    Number.parseInt(values.installmentInterval, 10) || 30
  );
  const amounts = splitAmount(values.amount, installmentCount);

  return Array.from({ length: installmentCount }, (_, index) => {
    const installmentNumber = index + 1;
    const dueDate =
      index === 0
        ? values.dueDate
        : formatDateToInput(addDaysToDate(values.dueDate, interval * index));
    const instructionDate = formatDateToInput(addDaysToDate(dueDate, 1));
    const suffix = String(installmentNumber).padStart(2, "0");
    const installmentDraft: BillingReviewDraft = {
      ...draft,
      values: {
        ...values,
        dueDate,
        amount: amounts[index],
        documentNumber:
          installmentCount > 1
            ? `${values.documentNumber.slice(0, 8)}${suffix}`.slice(0, 10)
            : values.documentNumber,
        ourNumber:
          installmentCount > 1
            ? `${values.ourNumber.slice(0, 4)}${suffix}`.slice(0, 6)
            : values.ourNumber.slice(0, 6),
        interestDate:
          values.interestCode !== "3" ? instructionDate : values.interestDate,
        fineDate: values.fineCode !== "0" ? instructionDate : values.fineDate,
      },
    };
    const body = buildTicketBody(installmentDraft);

    if (installmentCount > 1) {
      body.TituloParcela = `${installmentNumber}/${installmentCount}`;
    }

    return body;
  });
}

export async function POST(request: Request) {
  const incomingDraft = (await request.json()) as BillingReviewDraft;
  const draft = await enrichDraftBankData(incomingDraft);
  const bodies = buildTicketBodies(draft);
  const body = bodies[0];
  const requiredFields = [
    { label: "CPF/CNPJ do cedente", value: onlyDigits(draft.assignor.document) },
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
    { label: "Valor", value: body.TituloValor },
    { label: "Data de emissão", value: body.TituloDataEmissao },
    { label: "Data de vencimento", value: body.TituloDataVencimento },
    { label: "Nosso número", value: body.TituloNossoNumero },
    { label: "Número do documento", value: body.TituloNumeroDocumento },
  ];
  const missingFields = requiredFields
    .filter((field) => !field.value)
    .map((field) => field.label);

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        message: `Antes de registrar, preencha: ${missingFields.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  if (
    bodies.some(
      (ticketBody) =>
        !isValidBillingOurNumber(String(ticketBody.TituloNossoNumero ?? ""))
    )
  ) {
    return NextResponse.json(
      {
        message:
          "Nosso número inválido: use até 6 dígitos e inicie com um número entre 2 e 9.",
      },
      { status: 400 }
    );
  }

  try {
    const response = await tecnospeedRequest<TecnospeedTicketPayload>({
      method: "POST",
      path: "/boletos/lote",
      headers: {
        "cnpj-cedente": onlyDigits(draft.assignor.document),
      },
      body: bodies,
    });

    if (
      response._status === "erro" &&
      !response._dados?._falha?.length &&
      !response._dados?._sucesso?.length
    ) {
      return NextResponse.json(
        { message: normalizeTecnospeedMessage(response), response },
        { status: 400 }
      );
    }

    const result = buildRegistrationResult(response, bodies, draft);
    const successCount = result.successes.length;
    const failureCount = result.failures.length;
    const supabase = createAdminClient();

    await createInternalActionNotification(supabase, {
      sourceKey: `billing-ticket-registered:${result.createdAt}:${result.successes
        .map((item) => item.integrationId)
        .join(",")}`,
      category: "billing",
      type: failureCount > 0 ? "billing_ticket_registration_partial" : "billing_ticket_registered",
      title:
        failureCount > 0
          ? "Cobrança registrada com pendência"
          : "Cobrança registrada",
      message:
        successCount === 1 && failureCount === 0
          ? `${result.successes[0]?.payerName ?? "Pagador"} · ${result.successes[0]?.amount ?? ""}`
          : `${successCount} boleto(s) registrado(s) · ${failureCount} falha(s)`,
      severity: failureCount > 0 ? "warning" : "success",
      entityType: "billing_ticket",
      entityId: result.successes[0]?.integrationId ?? null,
      actionHref: "/cobranca",
      metadata: {
        assignorDocument: onlyDigits(draft.assignor.document),
        assignorName: draft.assignor.name,
        payerName: draft.payer?.name ?? null,
        successCount,
        failureCount,
        integrationIds: result.successes.map((item) => item.integrationId),
        response: response as Json,
      },
    });

    return NextResponse.json({ result, response }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao registrar cobrança.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
