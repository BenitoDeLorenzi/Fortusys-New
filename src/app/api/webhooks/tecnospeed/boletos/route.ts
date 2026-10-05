import { NextResponse } from "next/server";

import type { Database, Json } from "@/features/database/types";
import { createEventNotification } from "@/features/notifications/server/notification-service";
import {
  isProviderDischargedStatus,
  isProviderActiveTicketStatus,
  mapRealEstateTicketStatus,
} from "@/features/real-estate/server/charge-tickets";
import { createAdminClient } from "@/lib/supabase/admin";

type RealEstateChargeUpdate =
  Database["public"]["Tables"]["real_estate_charges"]["Update"];

type TecnospeedBillingWebhookPayload = {
  tipoWH?: string;
  dataHoraEnvio?: string;
  CpfCnpjCedente?: string;
  titulo?: {
    situacao?: string;
    idintegracao?: string;
    IdIntegracao?: string;
    TituloNossoNumero?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
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

  return {};
}

function validateWebhookToken(request: Request) {
  const expectedToken = process.env.TECNOSPEED_WEBHOOK_TOKEN;

  if (!expectedToken) {
    return true;
  }

  const receivedToken =
    request.headers.get("x-fortusys-webhook-token") ??
    request.headers.get("x-tecnospeed-webhook-token");
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : authorization;

  return receivedToken === expectedToken || bearerToken === expectedToken;
}

function normalizeStatus(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isPaidStatus(status?: string | null) {
  const normalized = normalizeStatus(status);
  return normalized.includes("liquid") || normalized.includes("pago");
}

function isOverdueStatus(status?: string | null) {
  const normalized = normalizeStatus(status);
  return normalized.includes("venc");
}

function getNotificationSeverity(status?: string | null) {
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

function getNotificationTitle(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized.includes("falh") || normalized.includes("rejeit")) {
    return "Boleto com falha";
  }

  if (normalized.includes("liquid") || normalized.includes("pago")) {
    return "Boleto liquidado";
  }

  if (normalized.includes("baix")) {
    return "Boleto baixado";
  }

  if (normalized.includes("venc")) {
    return "Boleto vencido";
  }

  if (normalized.includes("registr")) {
    return "Boleto registrado";
  }

  return "Status do boleto atualizado";
}

export async function POST(request: Request) {
  if (!validateWebhookToken(request)) {
    return NextResponse.json(
      { message: "Webhook não autorizado." },
      { status: 401 }
    );
  }

  try {
    const payload = (await request.json()) as TecnospeedBillingWebhookPayload;
    const payloadRecord = payload as Record<string, unknown>;
    const title = getObjectField(payloadRecord, ["titulo"]);
    const integrationId = getStringField(title, [
      "idintegracao",
      "IdIntegracao",
      "id",
    ]).trim();
    const assignorDocument = onlyDigits(
      getStringField(payloadRecord, [
        "CpfCnpjCedente",
        "cpfCnpjCedente",
        "cnpjCedente",
      ])
    );
    const status = getStringField(title, ["situacao", "Situacao"]) || null;
    const eventType = getStringField(payloadRecord, ["tipoWH", "tipoWh"]) || null;
    const supabase = createAdminClient();

    const { error: eventError } = await supabase
      .from("billing_webhook_events")
      .insert({
        provider: "tecnospeed",
        event_type: eventType,
        assignor_document: assignorDocument || null,
        integration_id: integrationId || null,
        status,
        payload: payload as Json,
      });

    if (eventError) {
      throw new Error(eventError.message);
    }

    if (integrationId) {
      const { error: cacheError } = await supabase
        .from("billing_ticket_status_cache")
        .upsert({
          integration_id: integrationId,
          provider: "tecnospeed",
          assignor_document: assignorDocument || null,
          status,
          event_type: eventType,
          last_payload: payload as Json,
          updated_at: new Date().toISOString(),
        });

      if (cacheError) {
        throw new Error(cacheError.message);
      }

      const realEstateTicketStatus = mapRealEstateTicketStatus(status);
      const realEstateUpdate: RealEstateChargeUpdate = {
        ticket_provider_status: status,
        ticket_provider_payload: payload as Json,
        updated_at: new Date().toISOString(),
      };

      if (realEstateTicketStatus) {
        realEstateUpdate.ticket_status = realEstateTicketStatus;
      }

      if (isPaidStatus(status)) {
        realEstateUpdate.status = "paid";
      }

      if (isProviderDischargedStatus(status)) {
        realEstateUpdate.status = "canceled";
      }

      if (isOverdueStatus(status)) {
        realEstateUpdate.status = "overdue";
      }

      if (realEstateTicketStatus) {
        const { error: ticketError } = await supabase
          .from("real_estate_charge_tickets")
          .update({
            provider_status: status,
            ticket_status: realEstateTicketStatus,
            provider_payload: payload as Json,
            is_active: isProviderActiveTicketStatus(status),
            updated_at: new Date().toISOString(),
          })
          .eq("integration_id", integrationId);

        if (ticketError) {
          throw new Error(ticketError.message);
        }
      }

      const { error: realEstateChargeError } = await supabase
        .from("real_estate_charges")
        .update(realEstateUpdate)
        .eq("ticket_integration_id", integrationId);

      if (realEstateChargeError) {
        throw new Error(realEstateChargeError.message);
      }

      let { data: chargeForNotification } = await supabase
        .from("real_estate_charges")
        .select("id,asset_id,competence_month,competence_year,total_amount_cents")
        .eq("ticket_integration_id", integrationId)
        .maybeSingle();

      if (!chargeForNotification) {
        const { data: ticketForNotification } = await supabase
          .from("real_estate_charge_tickets")
          .select("charge_id")
          .eq("integration_id", integrationId)
          .maybeSingle();

        if (ticketForNotification?.charge_id) {
          const { data: chargeByTicket } = await supabase
            .from("real_estate_charges")
            .select("id,asset_id,competence_month,competence_year,total_amount_cents")
            .eq("id", ticketForNotification.charge_id)
            .maybeSingle();

          chargeForNotification = chargeByTicket;
        }
      }

      if (chargeForNotification) {
        const { data: assetForNotification } = await supabase
          .from("real_estate_assets")
          .select("code,title")
          .eq("id", chargeForNotification.asset_id)
          .maybeSingle();
        const competence = `${String(
          chargeForNotification.competence_month
        ).padStart(2, "0")}/${chargeForNotification.competence_year}`;
        const assetTitle = assetForNotification
          ? `${assetForNotification.code ? `${assetForNotification.code} · ` : ""}${assetForNotification.title}`
          : "Imóvel";

        await createEventNotification(supabase, {
          sourceKey: `tecnospeed:${integrationId}:${status ?? eventType ?? "status"}`,
          category: "billing",
          type: "ticket_status",
          title: getNotificationTitle(status),
          message: `${assetTitle} · Competência ${competence}${status ? ` · ${status}` : ""}`,
          severity: getNotificationSeverity(status),
          entityType: "real_estate_charge",
          entityId: chargeForNotification.id,
          actionHref: `/imobiliaria/${chargeForNotification.asset_id}/financeiro`,
          metadata: {
            integrationId,
            status,
            eventType,
            provider: "tecnospeed",
          },
          notifyActiveUsers: true,
        });
      } else {
        await createEventNotification(supabase, {
          sourceKey: `tecnospeed-billing:${integrationId}:${status ?? eventType ?? "status"}`,
          category: "billing",
          type: "billing_ticket_status",
          title: getNotificationTitle(status),
          message: `Boleto ${integrationId}${status ? ` · ${status}` : ""}`,
          severity: getNotificationSeverity(status),
          entityType: "billing_ticket",
          entityId: integrationId,
          actionHref: "/cobranca",
          metadata: {
            integrationId,
            status,
            eventType,
            assignorDocument,
            provider: "tecnospeed",
          },
          notifyActiveUsers: true,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível processar o webhook.",
      },
      { status: 400 }
    );
  }
}
