"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Loader2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  RoleOption,
  UserListItem,
  UsersResponse,
  UserStatus,
} from "@/features/users/types";

type UserFormValues = {
  name: string;
  email: string;
  password: string;
  roleId: string;
  status: UserStatus;
};

function StatusBadge({ status }: { status: UserStatus }) {
  return status === "active" ? (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
      Ativo
    </Badge>
  ) : (
    <Badge variant="secondary">Inativo</Badge>
  );
}

function UserStatusLabel({ status }: { status: UserStatus }) {
  return status === "active" ? <>Ativo</> : <>Inativo</>;
}

function RoleLabel({
  roleId,
  roles,
}: {
  roleId: string;
  roles: RoleOption[];
}) {
  return roles.find((role) => role.id === roleId)?.name ?? "Selecione o perfil";
}

export function UsersManagement() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    role: "all",
    status: "all",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const form = useForm<UserFormValues>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleId: "",
      status: "active",
    },
  });

  const filteredUsers = useMemo(() => {
    const normalizedSearch = appliedFilters.search
      .trim()
      .toLocaleLowerCase("pt-BR");

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        user.email.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
      const matchesRole =
        appliedFilters.role === "all" || user.roleId === appliedFilters.role;
      const matchesStatus =
        appliedFilters.status === "all" ||
        user.status === appliedFilters.status;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [appliedFilters, users]);
  const pageSize = 8;
  const visibleUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  async function loadUsers() {
    setIsLoading(true);
    const response = await fetch("/api/users", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Não foi possível carregar usuários.");
    }

    const data = (await response.json()) as UsersResponse;
    setUsers(data.users);
    setRoles(data.roles);
    setIsLoading(false);
  }

  useEffect(() => {
    // Initial client-side fetch for the admin users workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers().catch((error) => {
      setIsLoading(false);
      toast.error(error instanceof Error ? error.message : "Erro inesperado.");
    });
  }, []);

  async function handleSubmit(values: UserFormValues) {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      toast.error(data.message ?? "Não foi possível cadastrar o usuário.");
      return;
    }

    toast.success("Usuário cadastrado", {
      description: "A conta foi criada no Auth e vinculada ao Fortusys.",
    });
    form.reset({
      name: "",
      email: "",
      password: "",
      roleId: "",
      status: "active",
    });
    setIsSheetOpen(false);
    await loadUsers();
  }

  return (
    <ManagementPage className="space-y-3">
      <ManagementPageHeader
        badge="Usuários"
        compact
        hideTitle
        icon={Users}
        title="Controle de usuários"
        actions={
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger render={<Button />}>
            <Plus className="size-4" />
            Novo usuário
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[min(28rem,calc(100vw-1rem))] overflow-y-auto p-0"
          >
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>Novo usuário</SheetTitle>
              <SheetDescription>
                Cadastro realizado pelo administrador do sistema.
              </SheetDescription>
            </SheetHeader>
            <div className="p-5">
              <Form {...form}>
                <form
                  className="space-y-5"
                  onSubmit={form.handleSubmit(handleSubmit)}
                >
                  <FormField
                    control={form.control}
                    name="name"
                    rules={{ required: "Informe o nome do usuário." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    rules={{
                      required: "Informe o e-mail.",
                      pattern: {
                        value: /^\S+@\S+\.\S+$/,
                        message: "Informe um e-mail válido.",
                      },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="usuario@empresa.com.br"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    rules={{
                      required: "Informe uma senha temporária.",
                      minLength: {
                        value: 6,
                        message:
                          "A senha temporária deve ter pelo menos 6 caracteres.",
                      },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha temporária</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="Defina uma senha inicial"
                              className="pl-9"
                              autoComplete="new-password"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          O administrador informa esta senha ao usuário.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roleId"
                    rules={{ required: "Selecione um perfil." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perfil</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o perfil">
                                <RoleLabel
                                  roleId={field.value}
                                  roles={roles}
                                />
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          O perfil define as permissões do usuário.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o status">
                                <UserStatusLabel status={field.value} />
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    className="w-full"
                    disabled={form.formState.isSubmitting}
                    type="submit"
                  >
                    {form.formState.isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Cadastrar acesso
                  </Button>
                </form>
              </Form>
            </div>
          </SheetContent>
        </Sheet>
        }
      />

      <ManagementFilters
        className="gap-2 p-2.5 pl-4 shadow-sm before:inset-y-2"
        actions={
          <>
            <Button
              className="h-8 min-w-24"
              onClick={() =>
                {
                  setAppliedFilters({
                    search,
                    role: roleFilter,
                    status: statusFilter,
                  });
                  setCurrentPage(1);
                }
              }
              type="button"
            >
              <Search className="size-4" />
              Filtrar
            </Button>
            <Button
              className="h-8 min-w-24"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setStatusFilter("all");
                setAppliedFilters({
                  search: "",
                  role: "all",
                  status: "all",
                });
                setCurrentPage(1);
              }}
              type="button"
              variant="outline"
            >
              <RotateCcw className="size-4" />
              Limpar
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="user-search"
            >
              Nome ou e-mail
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                id="user-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar usuário"
                value={search}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Perfil
            </label>
            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value ?? "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {roleFilter === "all"
                    ? "Todos os perfis"
                    : roles.find((role) => role.id === roleFilter)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value ?? "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {statusFilter === "all"
                    ? "Todos os status"
                    : statusFilter === "active"
                      ? "Ativos"
                      : "Inativos"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </ManagementFilters>

      <ManagementDataCard
        className="[&_[data-slot=card-content]]:space-y-3 [&_[data-slot=card-content]]:py-3 [&_[data-slot=card-header]]:py-3"
        count={`${filteredUsers.length} usuário(s)`}
        title="Usuários cadastrados"
      >
          {isLoading ? (
            <ManagementTableSkeleton columns={5} rows={8} />
          ) : false ? (
            <ManagementState loading>Carregando usuários...</ManagementState>
          ) : filteredUsers.length === 0 ? (
            <ManagementState>
              Nenhum usuário encontrado para os filtros informados.
            </ManagementState>
          ) : (
            <>
              <div className="hidden">
                {visibleUsers.map((user) => (
                  <div className="rounded-lg border p-3" key={user.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <StatusBadge status={user.status} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Perfil</span>
                      <span className="font-medium">
                        {user.roleName ?? "Sem perfil"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <ManagementTableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.roleName ?? "Sem perfil"}</TableCell>
                        <TableCell>
                          <StatusBadge status={user.status} />
                        </TableCell>
                        <TableCell>
                          {new Intl.DateTimeFormat("pt-BR").format(
                            new Date(user.createdAt)
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ManagementTableFrame>
              <ManagementPagination
                isLoading={isLoading}
                itemLabel="usuário(s)"
                onPageChange={setCurrentPage}
                page={currentPage}
                pageSize={pageSize}
                total={filteredUsers.length}
                visible={visibleUsers.length}
              />
            </>
          )}
      </ManagementDataCard>
    </ManagementPage>
  );
}
