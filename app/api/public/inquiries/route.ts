import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Public endpoint — no auth. External parties submit product inquiries here.
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { name, productName, quantity, rate, location, partyName } = body

        if (!name || !productName || quantity == null || rate == null || !location || !partyName) {
            return new NextResponse("Missing required fields", { status: 400 })
        }

        const qty = parseInt(quantity, 10)
        const rt = parseFloat(rate)
        if (Number.isNaN(qty) || Number.isNaN(rt)) {
            return new NextResponse("Quantity and rate must be numbers", { status: 400 })
        }

        await prisma.productInquiry.create({
            data: {
                name: String(name).trim(),
                productName: String(productName).trim(),
                quantity: qty,
                rate: rt,
                location: String(location).trim(),
                partyName: String(partyName).trim(),
                status: "PENDING",
            },
        })

        // Don't leak internal IDs to the public form
        return NextResponse.json({ ok: true }, { status: 201 })
    } catch (error) {
        console.error("[PUBLIC_INQUIRY_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
