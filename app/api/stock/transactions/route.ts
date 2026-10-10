/**
 * GET /api/stock/transactions — read-only audit history across ALL stock items
 * (including items that have since been deleted). Query params and response
 * shape: see lib/stockHistory.ts.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"
import { HistoryQueryError, queryStockHistory } from "@/lib/stockHistory"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "stock")) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const data = await queryStockHistory(new URL(req.url).searchParams, null)
        return NextResponse.json(data)
    } catch (error) {
        if (error instanceof HistoryQueryError) return new NextResponse(error.message, { status: error.status })
        console.error("[STOCK_TX_ALL_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
