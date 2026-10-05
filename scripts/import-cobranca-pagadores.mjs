import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Uso: node scripts/import-cobranca-pagadores.mjs caminho/arquivo.json");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
  },
});

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

function normalizeStatus(source) {
  const rawStatus = firstValue(source, ["status", "situacao", "ativo"], "active").toLowerCase();

  if (rawStatus === "false" || rawStatus === "inativo" || rawStatus === "inactive") {
    return "inactive";
  }

  return "active";
}

function normalizePayer(document) {
  const data = document.data ?? document;
  const firestoreId = document.id ?? data.id ?? data.firestoreId ?? null;

  return {
    firestore_id: firestoreId ? String(firestoreId) : null,
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

const raw = await readFile(inputPath, "utf8");
const parsed = JSON.parse(raw);
const documents = Array.isArray(parsed) ? parsed : Object.entries(parsed).map(([id, data]) => ({ id, data }));
const payers = documents.map(normalizePayer).filter((payer) => payer.name && payer.document);

if (payers.length === 0) {
  console.log("Nenhum pagador válido encontrado no arquivo.");
  process.exit(0);
}

const { error } = await supabase.from("payers").upsert(payers, {
  onConflict: "document",
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`${payers.length} pagador(es) importado(s) de cobrancaPagadores.`);
