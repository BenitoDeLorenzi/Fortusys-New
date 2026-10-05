import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import type { Json } from "@/features/database/types";
import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import {
  REAL_ESTATE_PHOTO_LIMIT,
  REAL_ESTATE_PHOTO_MAX_BYTES,
  REAL_ESTATE_PHOTO_MIME_TYPES,
  REAL_ESTATE_PHOTOS_BUCKET,
  type RealEstatePhoto,
  type RealEstatePhotosResponse,
} from "@/features/real-estate/photos";
import { createAdminClient } from "@/lib/supabase/admin";

type StoredPhoto = {
  id: string;
  storagePath: string | null;
  externalUrl: string | null;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  isCover: boolean;
  sortOrder: number;
  createdAt: string | null;
};

type AssetPhotoRow = {
  id: string;
  code: number | null;
  title: string;
  photos: Json;
};

type PhotosRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStoredPhotos(value: Json): StoredPhoto[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): StoredPhoto | null => {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        typeof item.storagePath !== "string" ||
        !item.storagePath.trim()
      ) {
        return null;
      }

      return {
        id: item.id,
        storagePath: item.storagePath,
        externalUrl: null,
        originalName:
          typeof item.originalName === "string"
            ? item.originalName
            : `Foto ${index + 1}`,
        mimeType: typeof item.mimeType === "string" ? item.mimeType : null,
        sizeBytes:
          typeof item.sizeBytes === "number" ? item.sizeBytes : null,
        isCover: Boolean(item.isCover),
        sortOrder:
          typeof item.sortOrder === "number" ? item.sortOrder : index,
        createdAt:
          typeof item.createdAt === "string" ? item.createdAt : null,
      };
    })
    .filter((photo): photo is StoredPhoto => Boolean(photo))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((photo, index, photos) => ({
      ...photo,
      isCover: photos.some((item) => item.isCover)
        ? photo.isCover
        : index === 0,
      sortOrder: index,
    }));
}

function serializePhotos(photos: StoredPhoto[]) {
  return photos.map((photo, index) => ({
    ...photo,
    sortOrder: index,
  })) as Json;
}

