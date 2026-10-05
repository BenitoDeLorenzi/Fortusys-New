import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import type { Json } from "@/features/database/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import {
  REAL_ESTATE_DOCUMENT_LIMIT,
  REAL_ESTATE_DOCUMENT_MAX_BYTES,
  REAL_ESTATE_DOCUMENT_MIME_TYPES,
  REAL_ESTATE_DOCUMENTS_BUCKET,
  type RealEstateDocument,
  type RealEstateDocumentsResponse,
} from "@/features/real-estate/documents";
import { createAdminClient } from "@/lib/supabase/admin";

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

type AssetDocumentRow = {
  id: string;
  code: number | null;
  title: string;
  documents: Json;
};

type DocumentsRouteContext = {
  params: Promise<{ id: string }>;
};

const extensionByMimeType: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "image/jpeg": "jpg",
  "image/png": "png",
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
      allowedMimeTypes: [...REAL_ESTATE_DOCUMENT_MIME_TYPES],
    }
  );

  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(error.message);
  }
}

async function getAsset(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_assets")
    .select("id,code,title,documents")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AssetDocumentRow | null) ?? null;
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

async function updateAssetDocuments(
  assetId: string,
  documents: StoredDocument[]
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("real_estate_assets")
    .update({
      documents: documents as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }
}

function unauthorizedResponse() {
  return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
}

export async function GET(_request: Request, context: DocumentsRouteContext) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const asset = await getAsset(id);

    if (!asset) {
      return NextResponse.json(
        { message: "Imóvel não encontrado." },
        { status: 404 }
      );
    }

    await ensureDocumentsBucket();
    const documents = await Promise.all(
      normalizeStoredDocuments(asset.documents).map(mapDocument)
    );

    return NextResponse.json({
      asset: {
        id: asset.id,
        code: asset.code,
        title: asset.title,
      },
      documents,
      limit: REAL_ESTATE_DOCUMENT_LIMIT,
    } satisfies RealEstateDocumentsResponse);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os documentos.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: DocumentsRouteContext) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  const uploadedPaths: string[] = [];

  try {
    const { id } = await context.params;
    const asset = await getAsset(id);

    if (!asset) {
      return NextResponse.json(
        { message: "Imóvel não encontrado." },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { message: "Selecione ao menos um documento." },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { message: "Envie no máximo 10 documentos por vez." },
        { status: 400 }
      );
    }

    const currentDocuments = normalizeStoredDocuments(asset.documents);

    if (currentDocuments.length + files.length > REAL_ESTATE_DOCUMENT_LIMIT) {
      return NextResponse.json(
        {
          message: `Cada imóvel pode ter até ${REAL_ESTATE_DOCUMENT_LIMIT} documentos.`,
        },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (
        !REAL_ESTATE_DOCUMENT_MIME_TYPES.includes(
          file.type as (typeof REAL_ESTATE_DOCUMENT_MIME_TYPES)[number]
        )
      ) {
        return NextResponse.json(
          { message: `${file.name}: formato não permitido.` },
          { status: 400 }
        );
      }

      if (file.size > REAL_ESTATE_DOCUMENT_MAX_BYTES) {
        return NextResponse.json(
          { message: `${file.name}: o limite é 15 MB por documento.` },
          { status: 400 }
        );
      }
    }

    await ensureDocumentsBucket();
    const supabase = createAdminClient();
    const newDocuments: StoredDocument[] = [];

    for (const file of files) {
      const documentId = randomUUID();
      const extension = extensionByMimeType[file.type];
      const storagePath = `${id}/${documentId}.${extension}`;
      const { error } = await supabase.storage
        .from(REAL_ESTATE_DOCUMENTS_BUCKET)
        .upload(storagePath, await file.arrayBuffer(), {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        throw new Error(`${file.name}: ${error.message}`);
      }

      uploadedPaths.push(storagePath);
      newDocuments.push({
        id: documentId,
        storagePath,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
        scope: "asset",
      });
    }

    const documents = [...currentDocuments, ...newDocuments];
    await updateAssetDocuments(id, documents);

    await createInternalActionNotification(createAdminClient(), {
      sourceKey: `real-estate-asset:${id}:documents-added:${Date.now()}`,
      category: "real_estate",
      type: "asset_documents_added",
      title: "Documentos adicionados ao imóvel",
      message: `${asset.code ? `${asset.code} · ` : ""}${asset.title} · ${newDocuments.length} documento(s)`,
      severity: "info",
      entityType: "real_estate_asset",
      entityId: id,
      actionHref: `/imobiliaria/${id}/documentos`,
      metadata: { assetId: id, count: newDocuments.length },
    });

    return NextResponse.json(
      {
        documents: await Promise.all(documents.map(mapDocument)),
        limit: REAL_ESTATE_DOCUMENT_LIMIT,
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const supabase = createAdminClient();
      await supabase.storage
        .from(REAL_ESTATE_DOCUMENTS_BUCKET)
        .remove(uploadedPaths);
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar os documentos.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: DocumentsRouteContext
) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const documentId = new URL(request.url).searchParams.get("documentId");
    const asset = await getAsset(id);

    if (!asset || !documentId) {
      return NextResponse.json(
        { message: "Documento não encontrado." },
        { status: 404 }
      );
    }

    const currentDocuments = normalizeStoredDocuments(asset.documents);
    const document = currentDocuments.find((item) => item.id === documentId);

    if (!document) {
      return NextResponse.json(
        { message: "Documento não encontrado." },
        { status: 404 }
      );
    }

    const supabase = createAdminClient();
    const { error: storageError } = await supabase.storage
      .from(REAL_ESTATE_DOCUMENTS_BUCKET)
      .remove([document.storagePath]);

    if (storageError) {
      throw new Error(storageError.message);
    }

    const documents = currentDocuments.filter(
      (item) => item.id !== documentId
    );
    await updateAssetDocuments(id, documents);

    await createInternalActionNotification(supabase, {
      sourceKey: `real-estate-asset:${id}:document-deleted:${Date.now()}`,
      category: "real_estate",
      type: "asset_document_deleted",
      title: "Documento excluído do imóvel",
      message: `${asset.code ? `${asset.code} · ` : ""}${asset.title}`,
      severity: "warning",
      entityType: "real_estate_asset",
      entityId: id,
      actionHref: `/imobiliaria/${id}/documentos`,
      metadata: { assetId: id, documentId },
    });

    return NextResponse.json({
      documents: await Promise.all(documents.map(mapDocument)),
      limit: REAL_ESTATE_DOCUMENT_LIMIT,
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
