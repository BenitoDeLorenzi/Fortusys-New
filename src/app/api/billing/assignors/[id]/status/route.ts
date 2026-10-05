import { NextRequest, NextResponse } from "next/server";

import {
  TecnospeedRequestError,
  tecnospeedRequest,
} from "@/features/integrations/tecnospeed/server/client";

type UpdateAssignorStatusPayload = {
  active?: boolean;
  document?: string;
  reason?: string;
};

type TecnospeedStatusResponse = {
  _status: "sucesso" | "erro";
  _mensagem?: string;
  _dados?: string | Array<{ _erro?: string }>;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeErrorMessage(response: TecnospeedStatusResponse) {
  if (Array.isArray(response._dados)) {
    const errors = response._dados
      .map((item) => item._erro)
      .filter(Boolean);

    if (errors.length > 0) {
      return errors.join(" ");
    }
  }

  return response._mensagem ?? "Erro ao alterar situação do cedente.";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const payload = (await request.json()) as UpdateAssignorStatusPayload;
  const document = onlyDigits(payload.document ?? "");

  if (!id || Number.isNaN(Number(id))) {
    return NextResponse.json(
      { message: "Cedente inválido." },
      { status: 400 }
    );
  }

  if (typeof payload.active !== "boolean") {
    return NextResponse.json(
      { message: "Informe a situação do cedente." },
      { status: 400 }
    );
  }

  if (!document) {
    return NextResponse.json(
      { message: "Informe o CPF/CNPJ do cedente." },
      { status: 400 }
    );
  }

  const body = payload.active
    ? { ativo: true }
    : {
        ativo: false,
        motivoInativacao:
          payload.reason?.trim() || "Situação alterada pelo Fortusys.",
      };

  try {
    const response = await tecnospeedRequest<TecnospeedStatusResponse>({
      method: "PUT",
      path: `/cedentes/${id}`,
      headers: {
        "cnpj-cedente": document,
      },
      body,
    });

    if (response._status === "erro") {
      return NextResponse.json(
        { message: normalizeErrorMessage(response) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: payload.active ? "ATIVO" : "INATIVO",
      message:
        typeof response._dados === "string"
          ? response._dados
          : "Situação do cedente alterada.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao alterar situação do cedente.",
      },
      { status: error instanceof TecnospeedRequestError ? error.status : 500 }
    );
  }
}
