import EditProfileForm from "@/components/user-profile/EditProfileForm";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Edit profile | EstateFlow",
  description: "Manage your personal and office profile details",
};

export default function ProfilePage() {
  return <EditProfileForm />;
}
