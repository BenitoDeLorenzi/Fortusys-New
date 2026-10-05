"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  Landmark,
  Loader2,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BILLING_RESULT_KEY,
  BILLING_REVIEW_DRAFT_KEY,
  type BillingRegistrationResult,
  type BillingReviewDraft,
} from "@/features/billing/billing-draft";
import { formatDocument } from "@/features/billing/utils";

const documentSpeciesLabels: Record<string, string> = {
  "01": "Duplicata mercantil",
  "02": "Nota promissória",
  "03": "Nota de seguro",
  "04": "Duplicata de serviço",
  "05": "Recibo",
  "99": "Outros",
};

const interestLabels: Record<string, string> = {
  "1": "Valor por dia",
  "2": "Taxa mensal",
  "3": "Isento",
};

const fineLabels: Record<string, string> = {
  "0": "Não registrar",
  "1": "Valor fixo",
  "2": "Percentual",
};

const discountLabels: Record<string, string> = {
  "0": "Sem desconto",
  "1": "Valor fixo até a data",
  "2": "Percentual até a data",
  "3": "Valor por antecipação em dias corridos",
  "4": "Valor por antecipação em dias úteis",
  "5": "Percentual por dia corrido",
  "6": "Percentual por dia útil",
};

const protestLabels: Record<string, string> = {
  "1": "Dias corridos",
  "2": "Dias úteis",
  "3": "Não protestar",
  "4": "Fim falimentar em dias úteis",
  "5": "Fim falimentar em dias corridos",
  "8": "Negativação sem protesto",
  "9": "Cancelar protesto automático",
};

const writeOffLabels: Record<string, string> = {
  "1": "Baixar / devolver",
  "2": "Não baixar / não devolver",
  "3": "Cancelar prazo",
};

