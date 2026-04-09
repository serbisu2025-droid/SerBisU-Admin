"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import {
    Calendar,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    RefreshCw,
    Star,
    User,
    Briefcase,
    ChevronLeft,
    ChevronRight,
    Download,
    AlertCircle,
    CalendarCheck,
    CalendarX,
    Activity,
} from "lucide-react";

// Fix #8: Title case normalizer
function toTitleCase(str?: string): string {
    if (!str) return "";
    return str
        .toLowerCase()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

interface Booking {
    id: string;
    referenceNumber?: string;
    clientName?: string;
    customerName?: string;
    workerName?: string;
    workerPhone?: string;
    workerId?: string;
    worker?: { name?: string; id?: string };
    serviceType?: string;
    jobType?: string;
    serviceName?: string;
    status?: string;
    getStatus?: string;
    price?: any;
    createdAt?: any;
    scheduledDate?: any;
    completedAt?: any;
    cancelledAt?: any;
    rating?: number;
    ratingComment?: string;
    address?: string;
    location?: any;
}

const statusColors: Record<string, { bg: string; text: string; border: string; glow: string; icon: any }> = {
    pending: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-l-amber-400",
        glow: "shadow-amber-100",
        icon: Clock,
    },
    confirmed: {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-l-blue-400",
        glow: "shadow-blue-100",
        icon: CalendarCheck,
    },
    "in-progress": {
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-l-purple-400",
        glow: "shadow-purple-100",
        icon: Activity,
    },
    completed: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-l-emerald-400",
        glow: "shadow-emerald-100",
        icon: CheckCircle2,
    },
    cancelled: {
        bg: "bg-rose-50",
        text: "text-rose-700",
        border: "border-l-rose-400",
        glow: "shadow-rose-100",
        icon: XCircle,
    },
    declined: {
        bg: "bg-rose-50",
        text: "text-rose-700",
        border: "border-l-rose-400",
        glow: "shadow-rose-100",
        icon: XCircle,
    },
};

function getStatus(booking: Booking): string {
    return (booking.status || booking.getStatus || "pending").toLowerCase();
}

function getStatusStyle(status: string) {
    return statusColors[status] || statusColors["pending"];
}

function formatDate(ts: any): string {
    if (!ts) return "—";
    try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "—";
    }
}

function getNumericPrice(val: any): number {
    if (!val) return 0;
    if (typeof val === "number") return val;
    const cleaned = val.toString().replace(/[^\d.-]/g, "");
    return parseFloat(cleaned) || 0;
}

