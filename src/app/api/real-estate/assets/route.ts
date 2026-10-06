import { NextRequest, NextResponse } from "next/server";

import type {
  RealEstateAsset,
  RealEstateAssetsResponse,
} from "@/features/real-estate/types";
import { requireAuthenticatedUser } from "@/features/auth/server/require-user";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { REAL_ESTATE_DOCUMENTS_BUCKET } from "@/features/real-estate/documents";
import { REAL_ESTATE_PHOTOS_BUCKET } from "@/features/real-estate/photos";
import { createAdminClient } from "@/lib/supabase/admin";

type RealEstateAssetRow = {
  id: string;
  firestore_id: string | null;
  code: number | null;
  title: string;
  property_name: string | null;
  type: string;
  status: string;
  motive: string | null;
  address: string | null;
  notes: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  garage: string | null;
  area: string | null;
  rent_amount: string | null;
  condominium_amount: string | null;
  iptu_amount: string | null;
  payer_iptu: string | null;
  payer_condominium: string | null;
  energy_contract: string | null;
  energy_meter: string | null;
  water_contract: string | null;
  water_meter: string | null;
  registration_number: string | null;
  municipal_registration: string | null;
  photos: unknown;
  metadata: unknown;
  landlord_firestore_id: string | null;
  landlord_name: string | null;
  landlord_document: string | null;
  created_at: string;
};

function onlyDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStoragePaths(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) =>
    item &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    "storagePath" in item &&
    typeof item.storagePath === "string"
      ? [item.storagePath]
      : []
  );
}

