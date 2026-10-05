import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import type {
  RealEstateContractModelClause,
  RealEstateContractModel,
  RealEstateContractModelPurpose,
  RealEstateContractModelsResponse,
  RealEstateContractModelStatus,
  RealEstateContractModelUsage,
} from "@/features/real-estate/types";
import { createAdminClient } from "@/lib/supabase/admin";

type ContractModelRow = {
  id: string;
  name: string;
  contract_purpose: RealEstateContractModelPurpose;
  property_usage: RealEstateContractModelUsage;
  description: string | null;
  notes: string | null;
  status: RealEstateContractModelStatus;
  is_default: boolean;
  witness_1_name: string | null;
  witness_1_document: string | null;
  witness_2_name: string | null;
  witness_2_document: string | null;
  clauses: unknown;
  created_at: string;
  updated_at: string;
};

type ContractModelPayload = {
  name?: string;
  contractPurpose?: RealEstateContractModelPurpose;
  propertyUsage?: RealEstateContractModelUsage;
  description?: string | null;
  notes?: string | null;
  status?: RealEstateContractModelStatus;
  witness1Name?: string | null;
  witness1Document?: string | null;
  witness2Name?: string | null;
  witness2Document?: string | null;
  clauses?: RealEstateContractModelClause[];
};

const purposes: RealEstateContractModelPurpose[] = ["rental", "sale"];
const usages: RealEstateContractModelUsage[] = ["residential", "commercial"];
const statuses: RealEstateContractModelStatus[] = ["active", "inactive"];

const defaultModels = [
  {
    name: "Contrato de locação residencial",
    contract_purpose: "rental",
    property_usage: "residential",
    description: "Modelo padrão para locação de imóveis residenciais.",
  },
  {
    name: "Contrato de locação comercial",
    contract_purpose: "rental",
    property_usage: "commercial",
    description: "Modelo padrão para locação de imóveis comerciais.",
  },
  {
    name: "Contrato de venda residencial",
    contract_purpose: "sale",
    property_usage: "residential",
    description: "Modelo padrão para venda de imóveis residenciais.",
  },
  {
    name: "Contrato de venda comercial",
    contract_purpose: "sale",
    property_usage: "commercial",
    description: "Modelo padrão para venda de imóveis comerciais.",
  },
] satisfies Array<{
  name: string;
  contract_purpose: RealEstateContractModelPurpose;
  property_usage: RealEstateContractModelUsage;
  description: string;
}>;

function normalizeClauses(value: unknown): RealEstateContractModelClause[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }

      const clause = item as Partial<RealEstateContractModelClause>;
      const title =
        typeof clause.title === "string" ? clause.title.trim() : "";
      const text = typeof clause.text === "string" ? clause.text.trim() : "";

      if (!title && !text) {
        return [];
      }

      return [
        {
          id:
            typeof clause.id === "string" && clause.id.trim()
              ? clause.id.trim()
              : crypto.randomUUID(),
          title: title || `Cláusula ${index + 1}`,
          text,
          order: Number.isFinite(Number(clause.order))
            ? Number(clause.order)
            : index + 1,
        },
      ];
    })
    .sort((a, b) => a.order - b.order)
    .map((clause, index) => ({ ...clause, order: index + 1 }));
}

function optional(value?: string | null) {
  return value?.trim() || null;
}

function mapModel(row: ContractModelRow): RealEstateContractModel {
  return {
    id: row.id,
    name: row.name,
    contractPurpose: row.contract_purpose,
    propertyUsage: row.property_usage,
    description: row.description,
    notes: row.notes,
    status: row.status,
    isDefault: row.is_default,
    witness1Name: row.witness_1_name,
    witness1Document: row.witness_1_document,
    witness2Name: row.witness_2_name,
    witness2Document: row.witness_2_document,
    clauses: normalizeClauses(row.clauses),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validatePayload(payload: ContractModelPayload, mode: "create" | "update") {
  const name = payload.name?.trim();
  const description = optional(payload.description);
  const notes = optional(payload.notes);

  if (mode === "create" && !name) {
    return { error: "Informe o nome do modelo." };
  }

  if (
    payload.contractPurpose !== undefined &&
    !purposes.includes(payload.contractPurpose)
  ) {
    return { error: "Tipo de contrato inválido." };
  }

  if (
    payload.propertyUsage !== undefined &&
    !usages.includes(payload.propertyUsage)
  ) {
    return { error: "Uso do imóvel inválido." };
  }

  if (payload.status !== undefined && !statuses.includes(payload.status)) {
    return { error: "Situação inválida." };
  }

  return {
    data: {
      name,
      description,
      notes,
      contractPurpose: payload.contractPurpose,
      propertyUsage: payload.propertyUsage,
      status: payload.status,
      witness1Name: optional(payload.witness1Name),
      witness1Document: optional(payload.witness1Document),
      witness2Name: optional(payload.witness2Name),
      witness2Document: optional(payload.witness2Document),
      clauses: normalizeClauses(payload.clauses),
    },
  };
}

async function ensureDefaultModels() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("real_estate_contract_models")
    .select("contract_purpose,property_usage,is_default")
    .eq("is_default", true);

  if (error) {
    throw new Error(error.message);
  }

  const existingKeys = new Set(
    (data ?? []).map(
      (item) => `${item.contract_purpose}:${item.property_usage}`
    )
  );
  const missing = defaultModels.filter(
    (model) => !existingKeys.has(`${model.contract_purpose}:${model.property_usage}`)
  );

  if (missing.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("real_estate_contract_models")
    .insert(
      missing.map((model) => ({
        ...model,
        status: "active" as const,
        is_default: true,
        updated_at: new Date().toISOString(),
      }))
    );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function GET() {
  try {
    await ensureDefaultModels();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("real_estate_contract_models")
      .select("*")
      .order("contract_purpose", { ascending: true })
      .order("property_usage", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const response: RealEstateContractModelsResponse = {
      models: ((data ?? []) as ContractModelRow[]).map(mapModel),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os modelos.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAuthenticatedUser())) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const payload = (await request.json()) as ContractModelPayload;
  const parsed = validatePayload(payload, "create");

  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const name = parsed.data.name;

  if (!name || !parsed.data.contractPurpose || !parsed.data.propertyUsage) {
    return NextResponse.json(
      { message: "Informe tipo de contrato e uso do imóvel." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_contract_models")
    .insert({
      name,
      contract_purpose: parsed.data.contractPurpose,
      property_usage: parsed.data.propertyUsage,
      description: parsed.data.description,
      notes: parsed.data.notes,
      status: parsed.data.status ?? "active",
      is_default: false,
      witness_1_name: parsed.data.witness1Name,
      witness_1_document: parsed.data.witness1Document,
      witness_2_name: parsed.data.witness2Name,
      witness_2_document: parsed.data.witness2Document,
      clauses: parsed.data.clauses,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const model = mapModel(data as ContractModelRow);

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-contract-model:${model.id}:created`,
    category: "real_estate",
    type: "contract_model_created",
    title: "Modelo de contrato criado",
    message: model.name,
    severity: "info",
    entityType: "real_estate_contract_model",
    entityId: model.id,
    actionHref: "/imobiliaria?tab=configuracoes",
    metadata: {
      contractPurpose: model.contractPurpose,
      propertyUsage: model.propertyUsage,
    },
  });

  return NextResponse.json(model, { status: 201 });
}
