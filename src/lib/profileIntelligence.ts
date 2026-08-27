import { apiFetch } from "@/lib/api";
import { cacheStoredUser, type AuthUser } from "@/lib/auth";

export type ProfileProposal = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  office_phone?: string | null;
  address?: string | null;
  office_address?: string | null;
  bio?: string | null;
  work_locations?: string[];
};

export type ProfileFieldDiff = {
  field: string;
  label: string;
  current: string | string[] | null;
  proposed: string | string[] | null;
  confidence: number;
  changed: boolean;
};

export type ProfileAnalyzeResult = {
  status: "ready" | "empty" | "error" | string;
  summary: string;
  highlights: string[];
  proposed: ProfileProposal;
  field_diffs: ProfileFieldDiff[];
  field_confidence: Record<string, number>;
  source_meta: Record<string, unknown>;
  llm: Record<string, unknown>;
  message: string;
};

export type ProfileApplyResult = {
  message: string;
  applied_fields: string[];
  profile: AuthUser;
};

export type ProfileFocus = "profile" | "locations" | "both";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",", 1)[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function detectContentType(file: File): "pdf" | "excel" | "csv" | "text" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xlsm") ||
    name.endsWith(".xls") ||
    file.type.includes("spreadsheet")
  ) {
    return "excel";
  }
  if (name.endsWith(".csv") || file.type === "text/csv") return "csv";
  return "text";
}

export async function analyzeProfileIntelligence(input: {
  text?: string;
  file?: File | null;
  focus?: ProfileFocus;
}) {
  const focus = input.focus || "both";
  if (input.file) {
    const contentType = detectContentType(input.file);
    if (contentType === "text" || contentType === "csv") {
      const text = await input.file.text();
      return apiFetch<ProfileAnalyzeResult>("/api/v1/agents/profile-intelligence/analyze", {
        method: "POST",
        body: JSON.stringify({
          focus,
          file_name: input.file.name,
          content_type: contentType,
          ...(contentType === "csv" ? { raw_csv: text } : { text }),
        }),
      });
    }
    const file_base64 = await fileToBase64(input.file);
    return apiFetch<ProfileAnalyzeResult>("/api/v1/agents/profile-intelligence/analyze", {
      method: "POST",
      body: JSON.stringify({
        focus,
        file_name: input.file.name,
        content_type: contentType,
        file_base64,
      }),
    });
  }

  return apiFetch<ProfileAnalyzeResult>("/api/v1/agents/profile-intelligence/analyze", {
    method: "POST",
    body: JSON.stringify({
      focus,
      text: input.text || "",
      content_type: "text",
    }),
  });
}

export async function applyProfileIntelligence(payload: {
  profile: ProfileProposal;
  selected_fields: string[];
  merge_work_locations?: "replace" | "union";
}) {
  const result = await apiFetch<ProfileApplyResult>(
    "/api/v1/agents/profile-intelligence/apply",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  // The agent writes the user row server-side, so without this the cached copy
  // behind the header stays stale exactly the way a profile save used to.
  cacheStoredUser(result.profile);
  return result;
}
