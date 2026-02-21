import Sidebar from "@/components/layout/Sidebar";
import { RefreshProvider } from "@/components/layout/RefreshContext";
import { ToastProvider } from "@/components/layout/ToastContext";
import { DragProvider } from "@/components/layout/DragContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RefreshProvider>
      <ToastProvider>
        <DragProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </DragProvider>
      </ToastProvider>
    </RefreshProvider>
  );
}
