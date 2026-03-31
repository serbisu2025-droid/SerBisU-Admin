"use client";

import { Bell, Search, User, ChevronDown, X, Check, CheckCircle2, AlertTriangle, Info, LogOut } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, where, updateDoc, doc, addDoc, serverTimestamp, getDocs, writeBatch } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "firebase/auth";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    createdAt: any;
}

const Topbar = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const [notificationLimit, setNotificationLimit] = useState(10);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        if (!user) return;

        // Fetch all notifications for admins (removed targetRole filter to include legacy docs)
        const q = query(
            collection(db, "admin_notifications"),
            orderBy("createdAt", "desc"),
            limit(notificationLimit + 1) // Fetch one extra to check for more
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs;
            const more = docs.length > notificationLimit;
            const data = (more ? docs.slice(0, notificationLimit) : docs).map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];

            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
            setHasMore(more);
        }, (error) => {
            console.warn("Notification listener error:", error);
        });

        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setShowProfileDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            unsubscribe();
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [user, notificationLimit]);

    const seedWelcome = async () => {
        try {
            const snap = await getDocs(collection(db, "admin_notifications"));
            if (snap.empty) {
                await addDoc(collection(db, "admin_notifications"), {
                    title: "Welcome to SerBisU",
                    message: "System monitoring initialized. Real-time updates active.",
                    type: "success",
                    read: false,
                    targetRole: "all",
                    createdAt: serverTimestamp()
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        seedWelcome();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, "admin_notifications", id), { read: true });
        } catch (error) {
            console.error("Error marking read:", error);
        }
    };

    const markAllRead = async () => {
        try {
            const batch = writeBatch(db);
            notifications.filter(n => !n.read).forEach(n => {
                const ref = doc(db, "admin_notifications", n.id);
                batch.update(ref, { read: true });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error marking all read:", error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/');
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-4 h-4 text-success" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            case 'error': return <AlertTriangle className="w-4 h-4 text-error" />;
            default: return <Info className="w-4 h-4 text-primary" />;
        }
    };

    const getTimeAgo = (timestamp: any) => {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((new Date().getTime() - date.getTime()) / 60000);
        if (diff < 1) return 'Just now';
        if (diff < 60) return `${diff}m ago`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 sticky top-0 z-40">
            <div className="relative w-96">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-light">
                    <Search className="w-5 h-5" />
                </span>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    placeholder="Search..."
                />
            </div>

            <div className="flex items-center gap-6">
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative text-text-light hover:text-primary transition-colors p-1"
                    >
                        <Bell className="w-6 h-6" />
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 bg-error text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-border/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-background/50">
                                <h3 className="text-sm font-black text-text uppercase tracking-wider">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="text-[10px] font-bold text-primary hover:text-primary-light transition-colors"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {notifications.length > 0 ? (
                                    <>
                                        {notifications.map((n) => (
                                            <div
                                                key={n.id}
                                                onClick={() => markAsRead(n.id)}
                                                className={`p-4 border-b border-border/30 hover:bg-background/50 transition-colors cursor-pointer group ${!n.read ? 'bg-primary/5' : ''}`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.read ? 'bg-white shadow-sm' : 'bg-background'}`}>
                                                        {getIcon(n.type)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className={`text-xs font-bold ${!n.read ? 'text-text' : 'text-text-light'}`}>{n.title}</p>
                                                            <span className="text-[9px] font-bold text-text-light/60">{getTimeAgo(n.createdAt)}</span>
                                                        </div>
                                                        <p className="text-[11px] text-text-light leading-relaxed whitespace-pre-wrap">{n.message}</p>
                                                    </div>
                                                    {!n.read && (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {hasMore && (
                                            <button
                                                onClick={() => setNotificationLimit(prev => prev + 10)}
                                                className="w-full p-3 text-[10px] font-black text-primary uppercase hover:bg-background transition-all"
                                            >
                                                View Older Notifications
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="p-8 text-center text-text-light/50 text-xs">
                                        No notifications
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={profileRef}>
                    <div
                        className="flex items-center gap-3 cursor-pointer group hover:bg-background/80 p-1.5 pr-3 rounded-2xl transition-all"
                        onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    >
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors overflow-hidden border-2 border-transparent group-hover:border-primary/20">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt={user.fullName} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-6 h-6" />
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-text group-hover:text-primary transition-colors">
                                {user?.fullName || 'Administrator'}
                            </span>
                            <ChevronDown className={cn("w-4 h-4 text-text-light transition-transform", showProfileDropdown && "rotate-180")} />
                        </div>
                    </div>

                    {showProfileDropdown && (
                        <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-border/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-border/30 bg-background/30">
                                <p className="text-xs font-black text-text uppercase truncate">{user?.fullName}</p>
                                <p className="text-[10px] font-bold text-text-light/60 truncate">{user?.email}</p>
                                <span className="mt-2 inline-block px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase rounded-full border border-primary/20">
                                    {user?.role?.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="p-2">
                                <button
                                    onClick={() => router.push('/settings')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-black uppercase text-text-light hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                >
                                    <User className="w-4 h-4" />
                                    Profile Settings
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-black uppercase text-error hover:bg-error/5 rounded-xl transition-all"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Topbar;
