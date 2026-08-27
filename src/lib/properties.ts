import { apiFetch } from "@/lib/api";

export type PropertyStatus = "Available" | "Reserved" | "Sold";
export type PropertyListingType = "Sale" | "Rent";

export type NearbyPlace = {
  name: string;
  category?: string | null;
  distance?: string | null;
};

export type PropertyRecord = {
  id: string;
  organization_id: string;
  title: string;
  location: string;
  property_type: string;
  price_label: string;
  price_amount: string | number | null;
  listing_type: PropertyListingType | string;
  rent_per_month: string | number | null;
  security_deposit: string | number | null;
  status: PropertyStatus | string;
  description: string | null;
  bhk: string | null;
  furnishing: string | null;
  carpet_area: string | null;
  facing: string | null;
  possession: string | null;
  brokerage: string | null;
  amenities: string[];
  nearby_places: NearbyPlace[];
  image_urls: string[];
  created_at: string;
  updated_at: string;
};

export type PropertyStats = {
  active_listings: number;
  new_this_month: number;
  reserved: number;
  sold_this_quarter: number;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export async function listProperties(page = 1, pageSize = 50) {
  return apiFetch<PageResult<PropertyRecord>>(
    `/api/v1/properties?page=${page}&page_size=${pageSize}`,
  );
}

export async function getPropertyStats() {
  return apiFetch<PropertyStats>("/api/v1/properties/stats");
}

export const PROPERTY_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  location: "Location",
  property_type: "Property type",
  bhk: "BHK",
  listing_type: "Listing type",
  price_label: "Price label",
  price_amount: "Price amount",
  rent_per_month: "Monthly rent",
  security_deposit: "Security deposit",
  status: "Status",
  furnishing: "Furnishing",
  carpet_area: "Carpet area",
  facing: "Facing",
  possession: "Possession",
  brokerage: "Brokerage",
  amenities: "Amenities",
  description: "Description",
  image_urls: "Image URLs",
};

export type PropertyImportColumn = {
  column: string;
  field: string | null;
  confidence: number;
  status: string;
  reason: string;
  source: string;
  examples?: string[];
  dtype?: string | null;
};

export type PropertyImportAnalyze = {
  file_name: string;
  source_type: string;
  source_rows: number;
  source_columns: number;
  columns: PropertyImportColumn[];
  allowed_fields: string[];
  preview: Array<Record<string, unknown>>;
  preview_skipped: number;
  ready: boolean;
  llm: {
    used: boolean;
    provider?: string | null;
    reason?: string;
    suggestions?: number;
  };
};

export type PropertyImportCommit = {
  file_name: string;
  source_rows: number;
  imported: number;
  skipped: number;
  column_mapping: Record<string, string | null>;
  stats: {
    rent: number;
    sale: number;
    bhk: Record<string, number>;
    areas: Record<string, number>;
  };
  note: string;
  note_source: string;
  ids: string[];
};

export async function analyzePropertyImport(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<PropertyImportAnalyze>("/api/v1/properties/import/analyze", {
    method: "POST",
    body,
  });
}

export async function commitPropertyImport(
  file: File,
  columnMapping: Record<string, string | null>,
) {
  const body = new FormData();
  body.append("file", file);
  body.append("column_mapping", JSON.stringify(columnMapping));
  return apiFetch<PropertyImportCommit>("/api/v1/properties/import/commit", {
    method: "POST",
    body,
  });
}

export function formatPropertyPrice(property: PropertyRecord) {
  const label = (property.price_label || "").trim();
  if (label) return label;
  if (property.rent_per_month != null && property.rent_per_month !== "") {
    const amount = Number(property.rent_per_month);
    if (!Number.isNaN(amount)) {
      return `₹${amount.toLocaleString("en-IN")}/month`;
    }
  }
  return "—";
}

export function propertyStatusLabel(status: string | null | undefined) {
  const raw = (status || "").trim();
  if (!raw) return "Unknown";
  const named: Record<string, string> = {
    AVAILABLE: "Available",
    RESERVED: "Reserved",
    SOLD: "Sold",
  };
  return named[raw.toUpperCase()] || raw;
}
