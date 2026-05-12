import { useLocation } from "wouter";

/**
 * Extracts source group from URL path dynamically.
 * /<group>/customers → "<group>"
 * /customers → undefined (no filter)
 *
 * Known group prefixes are detected by checking if the first path segment
 * is followed by a known sub-route (customers, surveys, follow-ups, installations, finance).
 */
export function useSourceGroup(): string | undefined {
  const [location] = useLocation();
  const knownSubRoutes = ["dashboard", "customers", "surveys", "follow-ups", "installations", "finance"];
  const parts = location.split("/").filter(Boolean);
  if (parts.length >= 2 && knownSubRoutes.includes(parts[1])) {
    return parts[0]; // e.g. "tcs", "gulf", "mea", or any new group
  }
  return undefined;
}
