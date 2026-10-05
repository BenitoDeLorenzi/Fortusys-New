import { NextResponse } from "next/server";

import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";

type EmailRequest = {
  assignorDocument?: string;
  integrationIds?: string[];
  senderName?: string;
  senderEmail?: string;
  subject?: string;
  message?: string;
  recipients?: string[];
  attachTicket?: boolean;
  html?: boolean;
  printType?: string;
};

type TecnospeedEmailPayload = {
  _status?: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: {
    situacao?: string;
    protocolo?: string;
  };
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getTextMessage(value: string, html: boolean) {
  return html ? value : value.replace(/\r?\n/g, "|");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EmailRequest;
    const assignorDocument = onlyDigits(body.assignorDocument);
    const integrationIds = Array.from(
      new Set(
        body.integrationIds
          ?.map((integrationId) => integrationId.trim())
          .filter(Boolean) ?? []
      )
    );
    const recipients = Array.from(
      new Set(
        body.recipients?.map(normalizeEmail).filter(Boolean) ?? []
      )
    );
    const senderName = body.senderName?.trim();
    const senderEmail = normalizeEmail(body.senderEmail ?? "");
    const subject = body.subject?.trim();
    const message = body.message?.trim();
    const html = Boolean(body.html);

    if (!assignorDocument) {
      return NextResponse.json(
        { message: "Informe o CPF/CNPJ do cedente." },
        { status: 400 }
      );
    }

    if (!integrationIds.length) {
      return NextResponse.json(
        { message: "Selecione ao menos um boleto." },
        { status: 400 }
      );
    }

    if (!senderName || !senderEmail || !subject || !message) {
      return NextResponse.json(
        { message: "Preencha remetente, e-mail, assunto e mensagem." },
        { status: 400 }
      );
    }

    if (!recipients.length) {
      return NextResponse.json(
        { message: "Informe ao menos um destinatário." },
        { status: 400 }
      );
    }

    const printType = body.printType || "0";

    if (integrationIds.length > 100 && !["4", "99"].includes(printType)) {
      return NextResponse.json(
        { message: "O envio por e-mail permite até 100 boletos." },
        { status: 400 }
      );
    }

    if (integrationIds.length > 50 && ["4", "99"].includes(printType)) {
      return NextResponse.json(
        { message: "Este tipo de impressão permite até 50 boletos." },
        { status: 400 }
      );
    }

    const response = await tecnospeedRequest<TecnospeedEmailPayload>({
      method: "POST",
      path: "/email/lote",
      body: {
        IdIntegracao: integrationIds,
        EmailNomeRemetente: senderName,
        EmailRemetente: senderEmail,
        EmailAssunto: subject,
        EmailMensagem: getTextMessage(message, html),
        EmailDestinatario: recipients,
        EmailAnexarBoleto: Boolean(body.attachTicket),
        EmailConteudoHtml: html,
        TipoImpressao: printType,
      },
      headers: {
        "cnpj-cedente": assignorDocument,
      },
    });

    if (response._status === "erro" || !response._dados?.protocolo) {
      return NextResponse.json(
        {
          message:
            response._mensagem ??
            "Não foi possível solicitar o envio por e-mail.",
          data: response._dados ?? null,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: response._mensagem ?? "Envio de e-mail em processamento.",
      protocol: response._dados.protocolo,
      status: response._dados.situacao ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao enviar e-mail.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
