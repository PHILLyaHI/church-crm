import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** The front door: sign in, first run, or straight to the list. */
export default async function Root() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true },
  });
  if (!user) redirect("/sign-in");

  redirect(user.onboardedAt ? "/people" : "/welcome");
}
