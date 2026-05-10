import { useLocation } from "wouter";

export type SourceGroup = "tcs" | "gulf" | "mea" | undefined;

/**
 * Extracts source group from URL path.
 * /tcs/customers → "tcs"
 * /gulf/surveys → "gulf"
 * /mea/installations → "mea"
 * /customers → undefined (no filter)
 */
export function useSourceGroup(): SourceGroup {
  const [location] = useLocation();
  if (location.startsWith("/tcs/")) return "tcs";
  if (location.startsWith("/gulf/")) return "gulf";
  if (location.startsWith("/mea/")) return "mea";
  return undefined;
}
