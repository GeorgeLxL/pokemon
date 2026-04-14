import { NextResponse } from "next/server";
import { getCardCategories } from "@/lib/queries";

export async function GET() {
  try {
    return NextResponse.json(await getCardCategories());
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}
