/**
 * Shared read-side of the stock ledger, used by
 *   GET /api/stock/transactions        (all products)
 *   GET /api/stock/:id/transactions    (one product)
 *
 * Query (all optional):
 *   from, to   ISO instants; filter is createdAt >= from AND createdAt < to.
 *              The client sends `to` as the start of the day AFTER the chosen
 *              end date, so the whole end date is included.
 *   type       ADD | MINUS
 *   search     matches item code, item name or performer name
 *   page       1-based (default 1)
 *   pageSize   10 | 25 | 50 (default 10; 5 for the quick view)
 */

import { Prisma, StockTransactionType } from "@prisma/client"
import prisma from "@/lib/prisma"

const PAGE_SIZES = [5, 10, 25, 50]

export class HistoryQueryError extends Error {
    constructor(message: string, public status = 400) {
        super(message)
    }
}

function parseInstant(raw: string | null): Date | null {
    if (!raw) return null
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) throw new HistoryQueryError("Invalid date")
    return d
}

export async function queryStockHistory(params: URLSearchParams, stockItemId: string | null) {
    const from = parseInstant(params.get("from"))
    const to = parseInstant(params.get("to"))
    if (from && to && from >= to) throw new HistoryQueryError("From date must be before To date")

    const typeRaw = params.get("type")
    if (typeRaw && typeRaw !== "ADD" && typeRaw !== "MINUS") {
        throw new HistoryQueryError("Invalid transaction type")
    }
    const type = typeRaw as StockTransactionType | null

    const search = (params.get("search") || "").trim().slice(0, 100)
    const page = Math.max(1, parseInt(params.get("page") || "1") || 1)
    const sizeRaw = parseInt(params.get("pageSize") || "10")
    const pageSize = PAGE_SIZES.includes(sizeRaw) ? sizeRaw : 10

    const item = stockItemId
        ? await prisma.stockItem.findUnique({
              where: { id: stockItemId },
              select: { id: true, itemCode: true, itemName: true, quantity: true, quantityUnit: true },
          })
        : null
    if (stockItemId && !item) throw new HistoryQueryError("Not found", 404)

    const createdAt: Prisma.DateTimeFilter = {}
    if (from) createdAt.gte = from
    if (to) createdAt.lt = to

    const where: Prisma.StockTransactionWhereInput = {
        ...(stockItemId ? { stockItemId } : {}),
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

    const [total, rows, sums, items] = await Promise.all([
        prisma.stockTransaction.count({ where }),
        prisma.stockTransaction.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { seq: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
                id: true, stockItemId: true, itemCode: true, itemName: true,
                transactionType: true, quantityChanged: true,
                previousQuantity: true, newQuantity: true, performedByName: true,
                remarks: true, createdAt: true, quantityUnit: true,
            },
        }),
        prisma.stockTransaction.groupBy({
            by: ["transactionType"],
            where,
            _sum: { quantityChanged: true },
        }),
        // Distinct products touched (by code, so deleted items still count).
        stockItemId ? Promise.resolve(null) : prisma.stockTransaction.groupBy({ by: ["itemCode"], where }),
    ])

    const sumOf = (t: StockTransactionType) =>
        sums.find(s => s.transactionType === t)?._sum.quantityChanged ?? 0

    return {
        item,
        summary: {
            totalAdded: sumOf("ADD"),
            totalDeducted: sumOf("MINUS"),
            totalTransactions: total,
            itemsAffected: items ? items.length : null,
        },
        transactions: rows,
        total,
        page,
        pageSize,
    }
}
