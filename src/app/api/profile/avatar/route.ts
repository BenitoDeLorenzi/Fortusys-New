import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import type { AuthProfile } from "@/features/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PROFILE_AVATARS_BUCKET = "profile-avatars";
const maxAvatarSizeBytes = 2 * 1024 * 1024;
const allowedAvatarMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  avatar_url: string | null;
  name: string;
  email: string;
  status: "active" | "inactive";
  role_id: string | null;
};

function getFileExtension(file: File) {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensionByType[file.type] ?? "jpg";
}

function getStoragePathFromPublicUrl(publicUrl: string | null) {
  if (!publicUrl) {
    return null;
  }

  const marker = `/storage/v1/object/public/${PROFILE_AVATARS_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  return decodeURIComponent(publicUrl.slice(markerIndex + marker.length));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Selecione uma imagem para o avatar." },
      { status: 400 }
    );
  }

  if (!allowedAvatarMimeTypes.has(file.type)) {
    return NextResponse.json(
      { message: "Envie uma imagem JPG, PNG ou WebP." },
      { status: 400 }
    );
  }

  if (file.size > maxAvatarSizeBytes) {
    return NextResponse.json(
      { message: "O avatar deve ter no máximo 2 MB." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const email = user.email.toLowerCase();
  const { data: appUsers, error } = await admin
    .from("app_users")
    .select("id,auth_user_id,avatar_url,name,email,status,role_id")
    .or(`auth_user_id.eq.${user.id},email.ilike.${email}`)
    .limit(1);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const appUser = (appUsers?.[0] ?? null) as AppUserRow | null;

  if (!appUser) {
    return NextResponse.json(
      { message: "Usuário não cadastrado pelo administrador." },
      { status: 403 }
    );
  }

  if (appUser.status !== "active") {
    return NextResponse.json(
      { message: "Usuário inativo. Fale com o administrador." },
      { status: 403 }
    );
  }

  const extension = getFileExtension(file);
  const storagePath = `${appUser.id}/${randomUUID()}.${extension}`;
  const uploadResult = await admin.storage
    .from(PROFILE_AVATARS_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return NextResponse.json(
      { message: uploadResult.error.message },
      { status: 500 }
    );
  }

  const publicUrl = admin.storage
    .from(PROFILE_AVATARS_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl;

  const { data: updatedUser, error: updateError } = await admin
    .from("app_users")
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appUser.id)
    .select("id,auth_user_id,avatar_url,name,email,status,role_id")
    .single();

  if (updateError || !updatedUser) {
    await admin.storage.from(PROFILE_AVATARS_BUCKET).remove([storagePath]);

    return NextResponse.json(
      { message: updateError?.message ?? "Não foi possível salvar o avatar." },
      { status: 500 }
    );
  }

  const previousStoragePath = getStoragePathFromPublicUrl(appUser.avatar_url);

  if (previousStoragePath && previousStoragePath !== storagePath) {
    await admin.storage
      .from(PROFILE_AVATARS_BUCKET)
      .remove([previousStoragePath]);
  }

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { name: updatedUser.name, avatar_url: publicUrl },
  });

  const { data: role } = updatedUser.role_id
    ? await admin
        .from("roles")
        .select("id,name,slug")
        .eq("id", updatedUser.role_id)
        .single()
    : { data: null };

  return NextResponse.json({
    id: updatedUser.id,
    authUserId: user.id,
    avatarUrl: updatedUser.avatar_url,
    name: updatedUser.name,
    email: updatedUser.email,
    status: updatedUser.status,
    role,
  } satisfies AuthProfile);
}
