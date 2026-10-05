import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import type {
  RealEstateContractModel,
  RealEstateContractModelClause,
  RealEstateContractModelPurpose,
  RealEstateContractModelStatus,
  RealEstateContractModelUsage,
} from "@/features/real-estate/types";
import { createAdminClient } from "@/lib/supabase/admin";

type ContractModelRouteProps = {
  params: Promise<{ id: string }>;
};

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

export async function PATCH(
  request: NextRequest,
  { params }: ContractModelRouteProps
) {
  if (!(await requireAuthenticatedUser())) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json()) as ContractModelPayload;
  const updates: {
    name?: string;
    contract_purpose?: RealEstateContractModelPurpose;
    property_usage?: RealEstateContractModelUsage;
    description?: string | null;
    notes?: string | null;
    status?: RealEstateContractModelStatus;
    witness_1_name?: string | null;
    witness_1_document?: string | null;
    witness_2_name?: string | null;
    witness_2_document?: string | null;
    clauses?: RealEstateContractModelClause[];
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) {
    const name = payload.name.trim();

    if (!name) {
      return NextResponse.json(
        { message: "Informe o nome do modelo." },
        { status: 400 }
      );
    }

    updates.name = name;
  }

  if (payload.contractPurpose !== undefined) {
    if (!purposes.includes(payload.contractPurpose)) {
      return NextResponse.json(
        { message: "Tipo de contrato inválido." },
        { status: 400 }
      );
    }

    updates.contract_purpose = payload.contractPurpose;
  }

  if (payload.propertyUsage !== undefined) {
    if (!usages.includes(payload.propertyUsage)) {
      return NextResponse.json(
        { message: "Uso do imóvel inválido." },
        { status: 400 }
      );
    }

    updates.property_usage = payload.propertyUsage;
  }

  if (payload.description !== undefined) {
    updates.description = optional(payload.description);
  }

  if (payload.notes !== undefined) {
    updates.notes = optional(payload.notes);
  }

  if (payload.status !== undefined) {
    if (!statuses.includes(payload.status)) {
      return NextResponse.json(
        { message: "Situação inválida." },
        { status: 400 }
      );
    }

    updates.status = payload.status;
  }

  if (payload.witness1Name !== undefined) {
    updates.witness_1_name = optional(payload.witness1Name);
  }

  if (payload.witness1Document !== undefined) {
    updates.witness_1_document = optional(payload.witness1Document);
  }

  if (payload.witness2Name !== undefined) {
    updates.witness_2_name = optional(payload.witness2Name);
  }

  if (payload.witness2Document !== undefined) {
    updates.witness_2_document = optional(payload.witness2Document);
  }

  if (payload.clauses !== undefined) {
    updates.clauses = normalizeClauses(payload.clauses);
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { message: "Informe os dados para atualizar o modelo." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_contract_models")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const model = mapModel(data as ContractModelRow);
  const changedStatus = payload.status !== undefined;

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-contract-model:${model.id}:updated:${Date.now()}`,
    category: "real_estate",
    type: changedStatus ? "contract_model_status_changed" : "contract_model_updated",
    title: changedStatus
      ? model.status === "active"
        ? "Modelo de contrato ativado"
        : "Modelo de contrato inativado"
      : "Modelo de contrato atualizado",
    message: model.name,
    severity:
      changedStatus && model.status === "inactive" ? "warning" : "info",
    entityType: "real_estate_contract_model",
    entityId: model.id,
    actionHref: "/imobiliaria?tab=configuracoes",
    metadata: {
      contractPurpose: model.contractPurpose,
      propertyUsage: model.propertyUsage,
      status: model.status,
    },
  });

  return NextResponse.json(model);
}
