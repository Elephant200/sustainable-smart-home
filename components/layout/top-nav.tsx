import { AuthButton } from "@/components/auth/auth-button";
import Link from "next/link";
import Image from "next/image";

interface TopNavProps {
  showScrollLinks?: boolean;
}

const TopNav = ({ showScrollLinks = false }: TopNavProps) => {
  return (
    <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16 sticky top-0 z-50 bg-white/80 backdrop-blur-md">
      <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
        <div className="flex gap-5 items-center font-semibold">
          <Link href={"/#home"} className="flex items-center gap-2">
            <Image 
              src="/favicon.ico" 
              alt="Sustainable Smart Home" 
              width={24} 
              height={24}
              className="rounded-sm"
            />
            Sustainable Smart Home
          </Link>
        </div>

        {/* Scroll Navigation for Landing Page */}
        {showScrollLinks && (
          <div className="hidden md:flex space-x-8">
            <a href="#features" className="text-gray-600 hover:text-green-600 transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-green-600 transition-colors">How It Works</a>
            <a href="#benefits" className="text-gray-600 hover:text-green-600 transition-colors">Benefits</a>
            <a href="#about" className="text-gray-600 hover:text-green-600 transition-colors">About</a>
          </div>
        )}

        <AuthButton />
      </div>
    </nav>
  );
};

export { TopNav }; 