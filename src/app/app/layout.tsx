import { clerkConfigured } from "@/server/auth-public";
import { AppBarProvider } from "@/client/components/AppBarContext";
import { AppBar } from "@/client/components/AppBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const authOn = clerkConfigured();
  return (
    <AppBarProvider>
      <div className="min-h-screen">
        <AppBar authOn={authOn} />
        {children}
      </div>
    </AppBarProvider>
  );
}
