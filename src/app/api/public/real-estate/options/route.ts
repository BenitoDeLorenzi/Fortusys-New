import { NextResponse } from "next/server";

import { getPublicRealEstateOptions } from "@/features/public-site/options";

export async function GET() {
  const options = await getPublicRealEstateOptions();

  return NextResponse.json(options);
}
