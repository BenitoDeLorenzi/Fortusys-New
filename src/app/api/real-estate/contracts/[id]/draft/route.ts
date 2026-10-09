import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { Json } from "@/features/database/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import {
  REAL_ESTATE_DOCUMENT_LIMIT,
  REAL_ESTATE_DOCUMENT_MAX_BYTES,
  REAL_ESTATE_DOCUMENTS_BUCKET,
  type RealEstateDocument,
} from "@/features/real-estate/documents";
import type { RealEstateLeaseDocumentStatus } from "@/features/real-estate/leases";
import { createAdminClient } from "@/lib/supabase/admin";
import { withCurrentLandlord } from "@/features/real-estate/server/current-landlord";

type DraftRouteProps = {
  params: Promise<{ id: string }>;
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
  templateType?: ContractDraftTemplate | null;
};

type ContractDraftTemplate = "residential" | "commercial";

type LeaseRow = {
  id: string;
  code: number | null;
  asset_id: string;
  tenant_id: string;
  status: "draft" | "active" | "ended" | "canceled";
  document_status: RealEstateLeaseDocumentStatus;
  contract_number: string | null;
  start_date: string;
  end_date: string;
  payment_due_day: number | null;
  rent_amount_cents: number;
  guarantee_type:
    | "none"
    | "deposit"
    | "guarantor"
    | "insurance"
    | "capitalization";
  guarantee_amount_cents: number | null;
  adjustment_index: "none" | "ipca" | "igpm" | "other";
  next_adjustment_date: string | null;
  guarantor_id: string | null;
  guarantor_name: string | null;
  guarantor_document: string | null;
  notes: string | null;
};

