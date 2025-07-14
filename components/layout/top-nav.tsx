import { AuthButton } from "@/components/auth/auth-button";
import Link from "next/link";
import Image from "next/image";

const TopNav = () => {
  return (
    <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
      <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
        <div className="flex gap-5 items-center font-semibold">
          <Link href={"/"} className="flex items-center gap-2">
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
        <AuthButton />
      </div>
    </nav>
  );
};

export { TopNav }; 