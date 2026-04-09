import DashboardLayout from "@/components/DashboardLayout";

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
