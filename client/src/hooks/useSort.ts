import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * Generic hook for sorting arrays of objects by any key.
 * Supports string, number, date (timestamp), and null/undefined values.
 *
 * Usage:
 *   const { sortedData, sortConfig, requestSort, getSortIcon } = useSort(data);
 *   <th onClick={() => requestSort("name")}>Name {getSortIcon("name")}</th>
 */
export function useSort<T extends Record<string, any>>(
  data: T[],
  defaultSort?: SortConfig
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(
    defaultSort ?? { key: "", direction: null }
  );

  const requestSort = useCallback(
    (key: string) => {
      setSortConfig((prev) => {
        if (prev.key === key) {
          // Cycle: asc -> desc -> null
          if (prev.direction === "asc") return { key, direction: "desc" };
          if (prev.direction === "desc") return { key: "", direction: null };
        }
        return { key, direction: "asc" };
      });
    },
    []
  );

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      // Handle null/undefined — push to bottom
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;

      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal, "th");
      } else {
        // Fallback: convert to string
        comparison = String(aVal).localeCompare(String(bVal), "th");
      }

      return sortConfig.direction === "desc" ? -comparison : comparison;
    });

    return sorted;
  }, [data, sortConfig]);

  return { sortedData, sortConfig, requestSort };
}
