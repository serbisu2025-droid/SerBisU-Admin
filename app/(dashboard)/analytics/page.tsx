"use client";


import { useEffect, useState, useRef } from "react";
import {
    ChartLine,
    TrendingUp,
    TrendingDown,
    BarChart3,
    PieChart as PieChartIcon,
    Calendar,
    Download,
    Loader2,
    Users,
    CheckCircle,
    RotateCcw,
    Search,
    Clock,
    Trophy,
    Coins,
    BarChart,
    FileText,
    AlertCircle,
    Star
} from "lucide-react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { fetchAnalyticsData, AnalyticsData } from "@/lib/analytics";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'activity', label: 'User Activity', icon: Users },
    { id: 'bookings', label: 'Bookings', icon: CheckCircle },
    { id: 'services', label: 'Services', icon: BarChart },
    { id: 'search', label: 'Search Trends', icon: Search },
];

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const reportRef = useRef<HTMLDivElement>(null);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const result = await fetchAnalyticsData(new Date(startDate), new Date(endDate));
            setData(result);
        } catch (error) {
            console.error("Failed to load analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, []);

    const generatePDF = async () => {
        if (!reportRef.current) return;
        const canvas = await html2canvas(reportRef.current);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`SerBisU-Analytics-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    if (loading && !data) {
        return (
            <>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="font-bold text-text-light animate-pulse">Loading report...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text tracking-tight">System Analytics</h1>
                    <div className="h-1.5 w-16 bg-gradient-to-r from-primary to-accent rounded-full mt-2"></div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white border border-border rounded-xl px-3 py-1 shadow-sm">
                        <Calendar className="w-4 h-4 text-text-light mr-2" />
                        <input
                            type="date"
                            className="text-sm font-bold bg-transparent outline-none py-1"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="mx-2 text-text-light font-black">→</span>
                        <input
                            type="date"
                            className="text-sm font-bold bg-transparent outline-none py-1"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={loadAnalytics}
                        className="p-2.5 bg-white border border-border rounded-xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm active:scale-90"
                    >
                        <RotateCcw className={loading ? "animate-spin w-5 h-5" : "w-5 h-5"} />
                    </button>
                    <button
                        onClick={generatePDF}
                        className="flex items-center gap-2 px-6 py-2.5 bg-success text-white rounded-xl text-sm font-black hover:bg-success/90 transition-all shadow-lg shadow-success/20 active:scale-95"
                    >
                        <FileText className="w-4 h-4" />
                        Report
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 bg-background p-1.5 rounded-2xl border border-border/50 w-fit overflow-x-auto no-scrollbar">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                            : 'text-text-light hover:bg-white'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div ref={reportRef} className="space-y-8 animate-in fade-in duration-500">
                {activeTab === 'overview' && <OverviewTab data={data!} />}
                {activeTab === 'activity' && <ActivityTab data={data!} />}
                {activeTab === 'bookings' && <BookingsTab data={data!} />}
                {activeTab === 'services' && <ServicesTab data={data!} />}
                {activeTab === 'search' && <SearchTab data={data!} />}
            </div>
        </>
    );
}

function OverviewTab({ data }: { data: AnalyticsData }) {
    const activeUsersLine = {
        labels: data.homeowners.dailyLogins.map((d: any) => d.date),
        datasets: [{
            fill: true,
            label: 'Daily Logins',
            data: data.homeowners.dailyLogins.map((d: any) => d.count),
            borderColor: '#003B73',
            backgroundColor: 'rgba(0, 59, 115, 0.1)',
            tension: 0.4,
        }]
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Active Homeowners"
                    value={data.homeowners.activeUsers}
                    change={`+${data.homeowners.activeUsersGrowth.toFixed(1)}%`}
                    icon={<Users className="w-6 h-6" />}
                    positive
                />
                <MetricCard
                    title="Booking Completion"
                    value={`${data.bookings.completionRate.toFixed(1)}%`}
                    change="+2.4%"
                    icon={<CheckCircle className="w-6 h-6" />}
                    positive
                />
                <MetricCard
                    title="Homeowner Retention"
                    value={`${data.homeowners.retentionRate.toFixed(1)}%`}
                    change="+1.5%"
                    icon={<RotateCcw className="w-6 h-6" />}
                    positive
                />
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl border border-border/50">
                <h3 className="text-sm font-black text-text uppercase tracking-widest mb-8 flex items-center gap-2">
                    <ChartLine className="w-5 h-5 text-primary" /> Active User Trend
                </h3>
                <div className="h-[400px]">
                    <Line data={activeUsersLine} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
            </div>
        </div>
    );
}

function ActivityTab({ data }: { data: AnalyticsData }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-border/50 flex flex-col items-center justify-center text-center">
                <p className="text-xs font-black text-text-light uppercase tracking-widest mb-6">Currently Online</p>
                <div className="relative">
                    <div className="w-32 h-32 rounded-full bg-success/10 flex items-center justify-center border-[8px] border-white shadow-xl">
                        <span className="text-4xl font-black text-success">{data.homeowners.onlineUsers}</span>
                    </div>
                    <div className="absolute top-0 right-0 w-8 h-8 bg-success rounded-full border-4 border-white animate-pulse"></div>
                </div>
                <p className="mt-6 text-sm font-bold text-text-light">
                    Out of <span className="text-text">{data.homeowners.totalCount}</span> total homeowners
                </p>
            </div>

            <div className="bg-primary p-8 rounded-3xl shadow-2xl text-white relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
                <Users className="w-12 h-12 mb-6 text-accent opacity-50" />
                <h3 className="text-2xl font-black mb-2">New Registrations</h3>
                <p className="text-white/70 mb-8 font-medium">Showing growth this month</p>
                <div className="flex items-end gap-3 mb-4">
                    <span className="text-6xl font-black">{data.homeowners.newUsers}</span>
                    <span className="text-success font-black flex items-center gap-1 mb-2 bg-white/10 px-3 py-1 rounded-full text-sm">
                        <TrendingUp className="w-4 h-4" /> {data.homeowners.userGrowth.toFixed(1)}%
                    </span>
                </div>
                <p className="text-sm text-white/50 font-bold uppercase tracking-widest">Showing latest data</p>
            </div>
        </div>
    );
}

function BookingsTab({ data }: { data: AnalyticsData }) {
    const pieData = {
        labels: Object.keys(data.bookings.statusCounts),
        datasets: [{
            data: Object.values(data.bookings.statusCounts),
            backgroundColor: ['#28C76F', '#FF9F43', '#EA5455', '#00CFE8'],
            borderWidth: 0,
        }]
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-border/50">
                    <h3 className="text-sm font-black text-text uppercase tracking-widest mb-8 flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-accent" /> Status Distribution
                    </h3>
                    <div className="h-[300px]">
                        <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false }} />
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl border border-border/50">
                    <h3 className="text-sm font-black text-text uppercase tracking-widest mb-8 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" /> Peak Booking Hours
                    </h3>
                    <div className="h-[300px]">
                        <Bar
                            data={{
                                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                                datasets: [{
                                    label: 'Bookings',
                                    data: data.bookings.hourlyBookings,
                                    backgroundColor: '#003B73',
                                    borderRadius: 4
                                }]
                            }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Highlights */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-border/40">
                    <h3 className="text-[10px] font-black text-text-light uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-primary" /> Revenue Summary
                    </h3>
                    <div className="space-y-8">
                        <div className="flex items-center gap-6 group">
                            <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center text-success transition-transform group-hover:scale-110">
                                <Coins className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-text-light/50 uppercase tracking-widest mb-1">Total Revenue</p>
                                <p className="text-3xl font-black text-text">
                                    ₱{data.bookings.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 group">
                            <div className="w-14 h-14 rounded-2xl bg-[#00CFE8]/10 flex items-center justify-center text-[#00CFE8] transition-transform group-hover:scale-110">
                                <Download className="w-7 h-7 rotate-180" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-text-light/50 uppercase tracking-widest mb-1">Average Booking Value</p>
                                <p className="text-2xl font-black text-text">
                                    ₱{data.bookings.averageBookingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Skilled Worker Leaderboard */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-border/40">
                    <h3 className="text-[10px] font-black text-text-light uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" /> Top Skilled Workers
                    </h3>
                    <div className="space-y-4">
                        {data.bookings.topProviders.map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-background/50 hover:bg-background rounded-[1.5rem] border border-border/5 group transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm ring-4 ring-white ${i === 0 ? 'bg-yellow-400 text-white' :
                                        i === 1 ? 'bg-slate-300 text-slate-600' :
                                            i === 2 ? 'bg-orange-400 text-white' : 'bg-primary/10 text-primary'
                                        }`}>
                                        {i + 1}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-text text-sm group-hover:text-primary transition-colors">{p.name}</p>
                                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-400/10 rounded-lg">
                                                <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                                                <span className="text-[9px] font-black text-text-light">{p.rating?.toFixed(1) || "0.0"}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] font-bold text-text-light/50 uppercase tracking-tighter">{p.count} bookings</p>
                                            <div className="w-1 h-1 bg-border rounded-full"></div>
                                            <p className="text-[10px] font-bold text-success uppercase tracking-tighter font-mono">₱{p.earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-4 py-1.5 bg-primary/5 border border-primary/10 rounded-full">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                        {p.percentage.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Provider Earnings Matrix */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/50 overflow-hidden">
                <div className="p-8 border-b border-border/10 flex items-center justify-between bg-background/30">
                    <h3 className="text-sm font-black text-text uppercase tracking-widest flex items-center gap-2">
                        <Coins className="w-5 h-5 text-success" /> Provider Earnings
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-[#F8FAFC] text-[#64748B] text-[11px] uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-8 py-5 border-b border-border/10">Professional</th>
                                <th className="px-8 py-5 border-b border-border/10 text-center">Rating</th>
                                <th className="px-8 py-5 border-b border-border/10 text-right">Completed Jobs</th>
                                <th className="px-8 py-5 border-b border-border/10 text-right">Total Earnings</th>
                                <th className="px-8 py-5 border-b border-border/10 text-right">Average / Job</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/5">
                            {data.bookings.providerEarnings?.length > 0 ? (
                                data.bookings.providerEarnings.map((p: any, i: number) => (
                                    <tr key={i} className="hover:bg-[#F8FAFC] transition-all">
                                        <td className="px-8 py-5 font-bold text-text text-sm">{p.name}</td>
                                        <td className="px-8 py-5 whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1 px-3 py-1 bg-yellow-400/5 rounded-full border border-yellow-400/10">
                                                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                                <span className="text-xs font-black text-text">{p.rating?.toFixed(1) || "0.0"}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right font-black text-text-light">{p.count}</td>
                                        <td className="px-8 py-5 text-right font-black text-success">
                                            ₱{p.earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-8 py-5 text-right font-black text-primary">
                                            ₱{(p.earnings / (p.count || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-text-light/50 font-black uppercase tracking-widest">
                                        No earnings data available for this phase
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function ServicesTab({ data }: { data: AnalyticsData }) {
    return (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-border/50">
            <h3 className="text-sm font-black text-text uppercase tracking-widest mb-8 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" /> Service Vertical Performance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {data.bookings.serviceTypes.map((s: any, i: number) => (
                    <div key={i} className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="font-black text-sm">{s.name}</span>
                            <span className="text-xs font-bold text-text-light">{s.count} Requests</span>
                        </div>
                        <div className="h-2.5 w-full bg-background rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                    width: `${(s.count / data.bookings.totalBookings) * 100}%`,
                                    backgroundColor: s.color
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SearchTab({ data }: { data: AnalyticsData }) {
    const searchPieData = {
        labels: data.search.categoryData?.map((c: any) => c.category) || [],
        datasets: [{
            data: data.search.categoryData?.map((c: any) => c.count) || [],
            backgroundColor: ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#795548', '#00BCD4', '#607D8B'],
            borderWidth: 0,
        }]
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-border/50">
                    <h3 className="text-sm font-black text-text uppercase tracking-widest mb-8 flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-accent" /> Category Distribution
                    </h3>
                    <div className="h-[300px]">
                        <Pie data={searchPieData} options={{ responsive: true, maintainAspectRatio: false }} />
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl border border-border/50">
                    <h3 className="text-sm font-black text-text uppercase tracking-widest mb-8 flex items-center gap-2">
                        <Search className="w-5 h-5 text-primary" /> Consumer Intent (Terms)
                    </h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
                        {data.search.topTerms.map((t: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-background rounded-2xl group hover:bg-primary/5 transition-all">
                                <span className="font-bold text-sm capitalize text-text-light group-hover:text-primary">{t[0]}</span>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3 text-success" />
                                    <span className="text-sm font-black">{t[1]}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-text p-8 rounded-3xl shadow-2xl text-white">
                <div className="flex items-center gap-3 mb-8 text-primary">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">Insights</span>
                </div>
                <p className="text-3xl font-black mb-4">Search Analysis</p>
                <p className="text-white/60 mb-8 font-medium line-clamp-3">
                    Total consumer search queries identified: <span className="text-white font-black underline decoration-primary underline-offset-4">{data.search.totalSearches}</span>.
                    The most dominant intent focuses on <span className="text-white font-black">{data.search.topTerms[0]?.[0]}</span> services.
                </p>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-xs font-black text-white/40 uppercase mb-4 tracking-tighter">Suggestion</p>
                    <p className="text-sm font-bold text-white/80 leading-relaxed">
                        Increase service visibility for "{data.search.topTerms[1]?.[0] || 'emerging'}" - this category is seeing a surge in consumer inquiries but has restricted professional availability.
                    </p>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, change, icon, positive }: any) {
    return (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-border/50 hover:shadow-xl transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
            <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                    {icon}
                </div>
                <p className="text-[10px] font-black text-text-light uppercase tracking-[0.2em] mb-2">{title}</p>
                <h3 className="text-3xl font-black text-text mb-4 tracking-tighter">{value}</h3>
                <div className={`flex items-center gap-1.5 text-xs font-black ${positive ? 'text-success' : 'text-error'} bg-white/50 w-fit px-3 py-1 rounded-full shadow-sm border border-border/20`}>
                    {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {change}
                </div>
            </div>
        </div>
    );
}
