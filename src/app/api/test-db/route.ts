import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    console.log('Testing database connection...');
    
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Database connection successful:', result);
    
    // Test if tables exist
    const eventCount = await prisma.events.count();
    const deckCount = await prisma.decks.count();
    
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