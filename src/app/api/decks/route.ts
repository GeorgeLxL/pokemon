import { NextRequest, NextResponse } from "next/server";
import { getDecksAndStats } from "@/lib/queries";
import type { DeckFilter } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filter: DeckFilter = body.filter;
    const page: number = body.page ?? 1;
    const pageSize: number = body.pageSize ?? 16;

    if (!filter?.startDate || !filter?.endDate || !filter?.league) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 });
    }

    console.log('Fetching decks with filter:', filter, 'page:', page, 'pageSize:', pageSize);
    
    const result = await Promise.race([
      getDecksAndStats(filter, page, pageSize),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 36000000)
      )
    ]);
    
    console.log('Query completed successfully');
    return NextResponse.json(result);
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ 
      message: err instanceof Error ? err.message : "Internal Server Error" 
    }, { status: 500 });
  }
}
