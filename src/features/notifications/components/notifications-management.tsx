"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Mail,
  MailOpen,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import {
  ManagementDataCard,
  ManagementFilters,
  ManagementPage,
  ManagementPageHeader,
  ManagementPagination,
  ManagementState,
  ManagementTableFrame,
  ManagementTableSkeleton,
} from "@/components/management/management-layout";
import {
  SemanticStatusBadge,
  type StatusTone,
} from "@/components/management/semantic-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AppNotification,
  AppNotificationSeverity,
  NotificationsResponse,
} from "@/features/notifications/types";
import type { AuthProfile } from "@/features/auth/types";
import { NotificationActionBadge } from "@/features/notifications/components/notification-action-badge";
import { createClient } from "@/lib/supabase/client";

const pageSize = 8;

type Filters = {
  search: string;
  status: "all" | "unread" | "read";
  severity: "all" | AppNotificationSeverity;
  category: string;
};

const defaultFilters: Filters = {
  search: "",
  status: "all",
  severity: "all",
  category: "all",
};

const severityLabels: Record<AppNotificationSeverity, string> = {
  info: "Informação",
  success: "Sucesso",
  warning: "Atenção",
  danger: "Erro",
};

const severityTones: Record<AppNotificationSeverity, StatusTone> = {
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
};

