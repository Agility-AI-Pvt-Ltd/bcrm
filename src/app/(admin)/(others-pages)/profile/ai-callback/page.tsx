import { redirect } from "next/navigation";

/** Moved to the main menu; kept so old links still land on the page. */
export default function Page() {
  redirect("/ai-callback");
}
