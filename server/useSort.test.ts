import { describe, it, expect } from "vitest";

// Test the sort logic directly (not the hook, which requires React)
// We replicate the core sorting logic from useSort.ts

type SortDirection = "asc" | "desc" | null;

interface SortConfig {
  key: string;
  direction: SortDirection;
}

function sortData<T extends Record<string, any>>(data: T[], sortConfig: SortConfig): T[] {
  if (!sortConfig.key || !sortConfig.direction) return data;

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    let comparison = 0;

    if (typeof aVal === "number" && typeof bVal === "number") {
      comparison = aVal - bVal;
    } else if (typeof aVal === "string" && typeof bVal === "string") {
      comparison = aVal.localeCompare(bVal, "th");
    } else {
      comparison = String(aVal).localeCompare(String(bVal), "th");
    }

    return sortConfig.direction === "desc" ? -comparison : comparison;
  });

  return sorted;
}

function cycleSort(prev: SortConfig, key: string): SortConfig {
  if (prev.key === key) {
    if (prev.direction === "asc") return { key, direction: "desc" };
    if (prev.direction === "desc") return { key: "", direction: null };
  }
  return { key, direction: "asc" };
}

describe("useSort - sort logic", () => {
  const testData = [
    { name: "กรุณา", phone: "0812345678", amount: 5000, createdAt: 1700000000000 },
    { name: "สมชาย", phone: "0898765432", amount: 3000, createdAt: 1700100000000 },
    { name: "อารีย์", phone: "0856789012", amount: null, createdAt: 1700050000000 },
    { name: "ขวัญ", phone: null, amount: 8000, createdAt: null },
  ];

  it("should return original data when no sort is applied", () => {
    const result = sortData(testData, { key: "", direction: null });
    expect(result).toEqual(testData);
  });

  it("should sort strings ascending (Thai locale ก-ฮ)", () => {
    const result = sortData(testData, { key: "name", direction: "asc" });
    expect(result.map(d => d.name)).toEqual(["กรุณา", "ขวัญ", "สมชาย", "อารีย์"]);
  });

  it("should sort strings descending (Thai locale ฮ-ก)", () => {
    const result = sortData(testData, { key: "name", direction: "desc" });
    expect(result.map(d => d.name)).toEqual(["อารีย์", "สมชาย", "ขวัญ", "กรุณา"]);
  });

  it("should sort numbers ascending", () => {
    const result = sortData(testData, { key: "amount", direction: "asc" });
    // null should be pushed to bottom
    expect(result.map(d => d.amount)).toEqual([3000, 5000, 8000, null]);
  });

  it("should sort numbers descending", () => {
    const result = sortData(testData, { key: "amount", direction: "desc" });
    // null should be pushed to bottom
    expect(result.map(d => d.amount)).toEqual([8000, 5000, 3000, null]);
  });

  it("should push null/undefined values to bottom regardless of direction", () => {
    const resultAsc = sortData(testData, { key: "phone", direction: "asc" });
    expect(resultAsc[resultAsc.length - 1].phone).toBeNull();

    const resultDesc = sortData(testData, { key: "phone", direction: "desc" });
    expect(resultDesc[resultDesc.length - 1].phone).toBeNull();
  });

  it("should sort timestamps (numbers) correctly", () => {
    const result = sortData(testData, { key: "createdAt", direction: "asc" });
    // null pushed to bottom
    expect(result.map(d => d.name)).toEqual(["กรุณา", "อารีย์", "สมชาย", "ขวัญ"]);
  });
});

describe("useSort - cycle logic", () => {
  it("should start with asc on first click", () => {
    const result = cycleSort({ key: "", direction: null }, "name");
    expect(result).toEqual({ key: "name", direction: "asc" });
  });

  it("should cycle asc -> desc on second click", () => {
    const result = cycleSort({ key: "name", direction: "asc" }, "name");
    expect(result).toEqual({ key: "name", direction: "desc" });
  });

  it("should cycle desc -> null on third click", () => {
    const result = cycleSort({ key: "name", direction: "desc" }, "name");
    expect(result).toEqual({ key: "", direction: null });
  });

  it("should reset to asc when clicking a different column", () => {
    const result = cycleSort({ key: "name", direction: "desc" }, "phone");
    expect(result).toEqual({ key: "phone", direction: "asc" });
  });
});
