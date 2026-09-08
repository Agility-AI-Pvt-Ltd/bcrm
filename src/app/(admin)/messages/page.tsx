import type { Metadata } from "next";
import { Suspense } from "react";
import MessagesWorkspace from "@/components/messages/MessagesWorkspace";

export const metadata: Metadata = {
  title: "Messages | EstateFlow",
  description:
    "Read every AI message and customer reply, see how interested each customer is, and message them yourself.",
};

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading messages…</p>}>
      <MessagesWorkspace />
    </Suspense>
  );
}
