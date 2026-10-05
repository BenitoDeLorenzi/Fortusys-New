"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  ExternalLink,
  File,
  FileImage,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormPageHeader } from "@/components/management/form-page-header";
import {
  ManagementState,
  ManagementTableFrame,
  ManagementTableSkeleton,
} from "@/components/management/management-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  REAL_ESTATE_DOCUMENT_LIMIT,
  REAL_ESTATE_DOCUMENT_MAX_BYTES,
  REAL_ESTATE_DOCUMENT_MIME_TYPES,
  type RealEstateDocument,
  type RealEstateDocumentsResponse,
} from "@/features/real-estate/documents";

type RealEstateDocumentsManagementProps = {
  assetId: string;
};

const returnTabs = ["resumo", "imoveis", "agenda", "cobrancas"] as const;

function getReturnTab(value?: string | null) {
  return returnTabs.includes(value as (typeof returnTabs)[number])
    ? value
    : "imoveis";
}

type DocumentMutationResponse = {
  documents?: RealEstateDocument[];
  limit?: number;
  message?: string;
};

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDocumentPresentation(document: RealEstateDocument): {
  icon: LucideIcon;
  label: string;
  className: string;
} {
  if (document.mimeType === "application/pdf") {
    return {
      icon: FileText,
      label: "PDF",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (document.mimeType.includes("spreadsheet") || document.mimeType.includes("excel")) {
    return {
      icon: FileSpreadsheet,
      label: "Planilha",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (document.mimeType.startsWith("image/")) {
    return {
      icon: FileImage,
      label: "Imagem",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  if (document.mimeType.includes("word")) {
    return {
      icon: FileText,
      label: "Word",
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }

  return {
    icon: File,
    label: "Arquivo",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

export function RealEstateDocumentsManagement({
  assetId,
}: RealEstateDocumentsManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTab = getReturnTab(searchParams.get("returnTab"));
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<RealEstateDocumentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [documentToDelete, setDocumentToDelete] =
    useState<RealEstateDocument | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/documents`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as
        | RealEstateDocumentsResponse
        | { message?: string };

      if (!response.ok || !("documents" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar os documentos."
        );
      }

      setData(payload);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os documentos."
      );
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    let isCurrent = true;

    window.queueMicrotask(() => {
      if (isCurrent) {
        void loadDocuments();
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [loadDocuments]);

  async function handleUpload(files: File[]) {
    if (!data || files.length === 0) {
      return;
    }

    const availableSlots = data.limit - data.documents.length;

    if (files.length > availableSlots) {
      toast.warning(`Você pode adicionar mais ${availableSlots} documento(s).`);
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !REAL_ESTATE_DOCUMENT_MIME_TYPES.includes(
          file.type as (typeof REAL_ESTATE_DOCUMENT_MIME_TYPES)[number]
        ) || file.size > REAL_ESTATE_DOCUMENT_MAX_BYTES
    );

    if (invalidFile) {
      toast.error(
        `${invalidFile.name}: use PDF, Word, Excel, JPEG ou PNG de até 15 MB.`
      );
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );
      const payload = (await response.json()) as DocumentMutationResponse;

      if (!response.ok || !payload.documents) {
        throw new Error(
          payload.message ?? "Não foi possível enviar os documentos."
        );
      }

      setData((current) =>
        current
          ? {
              ...current,
              documents: payload.documents ?? current.documents,
              limit: payload.limit ?? current.limit,
            }
          : current
      );
      toast.success(
        files.length === 1
          ? "Documento adicionado"
          : `${files.length} documentos adicionados`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar os documentos."
      );
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleDelete() {
    if (!documentToDelete || !data) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/documents?documentId=${encodeURIComponent(
          documentToDelete.id
        )}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as DocumentMutationResponse;

      if (!response.ok || !payload.documents) {
        throw new Error(
          payload.message ?? "Não foi possível excluir o documento."
        );
      }

      setData({ ...data, documents: payload.documents });
      setDocumentToDelete(null);
      toast.success("Documento excluído");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o documento."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const atLimit = Boolean(
    data && data.documents.length >= REAL_ESTATE_DOCUMENT_LIMIT
  );

  return (
    <div className="space-y-5">
      <FormPageHeader
        backLabel="Voltar para imóveis"
        badge="Imobiliária"
        onBack={() => router.push(`/imobiliaria?tab=${returnTab}`)}
        title={
          data
            ? `Documentos · ${data.asset.title}`
            : "Documentos do imóvel"
        }
        actions={
          <>
            {data ? (
              <Badge variant="secondary">
                {data.documents.length}/{data.limit} documentos
              </Badge>
            ) : null}
            <Button
              disabled={isLoading || isUploading || atLimit}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FilePlus2 className="size-4" />
              )}
              Adicionar documentos
            </Button>
          </>
        }
      />

      <input
        ref={inputRef}
        accept={REAL_ESTATE_DOCUMENT_MIME_TYPES.join(",")}
        className="hidden"
        multiple
        onChange={(event) => {
          void handleUpload(Array.from(event.target.files ?? []));
        }}
        type="file"
      />

      {isLoading ? (
        <div className="space-y-4">
          <div
            aria-hidden="true"
            className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/15 p-5"
          >
            <div className="size-8 animate-pulse rounded-xl bg-muted-foreground/15" />
            <div className="h-4 w-64 animate-pulse rounded-full bg-muted-foreground/15" />
            <div className="h-3 w-80 max-w-full animate-pulse rounded-full bg-muted-foreground/10" />
          </div>
          <ManagementTableSkeleton columns={5} rows={6} />
        </div>
      ) : !data ? (
        <ManagementState>Não foi possível carregar o imóvel.</ManagementState>
      ) : (
        <>
          <button
            className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/15 p-5 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isUploading || atLimit}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleUpload(Array.from(event.dataTransfer.files));
            }}
            type="button"
          >
            {isUploading ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <Upload className="size-6 text-primary" />
            )}
            <span className="font-medium">
              {atLimit
                ? "Limite de documentos atingido"
                : "Arraste documentos ou clique para selecionar"}
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, Word, Excel, JPEG ou PNG · até 15 MB · máximo de 10 por envio
            </span>
          </button>

          {data.documents.length === 0 ? (
            <ManagementState>
              Este imóvel ainda não possui documentos cadastrados.
            </ManagementState>
          ) : (
            <ManagementTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Adicionado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.documents.map((document) => {
                    const presentation = getDocumentPresentation(document);
                    const DocumentIcon = presentation.icon;

                    return (
                      <TableRow key={document.id}>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <DocumentIcon className="size-4 text-muted-foreground" />
                            </span>
                            <span
                              className="max-w-96 truncate font-medium"
                              title={document.originalName}
                            >
                              {document.originalName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={presentation.className}
                            variant="outline"
                          >
                            {presentation.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatFileSize(document.sizeBytes)}</TableCell>
                        <TableCell>{formatDate(document.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              aria-label={`Abrir ${document.originalName}`}
                              disabled={!document.url}
                              onClick={() =>
                                window.open(
                                  document.url,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                            <Button
                              aria-label={`Baixar ${document.originalName}`}
                              disabled={!document.downloadUrl}
                              onClick={() =>
                                window.open(
                                  document.downloadUrl,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <Download className="size-4" />
                            </Button>
                            <Button
                              aria-label={`Excluir ${document.originalName}`}
                              disabled={isDeleting}
                              onClick={() => setDocumentToDelete(document)}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ManagementTableFrame>
          )}
        </>
      )}

      <AlertDialog
        open={Boolean(documentToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setDocumentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo “{documentToDelete?.originalName}” será removido deste
              imóvel. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isDeleting}>Cancelar</AlertDialogClose>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
