import { AuthButton } from "@/components/auth/auth-button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

function DeletedMessage({ searchParams }: { searchParams: { deleted?: string } }) {
  if (!searchParams.deleted) return null;
  
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4 max-w-2xl">
      <p className="text-sm text-green-800">
        ✅ Your account has been successfully deleted. Thank you for using Sustainable Smart Home.
      </p>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: { deleted?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>Sustainable Smart Home</Link>
            </div>
            <AuthButton />
          </div>
        </nav>
        
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl p-8 text-center">
          <Suspense fallback={null}>
            <DeletedMessage searchParams={searchParams} />
          </Suspense>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">
            Sustainable Smart Home
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Build a smarter, greener future for your home
          </p>
          
          {user ? (
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/auth/sign-up">Get Started</Link>
            </Button>
          )}
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
          <p className="text-muted-foreground">
            Build your sustainable future
          </p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
