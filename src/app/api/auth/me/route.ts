import { NextResponse } from "next/server";

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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
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
      { message: "Usuario inativo. Fale com o administrador." },
      { status: 403 }
    );
  }

  if (!appUser.auth_user_id) {
    await admin
      .from("app_users")
      .update({ auth_user_id: user.id })
      .eq("id", appUser.id);
  }

  const { data: role } = appUser.role_id
    ? await admin
        .from("roles")
        .select("id,name,slug")
        .eq("id", appUser.role_id)
        .single()
    : { data: null };

  return NextResponse.json({
    id: appUser.id,
    authUserId: user.id,
    avatarUrl: appUser.avatar_url,
    name: appUser.name,
    email: appUser.email,
    status: appUser.status,
    role,
  } satisfies AuthProfile);
}
