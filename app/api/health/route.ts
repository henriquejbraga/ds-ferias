import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health check para deploy e monitoramento.
 * GET /api/health
 * - 200: aplicação e DB ok
 * - 503: DB indisponível
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (err) {
    console.error("[health] Database check failed:", err);
    return NextResponse.json(
      { status: "error", message: "Database unavailable", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
