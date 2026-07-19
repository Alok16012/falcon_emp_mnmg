
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { homeForUser } from "@/lib/modules"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Dashboard if permitted, otherwise the user's first granted module
  redirect(homeForUser(session.user))
}
