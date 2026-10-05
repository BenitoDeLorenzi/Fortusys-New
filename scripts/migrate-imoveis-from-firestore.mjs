import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "firebase-service-account.json";
const collectionName = process.env.FIRESTORE_PROPERTIES_COLLECTION ?? "imoveis";
const shouldOnlyExport = process.argv.includes("--export-only");
const outputPath = "exports/imoveis.json";

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
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

await loadLocalEnv();

if (!existsSync(serviceAccountPath)) {
  console.error(
    `Arquivo de credenciais não encontrado: ${serviceAccountPath}. Gere uma nova chave e salve como firebase-service-account.json.`
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!shouldOnlyExport && (!supabaseUrl || !supabaseSecretKey)) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente.");
  process.exit(1);
}

function firstValue(source, keys, fallback = "") {
  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return fallback;
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
      Object.entries(value).map(([key, item]) => [key, serializeFirestoreValue(item)])
    );
  }

  return value;
}

function normalizeType(value) {
  const rawType = String(value ?? "").toLowerCase().trim();

  if (["casa", "apartamento", "apto", "residencial"].includes(rawType)) {
    return "residential";
  }

  if (["sala", "loja", "comercial", "galpao", "galpão"].includes(rawType)) {
    return "commercial";
  }

  if (["temporada"].includes(rawType)) {
    return "seasonal";
  }

  return "other";
}

function normalizeStatus(value) {
  const rawStatus = String(value ?? "").toLowerCase().trim();

  if (["alugado", "locado"].includes(rawStatus)) {
    return "rented";
  }

  if (["inativo", "inactive"].includes(rawStatus)) {
    return "inactive";
  }

  if (["vendido"].includes(rawStatus)) {
    return "sold";
  }

  return rawStatus || "available";
}

function normalizeProperty(document) {
  const data = document.data;
  const landlord = data.locador && typeof data.locador === "object" ? data.locador : {};
  const street = firstValue(data, ["endereco", "street"]);
  const number = firstValue(data, ["numero", "number"]);
  const district = firstValue(data, ["bairro", "district"]);
  const city = firstValue(data, ["cidade", "city"]);
  const state = firstValue(data, ["uf", "state"]).toUpperCase();

  return {
    firestore_id: document.id,
    code: numberOrNull(firstValue(data, ["codigo", "code"])),
    title: firstValue(data, ["imovel", "title", "nome"], "Imóvel sem nome"),
    property_name: firstValue(data, ["imovel", "title", "nome"], "Imóvel sem nome"),
    type: normalizeType(firstValue(data, ["tipo"])),
    status: normalizeStatus(firstValue(data, ["situacao"], "available")),
    address: [street, number, district, city, state].filter(Boolean).join(", ") || null,
    zip_code: onlyDigits(firstValue(data, ["cep"])) || null,
    street: street || null,
    number: number || null,
    district: district || null,
    city: city || null,
    state: state || null,
    bedrooms: firstValue(data, ["quartos"]) || null,
    bathrooms: firstValue(data, ["banheiros"]) || null,
    garage: firstValue(data, ["garagem"]) || null,
    area: firstValue(data, ["metragem"]) || null,
    registration_number: firstValue(data, ["matriculaImovel"]) || null,
    municipal_registration: firstValue(data, ["inscImobiliaria"]) || null,
    rent_amount: firstValue(data, ["valor"]) || null,
    condominium_amount: firstValue(data, ["valorCondominio"]) || null,
    iptu_amount: firstValue(data, ["valorIptu"]) || null,
    water_amount: firstValue(data, ["agua"]) || null,
    energy_amount: firstValue(data, ["energia"]) || null,
    gas_amount: firstValue(data, ["gas"]) || null,
    trash_amount: firstValue(data, ["lixo"]) || null,
    reserve_fund_amount: firstValue(data, ["fundoReserva"]) || null,
    other_amount: firstValue(data, ["outro"]) || null,
    commission_type: firstValue(data, ["tipoComissao"]) || null,
    commission_percentage: firstValue(data, ["comissaoPercentual"]) || null,
    commission_amount: firstValue(data, ["comissaoValor"]) || null,
    landlord_firestore_id: firstValue(data, ["locadorId"]) || firstValue(landlord, ["id"]) || null,
    landlord_code: numberOrNull(firstValue(landlord, ["codigo"])),
    landlord_name: firstValue(landlord, ["nome"]) || null,
    landlord_document: onlyDigits(firstValue(landlord, ["cpfCnpj", "document"])) || null,
    landlord_email: firstValue(landlord, ["email"]) || null,
    landlord_phone: onlyDigits(firstValue(landlord, ["telefone", "phone"])) || null,
    contract_firestore_id: firstValue(data, ["contratoId"]) || null,
    highlight: Boolean(data.destaque),
    photos: Array.isArray(data.fotos) ? data.fotos : [],
    documents: Array.isArray(data.documentos) ? data.documentos : [],
    metadata: data,
  };
}

const serviceAccount = JSON.parse(await readFile(serviceAccountPath, "utf8"));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const firestore = getFirestore();
const snapshot = await firestore.collection(collectionName).get();
const documents = snapshot.docs.map((doc) => ({
  id: doc.id,
  data: serializeFirestoreValue(doc.data()),
}));
const properties = documents
  .map(normalizeProperty)
  .filter((property) => property.firestore_id && property.title);

await mkdir("exports", { recursive: true });
await writeFile(outputPath, JSON.stringify(documents, null, 2), "utf8");

console.log(`${documents.length} documento(s) exportado(s) para ${outputPath}.`);

if (shouldOnlyExport) {
  process.exit(0);
}

if (properties.length === 0) {
  console.log("Nenhum imóvel válido encontrado para importar.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
  },
});

const { error } = await supabase.from("real_estate_assets").upsert(properties, {
  onConflict: "firestore_id",
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`${properties.length} imóvel(is) importado(s) no Supabase.`);
