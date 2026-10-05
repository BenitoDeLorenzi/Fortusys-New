import { NextRequest, NextResponse } from "next/server";

import type { RoleOption, UserListItem, UsersResponse } from "@/features/users/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

type CreateUserPayload = {
  name?: string;
  email?: string;
  password?: string;
  roleId?: string;
  status?: "active" | "inactive";
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  role_id: string | null;
  created_at: string;
};

export async function GET() {
  const supabase = createAdminClient();

  const [usersResult, rolesResult] = await Promise.all([
    supabase
      .from("app_users")
      .select("id,name,email,status,role_id,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("roles").select("id,name,slug").order("name"),
  ]);

  if (usersResult.error) {
    return NextResponse.json(
      { message: usersResult.error.message },
      { status: 500 }
    );
  }

  if (rolesResult.error) {
    return NextResponse.json(
      { message: rolesResult.error.message },
      { status: 500 }
    );
  }

  const roles = (rolesResult.data ?? []) as RoleOption[];
  const rawUsers = (usersResult.data ?? []) as UserRow[];
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const users: UserListItem[] = rawUsers.map((user) => {
    const role = user.role_id ? rolesById.get(user.role_id) : null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roleId: user.role_id,
      roleName: role?.name ?? null,
      createdAt: user.created_at,
    };
  });

  return NextResponse.json({ users, roles } satisfies UsersResponse);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as CreateUserPayload;
  const name = payload.name?.trim();
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();

  if (!name || !email || !password || !payload.roleId) {
    return NextResponse.json(
      { message: "Nome, e-mail, senha temporária e perfil são obrigatórios." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { message: "A senha temporária deve ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const existingUser = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser.error) {
    return NextResponse.json(
      { message: existingUser.error.message },
      { status: 500 }
    );
  }

  if (existingUser.data) {
    return NextResponse.json(
      { message: "Este e-mail ja esta cadastrado no Fortusys." },
      { status: 409 }
    );
  }

  const authUser = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
    },
  });

  if (authUser.error || !authUser.data.user) {
    return NextResponse.json(
      { message: authUser.error?.message ?? "Erro ao criar usuário Auth." },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("app_users")
    .insert({
      auth_user_id: authUser.data.user.id,
      name,
      email,
      role_id: payload.roleId,
      status: payload.status ?? "active",
    })
    .select("id")
    .single();

  if (error) {
    await supabase.auth.admin.deleteUser(authUser.data.user.id);
    const status = error.code === "23505" ? 409 : 500;

    return NextResponse.json({ message: error.message }, { status });
  }

  await createInternalActionNotification(supabase, {
    sourceKey: `app-user:${data.id}:created`,
    category: "system",
    type: "user_created",
    title: "Usuário criado",
    message: `${name} · ${email}`,
    severity: "info",
    entityType: "app_user",
    entityId: data.id,
    actionHref: "/usuarios",
    metadata: { userId: data.id, email },
  });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
