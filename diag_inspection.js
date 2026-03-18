
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const assignmentId = 'b7bb6770-9452-4eca-8783-2bbf8c1dc559'
    try {
        const assignment = await prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: { project: true, inspectionBoy: true }
        })
        console.log('Assignment:', JSON.stringify(assignment, null, 2))

        const inspection = await prisma.inspection.findFirst({
            where: { assignmentId },
            include: { submitter: true }
        })
        console.log('Inspection:', JSON.stringify(inspection, null, 2))
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