export default function BookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeStatus, setActiveStatus] = useState<string>("all");

    // Fix #7: Date filter states
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // Real-time listener
    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Booking[];
                setBookings(data);
                setLoading(false);
            },
            (err) => {
                console.error("Bookings listener error:", err);
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeStatus, startDate, endDate]);

    const filteredBookings = useMemo(() => {
        return bookings.filter((b) => {
            const status = getStatus(b);
            const name = (b.clientName || b.customerName || "").toLowerCase();
            const worker = (b.worker?.name || b.workerName || "").toLowerCase();
            const service = (b.serviceType || b.jobType || b.serviceName || "").toLowerCase();
            const ref = (b.referenceNumber || b.id || "").toLowerCase();
            const search = searchTerm.toLowerCase();

            const matchSearch =
                name.includes(search) ||
                worker.includes(search) ||
                service.includes(search) ||
                ref.includes(search);

            const matchStatus = activeStatus === "all" || status === activeStatus;

            // Fix #7: Date filter logic
            let matchDate = true;
            if (startDate || endDate) {
                const ts = b.createdAt || b.scheduledDate || b.completedAt;
                const bookingDate = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
                if (bookingDate) {
                    if (startDate && bookingDate < new Date(startDate)) matchDate = false;
                    if (endDate) {
                        const endOfDay = new Date(endDate);
                        endOfDay.setHours(23, 59, 59, 999);
                        if (bookingDate > endOfDay) matchDate = false;
                    }
                }
            }

            return matchSearch && matchStatus && matchDate;
        });
    }, [bookings, searchTerm, activeStatus, startDate, endDate]);

    const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
    const paginatedBookings = filteredBookings.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Stats
    const stats = useMemo(() => {
        const all = bookings.length;
        const pending = bookings.filter((b) => ["pending", "confirmed"].includes(getStatus(b))).length;
        const inProgress = bookings.filter((b) => getStatus(b) === "in-progress").length;
        const completed = bookings.filter((b) => getStatus(b) === "completed").length;
        const cancelled = bookings.filter((b) =>
            ["cancelled", "declined"].includes(getStatus(b))
        ).length;
        const revenue = bookings
            .filter((b) => getStatus(b) === "completed")
            .reduce((sum, b) => sum + getNumericPrice(b.price), 0);
        return { all, pending, inProgress, completed, cancelled, revenue };
    }, [bookings]);

    const exportToCSV = () => {
        const headers = ["Reference", "Customer", "Worker", "Service", "Status", "Price", "Date"];
        const rows = filteredBookings.map((b) => [
            b.referenceNumber || b.id,
            toTitleCase(b.clientName || b.customerName),
            toTitleCase(b.worker?.name || b.workerName),
            b.serviceType || b.jobType || "",
            getStatus(b),
            `₱${getNumericPrice(b.price).toFixed(2)}`,
            formatDate(b.createdAt),
        ]);
        const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bookings_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const filterTabs = [
        { id: "all", label: "All", count: stats.all },
        { id: "pending", label: "Pending", count: stats.pending },
        { id: "in-progress", label: "In Progress", count: stats.inProgress },
        { id: "completed", label: "Completed", count: stats.completed },
        { id: "cancelled", label: "Cancelled", count: stats.cancelled },
    ];

    return (
        <>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase">
                        <CalendarCheck className="w-8 h-8 text-primary" />
                        Booking Transactions
                    </h1>
                    <p className="text-sm font-bold text-text-light/60 uppercase tracking-widest mt-1">
                        Manage and monitor all service booking requests
                    </p>
                    <div className="h-1.5 w-24 bg-gradient-to-r from-primary via-accent to-transparent rounded-full mt-3" />
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-6 py-3 bg-success text-white rounded-2xl text-xs font-black uppercase transition-all hover:scale-105 active:scale-95 shadow-xl shadow-success/20"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                {[
                    { label: "Total", val: stats.all, icon: <Filter className="w-5 h-5" />, color: "bg-primary" },
                    { label: "Pending", val: stats.pending, icon: <Clock className="w-5 h-5" />, color: "bg-amber-500" },
                    { label: "Active", val: stats.inProgress, icon: <Activity className="w-5 h-5" />, color: "bg-purple-600" },
                    { label: "Completed", val: stats.completed, icon: <CheckCircle2 className="w-5 h-5" />, color: "bg-emerald-500" },
                    { label: "Cancelled", val: stats.cancelled, icon: <XCircle className="w-5 h-5" />, color: "bg-rose-500" },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="bg-white p-5 rounded-2xl border border-border/40 shadow-sm flex items-center gap-4 hover:shadow-lg transition-all"
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${s.color}`}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-text-light/50">{s.label}</p>
                            <p className="text-2xl font-black text-text">{s.val}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters Row */}
            <div className="bg-white rounded-[2rem] border border-border/40 shadow-sm p-6 mb-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                        <input
                            type="text"
                            placeholder="Search by customer, worker, or service..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-background border border-border/50 rounded-xl text-sm font-bold focus:outline-none focus:border-primary/40 transition-all"
                        />
                    </div>

                    {/* Fix #7: Date Range Filter */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="pl-9 pr-3 py-3 bg-background border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:border-primary/40 transition-all cursor-pointer"
                                title="Start Date"
                            />
                        </div>
                        <span className="text-text-light/30 font-bold">—</span>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="pl-9 pr-3 py-3 bg-background border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:border-primary/40 transition-all cursor-pointer"
                                title="End Date"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(""); setEndDate(""); }}
                                className="px-3 py-3 bg-error/10 text-error rounded-xl text-xs font-black hover:bg-error hover:text-white transition-all"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-text-light/50 ml-auto">
                        {filteredBookings.length} result{filteredBookings.length !== 1 ? "s" : ""}
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex flex-wrap gap-2">
                    {filterTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveStatus(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeStatus === tab.id
                                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105"
                                    : "bg-background border border-border/50 text-text-light hover:bg-white"
                            }`}
                        >
                            {tab.label}
                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                                activeStatus === tab.id ? "bg-white/20 text-white" : "bg-border/50 text-text-light"
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Fix #6: Emphasized Booking Cards */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
                    <p className="font-black text-text-light/40 uppercase tracking-widest text-[11px]">Loading Bookings...</p>
                </div>
            ) : paginatedBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4 text-text-light/30">
                    <AlertCircle className="w-16 h-16" />
                    <p className="font-black uppercase tracking-widest text-[11px]">No bookings found for the current filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                    {paginatedBookings.map((booking) => {
                        const status = getStatus(booking);
                        const style = getStatusStyle(status);
                        const StatusIcon = style.icon;
                        const isPending = status === "pending";
                        const isInProgress = status === "in-progress";
                        const isCompleted = status === "completed";
                        const isCancelled = ["cancelled", "declined"].includes(status);

                        return (
                            // Fix #6: Heavily emphasized cards with left border accent and color-coded glow
                            <div
                                key={booking.id}
                                className={`
                                    relative bg-white rounded-2xl border border-l-4 shadow-md hover:shadow-xl 
                                    transition-all duration-300 overflow-hidden group 
                                    ${style.border} ${style.glow}
                                    ${isPending ? "ring-2 ring-amber-300/40 animate-pulse-slow" : ""}
                                    ${isInProgress ? "ring-2 ring-purple-300/40" : ""}
                                `}
                            >
                                {/* Status Banner - Fix #6: Prominent status at top */}
                                <div className={`px-4 py-2 flex items-center gap-2 ${style.bg}`}>
                                    <StatusIcon className={`w-4 h-4 ${style.text}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${style.text}`}>
                                        {status.replace("-", " ")}
                                    </span>
                                    {isPending && (
                                        <span className="ml-auto text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                            ACTION NEEDED
                                        </span>
                                    )}
                                    {isInProgress && (
                                        <span className="ml-auto text-[9px] font-black bg-purple-600 text-white px-2 py-0.5 rounded-full">
                                            IN PROGRESS
                                        </span>
                                    )}
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Reference */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-mono text-text-light/50 font-bold uppercase tracking-widest">
                                            #{(booking.referenceNumber || booking.id).slice(0, 10)}
                                        </span>
                                        <span className="text-[10px] font-black text-primary">
                                            ₱{getNumericPrice(booking.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    {/* Service */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Briefcase className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-text">
                                                {booking.serviceType || booking.jobType || booking.serviceName || "Service"}
                                            </p>
                                            <p className="text-[10px] text-text-light font-bold">
                                                {formatDate(booking.createdAt || booking.scheduledDate)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* People - Fix #8: Title case names */}
                                    <div className="grid grid-cols-2 gap-3 bg-background/50 rounded-xl p-3">
                                        <div>
                                            <p className="text-[8px] font-black text-text-light/40 uppercase tracking-widest mb-1">Customer</p>
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3 h-3 text-primary/40 shrink-0" />
                                                <p className="text-xs font-black text-text truncate">
                                                    {toTitleCase(booking.clientName || booking.customerName) || "N/A"}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-text-light/40 uppercase tracking-widest mb-1">Worker</p>
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3 h-3 text-success/40 shrink-0" />
                                                <p className="text-xs font-black text-text truncate">
                                                    {toTitleCase(booking.worker?.name || booking.workerName) || "N/A"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rating for completed bookings */}
                                    {isCompleted && booking.rating && (
                                        <div className="flex items-center gap-2 pt-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-3.5 h-3.5 ${
                                                        i < booking.rating!
                                                            ? "text-yellow-500 fill-yellow-500"
                                                            : "text-border fill-border"
                                                    }`}
                                                />
                                            ))}
                                            {booking.ratingComment && (
                                                <p className="text-[9px] text-text-light italic truncate flex-1">
                                                    "{booking.ratingComment}"
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Cancellation note */}
                                    {isCancelled && booking.cancelledAt && (
                                        <p className="text-[9px] font-bold text-rose-500 flex items-center gap-1">
                                            <CalendarX className="w-3 h-3" />
                                            Cancelled: {formatDate(booking.cancelledAt)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-border/40 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-light/60">
                        Showing {(currentPage - 1) * itemsPerPage + 1}–
                        {Math.min(currentPage * itemsPerPage, filteredBookings.length)} of{" "}
                        {filteredBookings.length} bookings
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-border/50 rounded-xl disabled:opacity-30 hover:border-primary transition-all active:scale-90"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                            <button
                                key={p}
                                onClick={() => setCurrentPage(p)}
                                className={`w-9 h-9 flex items-center justify-center text-[10px] font-black rounded-xl transition-all ${
                                    currentPage === p
                                        ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110"
                                        : "bg-white border border-border/50 hover:border-primary text-text"
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-border/50 rounded-xl disabled:opacity-30 hover:border-primary transition-all active:scale-90"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
