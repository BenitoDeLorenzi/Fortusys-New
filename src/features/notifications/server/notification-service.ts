import type { SupabaseClient, User } from "@supabase/supabase-js";

import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import type { Database, Json } from "@/features/database/types";

export type NotificationSeverity = "info" | "success" | "warning" | "danger";

type AppUser = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  status: "active" | "inactive";
};

type CreateEventNotificationInput = {
  sourceKey?: string | null;
  actorUserId?: string | null;
  category?: string;
  type: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  entityType?: string | null;
  entityId?: string | null;
  actionHref?: string | null;
  metadata?: Json;
  recipientUserIds?: string[];
  notifyActiveUsers?: boolean;
  markActorAsRead?: boolean;
};

type InternalActionNotificationInput = Omit<
  CreateEventNotificationInput,
  "actorUserId" | "notifyActiveUsers"
>;

export async function getAppUserForAuthUser(
  supabase: SupabaseClient<Database>,
  authUser: User
) {
  const email = authUser.email?.toLowerCase();

  if (!email) {
    return null;
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id,auth_user_id,name,email,status")
    .or(`auth_user_id.eq.${authUser.id},email.ilike.${email}`)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const appUser = (data?.[0] ?? null) as AppUser | null;

  if (!appUser || appUser.status !== "active") {
    return null;
  }

  if (!appUser.auth_user_id) {
    await supabase
      .from("app_users")
      .update({ auth_user_id: authUser.id, updated_at: new Date().toISOString() })
      .eq("id", appUser.id);
  }

  return appUser;
}

async function listActiveUserIds(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("app_users")
    .select("id")
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((user) => user.id);
}

export async function createEventNotification(
  supabase: SupabaseClient<Database>,
  input: CreateEventNotificationInput
) {
  const now = new Date().toISOString();
  const severity = input.severity ?? "info";
  const category = input.category ?? "system";
  const metadata = input.metadata ?? {};
  const eventPayload = {
    source_key: input.sourceKey ?? null,
    actor_user_id: input.actorUserId ?? null,
    category,
    event_type: input.type,
    title: input.title,
    message: input.message,
    severity,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    action_href: input.actionHref ?? null,
    metadata,
  };

  let event:
    | Database["public"]["Tables"]["app_events"]["Row"]
    | { id: string }
    | null = null;

  if (input.sourceKey) {
    const { data: existingEvent, error: existingEventError } = await supabase
      .from("app_events")
      .select("id")
      .eq("source_key", input.sourceKey)
      .maybeSingle();

    if (existingEventError) {
      throw new Error(existingEventError.message);
    }

    if (existingEvent) {
      const { data: updatedEvent, error: updateEventError } = await supabase
        .from("app_events")
        .update(eventPayload)
        .eq("id", existingEvent.id)
        .select("id")
        .single();

      if (updateEventError) {
        throw new Error(updateEventError.message);
      }

      event = updatedEvent;
    }
  }

  if (!event) {
    const { data: insertedEvent, error: insertEventError } = await supabase
      .from("app_events")
      .insert(eventPayload)
      .select("id")
      .single();

    if (insertEventError) {
      throw new Error(insertEventError.message);
    }

    event = insertedEvent;
  }

  const recipientUserIds = input.notifyActiveUsers
    ? await listActiveUserIds(supabase)
    : input.recipientUserIds ?? [];

  if (recipientUserIds.length === 0) {
    return { eventId: event.id, notificationsCreated: 0 };
  }

  const notificationRows = recipientUserIds.map((userId) => {
    const isActor = Boolean(input.actorUserId && input.actorUserId === userId);
    const shouldMarkRead = isActor && input.markActorAsRead !== false;

    return {
      event_id: event.id,
      user_id: userId,
      actor_user_id: input.actorUserId ?? null,
      source_key: input.sourceKey ?? null,
      category,
      notification_type: input.type,
      title: input.title,
      message: input.message,
      severity,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      action_href: input.actionHref ?? null,
      metadata,
      read_at: shouldMarkRead ? now : null,
      is_silent: shouldMarkRead,
      updated_at: now,
    };
  });

  if (input.sourceKey) {
    for (const row of notificationRows) {
      const { data: existingNotification, error: existingNotificationError } =
        await supabase
          .from("app_notifications")
          .select("id")
          .eq("user_id", row.user_id)
          .eq("source_key", input.sourceKey)
          .maybeSingle();

      if (existingNotificationError) {
        throw new Error(existingNotificationError.message);
      }

      if (existingNotification) {
        const existingNotificationUpdate: Partial<typeof row> = { ...row };
        delete existingNotificationUpdate.read_at;
        delete existingNotificationUpdate.is_silent;
        const { error: updateNotificationError } = await supabase
          .from("app_notifications")
          .update(existingNotificationUpdate)
          .eq("id", existingNotification.id);

        if (updateNotificationError) {
          throw new Error(updateNotificationError.message);
        }

        continue;
      }

      const { error: insertNotificationError } = await supabase
        .from("app_notifications")
        .insert(row);

      if (insertNotificationError) {
        throw new Error(insertNotificationError.message);
      }
    }
  } else {
    const { error: notificationsError } = await supabase
      .from("app_notifications")
      .insert(notificationRows);

    if (notificationsError) {
      throw new Error(notificationsError.message);
    }
  }

  return {
    eventId: event.id,
    notificationsCreated: notificationRows.length,
  };
}

export async function createInternalActionNotification(
  supabase: SupabaseClient<Database>,
  input: InternalActionNotificationInput
) {
  try {
    const authUser = await requireAuthenticatedUser();
    const appUser = authUser
      ? await getAppUserForAuthUser(supabase, authUser)
      : null;

    await createEventNotification(supabase, {
      ...input,
      actorUserId: appUser?.id ?? null,
      notifyActiveUsers: true,
    });
  } catch {
    // Notificações internas são auxiliares e não devem bloquear a ação principal.
  }
}
