"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Building2, Eye, Loader2, LockKeyhole, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type LoginFormValues = {
  email: string;
  password: string;
};

export function LoginForm() {
  const router = useRouter();
  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function handleSubmit(values: LoginFormValues) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error("Não foi possível entrar", {
        description: "Confira o e-mail e a senha informados.",
      });
      return;
    }

    const profileResponse = await fetch("/api/auth/me", {
      cache: "no-store",
    });

    if (!profileResponse.ok) {
      const data = (await profileResponse.json()) as { message?: string };
      await supabase.auth.signOut();
      toast.error("Acesso bloqueado", {
        description:
          data.message ?? "Seu usuário não está habilitado no Fortusys.",
      });
      return;
    }

    toast.success("Acesso liberado", {
      description: "Bem-vindo ao painel Fortusys.",
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-svh bg-[radial-gradient(circle_at_top_left,_oklch(0.93_0.08_247),_transparent_34%),linear-gradient(135deg,_oklch(0.99_0.01_255),_oklch(0.94_0.03_240))] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex flex-col justify-between px-4 py-6 sm:px-10 sm:py-8 lg:min-h-svh lg:px-14">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Building2 className="size-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Fortusys</p>
            <p className="text-sm text-muted-foreground">
              Cobranças e imobiliária
            </p>
          </div>
        </div>

        <div className="max-w-2xl py-10 sm:py-14 lg:py-16">
          <p className="mb-4 inline-flex rounded-md border bg-background/70 px-3 py-1 text-sm font-medium text-primary shadow-sm backdrop-blur">
            Gestão segura para cobranças e imobiliária
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
            Controle cobranças, imobiliária e acessos em um painel único.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Acompanhe vencimentos, inadimplência, rotinas imobiliárias e
            permissões da equipe com uma interface objetiva e moderna.
          </p>
        </div>

        <div className="hidden max-w-2xl gap-3 text-sm text-muted-foreground sm:grid sm:grid-cols-3">
          <div className="rounded-lg border bg-background/65 p-3 backdrop-blur">
            <strong className="block text-foreground">Sem cadastro aberto</strong>
            Convites e perfis ficam sob controle administrativo.
          </div>
          <div className="rounded-lg border bg-background/65 p-3 backdrop-blur">
            <strong className="block text-foreground">Acesso por perfil</strong>
            Regras para financeiro, imobiliária e administradores.
          </div>
          <div className="rounded-lg border bg-background/65 p-3 backdrop-blur">
            <strong className="block text-foreground">Operação clara</strong>
            Indicadores pensados para rotina de cobrança.
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 pb-8 sm:px-6 lg:px-10 lg:py-10">
        <Card className="w-full max-w-md border-border/80 bg-background/92 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl">Entrar no Fortusys</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit(handleSubmit)}
              >
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
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="usuario@fortusys.com.br"
                            className="pl-9"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  rules={{
                    required: "Informe a senha.",
                    minLength: {
                      value: 6,
                      message: "A senha deve ter pelo menos 6 caracteres.",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Sua senha"
                            className="pl-9 pr-9"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <Eye className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  className="h-10 w-full"
                  disabled={form.formState.isSubmitting}
                  type="submit"
                >
                  {form.formState.isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Acessar painel
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
