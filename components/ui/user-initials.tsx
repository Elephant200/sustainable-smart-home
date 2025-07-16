import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

interface UserInitialsAvatarProps {
  user: User;
  className?: string;
}

export function UserInitialsAvatar({ user, className }: UserInitialsAvatarProps) {
  const initials = `${user.user_metadata?.first_name?.charAt(0) || ''}${user.user_metadata?.last_name?.charAt(0) || ''}`.trim();

  return (
    <div className={cn("h-8 w-8 rounded-full bg-muted flex items-center justify-center", className)}>
      <span className="text-sm font-medium text-foreground">{initials}</span>
    </div>
  );
} 