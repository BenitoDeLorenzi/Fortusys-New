import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const shouldExecute = process.argv.includes("--execute");
const exportPath =
  process.env.FIRESTORE_PROPERTIES_EXPORT_PATH ?? "exports/imoveis.json";

async function loadLocalEnv() {
  if (!existsSync(".env.local")) {
    return;
  }

  const content = await readFile(".env.local", "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function optional(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeDate(value) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getPropertyTitle(data) {
  return (
    optional(data.imovel) ??
    optional(data.title) ??
    optional(data.nome) ??
    "Imóvel sem nome"
  );
}

function mapLegacyBilling(document, item) {
  const data = document.data ?? {};
  const integrationId = optional(item.idintegracao);

  if (!document.id || !integrationId) {
    return null;
  }

  return {
    asset_id: null,
    firestore_asset_id: document.id,
    property_code: numberOrNull(data.codigo ?? data.code),
    property_title: getPropertyTitle(data),
    provider: "tecnospeed",
    provider_status: optional(item.situacao),
    integration_id: integrationId,
    print_id: optional(item.idImpressao),
    document_number: optional(item.TituloNumeroDocumento),
    our_number: optional(item.TituloNossoNumero),
    bank_code: onlyDigits(item.CedenteContaCodigoBanco) || null,
    account_number: onlyDigits(item.CedenteContaNumero) || null,
    agreement_number: onlyDigits(item.CedenteConvenioNumero) || null,
    reference_code: optional(item.TituloCodigoReferencia),
    assignor_document: onlyDigits(item.cnpjCedente) || null,
    created_at_provider: normalizeDate(item.dataCriacao),
    raw_payload: item,
  };
}

await loadLocalEnv();

if (!existsSync(exportPath)) {
  throw new Error(
    `Export não encontrado: ${exportPath}. Rode npm run export:imoveis antes.`
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
}

const documents = JSON.parse(await readFile(exportPath, "utf8"));
const legacyBillings = documents.flatMap((document) => {
  const billing = document.data?.faturamento;

  if (!Array.isArray(billing)) {
    return [];
  }

  return billing
    .map((item) => mapLegacyBilling(document, item))
    .filter(Boolean);
});
const duplicateIntegrationIds = [
  ...legacyBillings
    .reduce((acc, item) => {
      acc.set(item.integration_id, (acc.get(item.integration_id) ?? 0) + 1);
      return acc;
    }, new Map())
    .entries(),
]
  .filter(([, count]) => count > 1)
  .map(([integrationId]) => integrationId);

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
  },
});

const { data: assets, error: assetsError } = await supabase
  .from("real_estate_assets")
  .select("id,firestore_id,code,title")
  .not("firestore_id", "is", null);

if (assetsError) {
  throw assetsError;
}

const assetsByFirestoreId = new Map(
  assets.map((asset) => [asset.firestore_id, asset])
);
const rows = legacyBillings.map((item) => {
  const asset = assetsByFirestoreId.get(item.firestore_asset_id);

  return {
    ...item,
    asset_id: asset?.id ?? null,
    property_code: item.property_code ?? asset?.code ?? null,
    property_title: item.property_title ?? asset?.title ?? null,
  };
});
const missingAssetIds = [
  ...new Set(
    rows
      .filter((item) => !item.asset_id)
      .map((item) => item.firestore_asset_id)
  ),
];

const report = {
  mode: shouldExecute ? "execute" : "dry-run",
  exportPath,
  propertiesFound: documents.length,
  propertiesWithBilling: documents.filter((document) =>
    Array.isArray(document.data?.faturamento)
  ).length,
  legacyBillingsFound: legacyBillings.length,
  rowsToUpsert: rows.length,
  duplicateIntegrationIds,
  missingAssets: missingAssetIds,
};

if (duplicateIntegrationIds.length > 0) {
  console.log(JSON.stringify(report, null, 2));
  throw new Error("Existem idintegracao duplicados no export. Migração interrompida.");
}

if (!shouldExecute) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (rows.length > 0) {
  const batchSize = 500;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase
      .from("real_estate_legacy_billings")
      .upsert(batch, {
        onConflict: "provider,integration_id",
      });

    if (error) {
      throw error;
    }
  }
}

console.log(
  JSON.stringify(
    {
      ...report,
      imported: rows.length,
    },
    null,
    2
  )
);
