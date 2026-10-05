import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import type { Json } from "@/features/database/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import {
  REAL_ESTATE_DOCUMENT_LIMIT,
  REAL_ESTATE_DOCUMENT_MAX_BYTES,
  REAL_ESTATE_DOCUMENTS_BUCKET,
  type RealEstateDocument,
} from "@/features/real-estate/documents";
import { createAdminClient } from "@/lib/supabase/admin";

type ContractDocumentsRouteContext = {
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
  templateType?: string | null;
};

type LeaseRow = {
  id: string;
  asset_id: string;
  contract_number: string | null;
  status: "draft" | "active" | "ended" | "canceled";
  document_status:
    | "not_generated"
    | "draft_generated"
    | "pending_signature"
    | "signed";
};

type AssetRow = {
  id: string;
  documents: Json;
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
          typeof item.templateType === "string" ? item.templateType : null,
      };
    })
    .filter((document): document is StoredDocument => Boolean(document));
}

async function mapDocument(
  document: StoredDocument
): Promise<RealEstateDocument> {
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

function unauthorizedResponse() {
  return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
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

function getContractDocuments(documents: StoredDocument[], leaseId: string) {
  return documents.filter(
    (document) => document.leaseId === leaseId && document.scope === "contract"
  );
}

function getDocumentStatusAfterDeletion(
  lease: LeaseRow,
  remainingContractDocuments: StoredDocument[]
): LeaseRow["document_status"] {
  const hasSignedContract = remainingContractDocuments.some(
    (document) => document.documentType === "signed_contract"
  );
  const hasDraft = remainingContractDocuments.some(
    (document) => document.documentType === "draft"
  );

  if (hasSignedContract) {
    return "signed";
  }

  if (lease.document_status === "signed") {
    return hasDraft ? "pending_signature" : "not_generated";
  }

  if (lease.document_status === "pending_signature") {
    return hasDraft ? "pending_signature" : "not_generated";
  }

  if (lease.document_status === "draft_generated") {
    return hasDraft ? "draft_generated" : "not_generated";
  }

  return "not_generated";
}

export async function GET(
  _request: Request,
  context: ContractDocumentsRouteContext
) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: lease, error: leaseError } = await supabase
      .from("real_estate_leases")
      .select("id,asset_id,contract_number,status,document_status")
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
    const { data: asset, error: assetError } = await supabase
      .from("real_estate_assets")
      .select("id,documents")
      .eq("id", leaseRow.asset_id)
      .maybeSingle();

    if (assetError) {
      throw new Error(assetError.message);
    }

    if (!asset) {
      return NextResponse.json(
        { message: "Imóvel vinculado ao contrato não encontrado." },
        { status: 404 }
      );
    }

    const assetRow = asset as AssetRow;
    const documents = normalizeStoredDocuments(assetRow.documents)
      .filter(
        (document) =>
          document.leaseId === leaseRow.id && document.scope === "contract"
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      documents: await Promise.all(documents.map(mapDocument)),
      total: documents.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os documentos do contrato.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: ContractDocumentsRouteContext
) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  let uploadedPath: string | null = null;

  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Selecione o contrato assinado em PDF." },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { message: "O contrato assinado precisa estar em PDF." },
        { status: 400 }
      );
    }

    if (file.size > REAL_ESTATE_DOCUMENT_MAX_BYTES) {
      return NextResponse.json(
        { message: "O limite é 15 MB por documento." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: lease, error: leaseError } = await supabase
      .from("real_estate_leases")
      .select("id,asset_id,contract_number,status,document_status")
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
    const { data: asset, error: assetError } = await supabase
      .from("real_estate_assets")
      .select("id,documents")
      .eq("id", leaseRow.asset_id)
      .maybeSingle();

    if (assetError) {
      throw new Error(assetError.message);
    }

    if (!asset) {
      return NextResponse.json(
        { message: "Imóvel vinculado ao contrato não encontrado." },
        { status: 404 }
      );
    }

    const assetRow = asset as AssetRow;
    const currentDocuments = normalizeStoredDocuments(assetRow.documents);

    if (currentDocuments.length >= REAL_ESTATE_DOCUMENT_LIMIT) {
      return NextResponse.json(
        {
          message: `Este imóvel já possui o limite de ${REAL_ESTATE_DOCUMENT_LIMIT} documentos.`,
        },
        { status: 400 }
      );
    }

    const documentId = randomUUID();
    const originalName = normalizeFileName(
      file.name || `contrato-assinado-${leaseRow.id.slice(0, 8)}.pdf`
    );
    uploadedPath = `${assetRow.id}/${documentId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(REAL_ESTATE_DOCUMENTS_BUCKET)
      .upload(uploadedPath, await file.arrayBuffer(), {
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
      sizeBytes: file.size,
      createdAt,
      leaseId: leaseRow.id,
      scope: "contract",
      documentType: "signed_contract",
      templateType: null,
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
        document_status: "signed",
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
      title: "Contrato assinado anexado",
      description:
        "PDF assinado por todas as partes anexado ao contrato. Contrato liberado para ativação.",
      metadata: {
        documentId,
        storagePath: uploadedPath,
        originalName,
      },
    });

    await createInternalActionNotification(supabase, {
      sourceKey: `real-estate-contract:${leaseRow.id}:signed-document:${documentId}`,
      category: "real_estate",
      type: "contract_signed_document_added",
      title: "Contrato assinado anexado",
      message: leaseRow.contract_number
        ? `Contrato ${leaseRow.contract_number}`
        : "Contrato assinado anexado",
      severity: "success",
      entityType: "real_estate_contract",
      entityId: leaseRow.id,
      actionHref: `/imobiliaria/${assetRow.id}/contratos`,
      metadata: {
        assetId: assetRow.id,
        documentId,
        originalName,
      },
    });

    uploadedPath = null;

    return NextResponse.json(
      {
        document: await mapDocument(document),
        documents: await Promise.all(documents.map(mapDocument)),
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedPath) {
      const supabase = createAdminClient();
      await supabase.storage
        .from(REAL_ESTATE_DOCUMENTS_BUCKET)
        .remove([uploadedPath]);
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível anexar o contrato assinado.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: ContractDocumentsRouteContext
) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const documentId = new URL(request.url).searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { message: "Documento não informado." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: lease, error: leaseError } = await supabase
      .from("real_estate_leases")
      .select("id,asset_id,contract_number,status,document_status")
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
    const { data: asset, error: assetError } = await supabase
      .from("real_estate_assets")
      .select("id,documents")
      .eq("id", leaseRow.asset_id)
      .maybeSingle();

    if (assetError) {
      throw new Error(assetError.message);
    }

    if (!asset) {
      return NextResponse.json(
        { message: "Imóvel vinculado ao contrato não encontrado." },
        { status: 404 }
      );
    }

    const assetRow = asset as AssetRow;
    const currentDocuments = normalizeStoredDocuments(assetRow.documents);
    const document = currentDocuments.find(
      (item) =>
        item.id === documentId &&
        item.leaseId === leaseRow.id &&
        item.scope === "contract"
    );

    if (!document) {
      return NextResponse.json(
        { message: "Documento do contrato não encontrado." },
        { status: 404 }
      );
    }

    if (
      leaseRow.status === "active" &&
      document.documentType === "signed_contract"
    ) {
      return NextResponse.json(
        {
          message:
            "Não é possível excluir o contrato assinado de um contrato ativo.",
        },
        { status: 409 }
      );
    }

    const { error: storageError } = await supabase.storage
      .from(REAL_ESTATE_DOCUMENTS_BUCKET)
      .remove([document.storagePath]);

    if (storageError) {
      throw new Error(storageError.message);
    }

    const documents = currentDocuments.filter((item) => item.id !== documentId);
    const remainingContractDocuments = getContractDocuments(
      documents,
      leaseRow.id
    );
    const nextDocumentStatus = getDocumentStatusAfterDeletion(
      leaseRow,
      remainingContractDocuments
    );
    const updatedAt = new Date().toISOString();

    const { error: assetUpdateError } = await supabase
      .from("real_estate_assets")
      .update({
        documents: documents as unknown as Json,
        updated_at: updatedAt,
      })
      .eq("id", assetRow.id);

    if (assetUpdateError) {
      throw new Error(assetUpdateError.message);
    }

    const { error: leaseUpdateError } = await supabase
      .from("real_estate_leases")
      .update({
        document_status: nextDocumentStatus,
        updated_at: updatedAt,
      })
      .eq("id", leaseRow.id);

    if (leaseUpdateError) {
      throw new Error(leaseUpdateError.message);
    }

    await supabase.from("real_estate_contract_events").insert({
      asset_id: assetRow.id,
      lease_id: leaseRow.id,
      event_type: "updated",
      title: "Documento removido",
      description: `Documento ${document.originalName} removido do contrato.`,
      metadata: {
        documentId,
        originalName: document.originalName,
        documentType: document.documentType,
        nextDocumentStatus,
      },
    });

    await createInternalActionNotification(supabase, {
      sourceKey: `real-estate-contract:${leaseRow.id}:document-deleted:${documentId}`,
      category: "real_estate",
      type: "contract_document_deleted",
      title: "Documento de contrato excluído",
      message: document.originalName,
      severity:
        document.documentType === "signed_contract" ? "warning" : "info",
      entityType: "real_estate_contract",
      entityId: leaseRow.id,
      actionHref: `/imobiliaria/${assetRow.id}/contratos`,
      metadata: {
        assetId: assetRow.id,
        documentId,
        originalName: document.originalName,
        documentType: document.documentType,
        nextDocumentStatus,
      },
    });

    const contractDocuments = getContractDocuments(documents, leaseRow.id).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );

    return NextResponse.json({
      documents: await Promise.all(contractDocuments.map(mapDocument)),
      documentStatus: nextDocumentStatus,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir o documento.",
      },
      { status: 500 }
    );
  }
}
