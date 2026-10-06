"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BILLING_RESULT_KEY,
  type BillingRegistrationItem,
  type BillingRegistrationResult,
} from "@/features/billing/billing-draft";
import { formatDocument } from "@/features/billing/utils";

function ResultStatusBadge({ status }: { status?: string | null }) {
  const label = status?.trim() || "Não informado";
  const statusKey = label.toUpperCase();

  if (statusKey === "FALHA" || statusKey === "REJEITADO") {
    return <Badge className="bg-destructive text-destructive-foreground">{label}</Badge>;
  }

  if (statusKey === "EMITIDO" || statusKey === "REGISTRADO" || statusKey === "CRIADO") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{label}</Badge>;
  }

  return <Badge variant="secondary">{label}</Badge>;
}

function ResultTable({
  items,
  type,
}: {
  items: BillingRegistrationItem[];
  type: "success" | "failure";
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2">
          {type === "success" ? (
            <CheckCircle2 className="size-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="size-5 text-destructive" />
          )}
          {type === "success" ? "Boletos criados" : "Falhas encontradas"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Id integração</TableHead>
                <TableHead>N. Doc</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                {type === "failure" ? <TableHead>Falha</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={`${item.documentNumber}-${index}`}>
                  <TableCell>{item.installment}</TableCell>
                  <TableCell>
                    <ResultStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.integrationId || "-"}
                  </TableCell>
                  <TableCell>{item.documentNumber || "-"}</TableCell>
                  <TableCell>{item.payerName || "-"}</TableCell>
                  <TableCell>
                    {item.payerDocument
                      ? formatDocument(item.payerDocument)
                      : "-"}
                  </TableCell>
                  <TableCell>{item.dueDate || "-"}</TableCell>
                  <TableCell>R$ {item.amount || "0,00"}</TableCell>
                  {type === "failure" ? (
                    <TableCell className="max-w-md whitespace-normal text-destructive">
                      {item.message || "Falha não informada pela TecnoSpeed."}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function BillingFinalizationManagement() {
  const router = useRouter();
  const [result, setResult] = useState<BillingRegistrationResult | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasFailures = Boolean(result?.failures.length);
  const successIds = useMemo(
    () =>
      result?.successes
        .map((item) => item.integrationId)
        .filter(Boolean)
        .join(",") ?? "",
    [result?.successes]
  );

  useEffect(() => {
    window.queueMicrotask(() => {
      const storedResult = window.sessionStorage.getItem(BILLING_RESULT_KEY);

      if (storedResult) {
        setResult(JSON.parse(storedResult) as BillingRegistrationResult);
      }

      setIsLoaded(true);
    });
  }, []);

  function handlePrint() {
    toast.info("Vamos ligar a rotina de impressão da TecnoSpeed na próxima etapa.");
  }

  function handleWhatsApp() {
    if (!result?.payerPhone) {
      toast.error("O pagador não possui telefone para WhatsApp.");
      return;
    }

    const phone = result.payerPhone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá! Seus boletos foram gerados no Fortusys. IDs: ${successIds}`
    );
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  }

  function handleFinish() {
    window.sessionStorage.removeItem(BILLING_RESULT_KEY);
    router.push("/cobranca?tab=boletos");
  }

  if (!isLoaded) {
    return null;
  }

  if (!result) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nenhuma finalização encontrada
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Registre uma cobrança para visualizar o resultado da transação.
          </p>
        </div>
        <Button onClick={() => router.push("/cobranca")} type="button">
          Voltar para cobranças
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge
            className={
              hasFailures
                ? "mb-2 bg-destructive/10 text-destructive hover:bg-destructive/10"
                : "mb-2 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/10"
            }
          >
            Finalização
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            {hasFailures
              ? "Cobrança finalizada com falhas"
              : "Cobrança finalizada com sucesso"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.successes.length} boleto(s) criado(s),{" "}
            {result.failures.length} falha(s).
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {!hasFailures && result.successes.length > 0 ? (
            <>
              <Button onClick={handlePrint} type="button" variant="outline">
                <Printer className="size-4" />
                Imprimir
              </Button>
              <Button onClick={handleWhatsApp} type="button" variant="outline">
                <Send className="size-4" />
                Enviar WhatsApp
              </Button>
            </>
          ) : null}
          <Button onClick={handleFinish} type="button">
            Concluir
          </Button>
        </div>
      </section>

      <ResultTable items={result.failures} type="failure" />
      <ResultTable items={result.successes} type="success" />
    </div>
  );
}
