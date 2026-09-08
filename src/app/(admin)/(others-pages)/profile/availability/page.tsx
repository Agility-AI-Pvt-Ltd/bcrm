import AvailabilityForm from "@/components/user-profile/AvailabilityForm";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Availability | EstateFlow",
  description: "Choose when customers reach you and when the AI answers for you",
};

export default function AvailabilityPage() {
  return <AvailabilityForm />;
}
