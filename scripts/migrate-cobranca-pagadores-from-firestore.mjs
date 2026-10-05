import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "firebase-service-account.json";
const collectionName = process.env.FIRESTORE_PAYERS_COLLECTION ?? "cobrancaPagadores";
const shouldOnlyExport = process.argv.includes("--export-only");
const outputPath = "exports/cobrancaPagadores.json";

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

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
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

function normalizeStatus(source) {
  const rawStatus = firstValue(source, ["status", "situacao", "ativo"], "active").toLowerCase();

  if (rawStatus === "false" || rawStatus === "inativo" || rawStatus === "inactive") {
    return "inactive";
  }

  return "active";
}

function normalizePayer(document) {
  const data = document.data;

  return {
    firestore_id: document.id,
    code: Number(firstValue(data, ["codigo", "code"])) || null,
    name: firstValue(data, ["name", "nome", "razaoSocial", "razao_social", "sacadoNome"]),
    document: onlyDigits(
      firstValue(data, ["document", "documento", "cpfCnpj", "cpf_cnpj", "cpf", "cnpj", "sacadoCpfCnpj"])
    ),
    email: firstValue(data, ["email", "sacadoEmail"]) || null,
    phone: onlyDigits(firstValue(data, ["phone", "telefone", "celular", "sacadoTelefone"])) || null,
    zip_code: onlyDigits(firstValue(data, ["zipCode", "cep", "sacadoCep"])) || null,
    street: firstValue(data, ["street", "logradouro", "endereco", "sacadoLogradouro"]) || null,
    number: firstValue(data, ["number", "numero", "sacadoNumero"]) || null,
    complement: firstValue(data, ["complement", "complemento", "sacadoComplemento"]) || null,
    district: firstValue(data, ["district", "bairro", "sacadoBairro"]) || null,
    city: firstValue(data, ["city", "cidade", "sacadoCidade"]) || null,
    state: firstValue(data, ["state", "uf", "estado", "sacadoUf"]).toUpperCase() || null,
    status: normalizeStatus(data),
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
const payers = documents.map(normalizePayer).filter((payer) => payer.name && payer.document);

await mkdir("exports", { recursive: true });
await writeFile(outputPath, JSON.stringify(documents, null, 2), "utf8");

console.log(`${documents.length} documento(s) exportado(s) para ${outputPath}.`);

if (shouldOnlyExport) {
  process.exit(0);
}

if (payers.length === 0) {
  console.log("Nenhum pagador válido encontrado para importar.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
  },
});

const { error } = await supabase.from("payers").upsert(payers, {
  onConflict: "document",
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`${payers.length} pagador(es) importado(s) no Supabase.`);
