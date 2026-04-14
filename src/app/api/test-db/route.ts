import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    console.log('Testing database connection...');
    
    const [result] = await db.query('SELECT 1 as test');
    console.log('Database connection successful:', result);
    
    const [eventCountResult] = await db.query('SELECT COUNT(*) as count FROM events');
    const [deckCountResult] = await db.query('SELECT COUNT(*) as count FROM decks');
    const eventCount = (eventCountResult as {count: number}[])[0]?.count ?? 0;
    const deckCount = (deckCountResult as {count: number}[])[0]?.count ?? 0;
    
    return NextResponse.json({
      status: 'success',
      connection: 'ok',
      eventCount,
      deckCount,
      testQuery: result
    });
  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}