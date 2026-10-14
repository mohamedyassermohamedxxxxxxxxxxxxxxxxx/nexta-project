"use client";

import { usePathname } from "next/navigation";
import AdminNavbar from "@/components/AdminNavbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const useOperationsTheme =
    pathname === "/admin" || pathname === "/organizer" || pathname === "/settings" || pathname?.startsWith("/patient/");

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className={`flex min-h-screen flex-col ${useOperationsTheme ? "operations-theme" : ""}`}>
      <AdminNavbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