function formatDate(date: string) {
  if (!date) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatOptional(value: string | null | undefined) {
  return value && value.trim() ? value : "Não informado";
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function BillingReviewManagement() {
  const router = useRouter();
  const [draft, setDraft] = useState<BillingReviewDraft | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    window.queueMicrotask(() => {
      const storedDraft = window.sessionStorage.getItem(BILLING_REVIEW_DRAFT_KEY);

      if (!storedDraft) {
        setIsLoaded(true);
        return;
      }

      try {
        setDraft(JSON.parse(storedDraft) as BillingReviewDraft);
      } catch {
        window.sessionStorage.removeItem(BILLING_REVIEW_DRAFT_KEY);
        toast.error("Não foi possível carregar o resumo da cobrança.");
      } finally {
        setIsLoaded(true);
      }
    });
  }, []);

  const payerLabel = useMemo(() => {
    if (!draft?.payer) {
      return "Pagador não informado";
    }

    return `${draft.payer.name} | ${formatDocument(draft.payer.document)}`;
  }, [draft]);

  async function handleConfirm() {
    if (!draft) {
      return;
    }

    setIsConfirming(true);

    try {
      const response = await fetch("/api/billing/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const data = (await response.json()) as {
        message?: string;
        result?: BillingRegistrationResult;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Não foi possível registrar a cobrança.");
      }

      if (!data.result) {
        throw new Error("A TecnoSpeed não retornou o resultado do lote.");
      }

      window.sessionStorage.setItem(
        BILLING_RESULT_KEY,
        JSON.stringify(data.result)
      );
      window.sessionStorage.removeItem(BILLING_REVIEW_DRAFT_KEY);
      router.push("/cobranca/nova/finalizacao");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a cobrança."
      );
    } finally {
      setIsConfirming(false);
    }
  }

  function handleLeaveReview() {
    window.sessionStorage.removeItem(BILLING_REVIEW_DRAFT_KEY);
    router.push("/cobranca");
  }

  if (!isLoaded) {
    return null;
  }

  if (!draft) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <ReceiptText className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nenhuma cobrança para conferir
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Prepare uma nova cobrança para visualizar o resumo antes da emissão.
          </p>
        </div>
        <Button onClick={handleLeaveReview} type="button">
          Voltar para cobranças
        </Button>
      </div>
    );
  }

  const values = draft.values;

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button
            aria-label="Voltar para editar"
            onClick={() => router.back()}
            size="icon"
            type="button"
            variant="outline"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <Badge className="mb-2 bg-primary/10 text-primary hover:bg-primary/10">
              Conferência
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">
              Resumo da cobrança
            </h1>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => router.back()} type="button" variant="outline">
            Editar
          </Button>
          <Button disabled={isConfirming} onClick={handleConfirm} type="button">
            {isConfirming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileCheck2 className="size-4" />
            )}
            Registrar cobrança
          </Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-primary-foreground/75">
                Valor da cobrança
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                R$ {values.amount || "0,00"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="bg-white/15 text-primary-foreground hover:bg-white/15">
                  {values.isHybrid ? "Híbrido" : "Boleto simples"}
                </Badge>
                <Badge className="bg-white/15 text-primary-foreground hover:bg-white/15">
                  {documentSpeciesLabels[values.documentSpecies] ?? values.documentSpecies}
                </Badge>
              </div>
            </div>
            <div className="grid gap-2 text-sm md:min-w-56">
              <div className="rounded-lg bg-white/10 p-2.5">
                <p className="text-primary-foreground/70">Vencimento</p>
                <p className="mt-1 font-semibold">{formatDate(values.dueDate)}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-2.5">
                <p className="text-primary-foreground/70">Documento</p>
                <p className="mt-1 font-semibold">{values.documentNumber}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              Pronto para conferência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <SummaryItem label="Cedente" value={draft.assignor.name} />
            <SummaryItem label="Pagador" value={payerLabel} />
            <SummaryItem label="Aceite" value={values.accept === "S" ? "Aceito" : "Não aceito"} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-5 text-primary" />
              Dados bancários
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <SummaryItem label="Cedente" value={draft.assignor.name} />
            <SummaryItem label="Documento do cedente" value={formatDocument(draft.assignor.document)} />
            <SummaryItem label="Conta" value={draft.account?.label ?? "Não informada"} />
            <SummaryItem label="Convênio" value={draft.agreement?.label ?? "Não informado"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" />
              Pagador
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <SummaryItem label="Nome" value={draft.payer?.name ?? "Não informado"} />
            <SummaryItem label="CPF/CNPJ" value={draft.payer?.document ? formatDocument(draft.payer.document) : "Não informado"} />
            <SummaryItem label="E-mail" value={formatOptional(draft.payer?.email)} />
            <SummaryItem label="Telefone" value={formatOptional(draft.payer?.phone)} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="size-5 text-primary" />
              Dados da cobrança
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <SummaryItem label="Emissão" value={formatDate(values.issueDate)} />
            <SummaryItem label="Vencimento" value={formatDate(values.dueDate)} />
            <SummaryItem label="Nosso número" value={values.ourNumber} />
            <SummaryItem label="Local de pagamento" value={values.paymentPlace} />
            <SummaryItem label="Parcelamento" value={values.installmentEnabled ? `${values.installmentCount} parcela(s), a cada ${values.installmentInterval} dias` : "Sem parcelamento"} />
            <SummaryItem label="Híbrido" value={values.isHybrid ? "Sim" : "Não"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              Instruções do boleto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryItem label="Juros" value={`${interestLabels[values.interestCode] ?? values.interestCode} | ${values.interestValue || "0,00"} | ${formatDate(values.interestDate)}`} />
              <SummaryItem label="Multa" value={`${fineLabels[values.fineCode] ?? values.fineCode} | ${values.fineValue || "0,00"} | ${formatDate(values.fineDate)}`} />
              <SummaryItem label="Desconto" value={discountLabels[values.discountCode] ?? values.discountCode} />
              <SummaryItem label="Protesto" value={`${protestLabels[values.protestCode] ?? values.protestCode} | ${values.protestDays || "0"} dias`} />
              <SummaryItem label="Baixa/devolução" value={`${writeOffLabels[values.writeOffCode] ?? values.writeOffCode}${values.writeOffDays ? ` | ${values.writeOffDays} dias` : ""}`} />
            </div>
            <Separator />
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryItem label="Mensagem 1" value={formatOptional(values.message1)} />
              <SummaryItem label="Mensagem 2" value={formatOptional(values.message2)} />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
