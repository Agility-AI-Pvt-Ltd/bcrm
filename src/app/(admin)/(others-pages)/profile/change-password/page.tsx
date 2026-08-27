import ChangePasswordForm from "@/components/user-profile/ChangePasswordForm";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Change password | EstateFlow",
  description: "Update your EstateFlow sign-in password",
};

export default function ChangePasswordPage() {
  return <ChangePasswordForm />;
}
