import { NextRequest, NextResponse } from "next/server";

import type {
  ClientRole,
  Payer,
  PayersResponse,
} from "@/features/payers/types";
import { createInternalActionNotification } from "@/features/notifications/server/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

type PayerPayload = {
  id?: string;
  firestoreId?: string | null;
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  status?: "active" | "inactive";
  roles?: ClientRole[];
};

type PayerRow = {
  id: string;
  firestore_id: string | null;
  code: number | null;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "inactive";
  roles: ClientRole[];
  created_at: string;
};

function onlyDigits(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function mapPayer(row: PayerRow): Payer {
  return {
    id: row.id,
    firestoreId: row.firestore_id,
    code: row.code,
    name: row.name,
    document: row.document,
    email: row.email,
    phone: row.phone,
    zipCode: row.zip_code,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    status: row.status,
    roles: row.roles,
    createdAt: row.created_at,
  };
}

function getPayerBody(payload: PayerPayload) {
  const roles: ClientRole[] = payload.roles?.length
    ? [...new Set(payload.roles)]
    : ["payer"];

  return {
    firestore_id: payload.firestoreId || null,
    name: payload.name?.trim() ?? "",
    document: onlyDigits(payload.document),
    email: payload.email?.trim().toLowerCase() || null,
    phone: onlyDigits(payload.phone) || null,
    zip_code: onlyDigits(payload.zipCode) || null,
    street: payload.street?.trim() || null,
    number: payload.number?.trim() || null,
    complement: payload.complement?.trim() || null,
    district: payload.district?.trim() || null,
    city: payload.city?.trim() || null,
    state: payload.state?.trim().toUpperCase() || null,
    status: payload.status ?? "active",
    roles,
  };
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim();
  const role = request.nextUrl.searchParams.get("role")?.trim() as
    | ClientRole
    | undefined;
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1);
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 8), 1),
    50
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const supabase = createAdminClient();
  let query = supabase
    .from("payers")
    .select(
      "id,firestore_id,code,name,document,email,phone,zip_code,street,number,complement,district,city,state,status,roles,created_at",
      { count: "exact" }
    )
    .order("code", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    const digits = onlyDigits(search);
    query = digits
      ? query.or(`document.ilike.%${digits}%,name.ilike.%${search}%`)
      : query.ilike("name", `%${search}%`);
  }

  if (role && ["payer", "tenant", "buyer", "guarantor"].includes(role)) {
    query = query.contains("roles", [role]);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    payers: ((data ?? []) as PayerRow[]).map(mapPayer),
    hasMore: from + (data?.length ?? 0) < (count ?? 0),
    total: count ?? 0,
  } satisfies PayersResponse);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as PayerPayload;
  const body = getPayerBody(payload);

  if (!body.name || !body.document) {
    return NextResponse.json(
      { message: "Nome e CPF/CNPJ são obrigatórios." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: lastPayer, error: lastPayerError } = await supabase
    .from("payers")
    .select("code")
    .not("code", "is", null)
    .order("code", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastPayerError) {
    return NextResponse.json({ message: lastPayerError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("payers")
    .insert({
      ...body,
      code: ((lastPayer?.code as number | null) ?? 0) + 1,
    })
    .select(
      "id,firestore_id,code,name,document,email,phone,zip_code,street,number,complement,district,city,state,status,roles,created_at"
    )
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ message: error.message }, { status });
  }

  const mappedPayer = mapPayer(data as PayerRow);

  await createInternalActionNotification(supabase, {
    sourceKey: `payer:${mappedPayer.id}:created`,
    category: "system",
    type: "payer_created",
    title: "Cliente criado",
    message: `${mappedPayer.code ? `${mappedPayer.code} · ` : ""}${mappedPayer.name}`,
    severity: "info",
    entityType: "payer",
    entityId: mappedPayer.id,
    actionHref: "/clientes",
    metadata: { payerId: mappedPayer.id, code: mappedPayer.code },
  });

  return NextResponse.json(mappedPayer, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const payload = (await request.json()) as PayerPayload;
  const body = getPayerBody(payload);

  if (!payload.id) {
    return NextResponse.json(
      { message: "Cliente inválido." },
      { status: 400 }
    );
  }

  if (!body.name || !body.document) {
    return NextResponse.json(
      { message: "Nome e CPF/CNPJ são obrigatórios." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payers")
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .select(
      "id,firestore_id,code,name,document,email,phone,zip_code,street,number,complement,district,city,state,status,roles,created_at"
    )
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ message: error.message }, { status });
  }

  const mappedPayer = mapPayer(data as PayerRow);

  await createInternalActionNotification(supabase, {
    sourceKey: `payer:${mappedPayer.id}:updated:${Date.now()}`,
    category: "system",
    type: "payer_updated",
    title: "Cliente atualizado",
    message: `${mappedPayer.code ? `${mappedPayer.code} · ` : ""}${mappedPayer.name}`,
    severity: "info",
    entityType: "payer",
    entityId: mappedPayer.id,
    actionHref: "/clientes",
    metadata: { payerId: mappedPayer.id, code: mappedPayer.code },
  });

  return NextResponse.json(mappedPayer);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { message: "Cliente inválido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: payer } = await supabase
    .from("payers")
    .select("id,code,name")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("payers").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await createInternalActionNotification(supabase, {
    sourceKey: `payer:${id}:deleted:${Date.now()}`,
    category: "system",
    type: "payer_deleted",
    title: "Cliente excluído",
    message: `${payer?.code ? `${payer.code} · ` : ""}${payer?.name ?? "Cliente"}`,
    severity: "warning",
    entityType: "payer",
    entityId: id,
    actionHref: "/clientes",
    metadata: { payerId: id, code: payer?.code ?? null },
  });

  return NextResponse.json({ message: "Cliente excluído." });
}
