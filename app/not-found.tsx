import { TopNav } from "@/components/layout/top-nav";
import { NotFoundContent } from "@/components/layout/not-found-content";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <NotFoundContent />
    </div>
  );
}