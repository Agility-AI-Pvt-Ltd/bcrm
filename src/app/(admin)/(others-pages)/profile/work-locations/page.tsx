import WorkLocationsForm from "@/components/user-profile/WorkLocationsForm";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Work locations | EstateFlow",
  description: "Manage cities and areas where you operate",
};

export default function WorkLocationsPage() {
  return <WorkLocationsForm />;
}
