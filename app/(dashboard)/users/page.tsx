"use client";


import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, Timestamp, deleteDoc, doc } from "firebase/firestore";

// Fix #8: Normalize names to title case
function toTitleCase(str?: string): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
import {
    Search,
    Trash2,
    MoreVertical,
    Mail,
    Phone,
    Filter,
    UserCheck,
    UserX,
    Loader2,
    Download,
    RefreshCw,
    Users,
    Activity,
    MapPin,
    Calendar,
    ChevronLeft,
    ChevronRight,
    MapPinned
} from "lucide-react";
// Removed unused Image import

interface Homeowner {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    phoneNumber?: string;
    phone?: string;
    status?: string;
    isOnline?: boolean;
    lastSeen?: any;
    location?: any;
    createdAt?: any;
    profileImageUrl?: string;
}

export default function UsersPage() {
    const [allUsers, setAllUsers] = useState<Homeowner[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "homeowners"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Homeowner[];
            setAllUsers(usersData);
            setLoading(false);
        }, (error) => {
            console.error("Error listening to homeowners:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Stats Calculations
    const stats = useMemo(() => {
        const total = allUsers.length;
        const online = allUsers.filter(u => u.isOnline).length;

        const locations = new Set();
        allUsers.forEach(u => {
            const loc = u.location?.address || u.location?.formatted_address || u.location;
            if (loc && typeof loc === 'string') locations.add(loc);
        });

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const newThisMonth = allUsers.filter(u => {
            if (!u.createdAt) return false;
            const date = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
            return date >= startOfMonth;
        }).length;

        return { total, online, locations: locations.size, newThisMonth };
    }, [allUsers]);

    const filteredUsers = useMemo(() => {
        return allUsers.filter(user => {
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
            const email = (user.email || "").toLowerCase();
            const phone = (user.mobileNumber || user.phoneNumber || user.phone || "").toLowerCase();
            const search = searchTerm.toLowerCase();

            return fullName.includes(search) ||
                email.includes(search) ||
                phone.includes(search) ||
                user.id.toLowerCase().includes(search);
        });
    }, [allUsers, searchTerm]);

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const exportToCSV = () => {
        const headers = ["Name", "Email", "Phone", "Location", "Joined Date", "Status"];
        const rows = allUsers.map(user => [
            `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            user.email || "N/A",
            user.mobileNumber || user.phoneNumber || user.phone || "N/A",
            user.location?.address || user.location || "N/A",
            user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : (user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"),
            user.isOnline ? "Online" : "Offline"
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `homeowners_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatLastSeen = (timestamp: any) => {
        if (!timestamp) return "Never";
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60); // minutes

            if (diff < 1) return "Just now";
            if (diff < 60) return `${diff}m ago`;
            if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
            return date.toLocaleDateString();
        } catch (e) {
            return "N/A";
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (confirm("Are you sure you want to delete this homeowner? This action cannot be undone.")) {
            try {
                await deleteDoc(doc(db, "homeowners", userId));
            } catch (error) {
                console.error("Error deleting user:", error);
                alert("Failed to delete user.");
            }
        }
    };

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase">
                        Homeowner Management
                    </h1>
                    <p className="text-sm font-bold text-text-light/60 uppercase tracking-widest mt-1">Manage platform users and view their activity</p>
                    <div className="h-1.5 w-24 bg-gradient-to-r from-primary via-accent to-transparent rounded-full mt-3"></div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-6 py-3 bg-success text-white rounded-2xl text-xs font-black uppercase transition-all hover:scale-105 active:scale-95 shadow-xl shadow-success/20"
                    >
                        <Download className="w-4 h-4" />
                        Export Data
                    </button>
                    <button
                        onClick={() => { }}
                        className="p-3 bg-white border border-border/50 rounded-2xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm active:scale-90"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <StatCard
                    title="Homeowners"
                    value={stats.total}
                    icon={<Users className="w-6 h-6" />}
                    color="bg-primary"
                    desc="Total Registered Users"
                />
                <StatCard
                    title="In Use"
                    value={stats.online}
                    icon={<Activity className="w-6 h-6" />}
                    color="bg-success"
                    desc="Currently Active Sessions"
                    onlineCount
                />
                <StatCard
                    title="Locations"
                    value={stats.locations}
                    icon={<MapPin className="w-6 h-6" />}
                    color="bg-accent"
                    desc="Unique Geo-Coordinates"
                />
                <StatCard
                    title="Network Ops"
                    value={stats.newThisMonth}
                    icon={<Calendar className="w-6 h-6" />}
                    color="bg-purple-600"
                    desc="New Monthly Onboarding"
                />
            </div>

            {/* Table Control */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 overflow-hidden">
                <div className="p-8 border-b border-border/10 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-background/30">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                        <input
                            type="text"
                            placeholder="Identify homeowner (Name, Email, ID)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border-2 border-border/30 rounded-[1.5rem] text-sm font-bold focus:outline-none focus:border-primary/40 transition-all placeholder:text-text-light/40 shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-light">
                        <Filter className="w-4 h-4" />
                        Displaying {filteredUsers.length} Users
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-primary/10">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-background/80 backdrop-blur-sm sticky top-0 z-10 text-text-light text-[10px] uppercase font-black tracking-[0.2em]">
                            <tr>
                                <th className="px-8 py-6 border-b border-border/20">User Info</th>
                                <th className="px-8 py-6 border-b border-border/20">Contact Info</th>
                                <th className="px-8 py-6 border-b border-border/20">Location</th>
                                <th className="px-8 py-6 border-b border-border/20">Joined Date</th>
                                <th className="px-8 py-6 border-b border-border/20">Status</th>
                                <th className="px-8 py-6 border-b border-border/20 text-right">Ops</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-32 text-center text-text-light/40 font-black uppercase tracking-widest">Synchronizing active homeowners...</td>
                                </tr>
                            ) : paginatedUsers.length > 0 ? (
                                paginatedUsers.map((user) => (
                                    <tr key={user.id} className="group hover:bg-primary/[0.02] transition-all">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    {user.profileImageUrl ? (
                                                        <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg group-hover:scale-110 transition-transform">
                                                            <img
                                                                src={user.profileImageUrl}
                                                                alt={user.firstName}
                                                                className="w-full h-full object-cover"
                                                                onError={(e: any) => { e.target.src = "https://ui-avatars.com/api/?name=" + (user.firstName || 'U'); }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black uppercase group-hover:scale-110 transition-transform shadow-lg border-2 border-primary/5">
                                                            {user.firstName?.[0] || user.lastName?.[0] || 'U'}
                                                        </div>
                                                    )}
                                                    {user.isOnline && (
                                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-4 border-white animate-pulse"></div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-text uppercase tracking-tighter group-hover:text-primary transition-colors">
                                                        {toTitleCase(user.firstName)} {toTitleCase(user.lastName)}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[11px] font-bold text-text-light">
                                                    <Mail className="w-3.5 h-3.5 text-primary opacity-50" />
                                                    {user.email || 'NODATA@NULL'}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] font-bold text-text-light">
                                                    <Phone className="w-3.5 h-3.5 text-primary opacity-50" />
                                                    {user.mobileNumber || user.phoneNumber || user.phone || 'NO_PHON'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-[11px] font-black text-text-light uppercase tracking-tight">
                                                <MapPinned className="w-4 h-4 text-accent" />
                                                <span className="line-clamp-1">{user.location?.address || user.location || 'Unknown Deployment'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-[11px] font-black text-text-light uppercase">
                                                {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'ARCHIVE')}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border-2 w-fit mb-1 shadow-sm ${user.isOnline
                                                    ? 'bg-success/10 border-success/30 text-success'
                                                    : 'bg-text/5 border-text/20 text-text/50'
                                                    }`}>
                                                    {user.isOnline ? 'Active' : 'Inactive'}
                                                </span>
                                                <span className="text-[8px] font-bold text-text-light/40 uppercase tracking-tighter">
                                                    Seen: {formatLastSeen(user.lastSeen)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2.5 bg-background border border-border/50 rounded-xl text-text-light hover:text-primary hover:border-primary/50 transition-all active:scale-90">
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-2.5 bg-background border border-border/50 rounded-xl text-error/60 hover:text-error hover:border-error/50 transition-all active:scale-90"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-32 text-center text-text-light/50 font-black uppercase tracking-[0.2em]">No users found matching your search</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Matrix */}
                {totalPages > 1 && (
                    <div className="p-8 border-t border-border/10 flex items-center justify-between bg-background/30">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-light/60">
                            Page {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="w-10 h-10 flex items-center justify-center bg-white border-2 border-border/30 rounded-xl text-text disabled:opacity-30 hover:border-primary transition-all active:scale-90 shadow-sm"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-2">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 flex items-center justify-center text-[10px] font-black rounded-xl transition-all shadow-sm ${currentPage === page
                                            ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20'
                                            : 'bg-white border-2 border-border/30 text-text hover:border-primary'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="w-10 h-10 flex items-center justify-center bg-white border-2 border-border/30 rounded-xl text-text disabled:opacity-30 hover:border-primary transition-all active:scale-90 shadow-sm"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function StatCard({ title, value, icon, color, desc, onlineCount }: any) {
    return (
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-border/40 hover:shadow-2xl transition-all group overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-all duration-700 ${color}`}></div>
            <div className="relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform ${color} ${onlineCount ? 'animate-pulse' : ''}`}>
                    {icon}
                </div>
                <div className="flex flex-col">
                    <p className="text-[10px] font-black text-text-light/50 uppercase tracking-[0.2em] mb-1">{title}</p>
                    <h3 className="text-4xl font-black text-text tracking-tighter">{value}</h3>
                    <div className="h-0.5 w-10 bg-border/40 my-4 group-hover:w-20 transition-all duration-500"></div>
                    <p className="text-[9px] font-black text-text-light/40 uppercase tracking-tighter">{desc}</p>
                </div>
            </div>
        </div>
    );
}