type AssetRow = {
  id: string;
  code: number | null;
  title: string;
  type: string;
  motive: string | null;
  address: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  registration_number: string | null;
  municipal_registration: string | null;
  rent_amount: string | null;
  landlord_name: string | null;
  landlord_document: string | null;
  metadata: Json;
  documents: Json;
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

type ContractModelClause = {
  id: string;
  title: string;
  text: string;
  order: number;
};

type ContractModelRow = {
  id: string;
  name: string;
  contract_purpose: "rental" | "sale";
  property_usage: "residential" | "commercial";
  description: string | null;
  notes: string | null;
  status: "active" | "inactive";
  witness_1_name: string | null;
  witness_1_document: string | null;
  witness_2_name: string | null;
  witness_2_document: string | null;
  clauses: unknown;
};

const adjustmentLabels: Record<LeaseRow["adjustment_index"], string> = {
  none: "Sem reajuste",
  ipca: "IPCA",
  igpm: "IGP-M",
  other: "Outro índice",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStoredDocuments(value: Json): StoredDocument[] {
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
          item.templateType === "residential" || item.templateType === "commercial"
            ? item.templateType
            : null,
      };
    })
    .filter((document): document is StoredDocument => Boolean(document));
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatLongDate(value?: string | null) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCurrencyFromCents(value?: number | null) {
  if (typeof value !== "number") {
    return "Não informado";
  }

  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDocument(value?: string | null) {
  const rawValue = value?.trim();
  const digits = rawValue?.replace(/\D/g, "") ?? "";

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
      6,
      9
    )}-${digits.slice(9)}`;
  }

  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
      5,
      8
    )}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  return rawValue || "Documento não informado";
}

function getAssetAddress(asset: AssetRow) {
  const composed = [
    asset.street,
    asset.number,
    asset.district,
    asset.city,
    asset.state,
  ]
    .filter(Boolean)
    .join(", ");

  return asset.address?.trim() || composed || "Endereço não informado";
}

function getMetadataString(metadata: Json, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatAssetType(value?: string | null) {
  const labels: Record<string, string> = {
    apartment: "Apartamento",
    commercial: "Comercial",
    house: "Casa",
    land: "Terreno",
    room: "Sala",
    warehouse: "Galpão",
  };
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "Não informado";
  }

  return labels[normalized] ?? value?.trim() ?? "Não informado";
}

function getLandlordDetails(asset: AssetRow) {
  const name =
    asset.landlord_name ??
    getMetadataString(asset.metadata, "landlordName") ??
    "Não informado";
  const document =
    asset.landlord_document ?? getMetadataString(asset.metadata, "landlordDocument");
  const street = getMetadataString(asset.metadata, "landlordStreet");
  const number = getMetadataString(asset.metadata, "landlordNumber");
  const complement = getMetadataString(asset.metadata, "landlordComplement");
  const district = getMetadataString(asset.metadata, "landlordDistrict");
  const city = getMetadataString(asset.metadata, "landlordCity");
  const state = getMetadataString(asset.metadata, "landlordState");
  const streetLine = [street, number]
    .filter((item): item is string => Boolean(item?.trim()))
    .join(", ");
  const districtLine = [district, city, state]
    .filter((item): item is string => Boolean(item?.trim()))
    .join(", ");
  const address = [streetLine, complement, districtLine]
    .filter((item): item is string => Boolean(item?.trim()))
    .join(" - ");

  return {
    name,
    tradeName: getMetadataString(asset.metadata, "landlordTradeName"),
    document: formatDocument(document),
    email: getMetadataString(asset.metadata, "landlordEmail"),
    phone: getMetadataString(asset.metadata, "landlordPhone"),
    zipCode: getMetadataString(asset.metadata, "landlordZipCode"),
    street,
    number,
    complement,
    district,
    city,
    state,
    address: address || "Endereço não informado",
  };
}

function hasPdfValue(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
      normalized !== "não informado" &&
      normalized !== "documento não informado" &&
      normalized !== "endereço não informado"
  );
}

function normalizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function ensureDocumentsBucket() {
  const supabase = createAdminClient();
  const { data } = await supabase.storage.getBucket(
    REAL_ESTATE_DOCUMENTS_BUCKET
  );

  if (data) {
    return;
  }

  const { error } = await supabase.storage.createBucket(
    REAL_ESTATE_DOCUMENTS_BUCKET,
    {
      public: false,
      fileSizeLimit: REAL_ESTATE_DOCUMENT_MAX_BYTES,
      allowedMimeTypes: ["application/pdf"],
    }
  );

  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(error.message);
  }
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

function normalizeClauses(value: unknown): ContractModelClause[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item, index) => {
      if (!isRecord(item)) {
        return [];
      }

      const title = typeof item.title === "string" ? item.title.trim() : "";
      const text = typeof item.text === "string" ? item.text.trim() : "";

      if (!title && !text) {
        return [];
      }

      return [
        {
          id:
            typeof item.id === "string" && item.id.trim()
              ? item.id.trim()
              : `clause-${index + 1}`,
          title: title || `Cláusula ${index + 1}`,
          text,
          order: Number.isFinite(Number(item.order))
            ? Number(item.order)
            : index + 1,
        },
      ];
    })
    .sort((a, b) => a.order - b.order);
}

function getLeaseDurationLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Prazo não informado";
  }

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 0 : -1);

  if (months > 0) {
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  }

  const days = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / 86_400_000)
  );

  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function numberToWordsPtBr(value: number): string {
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function belowThousand(input: number): string {
    if (input === 0) return "";
    if (input === 100) return "cem";
    if (input < 10) return units[input];
    if (input < 20) return teens[input - 10];
    if (input < 100) {
      const ten = Math.floor(input / 10);
      const unit = input % 10;
      return unit ? `${tens[ten]} e ${units[unit]}` : tens[ten];
    }

    const hundred = Math.floor(input / 100);
    const rest = input % 100;
    return rest ? `${hundreds[hundred]} e ${belowThousand(rest)}` : hundreds[hundred];
  }

  if (value === 0) return "zero";

  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const rest = value % 1_000;
  const parts: string[] = [];

  if (millions) {
    parts.push(`${belowThousand(millions)} ${millions === 1 ? "milhão" : "milhões"}`);
  }

  if (thousands) {
    parts.push(thousands === 1 ? "mil" : `${belowThousand(thousands)} mil`);
  }

  if (rest) {
    parts.push(belowThousand(rest));
  }

  return parts.join(" e ");
}

function currencyToWordsFromCents(value: number) {
  const reais = Math.floor(value / 100);
  const cents = value % 100;
  const realText = `${numberToWordsPtBr(reais)} ${reais === 1 ? "real" : "reais"}`;

  if (!cents) {
    return realText;
  }

  return `${realText} e ${numberToWordsPtBr(cents)} ${cents === 1 ? "centavo" : "centavos"}`;
}

function replacePlaceholders(value: string, placeholders: Record<string, string>) {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    return placeholders[key] ?? match;
  });
}

function sanitizePdfText(value: string) {
  return value
    .replace(/\u039C/g, "M")
    .replace(/\u03BC/g, "u")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[^\u0020-\u00ff]/g, "");
}

async function loadLogoBytes() {
  try {
    return await readFile(
      path.join(process.cwd(), "public", "images", "logo-fortulino-imoveis.jpeg")
    );
  } catch {
    return null;
  }
}

async function generateContractDraftPdf({
  asset,
  lease,
  tenant,
  guarantor,
  contractModel,
}: {
  asset: AssetRow;
  lease: LeaseRow;
  tenant: PayerRow;
  guarantor: PayerRow | null;
  templateType: ContractDraftTemplate;
  contractModel: ContractModelRow | null;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 42;
  const contentWidth = pageSize[0] - margin * 2;
  const logoBytes = await loadLogoBytes();
  const logo = logoBytes ? await pdf.embedJpg(logoBytes) : null;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - 34;
  let pageNumber = 1;

  function drawSafeText(
    value: string,
    options: Parameters<typeof page.drawText>[1]
  ) {
    page.drawText(sanitizePdfText(value), options);
  }

  function safeTextWidth(
    font: typeof regular,
    value: string,
    size: number
  ) {
    return font.widthOfTextAtSize(sanitizePdfText(value), size);
  }

  function drawCentered(value: string, yPosition: number, size: number, isBold = false) {
    const font = isBold ? bold : regular;
    const text = sanitizePdfText(value);
    drawSafeText(text, {
      x: (pageSize[0] - safeTextWidth(font, text, size)) / 2,
      y: yPosition,
      size,
      font,
      color: rgb(0.08, 0.16, 0.24),
    });
  }

  function drawFooter() {
    drawSafeText(`Página ${pageNumber}`, {
      x: pageSize[0] - margin - 45,
      y: 18,
      size: 8,
      font: regular,
      color: rgb(0.48, 0.52, 0.58),
    });
  }

  function drawWatermark() {
    if (!logo) return;

    const width = 330;
    const height = width * (logo.height / logo.width);
    page.drawImage(logo, {
      x: (pageSize[0] - width) / 2,
      y: (pageSize[1] - height) / 2,
      width,
      height,
      opacity: 0.055,
    });
  }

  function drawPageChrome() {
    drawWatermark();
  }

  drawPageChrome();

  function newPage() {
    drawFooter();
    page = pdf.addPage(pageSize);
    pageNumber += 1;
    y = pageSize[1] - 72;
    drawPageChrome();
  }

  function ensureSpace(height: number) {
    if (y - height < 42) {
      newPage();
    }
  }

  function splitText(text: string, size: number, maxWidth: number, font = regular) {
    const words = sanitizePdfText(text).replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (safeTextWidth(font, candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);
      line = word;
    }

    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function drawTextBlock(
    value: string,
    options?: {
      x?: number;
      width?: number;
      size?: number;
      font?: typeof regular;
      color?: ReturnType<typeof rgb>;
      gap?: number;
      lineHeight?: number;
    }
  ) {
    const size = options?.size ?? 9.6;
    const font = options?.font ?? regular;
    const width = options?.width ?? contentWidth;
    const x = options?.x ?? margin;
    const lineHeight = options?.lineHeight ?? size + 3.6;
    const lines = splitText(value, size, width, font);
    ensureSpace(lines.length * lineHeight + (options?.gap ?? 8));

    for (const line of lines) {
      drawSafeText(line, {
        x,
        y,
        size,
        font,
        color: options?.color ?? rgb(0.13, 0.15, 0.18),
      });
      y -= lineHeight;
    }

    y -= options?.gap ?? 8;
  }

  function getTextBlockHeight(
    value: string,
    options?: {
      width?: number;
      size?: number;
      font?: typeof regular;
      gap?: number;
      lineHeight?: number;
    }
  ) {
    const size = options?.size ?? 9.6;
    const font = options?.font ?? regular;
    const width = options?.width ?? contentWidth;
    const lineHeight = options?.lineHeight ?? size + 3.6;
    const lines = splitText(value, size, width, font);

    return lines.length * lineHeight + (options?.gap ?? 8);
  }

  function getCardHeight(rows: Array<[string, string]>, width: number) {
    const gap = 14;
    const columnWidth = (width - 22 - gap) / 2;
    let rowsHeight = 0;

    for (let index = 0; index < rows.length; index += 2) {
      const left = rows[index];
      const right = rows[index + 1];
      const leftLines = left
        ? splitText(`${left[0]}: ${left[1]}`, 8.2, columnWidth)
        : [];
      const rightLines = right
        ? splitText(`${right[0]}: ${right[1]}`, 8.2, columnWidth)
        : [];
      rowsHeight += Math.max(leftLines.length, rightLines.length, 1) * 10.8 + 2;
    }

    return 31 + rowsHeight;
  }

  function drawCard(title: string, rows: Array<[string, string]>, x: number, width: number, topY: number) {
    const height = getCardHeight(rows, width);
    const gap = 14;
    const columnWidth = (width - 22 - gap) / 2;

    page.drawRectangle({
      x,
      y: topY - height,
      width,
      height,
      borderWidth: 0.8,
      borderColor: rgb(0.78, 0.83, 0.88),
      color: rgb(0.985, 0.99, 0.995),
    });
    drawSafeText(title.toUpperCase(), {
      x: x + 11,
      y: topY - 17,
      size: 8.4,
      font: bold,
      color: rgb(0.05, 0.25, 0.38),
    });

    let rowY = topY - 32;
    for (let index = 0; index < rows.length; index += 2) {
      const pair = [
        { row: rows[index], x: x + 11 },
        { row: rows[index + 1], x: x + 11 + columnWidth + gap },
      ];
      const splitPair = pair.map((item) => ({
        ...item,
        lines: item.row
          ? splitText(`${item.row[0]}: ${item.row[1]}`, 8.2, columnWidth)
          : [],
      }));
      const lineCount = Math.max(
        ...splitPair.map((item) => item.lines.length),
        1
      );

      for (const item of splitPair) {
        let lineY = rowY;
        for (const line of item.lines) {
          drawSafeText(line, {
            x: item.x,
            y: lineY,
            size: 8.2,
            font: regular,
            color: rgb(0.16, 0.18, 0.21),
          });
          lineY -= 10.8;
        }
      }

      rowY -= lineCount * 10.8 + 2;
    }

    return height;
  }

  function drawCardGrid(cards: Array<{ title: string; rows: Array<[string, string]> }>) {
    for (const card of cards) {
      const cardHeight = getCardHeight(card.rows, contentWidth);
      ensureSpace(cardHeight + 10);
      drawCard(card.title, card.rows, margin, contentWidth, y);
      y -= cardHeight + 10;
    }
  }

  function drawSignature(
    label: string,
    name: string,
    document: string,
    x: number,
    width: number
  ) {
    page.drawLine({
      start: { x, y },
      end: { x: x + width, y },
      thickness: 0.7,
      color: rgb(0.16, 0.16, 0.16),
    });
    const labelWidth = safeTextWidth(bold, label, 8);
    drawSafeText(label, {
      x: x + (width - labelWidth) / 2,
      y: y - 13,
      size: 8,
      font: bold,
      color: rgb(0.12, 0.12, 0.12),
    });
    const displayName = name || "Não informado";
    const lines = splitText(displayName, 8, width);
    let lineY = y - 25;
    for (const line of lines.slice(0, 2)) {
      drawSafeText(line, {
        x: x + (width - safeTextWidth(regular, line, 8)) / 2,
        y: lineY,
        size: 8,
        font: regular,
        color: rgb(0.25, 0.25, 0.25),
      });
      lineY -= 10;
    }
    const documentText = `Documento: ${document || "Não informado"}`;
    const documentLines = splitText(documentText, 7.5, width);
    for (const line of documentLines.slice(0, 2)) {
      drawSafeText(line, {
        x: x + (width - safeTextWidth(regular, line, 7.5)) / 2,
        y: lineY,
        size: 7.5,
        font: regular,
        color: rgb(0.33, 0.33, 0.33),
      });
      lineY -= 9;
    }
  }

  function drawSignatureRow(
    left: [string, string, string],
    right: [string, string, string]
  ) {
    const width = 210;
    const gap = contentWidth - width * 2;
    ensureSpace(96);
    drawSignature(left[0], left[1], left[2], margin, width);
    drawSignature(right[0], right[1], right[2], margin + width + gap, width);
    y -= 96;
  }

  const contractNumber = lease.code
    ? String(lease.code)
    : lease.contract_number ?? lease.id.slice(0, 8);
  const contractDateIso = new Date().toISOString();
  const contractDate = formatDate(contractDateIso);
  const contractLongDate = formatLongDate(contractDateIso);
  const address = getAssetAddress(asset);
  const assetType = formatAssetType(asset.type);
  const landlord = getLandlordDetails(asset);
  const rent = formatCurrencyFromCents(lease.rent_amount_cents);
  const rentInWords = currencyToWordsFromCents(lease.rent_amount_cents);
  const dueDay = lease.payment_due_day ? String(lease.payment_due_day) : "a definir";
  const duration = getLeaseDurationLabel(lease.start_date, lease.end_date);
  const clauses = contractModel ? normalizeClauses(contractModel.clauses) : [];
  const modelNotes = contractModel?.notes?.trim() ?? "";
  const observations = [modelNotes, lease.notes?.trim()].filter(
    (observation): observation is string => Boolean(observation)
  );
  const placeholders: Record<string, string> = {
    numero_contrato: contractNumber,
    data_contrato: contractDate,
    data_inicio: formatDate(lease.start_date),
    data_fim: formatDate(lease.end_date),
    tempo_contrato: duration,
    valor_contrato: rent,
    valor_contrato_extenso: rentInWords,
    dia_vencimento: dueDay,
    reajuste_indice: adjustmentLabels[lease.adjustment_index],
    data_reajuste: formatDate(lease.next_adjustment_date),
    imovel_codigo: asset.code ? String(asset.code) : "Não informado",
    imovel_nome: asset.title,
    imovel_tipo: assetType,
    imovel_endereco: address,
    imovel_matricula: asset.registration_number ?? "Não informado",
    imovel_inscricao_municipal: asset.municipal_registration ?? "Não informado",
    locador_nome: landlord.name,
    locador_nome_fantasia: landlord.tradeName ?? "Não informado",
    locador_documento: landlord.document,
    locador_email: landlord.email ?? "Não informado",
    locador_telefone: landlord.phone ?? "Não informado",
    locador_endereco: landlord.address,
    locador_cep: landlord.zipCode ?? "Não informado",
    locador_bairro: landlord.district ?? "Não informado",
    locador_cidade: landlord.city ?? "Não informado",
    locador_uf: landlord.state ?? "Não informado",
    cliente_nome: tenant.name,
    cliente_documento: formatDocument(tenant.document),
    cliente_email: tenant.email ?? "Não informado",
    cliente_telefone: tenant.phone ?? "Não informado",
    fiador_nome: guarantor?.name ?? lease.guarantor_name ?? "Não informado",
    fiador_documento: formatDocument(guarantor?.document ?? lease.guarantor_document),
    testemunha_1_nome: contractModel?.witness_1_name ?? "Não informado",
    testemunha_1_documento: formatDocument(contractModel?.witness_1_document),
    testemunha_2_nome: contractModel?.witness_2_name ?? "Não informado",
    testemunha_2_documento: formatDocument(contractModel?.witness_2_document),
  };

  if (logo) {
    page.drawImage(logo, {
      x: margin,
      y: pageSize[1] - 96,
      width: 70,
      height: 70 * (logo.height / logo.width),
    });
  }

  drawCentered("FORTULINO IMÓVEIS", y, 15, true);
  y -= 17;
  drawCentered("Rua Cel. Marcos Rovaris, 773", y, 9);
  y -= 12;
  drawCentered("CEP: 88820-046 - BAIRRO: Centro - CIDADE: Içara/SC", y, 9);
  y -= 12;
  drawCentered("CNPJ: 55.060.598/0001-04", y, 9);
  y -= 28;
  drawCentered("CONTRATO DE LOCAÇÃO", y, 14, true);
  y -= 16;
  drawCentered(`Contrato Nº. ${contractNumber} - Data: ${contractDate}`, y, 10);
  y -= 24;

  const landlordRowsSource: Array<[string, string]> = [
    ["Razão social/Nome", landlord.name],
    ["Documento", landlord.document],
    ["Nome fantasia", landlord.tradeName ?? ""],
    ["E-mail", landlord.email ?? ""],
    ["Telefone", landlord.phone ?? ""],
    ["CEP", landlord.zipCode ?? ""],
    ["Uf", landlord.state ?? ""],
    ["Cidade", landlord.city ?? ""],
    ["Bairro", landlord.district ?? ""],
    ["Endereço", landlord.street ?? landlord.address],
    ["Número", landlord.number ?? ""],
    ["Complemento", landlord.complement ?? ""],
  ];
  const landlordRows = landlordRowsSource.filter(([, value]) =>
    hasPdfValue(value)
  );

  drawCardGrid([
    {
      title: "Dados do locatário",
      rows: [
        ["Nome", tenant.name],
        ["Documento", formatDocument(tenant.document)],
        ["E-mail", tenant.email ?? "Não informado"],
        ["Telefone", tenant.phone ?? "Não informado"],
      ],
    },
    {
      title: "Dados do locador",
      rows: landlordRows.length
        ? landlordRows
        : ([["Locador", "Dados do locador não informados no imóvel"]] satisfies Array<
            [string, string]
          >),
    },
    ...(guarantor || lease.guarantor_name || lease.guarantor_document
      ? [
          {
            title: "Dados do fiador",
            rows: [
              ["Nome", guarantor?.name ?? lease.guarantor_name ?? "Não informado"],
              ["Documento", formatDocument(guarantor?.document ?? lease.guarantor_document)],
              ["E-mail", guarantor?.email ?? "Não informado"],
              ["Telefone", guarantor?.phone ?? "Não informado"],
            ] satisfies Array<[string, string]>,
          },
        ]
      : []),
    {
      title: "Dados do imóvel",
      rows: [
        ["Nome", asset.title],
        ["Tipo", assetType],
        ["Valor", rent],
        ["CEP", asset.zip_code ?? "Não informado"],
        ["Uf", asset.state ?? "Não informado"],
        ["Cidade", asset.city ?? "Não informado"],
        ["Bairro", asset.district ?? "Não informado"],
        ["Endereço", asset.street ?? address],
        ["Número", asset.number ?? "Não informado"],
        ["Matrícula", asset.registration_number ?? "Não informado"],
        ["Inscrição municipal", asset.municipal_registration ?? "Não informado"],
      ],
    },
  ]);
  y -= 22;

  if (clauses.length === 0) {
    drawTextBlock("Nenhuma cláusula configurada para este modelo.", { size: 10 });
  } else {
    for (const clause of clauses) {
      const clauseText = `${clause.title}: ${replacePlaceholders(
        clause.text,
        placeholders
      )}`;
      const firstTextLinesHeight = Math.min(
        getTextBlockHeight(clauseText, {
          size: 8.5,
          lineHeight: 11.4,
          gap: 8,
        }),
        46
      );

      ensureSpace(firstTextLinesHeight);
      drawTextBlock(clauseText, {
        size: 8.5,
        lineHeight: 11.4,
        gap: 6,
      });
    }
  }

  if (observations.length > 0) {
    for (const observation of observations) {
      drawTextBlock(replacePlaceholders(observation, placeholders), {
        size: 9.4,
        lineHeight: 12.8,
      });
    }
  }

  const hasGuarantorSignature = Boolean(
    guarantor || lease.guarantor_name || lease.guarantor_document
  );
  ensureSpace(96 * (hasGuarantorSignature ? 3 : 2) + 88);
  y -= 48;
  drawSignatureRow(
    ["LOCATÁRIO", tenant.name, formatDocument(tenant.document)],
    ["LOCADOR", landlord.name, landlord.document]
  );
  drawSignatureRow(
    [
      "TESTEMUNHA 1",
      contractModel?.witness_1_name ?? "Não informado",
      formatDocument(contractModel?.witness_1_document),
    ],
    [
      "TESTEMUNHA 2",
      contractModel?.witness_2_name ?? "Não informado",
      formatDocument(contractModel?.witness_2_document),
    ]
  );

  if (hasGuarantorSignature) {
    drawSignature(
      "FIADOR",
      guarantor?.name ?? lease.guarantor_name ?? "Não informado",
      formatDocument(guarantor?.document ?? lease.guarantor_document),
      (pageSize[0] - 230) / 2,
      230
    );
    y -= 96;
  }
  y -= 18;
  drawCentered(`Içara/SC, ${contractLongDate}`, y, 10, true);
  y -= 28;

  drawFooter();
  return pdf.save();
}

export async function POST(request: NextRequest, { params }: DraftRouteProps) {
  const { id } = await params;
  const supabase = createAdminClient();
  let uploadedPath: string | null = null;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      templateType?: ContractDraftTemplate;
    };
    const templateType: ContractDraftTemplate =
      body.templateType === "commercial" ? "commercial" : "residential";

    const { data: lease, error: leaseError } = await supabase
      .from("real_estate_leases")
      .select(
        "id,code,asset_id,tenant_id,status,document_status,contract_number,start_date,end_date,payment_due_day,rent_amount_cents,guarantee_type,guarantee_amount_cents,adjustment_index,next_adjustment_date,guarantor_id,guarantor_name,guarantor_document,notes"
      )
      .eq("id", id)
      .maybeSingle();

    if (leaseError) {
      throw new Error(leaseError.message);
    }

    if (!lease) {
      return NextResponse.json(
        { message: "Contrato não encontrado." },
        { status: 404 }
      );
    }

    const leaseRow = lease as LeaseRow;
    const [
      { data: asset, error: assetError },
      { data: tenant, error: tenantError },
      { data: guarantor, error: guarantorError },
      { data: contractModel, error: contractModelError },
    ] = await Promise.all([
      supabase
        .from("real_estate_assets")
        .select(
          "id,code,title,type,motive,address,zip_code,street,number,district,city,state,registration_number,municipal_registration,rent_amount,landlord_name,landlord_document,metadata,documents"
        )
        .eq("id", leaseRow.asset_id)
        .maybeSingle(),
      supabase
        .from("payers")
        .select(
          "id,name,document,email,phone,zip_code,street,number,complement,district,city,state"
        )
        .eq("id", leaseRow.tenant_id)
        .maybeSingle(),
      leaseRow.guarantor_id
        ? supabase
            .from("payers")
            .select(
              "id,name,document,email,phone,zip_code,street,number,complement,district,city,state"
            )
            .eq("id", leaseRow.guarantor_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("real_estate_contract_models")
        .select(
          "id,name,contract_purpose,property_usage,description,notes,status,witness_1_name,witness_1_document,witness_2_name,witness_2_document,clauses"
        )
        .eq("contract_purpose", "rental")
        .eq("property_usage", templateType)
        .eq("status", "active")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const linkedError =
      assetError ?? tenantError ?? guarantorError ?? contractModelError ?? null;

    if (linkedError) {
      throw new Error(linkedError.message);
    }

    if (!asset || !tenant) {
      return NextResponse.json(
        { message: "Dados vinculados ao contrato não encontrados." },
        { status: 404 }
      );
    }

    const assetRow = await withCurrentLandlord(asset as AssetRow);
    const tenantRow = tenant as PayerRow;
    const guarantorRow = guarantor as PayerRow | null;
    const currentDocuments = normalizeStoredDocuments(assetRow.documents);

    if (currentDocuments.length >= REAL_ESTATE_DOCUMENT_LIMIT) {
      return NextResponse.json(
        {
          message: `Este imóvel já possui o limite de ${REAL_ESTATE_DOCUMENT_LIMIT} documentos.`,
        },
        { status: 400 }
      );
    }

    await ensureDocumentsBucket();

    const pdfBytes = await generateContractDraftPdf({
      asset: assetRow,
      lease: leaseRow,
      tenant: tenantRow,
      guarantor: guarantorRow,
      templateType,
      contractModel: (contractModel as ContractModelRow | null) ?? null,
    });
    const documentId = randomUUID();
    const baseName = normalizeFileName(
      `minuta-contrato-${templateType}-${leaseRow.contract_number ?? leaseRow.id.slice(0, 8)}`
    );
    const originalName = `${baseName}.pdf`;
    uploadedPath = `${assetRow.id}/${documentId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(REAL_ESTATE_DOCUMENTS_BUCKET)
      .upload(uploadedPath, pdfBytes, {
        cacheControl: "3600",
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const createdAt = new Date().toISOString();
    const document: StoredDocument = {
      id: documentId,
      storagePath: uploadedPath,
      originalName,
      mimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      createdAt,
      leaseId: leaseRow.id,
      scope: "contract",
      documentType: "draft",
      templateType,
    };
    const documents = [...currentDocuments, document];

    const { error: assetUpdateError } = await supabase
      .from("real_estate_assets")
      .update({
        documents: documents as unknown as Json,
        updated_at: createdAt,
      })
      .eq("id", assetRow.id);

    if (assetUpdateError) {
      throw new Error(assetUpdateError.message);
    }

    const { error: leaseUpdateError } = await supabase
      .from("real_estate_leases")
      .update({
        document_status: "draft_generated",
        updated_at: createdAt,
      })
      .eq("id", leaseRow.id);

    if (leaseUpdateError) {
      throw new Error(leaseUpdateError.message);
    }

    await supabase.from("real_estate_contract_events").insert({
      asset_id: assetRow.id,
      lease_id: leaseRow.id,
      event_type: "updated",
      title: "Minuta PDF gerada",
      description: `Arquivo ${originalName} gerado no modelo ${templateType === "commercial" ? "comercial" : "residencial"} e anexado aos documentos do contrato.`,
      metadata: {
        documentId,
        storagePath: uploadedPath,
        originalName,
        templateType,
      },
    });

    await createInternalActionNotification(supabase, {
      sourceKey: `real-estate-contract:${leaseRow.id}:draft-generated:${documentId}`,
      category: "real_estate",
      type: "contract_draft_generated",
      title: "Minuta de contrato gerada",
      message: `${assetRow.code ? `${assetRow.code} · ` : ""}${assetRow.title} · ${templateType === "commercial" ? "Comercial" : "Residencial"}`,
      severity: "info",
      entityType: "real_estate_contract",
      entityId: leaseRow.id,
      actionHref: `/imobiliaria/${assetRow.id}/contratos`,
      metadata: {
        assetId: assetRow.id,
        documentId,
        originalName,
        templateType,
      },
    });

    uploadedPath = null;

    return NextResponse.json(
      {
        document: await mapDocument(document),
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedPath) {
      await supabase.storage
        .from(REAL_ESTATE_DOCUMENTS_BUCKET)
        .remove([uploadedPath]);
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar a minuta do contrato.",
      },
      { status: 500 }
    );
  }
}



