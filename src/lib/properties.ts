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
  /** Walkthrough videos. A buyer asks for one by name, and it is not a photo. */
  video_urls: string[];
  // --- trust signals ---
  /** When a *person* last confirmed this is still available at this price. */
  verified_at: string | null;
  verified_by_user_id: string | null;
  /** As given by the seller. We do not check it with the RERA authority. */
  rera_number: string | null;
  carpet_area_sqft: number | null;
  builtup_area_sqft: number | null;
  super_area_sqft: number | null;
  maintenance_monthly: string | number | null;
  /** One-time charges on a sale: {"Covered parking": "300000"}. */
  other_charges: Record<string, string>;
  /** "sheet" for listings mirrored from a connected spreadsheet. */
  source: "manual" | "sheet" | "import" | string;
  sheet_connection_id: string | null;
  /** Spreadsheet columns that map to no field; searched by the bot as-is. */
  extra_fields: Record<string, string>;
  last_synced_at: string | null;
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

/** The dashboard tiles, each of which drills into the rows it counted. */
export type PropertyView =
  | "all"
  | "active"
  | "new-this-month"
  | "reserved"
  | "sold";

export const PROPERTY_VIEW_LABELS: Record<PropertyView, string> = {
  all: "All properties",
  active: "Active listings",
  "new-this-month": "New this month",
  reserved: "Reserved",
  sold: "Sold this quarter",
};

/** Which stat on the Properties page each view corresponds to. */
export const PROPERTY_VIEW_STAT: Record<
  Exclude<PropertyView, "all">,
  keyof PropertyStats
> = {
  active: "active_listings",
  "new-this-month": "new_this_month",
  reserved: "reserved",
  sold: "sold_this_quarter",
};

export function isPropertyView(value: string | null): value is PropertyView {
  return (
    value === "all" ||
    value === "active" ||
    value === "new-this-month" ||
    value === "reserved" ||
    value === "sold"
  );
}

export async function listProperties(page = 1, pageSize = 50) {
  return apiFetch<PageResult<PropertyRecord>>(
    `/api/v1/properties?page=${page}&page_size=${pageSize}`,
  );
}

/**
 * Rows behind one dashboard tile. The server derives the filter from the same
 * predicate that produced the tile's number, so the total here always matches
 * the card the user clicked.
 */
export async function listPropertiesByView(
  view: PropertyView,
  page = 1,
  pageSize = 25,
) {
  const params = new URLSearchParams({
    view,
    page: String(page),
    page_size: String(pageSize),
  });
  return apiFetch<PageResult<PropertyRecord>>(`/api/v1/properties?${params}`);
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
  video_urls: "Video URLs",
  rera_number: "RERA number",
  maintenance_monthly: "Monthly maintenance",
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


// ---------------------------------------------------------------------------
// Trust signals
// ---------------------------------------------------------------------------

/**
 * The four facts a buyer checks before believing a listing: when a person last
 * confirmed it, its RERA number, its carpet area, and what it actually costs.
 *
 * The rates behind the all-in cost are the agency's own. Nothing is assumed on
 * their behalf — stamp duty varies by state and by the buyer's gender, so a
 * national average would be wrong everywhere by lakhs. Until an agency enters its
 * rates, `missing` says so and every all-in on a card reads "from".
 */
export type TrustSettings = {
  verification_valid_days: number;
  stamp_duty_pct: string | null;
  registration_pct: string | null;
  registration_cap: string | null;
  gst_pct: string | null;
  brokerage_pct: string | null;
  rent_brokerage_months: string | null;
  show_all_in: boolean;
  show_unverified_badge: boolean;
  /** Which rates still have to be entered before an all-in can be complete. */
  missing: string[];
};

export type TrustSettingsUpdate = Partial<Omit<TrustSettings, "missing">>;

export type TrustSummary = {
  total: number;
  verified_fresh: number;
  verified_ageing: number;
  verified_stale: number;
  never_verified: number;
  with_rera: number;
  with_carpet_area: number;
  with_all_in: number;
};

export type VerificationState = "fresh" | "ageing" | "stale" | "never";

export const getTrustSettings = () =>
  apiFetch<TrustSettings>("/api/v1/properties/trust/settings");

export const saveTrustSettings = (payload: TrustSettingsUpdate) =>
  apiFetch<TrustSettings>("/api/v1/properties/trust/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getTrustSummary = () =>
  apiFetch<TrustSummary>("/api/v1/properties/trust/summary");

export const verifyProperty = (propertyId: string, verified = true) =>
  apiFetch<PropertyRecord>(`/api/v1/properties/${propertyId}/verify`, {
    method: "POST",
    body: JSON.stringify({ verified }),
  });

/**
 * How old a confirmation is allowed to get, mirroring the server's rule so the
 * screen and the customer's WhatsApp card never disagree about the same listing.
 * The last quarter of the window is amber, which is the broker's warning.
 */
export function verificationState(
  verifiedAt: string | null,
  validDays = 30,
): VerificationState {
  if (!verifiedAt) return "never";
  const at = new Date(verifiedAt);
  if (Number.isNaN(at.getTime())) return "never";
  const days = Math.max(0, Math.floor((Date.now() - at.getTime()) / 86_400_000));
  const window = Math.max(1, validDays);
  if (days > window) return "stale";
  if (days >= window * 0.75) return "ageing";
  return "fresh";
}

export function verificationLabel(verifiedAt: string | null): string {
  if (!verifiedAt) return "Not verified";
  const at = new Date(verifiedAt);
  if (Number.isNaN(at.getTime())) return "Not verified";
  const days = Math.max(0, Math.floor((Date.now() - at.getTime()) / 86_400_000));
  if (days === 0) return "Verified today";
  if (days === 1) return "Verified yesterday";
  if (days < 30) return `Verified ${days}d ago`;
  const months = Math.floor(days / 30);
  return `Verified ${months}mo ago`;
}

export const VERIFICATION_CHIP: Record<VerificationState, string> = {
  fresh: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  ageing: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  stale: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  never: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
};

/** "1,045 sq ft carpet" — and which area it actually is. */
export function areaLabel(property: PropertyRecord): string {
  if (property.carpet_area_sqft) {
    return `${Math.round(property.carpet_area_sqft).toLocaleString()} sq ft carpet`;
  }
  if (property.builtup_area_sqft) {
    return `${Math.round(property.builtup_area_sqft).toLocaleString()} sq ft built-up`;
  }
  if (property.super_area_sqft) {
    return `${Math.round(property.super_area_sqft).toLocaleString()} sq ft super`;
  }
  return property.carpet_area || "";
}

/** The number buyers argue about: advertised area minus what they can stand in. */
export function loadingPercent(property: PropertyRecord): number | null {
  const carpet = property.carpet_area_sqft;
  const sba = property.super_area_sqft;
  if (!carpet || !sba || sba < carpet) return null;
  return Math.round(((sba - carpet) / carpet) * 1000) / 10;
}

/** ₹65 L / ₹1.2 Cr / ₹25,000 — how prices are read here, not in millions. */
export function moneyLabel(value: string | number | null | undefined): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!amount || Number.isNaN(amount)) return "—";
  if (amount >= 10_000_000) return `₹${trimZeros(amount / 10_000_000)} Cr`;
  if (amount >= 100_000) return `₹${trimZeros(amount / 100_000)} L`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function trimZeros(value: number): string {
  return String(Math.round(value * 100) / 100);
}
