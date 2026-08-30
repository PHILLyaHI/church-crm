import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  role: string;
  onboarded: boolean;
};

/** Every page behind the rail calls this first. */
export async function requireViewer(): Promise<Viewer> {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, onboardedAt: true },
  });
  if (!user) redirect("/sign-in");
  return { ...user, onboarded: Boolean(user.onboardedAt) };
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") redirect("/people");
  return viewer;
}

export function isAdmin(viewer: Viewer) {
  return viewer.role === "admin";
}

/** Higher leaders read downward. Depth is one: direct reports only. */
export async function directReportIds(viewerId: string) {
  const reports = await db.user.findMany({
    where: { leaderId: viewerId },
    select: { id: true },
  });
  return reports.map((r) => r.id);
}

export type Access = { canRead: boolean; canWrite: boolean; borrowedFrom?: string };

/**
 * Nobody ever looks up or sideways. Own list is read+write; a direct
 * sub-leader's list is read-only and always says whose it is.
 */
export async function accessToOwner(viewer: Viewer, ownerId: string): Promise<Access> {
  if (ownerId === viewer.id) return { canRead: true, canWrite: true };

  const owner = await db.user.findUnique({
    where: { id: ownerId },
    select: { id: true, name: true, leaderId: true },
  });
  if (!owner) return { canRead: false, canWrite: false };

  if (owner.leaderId === viewer.id) {
    return { canRead: true, canWrite: false, borrowedFrom: owner.name };
  }
  if (viewer.role === "admin") {
    return { canRead: true, canWrite: false, borrowedFrom: owner.name };
  }
  return { canRead: false, canWrite: false };
}

/** Admin reads of someone else's person are written to that person's timeline. */
export async function logAdminRead(viewer: Viewer, personId: string, ownerName: string) {
  if (viewer.role !== "admin") return;
  const recent = await db.note.findFirst({
    where: {
      personId,
      kind: "system",
      authorId: viewer.id,
      createdAt: { gt: new Date(Date.now() - 60 * 60_000) },
    },
  });
  if (recent) return;
  await db.note.create({
    data: {
      personId,
      kind: "system",
      authorId: viewer.id,
      body: `${viewer.name} (admin) opened this record. Owner: ${ownerName}.`,
    },
  });
}
