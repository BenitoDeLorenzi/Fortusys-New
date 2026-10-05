import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import { getAppUserForAuthUser } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

type PatchPayload = {
  id?: string;
  all?: boolean;
  read?: boolean;
};

const notificationSeverities = ["info", "success", "warning", "danger"] as const;

type NotificationSeverity = (typeof notificationSeverities)[number];

function mapNotification(row: {
  id: string;
  actor_user_id: string | null;
  category: string;
  notification_type: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "danger";
  entity_type: string | null;
  entity_id: string | null;
  action_href: string | null;
  metadata: unknown;
  read_at: string | null;
  created_at: string;
}, actorNameById: Map<string, string>) {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const provider =
    typeof metadata.provider === "string" ? metadata.provider.toLowerCase() : null;
  const actorName = row.actor_user_id
    ? actorNameById.get(row.actor_user_id) ?? null
    : null;
  const originLabel = actorName
    ? actorName
    : provider === "tecnospeed"
      ? "TecnoSpeed"
      : "Sistema";
  const originDescription = actorName
    ? "Usuário do sistema"
    : provider === "tecnospeed"
      ? "Webhook TecnoSpeed"
      : "Automação interna";

  return {
    id: row.id,
    category: row.category,
    type: row.notification_type,
    title: row.title,
    message: row.message,
    severity: row.severity,
    actorUserId: row.actor_user_id,
    actorName,
    originLabel,
    originDescription,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionHref: row.action_href,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const user = await requireAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUser = await getAppUserForAuthUser(supabase, user);

  if (!appUser) {
    return NextResponse.json(
      { message: "Usuário não encontrado ou inativo." },
      { status: 403 }
    );
  }

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 20), 1),
    200
  );
  const status = request.nextUrl.searchParams.get("status") ?? "all";
  const severityParam = request.nextUrl.searchParams.get("severity") ?? "all";
  const severity = notificationSeverities.includes(
    severityParam as NotificationSeverity
  )
    ? (severityParam as NotificationSeverity)
    : "all";
  const category = request.nextUrl.searchParams.get("category") ?? "all";
  const search = request.nextUrl.searchParams.get("search")?.trim();
  let query = supabase
    .from("app_notifications")
    .select(
      "id,actor_user_id,category,notification_type,title,message,severity,entity_type,entity_id,action_href,metadata,read_at,created_at"
    )
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "read") {
    query = query.not("read_at", "is", null);
  }

  if (status === "unread") {
    query = query.is("read_at", null);
  }

  if (severity !== "all") {
    query = query.eq("severity", severity);
  }

  if (category !== "all") {
    query = query.eq("category", category);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
  }

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    query,
    supabase
      .from("app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", appUser.id)
      .is("read_at", null),
  ]);

  if (error || countError) {
    return NextResponse.json(
      { message: error?.message ?? countError?.message },
      { status: 500 }
    );
  }

  const actorIds = Array.from(
    new Set((data ?? []).map((row) => row.actor_user_id).filter(Boolean))
  ) as string[];
  const actorNameById = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: actors, error: actorsError } = await supabase
      .from("app_users")
      .select("id,name")
      .in("id", actorIds);

    if (actorsError) {
      return NextResponse.json({ message: actorsError.message }, { status: 500 });
    }

    for (const actor of actors ?? []) {
      actorNameById.set(actor.id, actor.name);
    }
  }

  return NextResponse.json({
    notifications: (data ?? []).map((row) => mapNotification(row, actorNameById)),
    unreadCount: count ?? 0,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await requireAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const payload = (await request.json()) as PatchPayload;
  const supabase = createAdminClient();
  const appUser = await getAppUserForAuthUser(supabase, user);

  if (!appUser) {
    return NextResponse.json(
      { message: "Usuário não encontrado ou inativo." },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();

  if (payload.all) {
    const updateQuery = supabase
      .from("app_notifications")
      .update({
        read_at: payload.read === false ? null : now,
        updated_at: now,
      });
    const { error } =
      payload.read === false
        ? await updateQuery.eq("user_id", appUser.id).not("read_at", "is", null)
        : await updateQuery.eq("user_id", appUser.id).is("read_at", null);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (!payload.id) {
    return NextResponse.json(
      { message: "Informe a notificação." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("app_notifications")
    .update({
      read_at: payload.read === false ? null : now,
      updated_at: now,
    })
    .eq("user_id", appUser.id)
    .eq("id", payload.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
