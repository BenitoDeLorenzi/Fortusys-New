import { NextResponse } from "next/server";

import type {
  RealEstateLandlord,
  RealEstateLandlordsResponse,
} from "@/features/real-estate/types";
import { createAdminClient } from "@/lib/supabase/admin";

type LandlordRow = {
  landlord_firestore_id: string | null;
  landlord_name: string | null;
  landlord_document: string | null;
};

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_assets")
    .select("landlord_firestore_id,landlord_name,landlord_document")
    .not("landlord_document", "is", null)
    .order("landlord_name", { ascending: true });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const landlordsByDocument = new Map<string, RealEstateLandlord>();

  for (const row of (data ?? []) as LandlordRow[]) {
    const document = row.landlord_document?.replace(/\D/g, "");

    if (!document || landlordsByDocument.has(document)) {
      continue;
    }

    landlordsByDocument.set(document, {
      firestoreId: row.landlord_firestore_id,
      name: row.landlord_name,
      document,
    });
  }

  return NextResponse.json({
    landlords: Array.from(landlordsByDocument.values()),
  } satisfies RealEstateLandlordsResponse);
}
