import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { SortConfig } from "@/hooks/useSort";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  className = "",
}: SortableHeaderProps) {
  const isActive = sortConfig.key === sortKey && sortConfig.direction !== null;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 hover:text-amber-600 transition-colors cursor-pointer select-none group ${
        isActive ? "text-amber-600 font-semibold" : ""
      } ${className}`}
    >
      <span>{label}</span>
      {isActive && sortConfig.direction === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : isActive && sortConfig.direction === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
      )}
    </button>
  );
}