async function ensurePhotosBucket() {
  const supabase = createAdminClient();
  const { data } = await supabase.storage.getBucket(REAL_ESTATE_PHOTOS_BUCKET);

  if (data) {
    return;
  }

  const { error } = await supabase.storage.createBucket(
    REAL_ESTATE_PHOTOS_BUCKET,
    {
      public: false,
      fileSizeLimit: REAL_ESTATE_PHOTO_MAX_BYTES,
      allowedMimeTypes: [...REAL_ESTATE_PHOTO_MIME_TYPES],
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
    .select("id,code,title,photos")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AssetPhotoRow | null) ?? null;
}

async function getPhotoUrl(photo: StoredPhoto) {
  if (!photo.storagePath) {
    return "";
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(REAL_ESTATE_PHOTOS_BUCKET)
    .createSignedUrl(photo.storagePath, 60 * 60);

  if (error) {
    return "";
  }

  return data.signedUrl;
}

async function mapPhoto(photo: StoredPhoto): Promise<RealEstatePhoto> {
  return {
    id: photo.id,
    url: await getPhotoUrl(photo),
    originalName: photo.originalName,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    isCover: photo.isCover,
    sortOrder: photo.sortOrder,
    createdAt: photo.createdAt,
    isLegacy: Boolean(photo.externalUrl),
  };
}

async function updateAssetPhotos(assetId: string, photos: StoredPhoto[]) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("real_estate_assets")
    .update({
      photos: serializePhotos(photos),
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(error.message);
  }
}

async function unauthorizedResponse() {
  return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
}

export async function GET(_request: Request, context: PhotosRouteContext) {
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

    await ensurePhotosBucket();
    const photos = await Promise.all(
      normalizeStoredPhotos(asset.photos).map(mapPhoto)
    );

    return NextResponse.json({
      asset: {
        id: asset.id,
        code: asset.code,
        title: asset.title,
      },
      photos,
      limit: REAL_ESTATE_PHOTO_LIMIT,
    } satisfies RealEstatePhotosResponse);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as fotos.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: PhotosRouteContext) {
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
        { message: "Selecione ao menos uma foto." },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { message: "Envie no máximo 10 fotos por vez." },
        { status: 400 }
      );
    }

    const currentPhotos = normalizeStoredPhotos(asset.photos);

    if (currentPhotos.length + files.length > REAL_ESTATE_PHOTO_LIMIT) {
      return NextResponse.json(
        {
          message: `Cada imóvel pode ter até ${REAL_ESTATE_PHOTO_LIMIT} fotos.`,
        },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (
        !REAL_ESTATE_PHOTO_MIME_TYPES.includes(
          file.type as (typeof REAL_ESTATE_PHOTO_MIME_TYPES)[number]
        )
      ) {
        return NextResponse.json(
          { message: `${file.name}: formato não permitido.` },
          { status: 400 }
        );
      }

      if (file.size > REAL_ESTATE_PHOTO_MAX_BYTES) {
        return NextResponse.json(
          { message: `${file.name}: o limite é 6 MB por foto.` },
          { status: 400 }
        );
      }
    }

    await ensurePhotosBucket();
    const supabase = createAdminClient();
    const newPhotos: StoredPhoto[] = [];

    for (const file of files) {
      const photoId = randomUUID();
      const extension = extensionByMimeType[file.type];
      const storagePath = `${id}/${photoId}.${extension}`;
      const { error } = await supabase.storage
        .from(REAL_ESTATE_PHOTOS_BUCKET)
        .upload(storagePath, await file.arrayBuffer(), {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        throw new Error(`${file.name}: ${error.message}`);
      }

      uploadedPaths.push(storagePath);
      newPhotos.push({
        id: photoId,
        storagePath,
        externalUrl: null,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        isCover: currentPhotos.length === 0 && newPhotos.length === 0,
        sortOrder: currentPhotos.length + newPhotos.length,
        createdAt: new Date().toISOString(),
      });
    }

    const photos = [...currentPhotos, ...newPhotos];
    await updateAssetPhotos(id, photos);

    await createInternalActionNotification(createAdminClient(), {
      sourceKey: `real-estate-asset:${id}:photos-added:${Date.now()}`,
      category: "real_estate",
      type: "asset_photos_added",
      title: "Fotos adicionadas ao imóvel",
      message: `${asset.code ? `${asset.code} · ` : ""}${asset.title} · ${newPhotos.length} foto(s)`,
      severity: "info",
      entityType: "real_estate_asset",
      entityId: id,
      actionHref: `/imobiliaria/${id}/fotos`,
      metadata: { assetId: id, count: newPhotos.length },
    });

    return NextResponse.json(
      {
        photos: await Promise.all(photos.map(mapPhoto)),
        limit: REAL_ESTATE_PHOTO_LIMIT,
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const supabase = createAdminClient();
      await supabase.storage
        .from(REAL_ESTATE_PHOTOS_BUCKET)
        .remove(uploadedPaths);
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar as fotos.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: PhotosRouteContext) {
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

    const body = (await request.json()) as {
      photoId?: string;
      action?: "cover";
      orderedIds?: string[];
    };
    let photos = normalizeStoredPhotos(asset.photos);

    if (body.action === "cover" && body.photoId) {
      if (!photos.some((photo) => photo.id === body.photoId)) {
        return NextResponse.json(
          { message: "Foto não encontrada." },
          { status: 404 }
        );
      }

      photos = photos.map((photo) => ({
        ...photo,
        isCover: photo.id === body.photoId,
      }));
    } else if (body.orderedIds) {
      const order = new Map(
        body.orderedIds.map((photoId, index) => [photoId, index])
      );
      photos = [...photos].sort(
        (a, b) =>
          (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
    } else {
      return NextResponse.json(
        { message: "Alteração inválida." },
        { status: 400 }
      );
    }

    await updateAssetPhotos(id, photos);

    return NextResponse.json({
      photos: await Promise.all(photos.map(mapPhoto)),
      limit: REAL_ESTATE_PHOTO_LIMIT,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar as fotos.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: PhotosRouteContext) {
  if (!(await requireAuthenticatedUser())) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const photoId = new URL(request.url).searchParams.get("photoId");
    const asset = await getAsset(id);

    if (!asset || !photoId) {
      return NextResponse.json(
        { message: "Foto não encontrada." },
        { status: 404 }
      );
    }

    const currentPhotos = normalizeStoredPhotos(asset.photos);
    const photo = currentPhotos.find((item) => item.id === photoId);

    if (!photo) {
      return NextResponse.json(
        { message: "Foto não encontrada." },
        { status: 404 }
      );
    }

    if (photo.storagePath) {
      const supabase = createAdminClient();
      const { error } = await supabase.storage
        .from(REAL_ESTATE_PHOTOS_BUCKET)
        .remove([photo.storagePath]);

      if (error) {
        throw new Error(error.message);
      }
    }

    let photos = currentPhotos.filter((item) => item.id !== photoId);

    if (photo.isCover && photos.length > 0) {
      photos = photos.map((item, index) => ({
        ...item,
        isCover: index === 0,
      }));
    }

    await updateAssetPhotos(id, photos);

    await createInternalActionNotification(createAdminClient(), {
      sourceKey: `real-estate-asset:${id}:photo-deleted:${Date.now()}`,
      category: "real_estate",
      type: "asset_photo_deleted",
      title: "Foto excluída do imóvel",
      message: `${asset.code ? `${asset.code} · ` : ""}${asset.title}`,
      severity: "warning",
      entityType: "real_estate_asset",
      entityId: id,
      actionHref: `/imobiliaria/${id}/fotos`,
      metadata: { assetId: id, photoId },
    });

    return NextResponse.json({
      photos: await Promise.all(photos.map(mapPhoto)),
      limit: REAL_ESTATE_PHOTO_LIMIT,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir a foto.",
      },
      { status: 500 }
    );
  }
}
