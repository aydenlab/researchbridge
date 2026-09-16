import { describe, expect, it } from "vitest";
import { DISCIPLINES, OTHER, allAreaNames, areasForDisciplines, disciplinesForAreaSlugs } from "@/lib/disciplines";
import { slugify } from "@/lib/format";

describe("discipline to research area mapping", () => {
  it("offers nothing until a discipline is chosen", () => {
    expect(areasForDisciplines([])).toEqual([]);
  });

  it("offers a discipline's areas with Other last", () => {
    const areas = areasForDisciplines(["economics"]);
    expect(areas[0]).toBe("Applied Economics");
    expect(areas.at(-1)).toBe(OTHER);
    expect(areas).toHaveLength(13);
  });

  it("combines disciplines and removes duplicates", () => {
    const areas = areasForDisciplines(["life-sciences", "computer-science-ai"]);
    expect(areas.filter((area) => area === "Bioinformatics")).toHaveLength(1);
    expect(areas.filter((area) => area === OTHER)).toHaveLength(1);
    expect(areas).toContain("Genetics");
    expect(areas).toContain("Machine Learning");
  });

  it("offers only Other for the standalone Other discipline", () => {
    expect(areasForDisciplines(["other"])).toEqual([OTHER]);
  });

  it("gives every discipline and area a distinct slug", () => {
    const disciplineSlugs = DISCIPLINES.map((discipline) => discipline.slug);
    expect(new Set(disciplineSlugs).size).toBe(17);
    expect(disciplineSlugs).not.toContain("other");
    const areaSlugs = allAreaNames().map(slugify);
    expect(new Set(areaSlugs).size).toBe(areaSlugs.length);
  });

  it("works out disciplines from an older profile's areas", () => {
    expect(disciplinesForAreaSlugs(["robotics"])).toEqual(["engineering", "computer-science-ai"]);
  });
});
