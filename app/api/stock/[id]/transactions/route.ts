/**
 * GET /api/stock/:id/transactions — read-only audit history for one stock item.
 * Query params and response shape: see lib/stockHistory.ts.
 *
 * There are intentionally no write endpoints: the ledger is immutable and is
 * only appended to by lib/stockLedger alongside the stock update itself.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"
import { HistoryQueryError, queryStockHistory } from "@/lib/stockHistory"

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "stock")) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const data = await queryStockHistory(new URL(req.url).searchParams, params.id)
        return NextResponse.json(data)
    } catch (error) {
        if (error instanceof HistoryQueryError) return new NextResponse(error.message, { status: error.status })
        console.error("[STOCK_TX_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
