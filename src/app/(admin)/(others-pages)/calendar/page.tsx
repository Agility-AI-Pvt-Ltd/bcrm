import Calendar from "@/components/calendar/Calendar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Visit calendar | EstateFlow",
  description:
    "Site visits on a grid: the week at a glance, where the free slots are, and what is already booked.",
};
export default function page() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Visit calendar" />
      <Calendar />
    </div>
  );
}
