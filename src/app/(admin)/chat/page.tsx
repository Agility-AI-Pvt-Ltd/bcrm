import type { Metadata } from "next";
import ChatPage from "@/components/support/ChatPage";

export const metadata: Metadata = {
  title: "Chat | EstateFlow",
  description: "Support chat workspace",
};

export default function Page() {
  return <ChatPage />;
}
