"use client";


import { useEffect, useState, useMemo, Fragment } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";
import {
    Search,
    Download,
    RefreshCw,
    Calendar,
    ChevronLeft,
    ChevronRight,
    LogIn,
    LogOut,
    Toolbox,
    Home,
    BookmarkCheck,
    Terminal,
    Eye,
    EyeOff,
    Monitor,
    ShieldCheck,
    Loader2,
    XCircle
} from "lucide-react";

interface LogEntry {
    id: string;
    event: string;
    level: string;
    category: string;
    source: string;
    timestamp: any;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
    userDisplayInfo?: string;
    deviceId?: string;
    userType?: 'Homeowner' | 'Skilled Worker' | 'Admin';
}

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [userMap, setUserMap] = useState<Record<string, string>>({});
    const itemsPerPage = 15;

    useEffect(() => {
        const fetchUserNames = async () => {
            const map: Record<string, string> = {};

            // Fetch Admins
            try {
                const adminsSnap = await getDocs(collection(db, "admins"));
                adminsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    map[doc.id] = data.fullName || data.name || "Admin";
                });
            } catch (e) {
                console.warn("Could not fetch admin names:", e);
            }

            // Fetch Skilled Workers
            try {
                const workersSnap = await getDocs(collection(db, "skilled_workers"));
                workersSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const name = data.personalInfo?.fullName || data.fullName || "Skilled Worker";
                    map[doc.id] = name;
                });
            } catch (e) {
                console.warn("Could not fetch worker names:", e);
            }

            // Fetch Homeowners
            try {
                const homeownersSnap = await getDocs(collection(db, "homeowners"));
                homeownersSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Homeowner";
                    map[doc.id] = name;
                });
            } catch (e) {
                console.warn("Could not fetch homeowner names:", e);
            }

            setUserMap(map);
        };

        fetchUserNames();
    }, []);

    useEffect(() => {
        setLoading(true);
        let q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(1000));

        // Note: Complex combining of filters + ordering usually requires Firestore indexes.
        // For now we'll fetch a larger set and filter in memory to avoid index errors, 
        // while still supporting basic category filtering if needed.

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as LogEntry[];
            setLogs(data);
            setLoading(false);
        }, (error) => {
            console.error("Error listening to logs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const extractUserInfo = (log: LogEntry) => {
        if (log.userDisplayInfo) return log.userDisplayInfo;
        if (log.details) {
            if (log.details.displayName && log.details.displayName !== 'Unknown User') return log.details.displayName;
            if (log.details.email) return log.details.email;
            if (log.details.username) return log.details.username;
            if (log.details.user?.displayName) return log.details.user.displayName;
            if (log.details.user?.email) return log.details.user.email;
        }
        if (log.userId && log.userId !== 'Unknown') return log.userId;
        return '';
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const userInfo = extractUserInfo(log).toLowerCase();
            const searchTermLower = searchTerm.toLowerCase();
            const matchesSearch =
                log.event?.toLowerCase().includes(searchTermLower) ||
                log.userId?.toLowerCase().includes(searchTermLower) ||
                log.category?.toLowerCase().includes(searchTermLower) ||
                userInfo.includes(searchTermLower);

            const cat = log.category?.toLowerCase() || "";
            const event = log.event?.toLowerCase() || "";
            const userType = (log.userType as string)?.toLowerCase() || "";
            const level = log.level?.toUpperCase() || "INFO";

            const matchesCategory = !activeCategory ||
                (activeCategory === 'login' && event.includes('login')) ||
                (activeCategory === 'logout' && event.includes('logout')) ||
                (activeCategory === 'error' && level === 'ERROR') ||
                (activeCategory === 'homeowners' && (cat.includes('homeowner') || userType.includes('homeowner'))) ||
                (activeCategory === 'Skilled Workers' && (cat.includes('worker') || userType.includes('worker'))) ||
                (activeCategory === 'booking' && (cat.includes('booking') || event.includes('booking'))) ||
                cat === activeCategory.toLowerCase();

            let matchesDate = true;
            if (startDate || endDate) {
                const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                if (startDate && logDate < new Date(startDate)) matchesDate = false;
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (logDate > end) matchesDate = false;
                }
            }

            return matchesSearch && matchesCategory && matchesDate;
        });
    }, [logs, searchTerm, activeCategory, startDate, endDate]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeCategory, startDate, endDate]);

    const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

    const getLevelStyle = (level: string) => {
        switch (level?.toUpperCase()) {
            case 'ERROR': return 'bg-error/10 text-error border-error/20';
            case 'WARNING': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'SUCCESS': return 'bg-success/10 text-success border-success/20';
            default: return 'bg-primary/10 text-primary border-primary/20';
        }
    };

    const exportToCSV = () => {
        const headers = ["Timestamp", "Level", "Category", "Source", "Event", "IP Address", "Device ID"];
        const rows = filteredLogs.map(log => [
            log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : "N/A",
            log.level || "INFO",
            log.category || "Authentication",
            log.source || "Mobile App",
            log.event || "N/A",
            log.ipAddress || "N/A",
            log.deviceId || "N/A"
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `serbisu_logs_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const categories = [
        { id: 'login', label: 'Login', icon: <LogIn className="w-3.5 h-3.5" /> },
        { id: 'logout', label: 'Logout', icon: <LogOut className="w-3.5 h-3.5" /> },
        { id: 'Skilled Workers', label: 'Workers', icon: <Toolbox className="w-3.5 h-3.5" /> },
        { id: 'homeowners', label: 'Homeowners', icon: <Home className="w-3.5 h-3.5" /> },
        { id: 'booking', label: 'Bookings', icon: <BookmarkCheck className="w-3.5 h-3.5" /> },
        { id: 'error', label: 'Errors', icon: <XCircle className="w-3.5 h-3.5" /> },
    ];

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase">
                        <Terminal className="w-8 h-8 text-primary" />
                        System Logs
                    </h1>
                    <p className="text-sm font-bold text-text-light/60 uppercase tracking-widest mt-1">Real-time platform activity & audit logs</p>
                    <div className="h-1.5 w-24 bg-gradient-to-r from-primary via-accent to-transparent rounded-full mt-3"></div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-primary/10 rounded-2xl text-xs font-black text-primary uppercase transition-all hover:bg-primary hover:text-white hover:shadow-xl hover:shadow-primary/20 active:scale-95 shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Export Logs
                    </button>
                    <button
                        className="p-3 bg-white border border-border/50 rounded-2xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm active:scale-90"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                        <input
                            type="text"
                            placeholder="Identify event (Event, User, Category)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border-2 border-border/30 rounded-[1.5rem] text-sm font-bold focus:outline-none focus:border-primary/40 transition-all placeholder:text-text-light/40 shadow-sm"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setActiveCategory(null)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!activeCategory ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-white border border-border/50 text-text-light hover:bg-background'}`}
                        >
                            All Events
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat.id ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-white border border-border/50 text-text-light hover:bg-background'}`}
                            >
                                {cat.icon}
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-border/40 shadow-sm flex flex-col md:flex-row items-center gap-4 text-xs">
                    <div className="flex-1 w-full space-y-1">
                        <label className="text-[9px] font-black text-text-light/50 uppercase ml-2 tracking-widest">Date Range Start</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-background border border-border/50 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                        </div>
                    </div>
                    <div className="text-text-light/20 hidden md:block mt-6">—</div>
                    <div className="flex-1 w-full space-y-1">
                        <label className="text-[9px] font-black text-text-light/50 uppercase ml-2 tracking-widest">Date Range End</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-background border border-border/50 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        className="mt-6 md:mt-5 p-2.5 bg-background border border-border/50 rounded-xl text-text-light hover:text-error transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-[#F8FAFC] sticky top-0 z-10 text-[#64748B] text-[11px] uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-8 py-5 border-b border-border/10">Timestamp</th>
                                <th className="px-8 py-5 border-b border-border/10">Level</th>
                                <th className="px-8 py-5 border-b border-border/10">Category</th>
                                <th className="px-8 py-5 border-b border-border/10">Source</th>
                                <th className="px-8 py-5 border-b border-border/10">Event</th>
                                <th className="px-8 py-5 border-b border-border/10">IP Address</th>
                                <th className="px-8 py-5 border-b border-border/10">Device ID</th>
                                <th className="px-8 py-5 border-b border-border/10 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                                            <p className="text-[11px] font-black text-text-light/40 uppercase tracking-[0.2em]">Loading Logs...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedLogs.length > 0 ? (
                                paginatedLogs.map((log) => {
                                    const isLogin = log.event?.toLowerCase().includes('login');
                                    const isLogout = log.event?.toLowerCase().includes('logout');
                                    const timestamp = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
                                    const userInfo = userMap[log.userId] || extractUserInfo(log);

                                    // Replace ID in event string if present
                                    let displayEvent = log.event || "";
                                    if (displayEvent) {
                                        Object.keys(userMap).forEach(uid => {
                                            if (displayEvent.includes(uid)) {
                                                displayEvent = displayEvent.replace(uid, userMap[uid]);
                                            }
                                        });
                                    }

                                    return (
                                        <Fragment key={log.id}>
                                            <tr
                                                className={`group transition-all hover:bg-[#F8FAFC] border-b border-border/5 text-[13px] text-text-light font-medium`}
                                            >
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="">{timestamp.toLocaleDateString()}</span>
                                                        <span className="text-[11px] opacity-60">{timestamp.toLocaleTimeString()}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-fit border ${log.level?.toUpperCase() === 'ERROR'
                                                        ? 'bg-error/5 text-error border-error/10'
                                                        : 'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]'
                                                        }`}>
                                                        <span className={`w-2 h-2 rounded-full ${log.level?.toUpperCase() === 'ERROR' ? 'bg-error' : 'bg-[#2563EB]'
                                                            }`}></span>
                                                        <span className="text-[10px] font-black uppercase tracking-widest">{log.level || 'INFO'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-text font-bold">{log.category || 'Authentication'}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="px-3 py-1 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[11px] font-black uppercase tracking-tighter">
                                                        {log.source || 'Mobile App'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        {isLogin && <LogIn className="w-4 h-4 text-[#10B981]" />}
                                                        {isLogout && <LogOut className="w-4 h-4 text-[#EF4444]" />}
                                                        {!isLogin && !isLogout && <ShieldCheck className="w-4 h-4 text-primary opacity-40" />}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`font-bold ${isLogout ? 'text-[#EF4444]' : (isLogin ? 'text-[#10B981]' : 'text-text')}`}>
                                                                {displayEvent}
                                                                {userInfo && !displayEvent.toLowerCase().includes(userInfo.toLowerCase()) && userInfo !== log.userId && ` - ${userInfo}`}
                                                            </span>
                                                            {(() => {
                                                                const type = log.userType || log.details?.userType;
                                                                if (!type || type.toLowerCase() === 'unknown') return null;
                                                                return (
                                                                    <span className="px-2 py-0.5 bg-[#F3E8FF] text-[#9333EA] rounded-md text-[9px] font-bold uppercase tracking-tight">
                                                                        {type}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    {(() => {
                                                        const ip = log.ipAddress || log.details?.ipAddress || log.details?.ip;
                                                        const isKnown = ip && ip !== 'Unknown' && ip !== 'N/A';
                                                        return (
                                                            <span className={`font-mono text-[11px] ${isKnown ? 'text-[#10B981] font-black' : 'text-text-light/30 font-bold uppercase tracking-tighter'}`}>
                                                                {ip || 'Unknown'}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-8 py-5 font-mono text-[11px] opacity-60">
                                                    {log.deviceId || 'UP1A.231005.007'}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button
                                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                                        className="p-2 bg-white border border-border/50 rounded-xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm active:scale-90"
                                                    >
                                                        {expandedLog === log.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedLog === log.id && (
                                                <tr className="bg-[#F8FAFC]">
                                                    <td colSpan={8} className="px-12 py-8">
                                                        <div className="bg-[#1E293B] p-6 rounded-[1.5rem] shadow-2xl border border-white/5 relative overflow-hidden text-[#94A3B8]">
                                                            <div className="absolute top-0 right-0 p-6 opacity-5">
                                                                <Terminal className="w-24 h-24 text-white" />
                                                            </div>
                                                            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                                                <Monitor className="w-3.5 h-3.5" />
                                                                Log Details
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                <div className="space-y-4">
                                                                    <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                                                                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Network Info</p>
                                                                        <div className="flex items-center gap-2 text-xs font-mono">
                                                                            <span className="text-white/80">IP Addr:</span>
                                                                            <span className="text-[#10B981] font-bold">{log.ipAddress || '127.0.0.1'}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                                                                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Device Info</p>
                                                                        <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                                                                            {log.userAgent || 'Mozilla/5.0 (Node/v20.x)...'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                                                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Raw Event Data</p>
                                                                    <pre className="text-[9px] font-mono text-blue-300 overflow-x-auto h-[120px] scrollbar-thin scrollbar-thumb-white/5">
                                                                        {JSON.stringify(log.details || {}, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-8 py-32 text-center text-text-light/50 font-black uppercase tracking-[0.2em]">No logs found matching your criteria</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-8 border-t border-border/10 flex items-center justify-between bg-background/30">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-light/60">
                            Page {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
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