function mapAsset(row: RealEstateAssetRow): RealEstateAsset {
  return {
    id: row.id,
    firestoreId: row.firestore_id,
    code: row.code,
    title: row.title,
    propertyName: row.property_name,
    type: row.type,
    status: row.status,
    motive: row.motive ?? getMetadataString(row.metadata, "motivo"),
    address: row.address,
    notes: row.notes,
    zipCode: row.zip_code,
    street: row.street,
    number: row.number,
    district: row.district,
    city: row.city,
    state: row.state,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    garage: row.garage,
    area: row.area,
    rentAmount: row.rent_amount,
    condominiumAmount: row.condominium_amount,
    iptuAmount: row.iptu_amount,
    payerIptu: row.payer_iptu,
    payerCondominium: row.payer_condominium,
    energyContract: row.energy_contract,
    energyMeter: row.energy_meter,
    waterContract: row.water_contract,
    waterMeter: row.water_meter,
    registrationNumber: row.registration_number,
    municipalRegistration: row.municipal_registration,
    photosCount: Array.isArray(row.photos) ? row.photos.length : 0,
    landlordFirestoreId: row.landlord_firestore_id,
    landlordName: row.landlord_name,
    landlordDocument: row.landlord_document,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  const supabase = createAdminClient();

  if (id) {
    const { data, error } = await supabase
      .from("real_estate_assets")
      .select(
        "id,firestore_id,code,title,property_name,type,status,motive,address,notes,zip_code,street,number,district,city,state,bedrooms,bathrooms,garage,area,rent_amount,condominium_amount,iptu_amount,payer_iptu,payer_condominium,energy_contract,energy_meter,water_contract,water_meter,registration_number,municipal_registration,photos,metadata,landlord_firestore_id,landlord_name,landlord_document,created_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { message: "Imóvel não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(mapAsset(data as RealEstateAssetRow));
  }

  const landlordDocument = onlyDigits(
    request.nextUrl.searchParams.get("landlordDocument")
  );
  const landlordId = request.nextUrl.searchParams.get("landlordId")?.trim();
  const type = request.nextUrl.searchParams.get("type")?.trim();
  const motive = request.nextUrl.searchParams.get("motive")?.trim();
  const status = request.nextUrl.searchParams.get("status")?.trim();
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1);
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 8), 1),
    50
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = supabase
    .from("real_estate_assets")
    .select(
      "id,firestore_id,code,title,property_name,type,status,motive,address,notes,zip_code,street,number,district,city,state,bedrooms,bathrooms,garage,area,rent_amount,condominium_amount,iptu_amount,payer_iptu,payer_condominium,energy_contract,energy_meter,water_contract,water_meter,registration_number,municipal_registration,photos,metadata,landlord_firestore_id,landlord_name,landlord_document,created_at",
      { count: "exact" }
    )
    .order("code", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (landlordDocument && landlordId) {
    query = query.or(
      `landlord_document.eq.${landlordDocument},landlord_firestore_id.eq.${landlordId}`
    );
  } else if (landlordDocument) {
    query = query.eq("landlord_document", landlordDocument);
  } else if (landlordId) {
    query = query.eq("landlord_firestore_id", landlordId);
  }

  if (type) {
    query = query.eq("type", type);
  }

  if (motive) {
    if (["aluguel", "venda"].includes(motive)) {
      query = query.or(
        `motive.eq.${motive},metadata->>motivo.eq.${motive}`
      );
    }
  }

  if (status) {
    query =
      status === "renovation"
        ? query.in("status", ["renovation", "emreforma"])
        : query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const contractStatuses = new Map<string, RealEstateAsset["contractStatus"]>();
  const assetIds = (data ?? []).map((asset) => asset.id);
  if (assetIds.length) {
    let offset = 0;
    while (true) {
      const { data: leases, error: leasesError } = await supabase
        .from("real_estate_leases")
        .select("id,asset_id,status,created_at")
        .in("asset_id", assetIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 999);
      if (leasesError) {
        return NextResponse.json(
          { message: "Não foi possível consultar a situação dos contratos." },
          { status: 500 }
        );
      }
      for (const lease of leases ?? []) {
        if (!contractStatuses.has(lease.asset_id) || lease.status === "active") {
          contractStatuses.set(lease.asset_id, lease.status);
        }
      }
      if (!leases || leases.length < 1000) break;
      offset += 1000;
    }
  }

  return NextResponse.json({
    assets: ((data ?? []) as RealEstateAssetRow[]).map((row) => ({
      ...mapAsset(row),
      contractStatus: contractStatuses.get(row.id) ?? null,
    })),
    total: count ?? 0,
    page,
    limit,
    hasNext: from + (data?.length ?? 0) < (count ?? 0),
  } satisfies RealEstateAssetsResponse);
}

type AssetPayload = {
  id?: string;
  motive?: string;
  status?: string;
  type?: string;
  title?: string;
  landlordId?: string;
  landlordDocument?: string;
  landlordName?: string;
  landlordTradeName?: string | null;
  landlordEmail?: string | null;
  landlordPhone?: string | null;
  landlordZipCode?: string | null;
  landlordStreet?: string | null;
  landlordNumber?: string | null;
  landlordComplement?: string | null;
  landlordDistrict?: string | null;
  landlordCity?: string | null;
  landlordState?: string | null;
  notes?: string;
  zipCode?: string;
  state?: string;
  city?: string;
  district?: string;
  street?: string;
  number?: string;
  area?: string;
  bedrooms?: string;
  bathrooms?: string;
  garage?: string;
  energyContract?: string;
  energyMeter?: string;
  waterContract?: string;
  waterMeter?: string;
  registrationNumber?: string;
  municipalRegistration?: string;
  rentAmount?: string;
  commissionType?: string;
  commissionAmount?: string;
  iptuAmount?: string;
  payerIptu?: string;
  condominiumAmount?: string;
  payerCondominium?: string;
};

function optional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function getAssetBody(payload: AssetPayload) {
  return {
    title: payload.title?.trim() ?? "",
    property_name: payload.title?.trim() ?? "",
    motive: optional(payload.motive),
    status: payload.status || "available",
    type: payload.type || "other",
    notes: optional(payload.notes),
    zip_code: onlyDigits(payload.zipCode),
    state: optional(payload.state?.toUpperCase()),
    city: optional(payload.city),
    district: optional(payload.district),
    street: optional(payload.street),
    number: optional(payload.number),
    address:
      [
        optional(payload.street),
        optional(payload.number),
        optional(payload.district),
        optional(payload.city),
        optional(payload.state?.toUpperCase()),
      ]
        .filter(Boolean)
        .join(", ") || null,
    area: optional(payload.area),
    bedrooms: optional(payload.bedrooms),
    bathrooms: optional(payload.bathrooms),
    garage: optional(payload.garage),
    energy_contract: optional(payload.energyContract),
    energy_meter: optional(payload.energyMeter),
    water_contract: optional(payload.waterContract),
    water_meter: optional(payload.waterMeter),
    registration_number: optional(payload.registrationNumber),
    municipal_registration: optional(payload.municipalRegistration),
    rent_amount: optional(payload.rentAmount),
    commission_type: optional(payload.commissionType),
    commission_amount: optional(payload.commissionAmount),
    iptu_amount: optional(payload.iptuAmount),
    payer_iptu: optional(payload.payerIptu),
    condominium_amount: optional(payload.condominiumAmount),
    payer_condominium: optional(payload.payerCondominium),
    landlord_firestore_id: optional(payload.landlordId),
    landlord_document: onlyDigits(payload.landlordDocument),
    landlord_name: optional(payload.landlordName),
    metadata: payload,
  };
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as AssetPayload;

  if (!payload.title?.trim() || !payload.landlordDocument?.trim()) {
    return NextResponse.json(
      { message: "Informe o nome do imóvel e o proprietário." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: lastAsset, error: lastAssetError } = await supabase
    .from("real_estate_assets")
    .select("code")
    .not("code", "is", null)
    .order("code", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAssetError) {
    return NextResponse.json({ message: lastAssetError.message }, { status: 500 });
  }

  const code = Number(lastAsset?.code ?? 0) + 1;
  const body = {
    ...getAssetBody(payload),
    code,
  };

  const { data, error } = await supabase
    .from("real_estate_assets")
    .insert(body)
    .select(
      "id,firestore_id,code,title,property_name,type,status,motive,address,notes,zip_code,street,number,district,city,state,bedrooms,bathrooms,garage,area,rent_amount,condominium_amount,iptu_amount,payer_iptu,payer_condominium,energy_contract,energy_meter,water_contract,water_meter,registration_number,municipal_registration,photos,metadata,landlord_firestore_id,landlord_name,landlord_document,created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const mappedAsset = mapAsset(data as RealEstateAssetRow);

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-asset:${mappedAsset.id}:created`,
    category: "real_estate",
    type: "asset_created",
    title: "Imóvel criado",
    message: `${mappedAsset.code ? `${mappedAsset.code} · ` : ""}${mappedAsset.title}`,
    severity: "info",
    entityType: "real_estate_asset",
    entityId: mappedAsset.id,
    actionHref: "/imobiliaria?tab=imoveis",
    metadata: { assetId: mappedAsset.id, code: mappedAsset.code },
  });

  return NextResponse.json(mappedAsset, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const payload = (await request.json()) as AssetPayload;

  if (!payload.id) {
    return NextResponse.json({ message: "Imóvel inválido." }, { status: 400 });
  }

  if (!payload.title?.trim() || !payload.landlordDocument?.trim()) {
    return NextResponse.json(
      { message: "Informe o nome do imóvel e o proprietário." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_assets")
    .update({
      ...getAssetBody(payload),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select(
      "id,firestore_id,code,title,property_name,type,status,motive,address,notes,zip_code,street,number,district,city,state,bedrooms,bathrooms,garage,area,rent_amount,condominium_amount,iptu_amount,payer_iptu,payer_condominium,energy_contract,energy_meter,water_contract,water_meter,registration_number,municipal_registration,photos,metadata,landlord_firestore_id,landlord_name,landlord_document,created_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { message: "Imóvel não encontrado." },
      { status: 404 }
    );
  }

  const mappedAsset = mapAsset(data as RealEstateAssetRow);

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-asset:${mappedAsset.id}:updated:${Date.now()}`,
    category: "real_estate",
    type: "asset_updated",
    title: "Imóvel atualizado",
    message: `${mappedAsset.code ? `${mappedAsset.code} · ` : ""}${mappedAsset.title}`,
    severity: "info",
    entityType: "real_estate_asset",
    entityId: mappedAsset.id,
    actionHref: "/imobiliaria?tab=imoveis",
    metadata: { assetId: mappedAsset.id, code: mappedAsset.code },
  });

  return NextResponse.json(mappedAsset);
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAuthenticatedUser())) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json(
      { message: "Imóvel inválido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: asset, error: assetError } = await supabase
    .from("real_estate_assets")
    .select("id,code,title,photos,documents")
    .eq("id", id)
    .maybeSingle();

  if (assetError) {
    return NextResponse.json({ message: assetError.message }, { status: 500 });
  }

  if (!asset) {
    return NextResponse.json(
      { message: "Imóvel não encontrado." },
      { status: 404 }
    );
  }

  const { data: activeLease, error: activeLeaseError } = await supabase
    .from("real_estate_leases")
    .select("id")
    .eq("asset_id", id)
    .eq("status", "active")
    .maybeSingle();

  if (activeLeaseError) {
    return NextResponse.json({ message: activeLeaseError.message }, { status: 500 });
  }

  if (activeLease) {
    return NextResponse.json(
      {
        message:
          "Não é possível excluir um imóvel com contrato ativo. Encerre o contrato antes de excluir.",
      },
      { status: 409 }
    );
  }

  const { data: linkedCharge, error: linkedChargeError } = await supabase
    .from("real_estate_charges")
    .select("id")
    .eq("asset_id", id)
    .limit(1)
    .maybeSingle();

  if (linkedChargeError) {
    return NextResponse.json(
      { message: "Não foi possível verificar as cobranças do imóvel. Tente novamente." },
      { status: 500 }
    );
  }

  if (linkedCharge) {
    return NextResponse.json(
      {
        message:
          "Não é possível excluir este imóvel porque existem cobranças vinculadas a ele. Consulte o financeiro do imóvel. O histórico financeiro deve ser preservado.",
      },
      { status: 409 }
    );
  }

  // Delete the record first: a foreign-key conflict must never remove its files.
  const { error } = await supabase
    .from("real_estate_assets")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      {
        message:
          error.code === "23503"
            ? "Não é possível excluir este imóvel porque existem registros vinculados a ele. Consulte os contratos e o financeiro do imóvel."
            : "Não foi possível excluir o imóvel. Tente novamente.",
      },
      { status: error.code === "23503" ? 409 : 500 }
    );
  }

  const photoPaths = getStoragePaths(asset.photos);
  const documentPaths = getStoragePaths(asset.documents);

  if (photoPaths.length > 0) {
    const { error } = await supabase.storage
      .from(REAL_ESTATE_PHOTOS_BUCKET)
      .remove(photoPaths);

    if (error) {
      console.error("Falha ao remover fotos do imóvel excluído", { assetId: id, error });
    }
  }

  if (documentPaths.length > 0) {
    const { error } = await supabase.storage
      .from(REAL_ESTATE_DOCUMENTS_BUCKET)
      .remove(documentPaths);

    if (error) {
      console.error("Falha ao remover documentos do imóvel excluído", { assetId: id, error });
    }
  }

  await createInternalActionNotification(supabase, {
    sourceKey: `real-estate-asset:${id}:deleted:${Date.now()}`,
    category: "real_estate",
    type: "asset_deleted",
    title: "Imóvel excluído",
    message: `${asset.code ? `${asset.code} · ` : ""}${asset.title ?? "Imóvel"}`,
    severity: "warning",
    entityType: "real_estate_asset",
    entityId: id,
    actionHref: "/imobiliaria?tab=imoveis",
    metadata: { assetId: id, code: asset.code },
  });

  return NextResponse.json({ message: "Imóvel excluído." });
}
