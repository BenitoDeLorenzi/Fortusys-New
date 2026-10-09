import type { Json } from "@/features/database/types";
import { tecnospeedRequest } from "@/features/integrations/tecnospeed/server/client";

type LandlordAsset = {
  landlord_name: string | null;
  landlord_document: string | null;
  metadata?: Json;
};

type Assignor = {
  cpf_cnpj?: string;
  razaosocial?: string;
  nomefantasia?: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
};

// Resolve current registration data without rewriting historical documents.
export async function withCurrentLandlord<T extends LandlordAsset>(asset: T): Promise<T> {
  const metadata = asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)
    ? asset.metadata : {};
  const document = (asset.landlord_document || String(metadata.landlordDocument ?? "")).replace(/\D/g, "");
  if (!document) return asset;

  const response = await tecnospeedRequest<{
    _status: string;
    _dados?: Assignor | Assignor[];
  }>({ path: `/cedentes?cpf_cnpj=${document}` });
  if (response._status !== "sucesso") {
    throw new Error("Não foi possível consultar os dados atuais do cedente. Tente novamente.");
  }
  const assignors = Array.isArray(response._dados) ? response._dados : [response._dados];
  const assignor = assignors.find((item) => item?.cpf_cnpj?.replace(/\D/g, "") === document);
  if (!assignor) {
    throw new Error("Cedente do imóvel não encontrado. Confira o vínculo do proprietário no cadastro do imóvel.");
  }
  return {
    ...asset,
    landlord_name: assignor.razaosocial?.trim() || null,
    landlord_document: document,
    metadata: {
      ...metadata,
      landlordName: assignor.razaosocial ?? null,
      landlordDocument: document,
      landlordTradeName: assignor.nomefantasia ?? null,
      landlordEmail: assignor.email ?? null,
      landlordPhone: assignor.telefone ?? null,
      landlordStreet: assignor.logradouro ?? null,
      landlordNumber: assignor.numero ?? null,
      landlordComplement: assignor.complemento ?? null,
      landlordDistrict: assignor.bairro ?? null,
      landlordZipCode: assignor.cep ?? null,
      landlordCity: assignor.cidade ?? null,
      landlordState: assignor.uf ?? null,
    },
  };
}
