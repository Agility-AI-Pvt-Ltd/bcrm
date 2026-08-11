import type { Metadata } from "next";
import ChatPage from "@/components/support/ChatPage";

export const metadata: Metadata = {
  title: "Chat | RealtyReach",
  description: "Support chat workspace",
};

export default function Page() {
  return <ChatPage />;
}
