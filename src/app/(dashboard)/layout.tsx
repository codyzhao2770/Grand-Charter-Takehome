import Sidebar from "@/components/layout/Sidebar";
import { RefreshProvider } from "@/components/layout/RefreshContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RefreshProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </RefreshProvider>
  );
}
