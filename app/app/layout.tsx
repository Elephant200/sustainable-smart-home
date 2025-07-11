import { AuthButton } from "@/components/auth/auth-button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>Sustainable Smart Home</Link>
            </div>
            <AuthButton />
          </div>
        </nav>
        
        {children}

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p className="text-muted-foreground">
            Build your sustainable future
          </p>
        </footer>
      </div>
    </main>
  );
}
