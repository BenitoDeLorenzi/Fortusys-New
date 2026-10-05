import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";

const shouldExecute = process.argv.includes("--execute");
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "firebase-service-account.json";

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

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function optional(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function dateToIso(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function moneyToCents(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/R\$/gi, "");

  if (!normalized) {
    return null;
  }

  const decimal = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const amount = Number(decimal);

  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function serializeFirestoreValue(value) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeFirestoreValue(item),
      ])
    );
  }

  return value;
}

function normalizeStatus(value) {
  const status = String(value ?? "").toLowerCase();

  if (status === "ativo") {
    return "active";
  }

  if (["encerrado", "finalizado"].includes(status)) {
    return "ended";
  }

  if (["cancelado", "rescindido"].includes(status)) {
    return "canceled";
  }

  return "draft";
}

function normalizeAdjustmentIndex(contract) {
  const value = `${contract.reajusteIndice ?? ""} ${
    contract.reajusteTipo ?? ""
  }`.toLowerCase();

  if (value.includes("ipca")) {
    return "ipca";
  }

  if (value.includes("igp")) {
    return "igpm";
  }

  return contract.reajusteData ? "igpm" : "none";
}

await loadLocalEnv();

if (!existsSync(serviceAccountPath)) {
  throw new Error(`Credencial do Firebase não encontrada: ${serviceAccountPath}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Configure as credenciais do Supabase.");
}

const serviceAccount = JSON.parse(await readFile(serviceAccountPath, "utf8"));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const firestore = getFirestore();
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
});

if (shouldExecute) {
  const { error: leaseTableError } = await supabase
    .from("real_estate_leases")
    .select(
      "id,firestore_id,code,guarantor_firestore_id,guarantor_name,guarantor_document,legacy_metadata"
    )
    .limit(1);

  if (leaseTableError) {
    throw new Error(
      "Aplique as migrações 20260706200000 e 20260706210000 de contratos no Supabase antes de executar a importação."
    );
  }
}

const [contractsSnapshot, clientsSnapshot, assetsResult, payersResult] =
  await Promise.all([
    firestore.collection("imoveisContratos").get(),
    firestore.collection("imoveisClientes").get(),
    supabase
      .from("real_estate_assets")
      .select("id,firestore_id,title,type,status,rent_amount"),
    supabase
      .from("payers")
      .select("id,firestore_id,document,name"),
  ]);

if (assetsResult.error) {
  throw assetsResult.error;
}

if (payersResult.error) {
  throw payersResult.error;
}

const contracts = contractsSnapshot.docs.map((document) => ({
  id: document.id,
  ...serializeFirestoreValue(document.data()),
}));
const clients = clientsSnapshot.docs.map((document) => ({
  id: document.id,
  ...serializeFirestoreValue(document.data()),
}));
const clientsById = new Map(clients.map((client) => [client.id, client]));
const assetsByFirestoreId = new Map(
  assetsResult.data
    .filter((asset) => asset.firestore_id)
    .map((asset) => [asset.firestore_id, asset])
);
const currentPayersByDocument = new Map(
  payersResult.data.map((payer) => [onlyDigits(payer.document), payer])
);
const contractClients = [
  ...new Map(
    contracts
      .map((contract) => clientsById.get(contract.clienteId))
      .filter(Boolean)
      .map((client) => [onlyDigits(client.cpfCnpj), client])
  ).values(),
];
const newPayers = contractClients
  .filter(
    (client) =>
      onlyDigits(client.cpfCnpj) &&
      !currentPayersByDocument.has(onlyDigits(client.cpfCnpj))
  )
  .map((client) => ({
    firestore_id: client.id,
    name: optional(client.nome) ?? "Cliente sem nome",
    document: onlyDigits(client.cpfCnpj),
    email: optional(client.email)?.toLowerCase() ?? null,
    phone: onlyDigits(client.telefone) || null,
    zip_code: onlyDigits(client.cep) || null,
    street: optional(client.endereco),
    number: optional(client.numero),
    complement: null,
    district: optional(client.bairro),
    city: optional(client.cidade),
    state: optional(client.uf)?.toUpperCase() ?? null,
    status: "active",
    metadata: client,
  }));

const initialReport = {
  mode: shouldExecute ? "execute" : "dry-run",
  contractsFound: contracts.length,
  contractClientsFound: contractClients.length,
  payersToCreate: newPayers.length,
  missingAssets: contracts
    .filter((contract) => !assetsByFirestoreId.has(contract.imovelId))
    .map((contract) => contract.id),
  missingClients: contracts
    .filter((contract) => !clientsById.has(contract.clienteId))
    .map((contract) => contract.id),
};

if (
  initialReport.missingAssets.length > 0 ||
  initialReport.missingClients.length > 0
) {
  console.log(JSON.stringify(initialReport, null, 2));
  throw new Error("Existem contratos órfãos. A importação foi interrompida.");
}

if (!shouldExecute) {
  console.log(JSON.stringify(initialReport, null, 2));
  process.exit(0);
}

if (newPayers.length > 0) {
  const { error } = await supabase.from("payers").insert(newPayers);

  if (error) {
    throw error;
  }
}

const { data: refreshedPayers, error: refreshedPayersError } = await supabase
  .from("payers")
  .select("id,firestore_id,document,name");

if (refreshedPayersError) {
  throw refreshedPayersError;
}

const payersByDocument = new Map(
  refreshedPayers.map((payer) => [onlyDigits(payer.document), payer])
);
const leaseRows = contracts.map((contract) => {
  const asset = assetsByFirestoreId.get(contract.imovelId);
  const tenant = payersByDocument.get(onlyDigits(contract.clienteDocumento));
  const guarantor = contract.fiadorId
    ? clientsById.get(contract.fiadorId)
    : null;
  const rentAmountCents = moneyToCents(
    contract.imovelDados?.valor ?? asset.rent_amount
  );

  if (!tenant || !rentAmountCents) {
    throw new Error(`Contrato ${contract.id} sem inquilino ou valor válido.`);
  }

  return {
    firestore_id: contract.id,
    code: Number(contract.codigo) || null,
    asset_id: asset.id,
    tenant_id: tenant.id,
    status: normalizeStatus(contract.situacao),
    contract_number: contract.codigo ? String(contract.codigo) : null,
    start_date: dateToIso(contract.dataInicio),
    end_date: dateToIso(contract.dataFim),
    payment_due_day: null,
    rent_amount_cents: rentAmountCents,
    guarantee_type:
      contract.fiadorId || contract.fiadorDocumento ? "guarantor" : "none",
    guarantee_amount_cents: null,
    adjustment_index: normalizeAdjustmentIndex(contract),
    next_adjustment_date: dateToIso(contract.reajusteData),
    guarantor_firestore_id: optional(contract.fiadorId),
    guarantor_name: optional(contract.fiadorDados?.nome ?? guarantor?.nome),
    guarantor_document:
      onlyDigits(contract.fiadorDocumento ?? guarantor?.cpfCnpj) || null,
    notes: null,
    legacy_metadata: contract,
  };
});

const invalidDates = leaseRows
  .filter((lease) => !lease.start_date || !lease.end_date)
  .map((lease) => lease.firestore_id);

if (invalidDates.length > 0) {
  throw new Error(`Contratos com datas inválidas: ${invalidDates.join(", ")}`);
}

const { error: leasesError } = await supabase
  .from("real_estate_leases")
  .upsert(leaseRows, { onConflict: "firestore_id" });

if (leasesError) {
  throw leasesError;
}

for (const contract of contracts) {
  const asset = assetsByFirestoreId.get(contract.imovelId);
  const { error } = await supabase
    .from("real_estate_assets")
    .update({
      contract_firestore_id: contract.id,
      status: normalizeStatus(contract.situacao) === "active"
        ? "rented"
        : asset.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", asset.id);

  if (error) {
    throw error;
  }
}

console.log(
  JSON.stringify(
    {
      ...initialReport,
      payersCreated: newPayers.length,
      contractsImported: leaseRows.length,
    },
    null,
    2
  )
);
