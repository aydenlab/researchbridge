import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Must stay above the largest FILE_RULES entry in src/lib/storage/index.ts.
  // A server action rejects an oversized body before any of our own validation
  // runs, so a lower value here silently breaks video and writing-sample
  // uploads no matter what those rules say.
  experimental: { serverActions: { bodySizeLimit: "64mb" } },
  /**
   * instrumentation.ts guards its digest import with a NEXT_RUNTIME check, which
   * is enough in a production build: minification removes the branch, so the
   * database driver never enters the edge or client graphs. Dev does not
   * minify, so the import survives, webpack resolves it anyway, and "pg" fails
   * on Node built-ins — taking the whole dev compilation down rather than just
   * that entry. serverExternalPackages above only covers the Node server bundle.
   *
   * Ignoring the module off Node makes the runtime guard a build-time one too.
   * Nothing outside Node is allowed to reach the scheduler in the first place,
   * so there is no case where this hides a real import.
   */
  webpack(config, { isServer, nextRuntime, webpack }) {
    if (isServer && nextRuntime === "nodejs") return config;
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@\/lib\/notifications\/schedule$/ }));
    return config;
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/(dashboard|applications|saved|profile|onboarding|researcher|admin)/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
