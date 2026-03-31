"use client";

import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

import RealTimeTriggers from "@/components/RealTimeTriggers";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [user, authLoading, router]);

    if (authLoading || !user) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex bg-background min-h-screen">
            <RealTimeTriggers />
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 ml-64">
                <Topbar />
                <main className="p-8 w-full">
                    {children}
                </main>
            </div>
        </div>
    );
}
