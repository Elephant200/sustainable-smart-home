import { SignUpForm } from "@/components/auth/sign-up-form";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-10">
        <DisclaimerBanner />
      </div>
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
