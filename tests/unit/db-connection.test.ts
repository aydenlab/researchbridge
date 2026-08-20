import { describe, expect, it } from "vitest";
import { sslFor } from "@/db";

describe("ssl selection for a Postgres connection string", () => {
  it("disables ssl for Railway private networking, which does not accept it", () => {
    expect(sslFor("postgresql://user:pass@postgres.railway.internal:5432/railway")).toBeUndefined();
  });

  it("disables ssl for local development databases", () => {
    expect(sslFor("postgresql://user:pass@localhost:5432/researchbridge")).toBeUndefined();
    expect(sslFor("postgresql://user:pass@127.0.0.1:5432/researchbridge")).toBeUndefined();
  });

  it("enables ssl for a public managed host", () => {
    expect(sslFor("postgresql://user:pass@containers-us-west-1.railway.app:6543/railway")).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("honours an explicit sslmode=disable even on a public host", () => {
    expect(sslFor("postgresql://user:pass@db.example.com:5432/app?sslmode=disable")).toBeUndefined();
  });

  it("honours an explicit sslmode=require even on a private host", () => {
    expect(sslFor("postgresql://user:pass@postgres.railway.internal:5432/railway?sslmode=require")).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("verifies the certificate when asked to", () => {
    expect(sslFor("postgresql://user:pass@db.example.com:5432/app?sslmode=verify-full")).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("returns undefined rather than throwing on an unparseable url", () => {
    expect(sslFor("not a url")).toBeUndefined();
  });
});
