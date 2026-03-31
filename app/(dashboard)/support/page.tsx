"use client";


import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, onSnapshot } from "firebase/firestore";
import {
    Headset,
    Search,
    MoreVertical,
    Mail,
    MessageSquare,
    Clock,
    CheckCircle2,
    Loader2,
    Filter,
    Trash2,
    Eye,
    Reply,
    AlertTriangle,
    CheckCircle,
    Info,
    Send,
    X,
    Calendar,
    ChevronDown,
    User,
    ShieldAlert
} from "lucide-react";

interface SupportRequest {
    id: string;
    userName?: string;
    userEmail?: string;
    subject?: string;
    message?: string;
    status?: 'pending' | 'in-progress' | 'resolved';
    priority?: 'high' | 'medium' | 'low';
    category?: string;
    createdAt?: any;
    adminResponse?: string;
    respondedAt?: any;
    respondedBy?: string;
}

export default function SupportRequestsPage() {
    const [requests, setRequests] = useState<SupportRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'in-progress' | 'resolved'>('all');

    // Response Modal States
    const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
    const [responseMessage, setResponseMessage] = useState("");
    const [updateStatus, setUpdateStatus] = useState<any>("pending");
    const [sendingResponse, setSendingResponse] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "support_requests"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SupportRequest[];
            setRequests(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching support requests:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const stats = useMemo(() => {
        const total = requests.length;
        const pending = requests.filter(r => r.status === 'pending').length;
        const inProgress = requests.filter(r => r.status === 'in-progress').length;
        const resolved = requests.filter(r => r.status === 'resolved').length;
        const highPriority = requests.filter(r => r.priority === 'high').length;

        return { total, pending, inProgress, resolved, highPriority };
    }, [requests]);

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const matchesSearch =
                req.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.subject?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesTab = activeFilter === 'all' || req.status === activeFilter;

            return matchesSearch && matchesTab;
        });
    }, [requests, searchTerm, activeFilter]);

    const handleOpenResponse = (req: SupportRequest) => {
        setSelectedRequest(req);
        setUpdateStatus(req.status || "pending");
        setResponseMessage(req.adminResponse || "");
        setSendingResponse(false);
    };

    const handleResponseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest || !responseMessage.trim()) return;

        setSendingResponse(true);
        try {
            await updateDoc(doc(db, "support_requests", selectedRequest.id), {
                status: updateStatus,
                adminResponse: responseMessage,
                respondedAt: serverTimestamp(),
                respondedBy: "Admin Portal"
            });

            // Mock Email Sending (or integrate EmailJS if needed)
            // Original code used EmailJS: service_zjt2ep8, template_lv0gek8
            console.log("Sending response email to:", selectedRequest.userEmail);

            setSelectedRequest(null);
            setResponseMessage("");
            alert("Response sent and status updated successfully!");
        } catch (error) {
            console.error("Error updating support request:", error);
            alert("Failed to send response.");
        } finally {
            setSendingResponse(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this support request?")) {
            try {
                await deleteDoc(doc(db, "support_requests", id));
            } catch (error) {
                console.error("Error deleting request:", error);
            }
        }
    };

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
                <div>
                    <h1 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase">
                        Support Requests
                    </h1>
                    <p className="text-sm font-bold text-text-light/60 uppercase tracking-widest mt-1">Manage user inquiries and disputes</p>
                    <div className="h-1.5 w-24 bg-gradient-to-r from-primary via-accent to-transparent rounded-full mt-3"></div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                        <input
                            type="text"
                            placeholder="Search subjects or users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-white border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-64 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 px-2">
                <StatCard
                    title="Total Tickets"
                    value={stats.total}
                    icon={<Headset className="w-6 h-6" />}
                    color="bg-primary"
                    active={activeFilter === 'all'}
                    onClick={() => setActiveFilter('all')}
                />
                <StatCard
                    title="Pending"
                    value={stats.pending}
                    icon={<Clock className="w-6 h-6" />}
                    color="bg-orange-500"
                    active={activeFilter === 'pending'}
                    onClick={() => setActiveFilter('pending')}
                    pulse={stats.pending > 0}
                />
                <StatCard
                    title="In Progress"
                    value={stats.inProgress}
                    icon={<Loader2 className="w-6 h-6" />}
                    color="bg-blue-500"
                    active={activeFilter === 'in-progress'}
                    onClick={() => setActiveFilter('in-progress')}
                />
                <StatCard
                    title="High Priority"
                    value={stats.highPriority}
                    icon={<ShieldAlert className="w-6 h-6" />}
                    color="bg-error"
                    desc="Critical Issues"
                />
            </div>

            {/* Support Matrix */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 overflow-hidden mx-2">
                <div className="p-8 border-b border-border/10 flex items-center justify-between bg-background/30">
                    <h3 className="text-[10px] font-black text-text-light uppercase tracking-[0.3em] flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" /> Support Tickets
                    </h3>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-primary/10">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-background/80 backdrop-blur-sm sticky top-0 z-10 text-text-light text-[10px] uppercase font-black tracking-[0.2em]">
                            <tr>
                                <th className="px-8 py-6 border-b border-border/20">User</th>
                                <th className="px-8 py-6 border-b border-border/20">Request Details</th>
                                <th className="px-8 py-6 border-b border-border/20">Priority & Status</th>
                                <th className="px-8 py-6 border-b border-border/20 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-32 text-center text-text-light/40 font-black uppercase tracking-widest">Loading support requests...</td>
                                </tr>
                            ) : filteredRequests.length > 0 ? (
                                filteredRequests.map((req) => (
                                    <tr key={req.id} className="group hover:bg-primary/[0.02] transition-all">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary font-black shadow-inner">
                                                    {req.userName?.[0] || <User className="w-6 h-6" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-text uppercase tracking-tighter">{req.userName || 'Anonymous User'}</p>
                                                    <p className="text-[10px] text-text-light font-bold flex items-center gap-1.5 mt-1">
                                                        <Mail className="w-3 h-3 text-primary/50" /> {req.userEmail}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="max-w-md">
                                                <p className="text-sm font-black text-text mb-1">Subject: {req.subject || 'No Subject'}</p>
                                                <p className="text-xs text-text-light line-clamp-2 leading-relaxed font-bold opacity-60">
                                                    "{req.message}"
                                                </p>
                                                <div className="flex items-center gap-3 mt-3">
                                                    <span className="text-[9px] font-black text-primary uppercase bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10 flex items-center gap-1">
                                                        <Calendar className="w-2.5 h-2.5" />
                                                        {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString() : 'Recent'}
                                                    </span>
                                                    <span className="text-[9px] font-black text-accent uppercase bg-accent/5 px-2 py-0.5 rounded-lg border border-accent/10">
                                                        {req.category || 'General'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    <PriorityBadge priority={req.priority} />
                                                    <StatusPill status={req.status} />
                                                </div>
                                                {req.adminResponse && (
                                                    <span className="text-[9px] font-black text-success uppercase flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Responded
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                                <button
                                                    onClick={() => handleOpenResponse(req)}
                                                    className="p-3 bg-white shadow-xl border border-border/50 rounded-2xl text-primary hover:bg-primary hover:text-white transition-all transform active:scale-90"
                                                    title="Quick Respond"
                                                >
                                                    <Reply className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(req.id)}
                                                    className="p-3 bg-white shadow-xl border border-border/50 rounded-2xl text-error hover:bg-error hover:text-white transition-all transform active:scale-90"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-8 py-32 text-center text-text-light/40 font-black uppercase tracking-widest leading-loose">
                                        <div className="flex flex-col items-center gap-4">
                                            <MessageSquare className="w-16 h-16 opacity-10" />
                                            No support requests found
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Response Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-text/60 backdrop-blur-md" onClick={() => setSelectedRequest(null)}></div>
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-border/10 flex items-center justify-between bg-primary text-white">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl">
                                    <Headset className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase">Resolve Ticket</h2>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Responding to Ticket #{selectedRequest.id.slice(0, 8)}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-10">
                            <div className="mb-10 bg-background/50 p-6 rounded-3xl border border-border/50 shadow-inner">
                                <div className="flex items-center gap-2 mb-4">
                                    <Info className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] font-black text-text uppercase tracking-widest">Original Message</span>
                                </div>
                                <h4 className="text-sm font-black text-text mb-2">"{selectedRequest.subject}"</h4>
                                <p className="text-xs text-text-light/80 leading-relaxed font-bold">
                                    {selectedRequest.message}
                                </p>
                                <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-text-light/50 uppercase">
                                            <User className="w-3 h-3" /> {selectedRequest.userName}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-text-light/50 uppercase">
                                            <Mail className="w-3 h-3" /> {selectedRequest.userEmail}
                                        </div>
                                    </div>
                                    <PriorityBadge priority={selectedRequest.priority} />
                                </div>
                            </div>

                            <form onSubmit={handleResponseSubmit} className="space-y-8">
                                <div className="flex flex-col gap-6 lg:flex-row">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-text-light uppercase tracking-widest mb-3 block ml-1">Resolution Message</label>
                                        <textarea
                                            value={responseMessage}
                                            onChange={(e) => setResponseMessage(e.target.value)}
                                            rows={5}
                                            className="w-full bg-background border-2 border-border/50 rounded-2xl p-5 text-sm font-bold focus:outline-none focus:border-primary transition-all resize-none shadow-sm"
                                            placeholder="Formulate your response here..."
                                            required
                                        ></textarea>
                                    </div>
                                    <div className="lg:w-1.5 lg:bg-border/20 lg:rounded-full"></div>
                                    <div className="lg:w-56">
                                        <label className="text-[10px] font-black text-text-light uppercase tracking-widest mb-3 block ml-1">Status</label>
                                        <select
                                            value={updateStatus}
                                            onChange={(e) => setUpdateStatus(e.target.value)}
                                            className="w-full bg-background border-2 border-border/50 rounded-2xl p-4 text-xs font-black uppercase tracking-widest cursor-pointer hover:border-primary transition-all"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in-progress">In Progress</option>
                                            <option value="resolved">Resolved</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-4 mt-10">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRequest(null)}
                                        className="px-8 py-3.5 text-xs font-black uppercase text-text-light hover:text-text transition-all tracking-widest"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sendingResponse}
                                        className="px-10 py-3.5 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {sendingResponse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Send Response
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function StatCard({ title, value, icon, color, active, onClick, desc, pulse }: any) {
    return (
        <div
            onClick={onClick}
            className={`p-8 rounded-[2rem] shadow-xl border border-border/40 transition-all group relative overflow-hidden cursor-pointer ${active ? 'bg-white ring-4 ring-primary/10 -translate-y-2' : 'bg-white/50 hover:bg-white'
                }`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-all duration-700 ${color}`}></div>
            <div className="relative z-10 font-black">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl shadow-black/10 transition-transform group-hover:scale-110 ${color} ${pulse ? 'animate-pulse' : ''}`}>
                    {icon}
                </div>
                <p className="text-[10px] text-text-light uppercase tracking-[0.2em] mb-2">{title}</p>
                <div className="flex items-end gap-3">
                    <h3 className="text-4xl text-text tracking-tighter">{value}</h3>
                    {desc && <span className="text-[9px] text-text-light/50 uppercase mb-2">/ {desc}</span>}
                </div>
            </div>
        </div>
    );
}

function PriorityBadge({ priority }: { priority?: string }) {
    const styles = {
        high: "bg-error/10 text-error border-error/20",
        medium: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        low: "bg-success/10 text-success border-success/20",
    };

    const p = priority?.toLowerCase() as keyof typeof styles || 'low';
    const current = styles[p] || styles.low;

    return (
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border flex items-center gap-1.5 ${current}`}>
            {p === 'high' && <AlertTriangle className="w-3 h-3" />}
            {p} Priority
        </span>
    );
}

function StatusPill({ status }: { status?: string }) {
    const styles = {
        pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        "in-progress": "bg-blue-500/10 text-blue-500 border-blue-500/20",
        resolved: "bg-success/10 text-success border-success/20",
    };

    const s = status?.toLowerCase() as keyof typeof styles || 'pending';
    const current = styles[s] || styles.pending;

    return (
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${current}`}>
            {s === 'in-progress' ? 'Processing' : s}
        </span>
    );
}
