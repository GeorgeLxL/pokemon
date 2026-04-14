import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("keyword") ?? "";
  if (keyword.length < 2) return NextResponse.json([]);
  try {
    return NextResponse.json(await searchCards(keyword));
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}
