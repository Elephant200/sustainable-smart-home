import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl p-8 text-center">
      <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">
        Sustainable Smart Home
      </h1>
      <p className="text-xl text-muted-foreground mb-8">
        Build a smarter, greener future for your home
      </p>
      
      {user ? (
        <Button asChild size="lg" className="text-lg px-8 py-6">
          <Link href="/app">Dashboard</Link>
        </Button>
      ) : (
        <Button asChild size="lg" className="text-lg px-8 py-6">
          <Link href="/auth/sign-up">Get Started</Link>
        </Button>
      )}
    </div>
  );
}
