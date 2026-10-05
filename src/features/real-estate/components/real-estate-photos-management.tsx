"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Expand,
  ImageOff,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  Upload,
  X,
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
  ManagementGallerySkeleton,
  ManagementState,
} from "@/components/management/management-layout";
import {
  REAL_ESTATE_PHOTO_MAX_BYTES,
  REAL_ESTATE_PHOTO_MIME_TYPES,
  type RealEstatePhoto,
  type RealEstatePhotosResponse,
} from "@/features/real-estate/photos";

type RealEstatePhotosManagementProps = {
  assetId: string;
};

const returnTabs = ["resumo", "imoveis", "agenda", "cobrancas"] as const;

function getReturnTab(value?: string | null) {
  return returnTabs.includes(value as (typeof returnTabs)[number])
    ? value
    : "imoveis";
}

type PhotoMutationResponse = {
  photos?: RealEstatePhoto[];
  limit?: number;
  message?: string;
};

function formatFileSize(value: number | null) {
  if (!value) {
    return null;
  }

  return `${(value / 1024 / 1024).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} MB`;
}

export function RealEstatePhotosManagement({
  assetId,
}: RealEstatePhotosManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTab = getReturnTab(searchParams.get("returnTab"));
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<RealEstatePhotosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<RealEstatePhoto | null>(
    null
  );
  const [previewPhoto, setPreviewPhoto] = useState<RealEstatePhoto | null>(null);
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(
    () => new Set()
  );

  const loadPhotos = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/photos`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as
        | RealEstatePhotosResponse
        | { message?: string };

      if (!response.ok || !("photos" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar as fotos."
        );
      }

      setData(payload);
      setFailedPhotoIds(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as fotos."
      );
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    let isCurrent = true;

    window.queueMicrotask(() => {
      if (isCurrent) {
        void loadPhotos();
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [loadPhotos]);

  async function handleUpload(files: File[]) {
    if (!data || files.length === 0) {
      return;
    }

    const availableSlots = data.limit - data.photos.length;

    if (files.length > availableSlots) {
      toast.warning(`Você pode adicionar mais ${availableSlots} foto(s).`);
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !REAL_ESTATE_PHOTO_MIME_TYPES.includes(
          file.type as (typeof REAL_ESTATE_PHOTO_MIME_TYPES)[number]
        ) || file.size > REAL_ESTATE_PHOTO_MAX_BYTES
    );

    if (invalidFile) {
      toast.error(`${invalidFile.name}: use JPEG, PNG ou WebP de até 6 MB.`);
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/photos`,
        {
          method: "POST",
          body: formData,
        }
      );
      const payload = (await response.json()) as PhotoMutationResponse;

      if (!response.ok || !payload.photos) {
        throw new Error(payload.message ?? "Não foi possível enviar as fotos.");
      }

      setData((current) =>
        current
          ? {
              ...current,
              photos: payload.photos ?? current.photos,
              limit: payload.limit ?? current.limit,
            }
          : current
      );
      toast.success(
        files.length === 1
          ? "Foto adicionada"
          : `${files.length} fotos adicionadas`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar as fotos."
      );
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function updatePhotos(body: Record<string, unknown>) {
    if (!data) {
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/photos`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const payload = (await response.json()) as PhotoMutationResponse;

      if (!response.ok || !payload.photos) {
        throw new Error(
          payload.message ?? "Não foi possível atualizar as fotos."
        );
      }

      setData((current) =>
        current ? { ...current, photos: payload.photos ?? current.photos } : current
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar as fotos."
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleSetCover(photo: RealEstatePhoto) {
    await updatePhotos({ action: "cover", photoId: photo.id });
    toast.success("Foto de capa atualizada");
  }

  async function handleMove(photoIndex: number, direction: -1 | 1) {
    if (!data) {
      return;
    }

    const targetIndex = photoIndex + direction;

    if (targetIndex < 0 || targetIndex >= data.photos.length) {
      return;
    }

    const reordered = [...data.photos];
    [reordered[photoIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[photoIndex],
    ];
    setData({ ...data, photos: reordered });
    await updatePhotos({ orderedIds: reordered.map((photo) => photo.id) });
  }

  async function handleDelete() {
    if (!photoToDelete || !data) {
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/real-estate/assets/${assetId}/photos?photoId=${encodeURIComponent(
          photoToDelete.id
        )}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as PhotoMutationResponse;

      if (!response.ok || !payload.photos) {
        throw new Error(payload.message ?? "Não foi possível excluir a foto.");
      }

      setData({ ...data, photos: payload.photos });
      setPhotoToDelete(null);
      toast.success("Foto excluída");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a foto."
      );
    } finally {
      setIsUpdating(false);
    }
  }

  const atLimit = Boolean(data && data.photos.length >= data.limit);

  return (
    <div className="space-y-5">
      <FormPageHeader
        backLabel="Voltar para imóveis"
        badge="Imobiliária"
        onBack={() => router.push(`/imobiliaria?tab=${returnTab}`)}
        title={data ? `Fotos · ${data.asset.title}` : "Fotos do imóvel"}
        actions={
          <>
            {data ? (
              <Badge variant="secondary">
                {data.photos.length}/{data.limit} fotos
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
                <ImagePlus className="size-4" />
              )}
              Adicionar fotos
            </Button>
          </>
        }
      />

      <input
        ref={inputRef}
        accept={REAL_ESTATE_PHOTO_MIME_TYPES.join(",")}
        className="hidden"
        multiple
        onChange={(event) => {
          void handleUpload(Array.from(event.target.files ?? []));
        }}
        type="file"
      />

      {isLoading ? (
        <ManagementGallerySkeleton items={8} />
      ) : !data ? (
        <ManagementState>Não foi possível carregar o imóvel.</ManagementState>
      ) : (
        <>
          <button
            className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/15 p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
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
                ? "Limite de fotos atingido"
                : "Arraste fotos ou clique para selecionar"}
            </span>
            <span className="text-xs text-muted-foreground">
              JPEG, PNG ou WebP · até 6 MB · máximo de 10 por envio
            </span>
          </button>

          {data.photos.length === 0 ? (
            <ManagementState>
              Este imóvel ainda não possui fotos cadastradas.
            </ManagementState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {data.photos.map((photo, index) => {
                const imageFailed = failedPhotoIds.has(photo.id);

                return (
                  <article
                    className="group overflow-hidden rounded-xl border bg-card shadow-sm"
                    key={photo.id}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {imageFailed ? (
                        <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/60 px-5 text-center text-muted-foreground">
                          <ImageOff className="size-8" />
                          <span className="text-sm font-medium">
                            Foto indisponível
                          </span>
                          <span className="text-xs">
                            Não foi possível carregar este arquivo.
                          </span>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          alt={photo.originalName}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          onError={() =>
                            setFailedPhotoIds((current) => {
                              const next = new Set(current);
                              next.add(photo.id);
                              return next;
                            })
                          }
                          src={photo.url}
                        />
                      )}
                      <div className="absolute left-2 top-2 flex gap-1.5">
                        {photo.isCover ? (
                          <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                            <Star className="size-3 fill-current" />
                            Capa
                          </Badge>
                        ) : null}
                        {photo.isLegacy ? (
                          <Badge variant="secondary">Legado</Badge>
                        ) : null}
                      </div>
                      <Button
                        aria-label="Ampliar foto"
                        className="absolute right-2 top-2 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                        disabled={imageFailed}
                        onClick={() => setPreviewPhoto(photo)}
                        size="icon"
                        type="button"
                        variant="secondary"
                      >
                        <Expand className="size-4" />
                      </Button>
                    </div>
                  <div className="space-y-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {photo.originalName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(photo.sizeBytes) ?? "Foto importada"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        <Button
                          aria-label="Mover foto para a esquerda"
                          disabled={index === 0 || isUpdating}
                          onClick={() => void handleMove(index, -1)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          <ArrowLeft className="size-3.5" />
                        </Button>
                        <Button
                          aria-label="Mover foto para a direita"
                          disabled={
                            index === data.photos.length - 1 || isUpdating
                          }
                          onClick={() => void handleMove(index, 1)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          disabled={photo.isCover || isUpdating}
                          onClick={() => void handleSetCover(photo)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Star className="size-3.5" />
                          Capa
                        </Button>
                        <Button
                          aria-label="Excluir foto"
                          disabled={isUpdating}
                          onClick={() => setPhotoToDelete(photo)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {previewPhoto ? (
        <div
          aria-label="Visualização ampliada da foto"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
        >
          <button
            aria-label="Fechar visualização"
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setPreviewPhoto(null)}
            type="button"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={previewPhoto.originalName}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
            src={previewPhoto.url}
          />
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(photoToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPhotoToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
            <AlertDialogDescription>
              A foto será removida deste imóvel. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isUpdating}>Cancelar</AlertDialogClose>
            <AlertDialogAction
              disabled={isUpdating}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isUpdating ? (
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
