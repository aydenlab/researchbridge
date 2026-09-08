export type PersonRole = "student" | "researcher" | "admin" | null;

export type Viewable = { id: string; role: PersonRole };

/**
 * Who a signed-in account is allowed to browse.
 *
 * The two sides of the platform look for each other, never at themselves: a
 * student is not a candidate for another student, and a researcher is not a
 * supervisor for another researcher. Hiding same-role accounts everywhere,
 * rather than only on the directory pages, keeps the follow graph and the inbox
 * pointed across the divide instead of drifting into a peer feed.
 *
 * Admins see everyone, because moderating requires it, and everyone can see an
 * admin so a message from support is never a conversation with a blank.
 */
export function canViewPerson(viewer: Viewable, target: Viewable): boolean {
  if (viewer.id === target.id) return true;
  if (viewer.role === "admin") return true;
  if (!viewer.role || !target.role) return false;
  return viewer.role !== target.role;
}

/** The counterpart side of the platform, or null when the viewer sees both. */
export function counterpartRole(role: PersonRole): "student" | "researcher" | null {
  if (role === "student") return "researcher";
  if (role === "researcher") return "student";
  return null;
}

export const SAME_ROLE_MESSAGE_REASON =
  "ResearchBridge connects students with researchers, so this account is not one you can write to.";
