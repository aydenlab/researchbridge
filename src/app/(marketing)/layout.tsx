import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getSessionUser } from "@/lib/auth/session";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const homeHref = user?.role === "admin" ? "/admin" : user?.role === "researcher" ? "/researcher" : "/dashboard";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <main className="rb-grid-bg overflow-x-clip bg-white text-ink">
          <SiteHeader signedIn={Boolean(user)} homeHref={homeHref} />
          {children}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
