import { apiFetch } from "@/lib/api";

/**
 * The agency's landmarks with verified coordinates. Distances the assistant
 * quotes are measured from a listing's pin to these, in a straight line.
 * Nothing is pre-filled: a made-up coordinate is a made-up distance.
 */

export type Landmark = {
  id: string;
  name: string;
  category: string;
  category_label: string;
  latitude: number;
  longitude: number;
  aliases: string[];
  locality: string | null;
  source: string | null;
  notes: string | null;
  created_by: string | null;
  updated_at: string | null;
};

export type LandmarkInput = {
  name: string;
  category: string;
  latitude?: number | null;
  longitude?: number | null;
  /** A Google Maps link containing the pin, instead of typing the numbers. */
  map_url?: string | null;
  aliases?: string[];
  locality?: string | null;
  source?: string | null;
  notes?: string | null;
};

export type LandmarkCategory = { value: string; label: string; plural: string };

export type NearbyResult = {
  property_id: string;
  property_title: string;
  property_has_coordinates: boolean;
  distance_type: "straight_line";
  results: Array<{
    name: string;
    category: string;
    distance_m: number;
    distance_km: number;
    near: boolean;
    band: string;
    locality: string | null;
  }>;
  /** The same reply the assistant gives a customer. */
  text: string;
};

export function listLandmarkCategories() {
  return apiFetch<LandmarkCategory[]>("/api/v1/landmarks/categories");
}

export function listLandmarks(params: { search?: string; category?: string } = {}) {
  const query = new URLSearchParams({ limit: "500" });
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  return apiFetch<{ items: Landmark[]; total: number }>(`/api/v1/landmarks?${query}`);
}

export function createLandmark(body: LandmarkInput) {
  return apiFetch<Landmark>("/api/v1/landmarks", { method: "POST", body: JSON.stringify(body) });
}

export function deleteLandmark(id: string) {
  return apiFetch<void>(`/api/v1/landmarks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function importLandmarks(items: LandmarkInput[]) {
  return apiFetch<{ created: number; updated: number; errors: Array<{ row: number; name: string; error: string }> }>(
    "/api/v1/landmarks/bulk",
    { method: "POST", body: JSON.stringify({ items }) },
  );
}

export function nearbyForProperty(propertyId: string, params: { category?: string; limit?: number } = {}) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 5) });
  if (params.category) query.set("category", params.category);
  return apiFetch<NearbyResult>(`/api/v1/landmarks/near/${encodeURIComponent(propertyId)}?${query}`);
}

/**
 * Lines pasted from a sheet: name, category, latitude, longitude[, locality].
 * Commas or tabs. A header row is skipped. Rows that do not parse are returned
 * as errors rather than guessed at.
 */
export function parseLandmarkLines(text: string): { items: LandmarkInput[]; bad: string[] } {
  const items: LandmarkInput[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/\t|,/).map((cell) => cell.trim());
    if (/^name$/i.test(cells[0] ?? "")) continue;
    const [name, category, lat, lng, locality] = cells;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!name || !category || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !lat || !lng) {
      bad.push(line);
      continue;
    }
    items.push({ name, category, latitude, longitude, locality: locality || null, source: "Imported" });
  }
  return { items, bad };
}
