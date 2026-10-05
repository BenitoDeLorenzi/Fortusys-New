"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CheckCheck,
  CircleDollarSign,
  Home,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  UserSearch,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NotificationActionBadge } from "@/features/notifications/components/notification-action-badge";
import type { AuthProfile } from "@/features/auth/types";
import type {
  AppNotification,
  NotificationsResponse,
} from "@/features/notifications/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cobrança", href: "/cobranca", icon: CircleDollarSign },
  { label: "Imobiliária", href: "/imobiliaria", icon: Building2 },
  { label: "Cedentes", href: "/cedentes", icon: BriefcaseBusiness },
  { label: "Clientes", href: "/clientes", icon: UserSearch },
  { label: "Usuários", href: "/usuarios", icon: Users },
  { label: "Notificações", href: "/notificacoes", icon: Bell },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getNotificationTone(severity: AppNotification["severity"]) {
  return {
    info: "bg-blue-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  }[severity];
}

function Brand() {
  return (
    <div className="group flex min-w-0 items-center gap-3">
      <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-blue-600 to-cyan-500 text-primary-foreground shadow-[0_16px_35px_-20px_rgba(37,99,235,0.9)] ring-1 ring-white/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_35%)]" />
        <Home className="relative size-5 transition-transform group-hover:scale-110" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[17px] font-bold tracking-tight">
          Fortusys
        </p>
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Gestão de operações
        </p>
      </div>
    </div>
  );
}

