"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Home,
    Users,
    Toolbox,
    ClipboardList,
    ChartLine,
    MessageSquare,
    Headset,
    Settings,
    LogOut,
    ShieldCheck
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { canAccessRoute, getRoleDisplayName } from "@/lib/rbac";

const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();

    const allMenuItems = [
        { title: "Dashboard", icon: <Home className="w-5 h-5" />, path: "/dashboard" },
        { title: "Homeowners", icon: <Users className="w-5 h-5" />, path: "/users" },
        { title: user?.role === 'super_admin' ? "Verification" : "PESO Verification", icon: <ShieldCheck className="w-5 h-5" />, path: "/skilled-workers" },
        { title: "Skilled Workers", icon: <Toolbox className="w-5 h-5" />, path: "/view-workers" },
        { title: "Bookings", icon: <ClipboardList className="w-5 h-5" />, path: "/bookings" },
        { title: "Logs", icon: <ClipboardList className="w-5 h-5" />, path: "/logs" },
        { title: "Analytics", icon: <ChartLine className="w-5 h-5" />, path: "/analytics" },
        { title: "SMS Announcements", icon: <MessageSquare className="w-5 h-5" />, path: "/sms" },
        { title: "Support Requests", icon: <Headset className="w-5 h-5" />, path: "/support" },
        { title: "Settings", icon: <Settings className="w-5 h-5" />, path: "/settings" },
    ];

    // Filter menu items based on user role
    const menuItems = user ? allMenuItems.filter(item => canAccessRoute(user.role, item.path)) : allMenuItems;

    const handleLogout = async () => {
        try {
            await auth.signOut();
            router.push("/");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <aside className="fixed left-0 top-0 w-64 h-screen bg-primary text-white flex flex-col z-50">
            <div className="p-6">
                <h2 className="text-2xl font-bold">SerBisU</h2>
                <p className="text-primary-light text-sm">Admin Portal</p>
            </div>

            {/* Role Badge */}
            {user && (
                <div className="mx-4 mb-4 px-4 py-3 bg-white/10 rounded-xl border border-white/20">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-4 h-4 text-accent" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-white/60">Role</span>
                    </div>
                    <p className="text-sm font-bold text-white">{getRoleDisplayName(user.role)}</p>
                    {user.fullName && (
                        <p className="text-xs text-white/70 mt-1 truncate">{user.fullName}</p>
                    )}
                </div>
            )}

            <nav className="flex-1 px-4 py-4 overflow-y-auto no-scrollbar">
                <ul className="space-y-2">
                    {menuItems.map((item) => (
                        <li key={item.path}>
                            <Link
                                href={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${pathname === item.path
                                    ? "bg-primary-light text-white"
                                    : "text-white/80 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                {item.icon}
                                <span className="font-medium">{item.title}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="p-4 border-t border-white/10">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-white/80 hover:text-white transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                </button>
                <p className="text-center text-xs text-white/40 mt-4">© 2026 SerBisU</p>
            </div>
        </aside>
    );
};

export default Sidebar;
