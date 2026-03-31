"use client";

import {
    Users,
    Toolbox,
    CheckCircle,
    Activity,
    TrendingUp,
    RefreshCw,
    ArrowRight,
    TrendingDown,
    PieChart as PieIcon,
    BarChart2,
    MapPin,
    Calendar,
    ChevronRight,
    Search,
    Loader2,
    Coins,
    Star
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Doughnut, PolarArea } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface StatCardProps {
    title: string;
    value: string | number;
    change: string;
    isUp: boolean;
    icon: React.ReactNode;
    iconBg: string;
}

const StatCard = ({ title, value, change, isUp, icon, iconBg }: StatCardProps) => (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-border/50 transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-24 h-24 opacity-5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 ${iconBg}`}></div>
        <div className="flex items-center gap-5 relative z-10">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 ${iconBg} shadow-2xl`}>
                {icon}
            </div>
            <div>
                <p className="text-[11px] font-extrabold text-text-light uppercase tracking-widest">{title}</p>
                <h3 className="text-3xl font-black text-text mt-0.5 tracking-tight">{value}</h3>
                <p className={`text-[10px] font-bold flex items-center gap-1 mt-1.5 uppercase ${isUp ? 'text-success' : 'text-error'}`}>
                    {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {change} VS LAST MONTH
                </p>
            </div>
        </div>
    </div>
);

