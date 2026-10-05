import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";

async function loadLocalEnv() {
  if (!existsSync(".env.local")) {
    return;
  }

  const content = await readFile(".env.local", "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const separatorIndex = trimmed.indexOf("=");

    if (!trimmed || trimmed.startsWith("#") || separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
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

await loadLocalEnv();

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "firebase-service-account.json";
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, "utf8"));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Configure as credenciais do Supabase.");
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
});
const [billingSnapshot, payersResult, leasesResult] = await Promise.all([
  getFirestore().collection("cobrancaPagadores").get(),
  supabase.from("payers").select("id,document,roles"),
  supabase.from("real_estate_leases").select("tenant_id"),
]);

if (payersResult.error) {
  throw new Error(
    "Aplique primeiro a migração 20260706220000_add_client_roles.sql no Supabase."
  );
}

if (leasesResult.error) {
  throw leasesResult.error;
}

const billingDocuments = new Set(
  billingSnapshot.docs
    .map((document) => {
      const data = document.data();
      return onlyDigits(
        data.document ??
          data.documento ??
          data.cpfCnpj ??
          data.cpf_cnpj ??
          data.cpf ??
          data.cnpj ??
          data.sacadoCpfCnpj
      );
    })
    .filter(Boolean)
);
const tenantIds = new Set(
  leasesResult.data.map((lease) => lease.tenant_id)
);
const classified = payersResult.data.map((client) => {
  const roles = [];

  if (billingDocuments.has(onlyDigits(client.document))) {
    roles.push("payer");
  }

  if (tenantIds.has(client.id)) {
    roles.push("tenant");
  }

  return {
    id: client.id,
    roles: roles.length > 0 ? roles : ["payer"],
  };
});

for (const client of classified) {
  const { error } = await supabase
    .from("payers")
    .update({ roles: client.roles })
    .eq("id", client.id);

  if (error) {
    throw error;
  }
}

const counts = {
  payerOnly: classified.filter(
    (client) =>
      client.roles.includes("payer") && !client.roles.includes("tenant")
  ).length,
  tenantOnly: classified.filter(
    (client) =>
      !client.roles.includes("payer") && client.roles.includes("tenant")
  ).length,
  both: classified.filter(
    (client) =>
      client.roles.includes("payer") && client.roles.includes("tenant")
  ).length,
};

console.log(
  JSON.stringify(
    {
      clientsUpdated: classified.length,
      ...counts,
    },
    null,
    2
  )
);
