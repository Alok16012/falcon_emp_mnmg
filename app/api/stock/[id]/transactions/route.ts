/**
 * GET /api/stock/:id/transactions — read-only audit history for one stock item.
 *
 * Query (all optional):
 *   from, to   ISO instants; filter is createdAt >= from AND createdAt < to.
 *              The client sends `to` as the start of the day AFTER the chosen
 *              end date, so the whole end date is included.
 *   type       ADD | MINUS
 *   search     matches item code, item name or performer name
 *   page       1-based (default 1)
 *   pageSize   10 | 25 | 50 (default 10)
 *
 * There are intentionally no write endpoints: the ledger is immutable and is
 * only appended to by lib/stockLedger alongside the stock update itself.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { Prisma, StockTransactionType } from "@prisma/client"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"

const PAGE_SIZES = [5, 10, 25, 50]

function parseInstant(raw: string | null): Date | null | "invalid" {
    if (!raw) return null
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? "invalid" : d
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "stock")) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const url = new URL(req.url)
        const from = parseInstant(url.searchParams.get("from"))
        const to = parseInstant(url.searchParams.get("to"))
        if (from === "invalid" || to === "invalid") return new NextResponse("Invalid date", { status: 400 })
        if (from && to && from >= to) return new NextResponse("From date must be before To date", { status: 400 })

        const typeRaw = url.searchParams.get("type")
        if (typeRaw && typeRaw !== "ADD" && typeRaw !== "MINUS") {
            return new NextResponse("Invalid transaction type", { status: 400 })
        }
        const type = typeRaw as StockTransactionType | null

        const search = (url.searchParams.get("search") || "").trim().slice(0, 100)
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1)
        const sizeRaw = parseInt(url.searchParams.get("pageSize") || "10")
        const pageSize = PAGE_SIZES.includes(sizeRaw) ? sizeRaw : 10

        const item = await prisma.stockItem.findUnique({
            where: { id: params.id },
            select: { id: true, itemCode: true, itemName: true, quantity: true, quantityUnit: true },
        })
        if (!item) return new NextResponse("Not found", { status: 404 })

        const createdAt: Prisma.DateTimeFilter = {}
        if (from) createdAt.gte = from
        if (to) createdAt.lt = to

        const where: Prisma.StockTransactionWhereInput = {
            stockItemId: item.id,
            ...(from || to ? { createdAt } : {}),
            ...(type ? { transactionType: type } : {}),
            ...(search
                ? {
                      OR: [
                          { itemCode: { contains: search, mode: "insensitive" } },
                          { itemName: { contains: search, mode: "insensitive" } },
                          { performedByName: { contains: search, mode: "insensitive" } },
                      ],
                  }
                : {}),
        }

        const [total, rows, sums] = await Promise.all([
            prisma.stockTransaction.count({ where }),
            prisma.stockTransaction.findMany({
                where,
                orderBy: [{ createdAt: "desc" }, { seq: "desc" }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true, transactionType: true, quantityChanged: true,
                    previousQuantity: true, newQuantity: true, performedByName: true,
                    remarks: true, createdAt: true, quantityUnit: true,
                },
            }),
            prisma.stockTransaction.groupBy({
                by: ["transactionType"],
                where,
                _sum: { quantityChanged: true },
            }),
        ])

        const sumOf = (t: StockTransactionType) =>
            sums.find(s => s.transactionType === t)?._sum.quantityChanged ?? 0

        return NextResponse.json({
            item,
            summary: {
                totalAdded: sumOf("ADD"),
                totalDeducted: sumOf("MINUS"),
                totalTransactions: total,
            },
            transactions: rows,
            total,
            page,
            pageSize,
        })
    } catch (error) {
        console.error("[STOCK_TX_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
