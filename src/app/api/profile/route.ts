import { NextRequest, NextResponse } from "next/server";

import type { AuthProfile } from "@/features/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  avatar_url: string | null;
  name: string;
  email: string;
  status: "active" | "inactive";
  role_id: string | null;
};

type UpdateProfilePayload = {
  name?: string;
};

async function getCurrentAppUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return {
      error: NextResponse.json({ message: "Não autenticado." }, { status: 401 }),
      user: null,
      appUser: null,
    };
  }

  const admin = createAdminClient();
  const email = user.email.toLowerCase();
  const { data: appUsers, error } = await admin
    .from("app_users")
    .select("id,auth_user_id,avatar_url,name,email,status,role_id")
    .or(`auth_user_id.eq.${user.id},email.ilike.${email}`)
    .limit(1);

  if (error) {
    return {
      error: NextResponse.json({ message: error.message }, { status: 500 }),
      user: null,
      appUser: null,
    };
  }

  const appUser = (appUsers?.[0] ?? null) as AppUserRow | null;

  if (!appUser) {
    return {
      error: NextResponse.json(
        { message: "Usuário não cadastrado pelo administrador." },
        { status: 403 }
      ),
      user: null,
      appUser: null,
    };
  }

  return { error: null, user, appUser };
}

export async function PATCH(request: NextRequest) {
  const payload = (await request.json()) as UpdateProfilePayload;
  const name = payload.name?.trim();

  if (!name || name.length < 3) {
    return NextResponse.json(
      { message: "Informe um nome com pelo menos 3 caracteres." },
      { status: 400 }
    );
  }

  const { error, user, appUser } = await getCurrentAppUser();

  if (error || !user || !appUser) {
    return error;
  }

  if (appUser.status !== "active") {
    return NextResponse.json(
      { message: "Usuário inativo. Fale com o administrador." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { data: updatedUser, error: updateError } = await admin
    .from("app_users")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", appUser.id)
    .select("id,auth_user_id,avatar_url,name,email,status,role_id")
    .single();

  if (updateError || !updatedUser) {
    return NextResponse.json(
      { message: updateError?.message ?? "Não foi possível atualizar o perfil." },
      { status: 500 }
    );
  }

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { name },
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
