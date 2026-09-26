import { SignIn } from "@clerk/nextjs";
import { LegalFooter } from "@/components/app/legal-footer";

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center">
        <SignIn />
      </div>
      <LegalFooter />
    </div>
  );
}
