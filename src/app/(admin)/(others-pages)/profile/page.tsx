import AccountSpendCard from "@/components/billing/AccountSpendCard";
import EditProfileForm from "@/components/user-profile/EditProfileForm";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Edit profile | EstateFlow",
  description: "Manage your personal and office profile details",
};

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <EditProfileForm />
      {/* What this account has cost, under the details it belongs to. */}
      <AccountSpendCard />
    </div>
  );
}
