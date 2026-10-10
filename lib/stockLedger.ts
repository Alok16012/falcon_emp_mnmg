/**
 * Stock ledger: every quantity change on a StockItem goes through here so the
 * update and its StockTransaction audit row commit (or roll back) together.
 *
 * Concurrency: the item row is locked with SELECT ... FOR UPDATE inside the
 * transaction, so two simultaneous ADD/MINUS requests are serialised and each
 * one computes from the true current quantity (no lost updates).
 *
 * Idempotency: callers may pass a client-generated requestId. It is stored with
 * a UNIQUE constraint, so a double-submitted request is applied only once.
 */

import { Prisma, StockItem, StockTransactionType } from "@prisma/client"
import prisma from "@/lib/prisma"

export class StockError extends Error {
    constructor(message: string, public status = 400) {
        super(message)
    }
}

export type StockActor = { id: string | null; name: string }

const MAX_QTY = 1_000_000_000

/** Round to 3 decimals so float noise (0.1 + 0.2) never leaks into stored stock. */
export function roundQty(n: number): number {
    return Math.round(n * 1000) / 1000
}

export function parseAmount(raw: unknown): number {
    const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""))
    if (!Number.isFinite(n)) throw new StockError("Quantity must be a number")
    if (Math.abs(n) > MAX_QTY) throw new StockError("Quantity is too large")
    return roundQty(n)
}

export function cleanRemarks(raw: unknown): string | null {
    if (raw === undefined || raw === null) return null
    const s = String(raw).trim()
    if (!s) return null
    if (s.length > 500) throw new StockError("Remarks must be 500 characters or fewer")
    return s
}

export function cleanRequestId(raw: unknown): string | null {
    if (raw === undefined || raw === null || raw === "") return null
    const s = String(raw)
    if (!/^[A-Za-z0-9-]{8,64}$/.test(s)) throw new StockError("Invalid request id")
    return s
}

type Tx = Prisma.TransactionClient

async function lockItem(tx: Tx, id: string): Promise<StockItem> {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "StockItem" WHERE id = ${id} FOR UPDATE`
    if (rows.length === 0) throw new StockError("Stock item not found", 404)
    return tx.stockItem.findUniqueOrThrow({ where: { id } })
}

/** Writes the audit row for a change from `previous` to `next`. No-op when equal. */
export async function logStockChange(
    tx: Tx,
    item: Pick<StockItem, "id" | "itemCode" | "itemName" | "quantityUnit">,
    previous: number,
    next: number,
    actor: StockActor,
    remarks: string | null,
    requestId: string | null = null,
) {
    const diff = roundQty(next - previous)
    if (diff === 0) return null
    return tx.stockTransaction.create({
        data: {
            stockItemId: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            quantityUnit: item.quantityUnit,
            transactionType: diff > 0 ? StockTransactionType.ADD : StockTransactionType.MINUS,
            quantityChanged: Math.abs(diff),
            previousQuantity: roundQty(previous),
            newQuantity: roundQty(next),
            performedById: actor.id,
            performedByName: actor.name,
            remarks,
            requestId,
        },
    })
}

function isUniqueViolation(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
}

/**
 * Atomically ADD (delta > 0) or MINUS (delta < 0) stock and log it.
 * MINUS beyond the available quantity is rejected — stock never goes negative.
 */
export async function adjustStock(opts: {
    itemId: string
    delta: number
    actor: StockActor
    remarks: string | null
    requestId: string | null
}): Promise<{ item: StockItem; duplicate: boolean }> {
    const { itemId, delta, actor, remarks, requestId } = opts
    if (delta === 0) throw new StockError("Quantity must be greater than 0")

    if (requestId) {
        const seen = await prisma.stockTransaction.findUnique({ where: { requestId } })
        if (seen) {
            const item = await prisma.stockItem.findUnique({ where: { id: itemId } })
            if (!item) throw new StockError("Stock item not found", 404)
            return { item, duplicate: true }
        }
    }

    try {
        const item = await prisma.$transaction(async (tx) => {
            const current = await lockItem(tx, itemId)
            const next = roundQty(current.quantity + delta)
            if (next < 0) {
                throw new StockError(
                    `Only ${current.quantity} ${current.quantityUnit} in stock — cannot minus ${Math.abs(delta)}`,
                    409,
                )
            }
            const updated = await tx.stockItem.update({ where: { id: itemId }, data: { quantity: next } })
            await logStockChange(tx, current, current.quantity, next, actor, remarks, requestId)
            return updated
        })
        return { item, duplicate: false }
    } catch (e) {
        // Same requestId raced in concurrently: the loser's whole transaction
        // rolled back, so report the already-applied result instead of an error.
        if (requestId && isUniqueViolation(e)) {
            const item = await prisma.stockItem.findUnique({ where: { id: itemId } })
            if (item) return { item, duplicate: true }
        }
        throw e
    }
}

/**
 * Update item fields; when `quantity` is part of the edit, the change is logged
 * as ADD/MINUS in the same transaction.
 */
export async function updateStockItem(
    itemId: string,
    data: Prisma.StockItemUpdateInput & { quantity?: number },
    actor: StockActor,
): Promise<StockItem> {
    return prisma.$transaction(async (tx) => {
        const current = await lockItem(tx, itemId)
        const updated = await tx.stockItem.update({ where: { id: itemId }, data })
        if (typeof data.quantity === "number") {
            await logStockChange(tx, updated, current.quantity, updated.quantity, actor, "Quantity edited")
        }
        return updated
    })
}

/** Create an item; a non-zero starting quantity is logged as an opening ADD. */
export async function createStockItem(data: Prisma.StockItemCreateInput, actor: StockActor): Promise<StockItem> {
    return prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.create({ data })
        if (item.quantity > 0) {
            await logStockChange(tx, item, 0, item.quantity, actor, "Opening stock")
        }
        return item
    })
}

export function actorFromSession(user: { id?: string | null; name?: string | null; email?: string | null }): StockActor {
    return { id: user.id ?? null, name: (user.name || user.email || "Unknown").trim() }
}
