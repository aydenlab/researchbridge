import { and, eq, isNull, sql } from "drizzle-orm";
import { db, notifications } from "@/db";
import { AppHeader, type NavItem } from "@/components/app/app-shell";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { currentUser } from "@/lib/auth/permissions";
import { unreadMessageCount } from "@/lib/queries/messages";

const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/reviews", label: "Reviews" },
  { href: "/directory/researchers", label: "Researchers" },
  { href: "/applications", label: "Applications" },
  { href: "/saved", label: "Saved" },
  { href: "/connections", label: "Connections" },
  { href: "/profile", label: "Profile" },
];

const RESEARCHER_NAV: NavItem[] = [
  { href: "/researcher", label: "Home" },
  { href: "/researcher/opportunities", label: "Postings" },
  { href: "/researcher/applicants", label: "Applicants" },
  { href: "/directory/students", label: "Find students" },
  { href: "/reviews", label: "Reviews" },
  { href: "/connections", label: "Connections" },
  { href: "/profile", label: "Profile" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/researchers", label: "Researchers" },
  { href: "/admin/faculty", label: "Faculty list" },
  { href: "/admin/opportunities", label: "Opportunities" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/institutions", label: "Institutions" },
  { href: "/admin/taxonomies", label: "Taxonomies" },
  { href: "/admin/system", label: "System" },
];

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  researcher: "Researcher",
  admin: "ResearchBridge admin",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  if (!user || !user.role) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex-1 bg-shell">
          <SiteHeader signedIn={Boolean(user)} homeHref="/onboarding" />
          {children}
        </div>
        <SiteFooter />
      </div>
    );
  }

  const nav = user.role === "admin" ? ADMIN_NAV : user.role === "researcher" ? RESEARCHER_NAV : STUDENT_NAV;
  const homeHref = user.role === "admin" ? "/admin" : user.role === "researcher" ? "/researcher" : "/dashboard";

  const [[{ unread }], unreadMessages] = await Promise.all([
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    unreadMessageCount(user.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-shell">
      <AppHeader
        nav={nav}
        homeHref={homeHref}
        displayName={user.displayName}
        email={user.email}
        photoFileId={user.photoFileId}
        roleLabel={ROLE_LABELS[user.role] ?? "Member"}
        unreadCount={unread}
        unreadMessageCount={unreadMessages}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
