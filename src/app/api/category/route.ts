import { NextResponse } from "next/server";
import { getCategories } from "@/lib/queries";

export async function GET() {
  try {
    return NextResponse.json(await getCategories());
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}
