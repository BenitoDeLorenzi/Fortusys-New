"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  ManagementDataCard,
  ManagementPage,
  ManagementPageHeader,
  ManagementState,
} from "@/components/management/management-layout";
import { SemanticStatusBadge } from "@/components/management/semantic-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { AuthProfile } from "@/features/auth/types";

const homeRouteStorageKey = "fortusys:preferred-home-route";

const preferredHomeOptions = [
  { value: "/dashboard", label: "Dashboard" },
  { value: "/imobiliaria", label: "Imobiliária" },
  { value: "/cobranca", label: "Cobrança" },
  { value: "/notificacoes", label: "Notificações" },
];

function getInitials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "US"
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function ProfileSectionHint({
  icon: Icon,
  title,
  description,
  tone = "primary",
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  tone?: "primary" | "success" | "neutral";
}) {
  const toneClasses = {
    primary: "border-primary/15 bg-primary/8 text-primary",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    neutral: "border-border bg-muted/25 text-muted-foreground",
  } as const;

  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-gradient-to-br from-background to-muted/25 p-3.5">
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${toneClasses[tone]}`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function ProfileManagement() {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preferredHome, setPreferredHome] = useState(() => {
    if (typeof window === "undefined") {
      return "/dashboard";
    }

    const savedHome = window.localStorage.getItem(homeRouteStorageKey);

    return savedHome &&
      preferredHomeOptions.some((option) => option.value === savedHome)
      ? savedHome
      : "/dashboard";
  });

  const initials = useMemo(() => getInitials(profile?.name), [profile?.name]);
  const selectedHomeLabel =
    preferredHomeOptions.find((option) => option.value === preferredHome)
      ?.label ?? "Dashboard";

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const payload = (await response.json()) as
          | AuthProfile
          | { message?: string };

        if (!response.ok || !("id" in payload)) {
          throw new Error(
            "message" in payload
              ? payload.message
              : "Não foi possível carregar seu perfil."
          );
        }

        setProfile(payload);
        setName(payload.name);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar seu perfil."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, []);

  async function handleSaveProfile() {
    const nextName = name.trim();

    if (nextName.length < 3) {
      toast.error("Informe um nome com pelo menos 3 caracteres.");
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const payload = (await response.json()) as
        | AuthProfile
        | { message?: string };

      if (!response.ok || !("id" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível atualizar seu perfil."
        );
      }

      setProfile(payload);
      setName(payload.name);
      window.dispatchEvent(new Event("fortusys:profile-updated"));
      toast.success("Perfil atualizado");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar seu perfil."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleAvatarChange(file: File | null) {
    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Envie uma imagem JPG, PNG ou WebP.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("O avatar deve ter no máximo 2 MB.");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as
        | AuthProfile
        | { message?: string };

      if (!response.ok || !("id" in payload)) {
        throw new Error(
          "message" in payload
            ? payload.message
            : "Não foi possível atualizar o avatar."
        );
      }

      setProfile(payload);
      window.dispatchEvent(new Event("fortusys:profile-updated"));
      toast.success("Avatar atualizado");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o avatar."
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos de senha.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da senha não confere.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Não foi possível alterar a senha.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha atualizada com sucesso");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a senha."
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  function handleSavePreferences() {
    window.localStorage.setItem(homeRouteStorageKey, preferredHome);
    toast.success("Preferências salvas neste navegador");
  }

  return (
    <ManagementPage className="space-y-3">
      <ManagementPageHeader
        badge="Meu perfil"
        compact
        hideTitle
        icon={UserRound}
        title="Meu perfil"
      />

      {isLoading ? (
        <ManagementDataCard count="Carregando" title="Dados da conta">
          <ManagementState loading>Carregando perfil...</ManagementState>
        </ManagementDataCard>
      ) : !profile ? (
        <ManagementState>
          Não foi possível carregar os dados do perfil.
        </ManagementState>
      ) : (
        <div className="space-y-3">
          <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/[0.14] via-card to-card p-1 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.65)]">
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 left-20 size-64 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative rounded-[1.35rem] bg-background/72 p-5 backdrop-blur-xl md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="group relative w-fit">
                  <Avatar className="size-20 border-4 border-background shadow-xl ring-1 ring-primary/15">
                    {profile.avatarUrl ? (
                      <AvatarImage alt={profile.name} src={profile.avatarUrl} />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-xl font-bold text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    className="absolute -bottom-1 -right-1 flex size-8 cursor-pointer items-center justify-center rounded-full border bg-background text-primary shadow-md transition hover:bg-primary hover:text-primary-foreground"
                    title="Alterar avatar"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={isUploadingAvatar}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleAvatarChange(file);
                        event.target.value = "";
                      }}
                      type="file"
                    />
                  </label>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <SemanticStatusBadge
                        tone={
                          profile.status === "active" ? "success" : "neutral"
                        }
                      >
                        {profile.status === "active" ? "Ativo" : "Inativo"}
                      </SemanticStatusBadge>
                      <span className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-background/80 px-2.5 text-xs font-medium text-muted-foreground">
                        <Sparkles className="size-3.5 text-primary" />
                        Perfil Fortusys
                      </span>
                    </div>
                    <h2 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                      {profile.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profile.email}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[30rem]">
                  <ProfileField
                    label="Perfil"
                    value={profile.role?.name ?? "Sem perfil"}
                  />
                  <ProfileField label="Página inicial" value={selectedHomeLabel} />
                  <ProfileField
                    label="Status"
                    value={profile.status === "active" ? "Ativo" : "Inativo"}
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.42fr)]">
            <ManagementDataCard
              className="[&_[data-slot=card-content]]:space-y-5 [&_[data-slot=card-content]]:py-5 [&_[data-slot=card-header]]:py-3"
              count="Editável"
              title="Dados pessoais"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nome exibido no sistema
                  </label>
                  <Input
                    className="h-11"
                    disabled={isSavingProfile}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Seu nome"
                    value={name}
                  />
                </div>
                <ProfileField label="E-mail de acesso" value={profile.email} />
                <ProfileField
                  label="Perfil de acesso"
                  value={profile.role?.name ?? "Sem perfil vinculado"}
                />
                <ProfileField
                  label="Identificador interno"
                  value={profile.id}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Atualizar dados pessoais</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O nome atualizado aparece no menu superior e nos registros do sistema.
                  </p>
                </div>
                <Button
                  className="sm:min-w-36"
                  disabled={isSavingProfile || name.trim() === profile.name}
                  onClick={() => void handleSaveProfile()}
                  type="button"
                >
                  {isSavingProfile ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </ManagementDataCard>

            <ManagementDataCard
              className="[&_[data-slot=card-content]]:space-y-3 [&_[data-slot=card-content]]:py-5 [&_[data-slot=card-header]]:py-3"
              count="Conta"
              title="Acesso"
            >
              <ProfileSectionHint
                description="Alterações de perfil, status e permissões continuam na gestão de usuários."
                icon={ShieldCheck}
                title="Permissão gerenciada"
              />
              <ProfileSectionHint
                description="Sua sessão está autenticada e vinculada ao usuário atual."
                icon={BadgeCheck}
                title="Sessão segura"
                tone="success"
              />
            </ManagementDataCard>
          </div>

          <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
            <ManagementDataCard
              className="h-full [&_[data-slot=card-content]]:space-y-4 [&_[data-slot=card-content]]:py-5 [&_[data-slot=card-header]]:py-3"
              count="Protegido"
              title="Segurança"
            >
              <ProfileSectionHint
                description="Use uma senha forte com pelo menos 8 caracteres. A senha atual é validada antes da alteração."
                icon={KeyRound}
                title="Alteração de senha"
                tone="neutral"
              />
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  autoComplete="current-password"
                  className="h-11"
                  disabled={isChangingPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Senha atual"
                  type="password"
                  value={currentPassword}
                />
                <Input
                  autoComplete="new-password"
                  className="h-11"
                  disabled={isChangingPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Nova senha"
                  type="password"
                  value={newPassword}
                />
                <Input
                  autoComplete="new-password"
                  className="h-11"
                  disabled={isChangingPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirmar nova senha"
                  type="password"
                  value={confirmPassword}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  disabled={isChangingPassword}
                  onClick={() => void handleChangePassword()}
                  type="button"
                  variant="outline"
                >
                  {isChangingPassword ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  Alterar senha
                </Button>
              </div>
            </ManagementDataCard>

            <ManagementDataCard
              className="h-full [&_[data-slot=card-content]]:space-y-4 [&_[data-slot=card-content]]:py-5 [&_[data-slot=card-header]]:py-3"
              count="Local"
              title="Preferências"
            >
              <ProfileSectionHint
                description="Defina a tela que faz mais sentido para o seu fluxo diário."
                icon={LayoutDashboard}
                title="Página inicial"
                tone="primary"
              />
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Página inicial preferida
                </label>
                <NativeSelect
                  className="h-11"
                  onChange={(event) => setPreferredHome(event.target.value)}
                  value={preferredHome}
                >
                  {preferredHomeOptions.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Preferência salva localmente neste navegador.
              </div>
              <Button
                onClick={handleSavePreferences}
                type="button"
                variant="outline"
              >
                <Save className="size-4" />
                Salvar preferências
              </Button>
            </ManagementDataCard>
          </div>
        </div>
      )}
    </ManagementPage>
  );
}
