import { NextResponse } from "next/server";

import type { DatabaseStatus } from "@/features/database/status";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const baseStatus = {
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasPublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
  };

  if (!baseStatus.hasUrl || !baseStatus.hasPublishableKey) {
    return NextResponse.json({
      ...baseStatus,
      isConnected: false,
      schemaApplied: false,
      rolesCount: null,
      error: "Configure URL e publishable key do Supabase.",
    } satisfies DatabaseStatus);
  }

  if (!baseStatus.hasSecretKey) {
    return NextResponse.json({
      ...baseStatus,
      isConnected: false,
      schemaApplied: false,
      rolesCount: null,
      error: "Configure SUPABASE_SECRET_KEY para testes administrativos.",
    } satisfies DatabaseStatus);
  }

  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("roles")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({
        ...baseStatus,
        isConnected: true,
        schemaApplied: false,
        rolesCount: null,
        error: error.message,
      } satisfies DatabaseStatus);
    }

    return NextResponse.json({
      ...baseStatus,
      isConnected: true,
      schemaApplied: true,
      rolesCount: count ?? 0,
      error: null,
    } satisfies DatabaseStatus);
  } catch (error) {
    return NextResponse.json({
      ...baseStatus,
      isConnected: false,
      schemaApplied: false,
      rolesCount: null,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    } satisfies DatabaseStatus);
  }
}