const categoryLabels: Record<string, string> = {
  billing: "Cobrança",
  real_estate: "Imobiliária",
  contract: "Contrato",
  system: "Sistema",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dispatchNotificationsUpdated() {
  window.dispatchEvent(new Event("fortusys:notifications-updated"));
}

export function NotificationsManagement() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters);

  async function loadNotifications() {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        limit: "200",
        status: filters.status,
        severity: filters.severity,
        category: filters.category,
      });

      if (filters.search.trim()) {
        params.set("search", filters.search.trim());
      }

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | NotificationsResponse
        | { message?: string };

      if (!response.ok || !("notifications" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível carregar notificações."
        );
      }

      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar notificações."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    window.queueMicrotask(() => {
      void loadNotifications();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    async function loadProfile() {
      const response = await fetch("/api/auth/me", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const profile = (await response.json()) as AuthProfile;
      setProfileId(profile.id);
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    if (!profileId) {
      return;
    }

    const handleNotificationsUpdated = () => {
      void loadNotifications();
    };
    const handleWindowFocus = () => {
      void loadNotifications();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    };
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-management")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_notifications",
          filter: `user_id=eq.${profileId}`,
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    window.addEventListener(
      "fortusys:notifications-updated",
      handleNotificationsUpdated
    );
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(
        "fortusys:notifications-updated",
        handleNotificationsUpdated
      );
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const filteredNotifications = useMemo(() => {
    const search = normalizeSearch(filters.search);

    if (!search) {
      return notifications;
    }

    return notifications.filter((notification) =>
      normalizeSearch(
        `${notification.title} ${notification.message} ${notification.originLabel}`
      ).includes(search)
    );
  }, [filters.search, notifications]);
  const safePage = Math.min(
    Math.max(page, 1),
    Math.max(1, Math.ceil(filteredNotifications.length / pageSize))
  );
  const paginatedNotifications = filteredNotifications.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  async function updateNotificationRead(notification: AppNotification, read: boolean) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id, read }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível atualizar.");
      }

      await loadNotifications();
      dispatchNotificationsUpdated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível atualizar."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function markAllAsRead() {
    setIsSaving(true);

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, read: true }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível atualizar.");
      }

      toast.success("Notificações marcadas como lidas");
      await loadNotifications();
      dispatchNotificationsUpdated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível atualizar."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function openNotification(notification: AppNotification) {
    if (!notification.readAt) {
      await updateNotificationRead(notification, true);
    }

    if (notification.actionHref) {
      router.push(notification.actionHref);
    }
  }

  return (
    <ManagementPage className="space-y-3">
      <ManagementPageHeader
        actions={
          <Button
            disabled={isSaving || unreadCount === 0}
            onClick={() => void markAllAsRead()}
            type="button"
          >
            <CheckCheck className="size-4" />
            Marcar todas como lidas
          </Button>
        }
        badge="Central"
        compact
        hideTitle
        icon={Bell}
        title="Notificações"
      />

      <ManagementFilters className="gap-2 p-2.5 pl-4 shadow-sm before:inset-y-2">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_11rem_11rem_11rem_auto] lg:items-end">
          <div className="w-full space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Buscar
            </label>
            <Input
              className="h-8"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Título ou mensagem"
              value={draftFilters.search}
            />
          </div>
          <div className="w-full space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <NativeSelect
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value as Filters["status"],
                }))
              }
              value={draftFilters.status}
            >
              <NativeSelectOption value="all">Todas</NativeSelectOption>
              <NativeSelectOption value="unread">Não lidas</NativeSelectOption>
              <NativeSelectOption value="read">Lidas</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="w-full space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Severidade
            </label>
            <NativeSelect
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  severity: event.target.value as Filters["severity"],
                }))
              }
              value={draftFilters.severity}
            >
              <NativeSelectOption value="all">Todas</NativeSelectOption>
              {Object.entries(severityLabels).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="w-full space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Categoria
            </label>
            <NativeSelect
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              value={draftFilters.category}
            >
              <NativeSelectOption value="all">Todas</NativeSelectOption>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex shrink-0 gap-2 lg:justify-end">
            <Button
              className="h-8 min-w-24"
              onClick={() => {
                setFilters({ ...draftFilters });
                setPage(1);
              }}
              type="button"
            >
              <Search className="size-4" />
              Filtrar
            </Button>
            <Button
              className="h-8 min-w-24"
              onClick={() => {
                setDraftFilters(defaultFilters);
                setFilters(defaultFilters);
                setPage(1);
              }}
              type="button"
              variant="outline"
            >
              <RotateCcw className="size-4" />
              Limpar
            </Button>
          </div>
        </div>
      </ManagementFilters>

      <ManagementDataCard
        className="[&_[data-slot=card-content]]:space-y-3 [&_[data-slot=card-content]]:py-3 [&_[data-slot=card-header]]:py-3"
        count={`${filteredNotifications.length} notificação(ões)`}
        title="Histórico de notificações"
      >
        {isLoading ? (
          <ManagementTableSkeleton columns={8} rows={8} />
        ) : false ? (
          <ManagementState loading>Carregando notificações...</ManagementState>
        ) : filteredNotifications.length === 0 ? (
          <ManagementState>Nenhuma notificação encontrada.</ManagementState>
        ) : (
          <>
            <ManagementTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Notificação</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-36 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedNotifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(notification.createdAt)}
                      </TableCell>
                      <TableCell>
                        <NotificationActionBadge notification={notification} />
                      </TableCell>
                      <TableCell className="max-w-xl">
                        <p className="font-medium">{notification.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="max-w-40 truncate text-sm font-medium">
                            {notification.originLabel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notification.originDescription}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {categoryLabels[notification.category] ??
                          notification.category}
                      </TableCell>
                      <TableCell>
                        <SemanticStatusBadge
                          tone={severityTones[notification.severity]}
                        >
                          {severityLabels[notification.severity]}
                        </SemanticStatusBadge>
                      </TableCell>
                      <TableCell>
                        <SemanticStatusBadge
                          tone={notification.readAt ? "neutral" : "info"}
                        >
                          {notification.readAt ? "Lida" : "Não lida"}
                        </SemanticStatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  disabled={isSaving}
                                  onClick={() =>
                                    void updateNotificationRead(
                                      notification,
                                      Boolean(notification.readAt) ? false : true
                                    )
                                  }
                                  size="icon-sm"
                                  type="button"
                                  variant="outline"
                                />
                              }
                            >
                              {notification.readAt ? (
                                <MailOpen className="size-4" />
                              ) : (
                                <Mail className="size-4" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {notification.readAt
                                ? "Marcar como não lida"
                                : "Marcar como lida"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  disabled={!notification.actionHref}
                                  onClick={() => void openNotification(notification)}
                                  size="icon-sm"
                                  type="button"
                                  variant="outline"
                                />
                              }
                            >
                              <ExternalLink className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent>Abrir destino</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ManagementTableFrame>
            <ManagementPagination
              itemLabel="notificação(ões)"
              onPageChange={setPage}
              page={safePage}
              pageSize={pageSize}
              total={filteredNotifications.length}
              visible={paginatedNotifications.length}
            />
          </>
        )}
      </ManagementDataCard>
    </ManagementPage>
  );
}
