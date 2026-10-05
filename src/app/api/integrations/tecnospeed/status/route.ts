import { NextResponse } from "next/server";

import {
  getTecnospeedConfigStatus,
  saveTecnospeedSettings,
} from "@/features/integrations/tecnospeed/server/config";

export async function GET() {
  return NextResponse.json(await getTecnospeedConfigStatus());
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      environment?: string;
      softwareHouseDocument?: string;
      softwareHouseToken?: string;
    };

    const status = await saveTecnospeedSettings(body);

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a configuração da TecnoSpeed.",
      },
      { status: 400 }
    );
  }
}
