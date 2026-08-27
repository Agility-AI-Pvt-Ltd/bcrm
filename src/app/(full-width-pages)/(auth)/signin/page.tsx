import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | EstateAdmin",
  description: "Sign in to EstateAdmin",
};

export default function SignIn() {
  return <SignInForm />;
}
