import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | EstateAdmin",
  description: "Create your EstateAdmin account",
};

export default function SignUp() {
  return <SignUpForm />;
}