const getNumericPrice = (value: any): number => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
};

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totalHomeowners: 0,
        totalWorkers: 0,
        activeJobs: 0,
        completedJobs: 0,
        revenue: "₱0.00",
        activeSessions: 0,
        userGrowth: "0%",
        providerGrowth: "0%",
        activeJobsGrowth: "0%",
        completedJobsGrowth: "0%",
        revenueGrowth: "0%"
    });
    const [recentBookings, setRecentBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState("Last 30 Days");
    const [bookingsPage, setBookingsPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // Chart States
    const [activityData, setActivityData] = useState<{ labels: string[], bookings: number[], signups: number[] }>({ labels: [], bookings: [], signups: [] });
    const [categoryData, setCategoryData] = useState<{ labels: string[], counts: number[] }>({ labels: [], counts: [] });
    const [locationData, setLocationData] = useState<{ labels: string[], counts: number[] }>({ labels: [], counts: [] });

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

            // Fetch Data
            const [usersSnap, workersSnap, bookingsSnap, logsSnap, servicesSnap] = await Promise.all([
                getDocs(collection(db, "homeowners")),
                getDocs(collection(db, "skilled_workers")),
                getDocs(collection(db, "bookings")),
                getDocs(query(collection(db, "logs"), where("category", "==", "Authentication"), where("event", "==", "User signup"))),
                getDocs(collection(db, "services"))
            ]);

            const bookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
            const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

            // Stats Calculations
            const active = bookings.filter((b: any) => ["pending", "confirmed", "in-progress"].includes(b.status?.toLowerCase())).length;
            const completed = bookings.filter((b: any) => b.status?.toLowerCase() === "completed");

            let totalRevenue = 0;
            completed.forEach((job: any) => {
                totalRevenue += getNumericPrice(job.price);
            });

            // Growth Calculations (Simple version using createdAt if available)
            const calculateGrowth = (items: any[], isMonth: boolean) => {
                const targetDate = isMonth ? firstDayOfMonth : startOfLastMonth;
                const countThisPeriod = items.filter((item: any) => {
                    const created = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                    return created >= targetDate;
                }).length;
                return countThisPeriod > 0 ? `+${((countThisPeriod / (items.length || 1)) * 100).toFixed(1)}%` : "0%";
            };

            const activeHomeowners = users.filter((u: any) => u.isOnline).length;
            const activeWorkers = workersSnap.docs.filter((d: any) => d.data().isOnline).length;
            const totalActiveSessions = activeHomeowners + activeWorkers;

            setStats({
                totalHomeowners: usersSnap.size,
                totalWorkers: workersSnap.size,
                activeJobs: active,
                completedJobs: completed.length,
                revenue: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalRevenue),
                activeSessions: totalActiveSessions,
                userGrowth: calculateGrowth(users, true),
                providerGrowth: calculateGrowth(workersSnap.docs.map(d => d.data()), true),
                activeJobsGrowth: "+2.4%",
                completedJobsGrowth: calculateGrowth(completed, true),
                revenueGrowth: "+18.2%"
            });

            // Create Worker Rating Map
            const workerRatingsMap: Record<string, number> = {};
            workersSnap.docs.forEach(doc => {
                workerRatingsMap[doc.id] = doc.data().rating || 0;
            });

            // Recent Bookings (Clean data)
            const recent = [...bookings].sort((a: any, b: any) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            }).map((b: any) => {
                const workerId = b.workerId || b.worker?.id;
                return {
                    id: b.id,
                    referenceNumber: b.referenceNumber || b.id,
                    customer: b.clientName || b.customerName || 'Anonymous',
                    service: b.serviceType || b.jobType || 'Unknown',
                    worker: b.worker?.name || b.workerName || 'N/A',
                    workerRating: workerId ? workerRatingsMap[workerId] : 0,
                    status: b.getStatus || b.status || 'Pending',
                    price: getNumericPrice(b.price),
                    dateDisplay: b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (b.date || 'N/A')
                };
            });
            setRecentBookings(recent);

            // Activity Chart Logic (matching original dashboard JS)
            const daysToFetch = timeRange === "Last 7 Days" ? 7 : timeRange === "Last 90 Days" ? 90 : 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysToFetch);

            const labels: string[] = [];
            const bookingCounts: number[] = [];
            const signupCounts: number[] = [];

            for (let i = 0; i <= daysToFetch; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                labels.push(dateStr);

                bookingCounts.push(bookings.filter((b: any) => {
                    const bDate = new Date(b.date || b.createdAt?.toDate?.() || 0);
                    return bDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === dateStr;
                }).length);

                signupCounts.push(logsSnap.docs.filter((l: any) => {
                    const lDate = l.data().timestamp?.toDate?.() || 0;
                    return lDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === dateStr;
                }).length);
            }
            setActivityData({ labels, bookings: bookingCounts, signups: signupCounts });

            // Category Chart Logic
            const categories: Record<string, number> = {};
            servicesSnap.docs.forEach(doc => {
                const cat = doc.data().category || 'Uncategorized';
                categories[cat] = (categories[cat] || 0) + 1;
            });
            setCategoryData({
                labels: Object.keys(categories),
                counts: Object.values(categories)
            });

            // Location Chart Logic
            const locations: Record<string, number> = {};
            users.forEach((u: any) => {
                let loc = 'Unknown';
                const address = u.address || u.location || u.city || '';

                if (address) {
                    const parts = address.split(',');
                    // Capture Barangay + City (first 2 parts) for better granularity
                    if (parts.length >= 2) {
                        loc = parts.slice(0, 2).join(', ').trim();
                    } else {
                        loc = address.trim();
                    }

                    // Truncate if too long (e.g. > 25 chars)
                    if (loc.length > 25) {
                        loc = loc.substring(0, 25) + '...';
                    }
                }
                locations[loc] = (locations[loc] || 0) + 1;
            });

            // Sort by count and limit to top 5 for chart readability
            // Displaying too many segments breaks the PolarArea chart rendering
            const allLocations = Object.entries(locations)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            setLocationData({
                labels: allLocations.map(l => l[0]),
                counts: allLocations.map(l => l[1])
            });

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to generate colors
    const generateColors = (count: number) => {
        const baseColors = [
            'rgba(0, 59, 115, 0.7)',   // Primary
            'rgba(40, 199, 111, 0.7)', // Success
            'rgba(255, 159, 67, 0.7)', // Warning
            'rgba(0, 207, 232, 0.7)',  // Info
            'rgba(111, 66, 193, 0.7)', // Purple
            'rgba(234, 84, 85, 0.7)',  // Error
            'rgba(255, 193, 7, 0.7)',  // Yellow
            'rgba(108, 117, 125, 0.7)', // Grey
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    };

    useEffect(() => {
        fetchDashboardData();
    }, [timeRange]);

    const activityChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
            legend: { position: 'top' as const, labels: { boxWidth: 8, font: { size: 10, weight: 'bold' as const } } },
            tooltip: {
                backgroundColor: 'rgba(0, 59, 115, 0.9)',
                padding: 12,
                cornerRadius: 12,
                titleFont: { size: 12, weight: 'bold' as const },
            }
        },
        scales: {
            y: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: 10, weight: 'bold' as const } } },
            x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' as const } } }
        }
    };

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-text tracking-tighter uppercase flex items-center gap-4">
                        <PieIcon className="w-10 h-10 text-primary" />
                        Dashboard
                    </h1>
                    <p className="text-sm font-bold text-text-light/60 uppercase tracking-widest mt-1 ml-1">Monitor platform activity and user statistics</p>
                    <div className="h-1.5 w-32 bg-gradient-to-r from-primary via-accent to-transparent rounded-full mt-3"></div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 px-5 py-2.5 bg-white border border-border/50 rounded-2xl shadow-sm">
                        <div className="w-2.5 h-2.5 bg-success rounded-full animate-ping"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-text">Live: {stats.activeSessions} active sessions</span>
                    </div>
                    <button
                        onClick={fetchDashboardData}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/30 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <StatCard
                    title="Homeowners"
                    value={stats.totalHomeowners}
                    change={stats.userGrowth}
                    isUp={true}
                    icon={<Users className="w-7 h-7" />}
                    iconBg="bg-blue-600"
                />
                <StatCard
                    title="PESO Verification"
                    value={stats.totalWorkers}
                    change={stats.providerGrowth}
                    isUp={true}
                    icon={<Toolbox className="w-7 h-7" />}
                    iconBg="bg-teal-500"
                />
                <StatCard
                    title="Active Flow"
                    value={stats.activeJobs}
                    change={stats.activeJobsGrowth}
                    isUp={false}
                    icon={<Activity className="w-7 h-7" />}
                    iconBg="bg-purple-600"
                />
                <StatCard
                    title="Market Reach"
                    value={stats.completedJobs}
                    change={stats.completedJobsGrowth}
                    isUp={true}
                    icon={<CheckCircle className="w-7 h-7" />}
                    iconBg="bg-orange-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left Column: Traffic and Table */}
                <div className="lg:col-span-8 space-y-10">
                    {/* Activity Chart */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-border/40 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/2 rounded-full -mr-32 -mt-32"></div>
                        <div className="flex items-center justify-between mb-10 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                    <BarChart2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-text uppercase tracking-tight">System Traffic Bloom</h3>
                                    <p className="text-[10px] font-bold text-text-light/50 uppercase">Requests vs Signups</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-background p-1 rounded-xl">
                                {["Last 7 Days", "Last 30 Days", "Last 90 Days"].map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${timeRange === range ? 'bg-white shadow-sm text-primary' : 'text-text-light/50 hover:text-text'}`}
                                    >
                                        {range.split(' ')[1]}D
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="h-[380px] relative z-10">
                            <Line
                                data={{
                                    labels: activityData.labels,
                                    datasets: [
                                        {
                                            label: 'Requests',
                                            data: activityData.bookings,
                                            borderColor: '#003B73',
                                            backgroundColor: 'rgba(0, 59, 115, 0.05)',
                                            fill: true,
                                            tension: 0.5,
                                            borderWidth: 4,
                                            pointRadius: 0,
                                            pointHoverRadius: 6,
                                        },
                                        {
                                            label: 'Signups',
                                            data: activityData.signups,
                                            borderColor: '#20c997',
                                            backgroundColor: 'transparent',
                                            tension: 0.5,
                                            borderWidth: 4,
                                            borderDash: [5, 5],
                                            pointRadius: 0,
                                        }
                                    ]
                                }}
                                options={activityChartOptions}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 overflow-hidden">
                        <div className="p-8 border-b border-border/20 flex items-center justify-between bg-background/30">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <h3 className="font-black text-text uppercase tracking-tight">Recent Bookings</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setBookingsPage(p => Math.max(1, p - 1))}
                                    disabled={bookingsPage === 1}
                                    className="px-3 py-1.5 bg-white border border-border/50 rounded-lg text-[10px] font-black uppercase disabled:opacity-50 hover:bg-background transition-all"
                                >
                                    Prev
                                </button>
                                <span className="text-[10px] font-bold text-text-light">{bookingsPage}</span>
                                <button
                                    onClick={() => setBookingsPage(p => (bookingsPage * ITEMS_PER_PAGE < recentBookings.length ? p + 1 : p))}
                                    disabled={bookingsPage * ITEMS_PER_PAGE >= recentBookings.length}
                                    className="px-3 py-1.5 bg-white border border-border/50 rounded-lg text-[10px] font-black uppercase disabled:opacity-50 hover:bg-background transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-background/80 backdrop-blur-sm text-text-light text-[10px] uppercase font-black tracking-[0.2em]">
                                    <tr>
                                        <th className="px-4 py-4">ID</th>
                                        <th className="px-4 py-4">Customer</th>
                                        <th className="px-4 py-4">Service</th>
                                        <th className="px-4 py-4">Worker</th>
                                        <th className="px-4 py-4">Price</th>
                                        <th className="px-4 py-4">Status</th>
                                        <th className="px-4 py-4 text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-24 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                                    <p className="font-black text-text-light/40 uppercase tracking-widest text-[11px]">Loading bookings...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : recentBookings.length > 0 ? (
                                        recentBookings.slice((bookingsPage - 1) * ITEMS_PER_PAGE, bookingsPage * ITEMS_PER_PAGE).map((job: any) => (
                                            <tr key={job.id} className="hover:bg-primary/[0.02] transition-all group">
                                                <td className="px-4 py-5">
                                                    <p className="text-[10px] font-mono text-text-light/80 font-bold uppercase tracking-widest break-all">{job.referenceNumber}</p>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <p className="text-xs font-black text-text uppercase tracking-tighter group-hover:text-primary transition-colors">{job.customer}</p>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <p className="text-xs font-bold text-text-light">{job.service}</p>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-xs font-black text-text uppercase tracking-tighter">{job.worker}</p>
                                                        {job.workerRating > 0 && (
                                                            <div className="flex items-center gap-1">
                                                                <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
                                                                <span className="text-[10px] font-black text-text-light">{job.workerRating.toFixed(1)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <p className="text-xs font-black text-primary">₱{(job.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border tracking-tighter shadow-sm ${job.status?.toLowerCase() === 'completed'
                                                        ? 'bg-success/10 border-success/20 text-success'
                                                        : job.status?.toLowerCase() === 'cancelled' || job.status?.toLowerCase() === 'declined'
                                                             ? 'bg-error/10 border-error/20 text-error'
                                                             : 'bg-primary/10 border-primary/20 text-primary'
                                                        }`}>
                                                        {job.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-5 text-right whitespace-nowrap">
                                                    <p className="text-[10px] font-bold text-text-light/60 uppercase tracking-widest">{job.dateDisplay}</p>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-8 py-32 text-center text-text-light/50 font-black uppercase tracking-widest">No bookings found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Widgets */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Revenue Prism */}
                    <div className="bg-white p-8 rounded-2xl shadow-md border border-border/50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-1000"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-8 opacity-80">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <Coins className="w-5 h-5 text-primary" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Financial Yield Audit</span>
                            </div>
                            <p className="text-text-light/60 text-[10px] font-black uppercase tracking-widest mb-1 ml-1">Current Gross Trajectory</p>
                            <h2 className="text-5xl font-black text-text tracking-tighter leading-none mb-8">{stats.revenue}</h2>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-background border border-border/50 p-4 rounded-xl">
                                    <p className="text-text-light/50 text-[8px] font-black uppercase mb-1">Growth Spike</p>
                                    <p className="text-success text-lg font-black">{stats.revenueGrowth}</p>
                                </div>
                                <div className="bg-background border border-border/50 p-4 rounded-xl">
                                    <p className="text-text-light/50 text-[8px] font-black uppercase mb-1">Node Output</p>
                                    <p className="text-primary text-lg font-black">{stats.completedJobs}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Service Spectrum */}
                    <div className="bg-white p-8 rounded-2xl shadow-md border border-border/50">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-accent/10 rounded-xl text-accent">
                                <PieIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-text uppercase tracking-tight text-sm">Service Categories</h3>
                            </div>
                        </div>
                        <div className="h-[250px] relative">
                            <Doughnut
                                data={{
                                    labels: categoryData.labels,
                                    datasets: [{
                                        data: categoryData.counts,
                                        backgroundColor: ['#003B73', '#28C76F', '#FF9F43', '#00CFE8', '#6f42c1', '#fd7e14'],
                                        borderWidth: 0,
                                        hoverOffset: 15
                                    }]
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '75%',
                                    plugins: { legend: { position: 'right' as const, labels: { boxWidth: 8, padding: 15, font: { size: 9, weight: 'bold' as const } } } }
                                }}
                            />
                        </div>
                    </div>

                    {/* User Locations Chart */}
                    <div className="bg-white p-8 rounded-2xl shadow-md border border-border/50 relative overflow-hidden group">
                        <div className="flex items-center gap-4 mb-8 relative z-10">
                            <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-text uppercase tracking-tight text-sm">User Locations</h3>
                            </div>
                        </div>
                        <div className="h-[250px] relative z-10">
                            <PolarArea
                                data={{
                                    labels: locationData.labels,
                                    datasets: [{
                                        data: locationData.counts,
                                        backgroundColor: generateColors(locationData.counts.length),
                                        borderWidth: 2,
                                        borderColor: '#ffffff'
                                    }]
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: { r: { display: false } },
                                    plugins: { legend: { position: 'right' as const, labels: { color: '#64748b', boxWidth: 8, font: { size: 9, weight: 'bold' as const } } } }
                                }}
                            />
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}
