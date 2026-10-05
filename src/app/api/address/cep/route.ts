import { NextRequest, NextResponse } from "next/server";

type ViaCepResponse = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
};

export async function GET(request: NextRequest) {
  const cep = request.nextUrl.searchParams.get("cep")?.replace(/\D/g, "");

  if (!cep || cep.length !== 8) {
    return NextResponse.json(
      { message: "Informe um CEP com 8 dígitos." },
      { status: 400 }
    );
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { message: "Não foi possível consultar o CEP." },
      { status: 502 }
    );
  }

  const data = (await response.json()) as ViaCepResponse;

  if (data.erro) {
    return NextResponse.json(
      { message: "CEP não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    zipCode: data.cep ?? "",
    street: data.logradouro ?? "",
    complement: data.complemento ?? "",
    district: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
    cityIbgeCode: data.ibge ?? "",
  });
}
