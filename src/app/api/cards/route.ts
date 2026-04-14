import { NextRequest, NextResponse } from "next/server";
import { getCards } from "@/lib/queries";
import type { DeckFilter } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filter: DeckFilter = body.filter;

    if (!filter?.startDate || !filter?.endDate || !filter?.league) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 });
    }

    console.log('Fetching cards with filter:', filter);
    
    const result = await Promise.race([
      getCards(filter),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cards query timeout')), 30000)
      )
    ]);
    
    console.log('Cards query completed successfully');
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cards API Error:', err);
    return NextResponse.json({ 
      message: err instanceof Error ? err.message : "Internal Server Error" 
    }, { status: 500 });
  }
}