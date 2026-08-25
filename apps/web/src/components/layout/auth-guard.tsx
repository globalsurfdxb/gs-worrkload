"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tokens = useAuthStore((s) => s.tokens);
  // Must start `false` unconditionally — `useAuthStore.persist` only exists
  // client-side; touching it during Next's server render throws.
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
    setHasHydrated(useAuthStore.persist.hasHydrated());
    return unsub;
  }, []);

  useEffect(() => {
    if (hasHydrated && !tokens?.accessToken) {
      router.replace("/login");
    }
  }, [hasHydrated, tokens?.accessToken, router]);

  if (!hasHydrated || !tokens?.accessToken) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return <>{children}</>;
}