function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1.5">
      {navigation.map((item) => {
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground",
              isActive &&
                "bg-gradient-to-r from-primary/12 via-primary/8 to-transparent text-primary shadow-sm"
            )}
          >
            {isActive ? (
              <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
            ) : null}
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/50 text-muted-foreground group-hover:bg-background group-hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const initials = useMemo(() => {
    const source = profile?.name ?? "Admin";

    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [profile?.name]);

  useEffect(() => {
    async function loadProfile() {
      const response = await fetch("/api/auth/me", { cache: "no-store" });

      if (response.ok) {
        setProfile((await response.json()) as AuthProfile);
        return;
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }

    const handleProfileUpdated = () => {
      void loadProfile();
    };

    loadProfile();
    window.addEventListener("fortusys:profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener(
        "fortusys:profile-updated",
        handleProfileUpdated
      );
    };
  }, [router]);

  async function loadNotifications() {
    const response = await fetch("/api/notifications?status=unread&limit=10", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as NotificationsResponse;
    setNotifications(payload.notifications);
    setUnreadNotifications(payload.unreadCount);
  }

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    window.queueMicrotask(() => {
      void loadNotifications();
    });
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
      .channel("app-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_notifications",
          filter: `user_id=eq.${profile.id}`,
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
  }, [profile?.id]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function markNotificationAsRead(notification: AppNotification) {
    if (!notification.readAt) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id, read: true }),
      });
      await loadNotifications();
      window.dispatchEvent(new Event("fortusys:notifications-updated"));
    }

    if (notification.actionHref) {
      router.push(notification.actionHref);
    }
  }

  async function markAllNotificationsAsRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, read: true }),
    });
    await loadNotifications();
    window.dispatchEvent(new Event("fortusys:notifications-updated"));
  }

  return (
    <div className="min-h-svh bg-gradient-to-br from-muted/55 via-muted/25 to-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border/70 bg-background/92 shadow-[18px_0_55px_-45px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex h-20 items-center px-5">
          <Brand />
        </div>
        <div className="px-5">
          <Separator />
        </div>
        <div className="flex-1 px-3 py-4">
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
            Menu principal
          </p>
          <Navigation />
        </div>
        <div className="border-t border-border/70 p-4">
          <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/8 via-background to-background p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </span>
              Perfil ativo
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {profile?.role?.name
                ? `${profile.role.name} com acesso aos módulos liberados.`
                : "Acesso validado pelo administrador do sistema."}
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/70 bg-background/82 px-4 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl md:px-6">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  className="rounded-xl lg:hidden"
                  size="icon"
                  variant="outline"
                />
              }
            >
              <PanelLeft className="size-4" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(20rem,calc(100vw-2rem))] p-0"
            >
              <SheetHeader className="border-b px-5 py-4 text-left">
                <SheetTitle>
                  <Brand />
                </SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <Navigation />
              </div>
            </SheetContent>
          </Sheet>

          <div className="relative hidden flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 max-w-xl rounded-2xl border-border/70 bg-muted/45 pl-9 shadow-inner shadow-background/30 transition focus-visible:bg-background"
              placeholder="Buscar cobrança, cliente, usuário ou imóvel"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          className="relative rounded-2xl border-border/70 bg-background/80 shadow-sm hover:bg-muted/70"
                          size="icon"
                          variant="outline"
                        />
                      }
                    />
                  }
                >
                  <Bell className="size-4" />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  ) : null}
                </TooltipTrigger>
                <TooltipContent>Notificações</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Notificações</p>
                    <p className="text-xs text-muted-foreground">
                      {unreadNotifications} não lida(s)
                    </p>
                  </div>
                  <Button
                    disabled={unreadNotifications === 0}
                    onClick={() => void markAllNotificationsAsRead()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <CheckCheck className="size-4" />
                    Ler todas
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Nenhuma notificação pendente.
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        className={cn(
                          "flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted",
                          !notification.readAt && "bg-primary/5"
                        )}
                        key={notification.id}
                        onClick={() => void markNotificationAsRead(notification)}
                        type="button"
                      >
                        <span
                          className={cn(
                            "mt-1 size-2.5 shrink-0 rounded-full",
                            getNotificationTone(notification.severity)
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className="line-clamp-1 text-sm font-medium">
                              {notification.title}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatNotificationDate(notification.createdAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {notification.message}
                          </span>
                          <span className="mt-2 flex items-center gap-2">
                            <NotificationActionBadge
                              compact
                              notification={notification}
                            />
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t p-2">
                  <Button
                    className="w-full"
                    onClick={() => router.push("/notificacoes")}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Ver todas
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className="h-10 gap-2 rounded-2xl border-border/70 bg-background/80 px-2 pr-3 shadow-sm transition hover:bg-muted/70"
                    variant="outline"
                  />
                }
              >
                <Avatar className="size-7 ring-2 ring-primary/10">
                  {profile?.avatarUrl ? (
                    <AvatarImage alt={profile.name} src={profile.avatarUrl} />
                  ) : null}
                  <AvatarFallback>{initials || "AD"}</AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 text-left md:block">
                  <span className="block max-w-36 truncate text-sm font-semibold leading-4">
                    {profile?.name ?? "Admin"}
                  </span>
                  <span className="block max-w-36 truncate text-[11px] leading-4 text-muted-foreground">
                    {profile?.role?.name ?? "Perfil ativo"}
                  </span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 overflow-hidden p-0">
                <div className="bg-gradient-to-br from-primary/12 via-card to-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-11 ring-2 ring-primary/15">
                      {profile?.avatarUrl ? (
                        <AvatarImage
                          alt={profile.name}
                          src={profile.avatarUrl}
                        />
                      ) : null}
                      <AvatarFallback className="font-semibold">
                        {initials || "AD"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {profile?.name ?? "Administrador"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {profile?.email ?? "admin@fortusys.com.br"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-background/70 px-2.5 py-1 text-xs font-medium text-primary">
                    <Sparkles className="size-3.5" />
                    {profile?.role?.name ?? "Perfil ativo"}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push("/perfil")}>
                    <UserRound className="size-4" />
                    Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/configuracoes")}
                  >
                    <Settings className="size-4" />
                    Preferências
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                    <LogOut className="size-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-2xl border-border/70 bg-muted/45 pl-9"
              placeholder="Buscar cobrança, cliente ou imóvel"
            />
          </div>
        </div>

        <main className="w-full px-4 py-6 md:px-6 2xl:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
