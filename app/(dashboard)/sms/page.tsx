"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import {
    Send,
    Users,
    MessageSquare,
    Clock,
    History,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Search as SearchIcon,
    ChevronDown,
    X,
    UserCheck
} from "lucide-react";
import { sendSMSAction } from "@/app/actions/sms";

interface Announcement {
    id: string;
    message: string;
    target: string;
    sentAt: any;
    status: 'sent' | 'pending' | 'failed';
    recipientsCount: number;
}

interface UserIdentity {
    id: string;
    fullName: string;
    phoneNumber: string;
    type: 'homeowner' | 'worker';
}

const SEMAPHORE_API_KEY = "19d2c681c1cde2ba78bb39a8174e444a";

export default function SMSAnnouncementsPage() {
    const [message, setMessage] = useState("");
    const [target, setTarget] = useState("all");
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<Announcement[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    // Specific user selection states
    const [showUserModal, setShowUserModal] = useState(false);
    const [userSearch, setUserSearch] = useState("");
    const [allPotentialUsers, setAllPotentialUsers] = useState<UserIdentity[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserIdentity[]>([]);
    const [fetchingUsers, setFetchingUsers] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const q = query(collection(db, "sms_announcements"), orderBy("sentAt", "desc"));
            const snap = await getDocs(q);
            const historyData = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Announcement[];
            setHistory(historyData);
        } catch (error) {
            console.error("Error fetching SMS history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        setFetchingUsers(true);
        try {
            const [homeownersSnap, workersSnap] = await Promise.all([
                getDocs(collection(db, "homeowners")),
                getDocs(collection(db, "skilled_workers"))
            ]);

            const homeowners = homeownersSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown Homeowner',
                    phoneNumber: data.mobileNumber || data.phoneNumber || data.phone || '',
                    type: 'homeowner' as const
                };
            }).filter(u => u.phoneNumber);

            const workers = workersSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    fullName: data.personalInfo?.fullName || data.fullName || 'Unknown Worker',
                    phoneNumber: data.personalInfo?.mobileNumber || data.personalInfo?.phoneNumber || data.phone || data.phoneNumber || '',
                    type: 'worker' as const
                };
            }).filter(u => u.phoneNumber);

            setAllPotentialUsers([...homeowners, ...workers]);
        } catch (error) {
            console.error("Error fetching users for SMS:", error);
        } finally {
            setFetchingUsers(false);
        }
    };

    const toggleUserSelection = (user: UserIdentity) => {
        if (selectedUsers.find(u => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        if (target === 'specific' && selectedUsers.length === 0) {
            alert("Please select at least one recipient.");
            return;
        }

        setLoading(true);
        try {
            let recipients: string[] = [];

            if (target === 'specific') {
                recipients = selectedUsers.map(u => u.phoneNumber);
            } else {
                const [homeownersSnap, workersSnap] = await Promise.all([
                    target === 'workers' ? Promise.resolve({ docs: [] }) : getDocs(collection(db, "homeowners")),
                    target === 'homeowners' ? Promise.resolve({ docs: [] }) : getDocs(collection(db, "skilled_workers"))
                ]);

                homeownersSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const phone = data.mobileNumber || data.phoneNumber || data.phone;
                    if (phone) recipients.push(phone);
                });

                workersSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const phone = data.personalInfo?.mobileNumber || data.personalInfo?.phoneNumber || data.phone || data.phoneNumber;
                    if (phone) recipients.push(phone);
                });
            }

            // Remove duplicates and empty strings
            recipients = Array.from(new Set(recipients.filter(r => r && r.trim() !== '')));

            if (recipients.length === 0) {
                alert("No valid phone numbers found for the selected audience.");
                setLoading(false);
                return;
            }

            // Replaced raw /api/sms fetch with Server Action to prevent production 404s
            const actionResult = await sendSMSAction(recipients.join(','), message);

            if (actionResult.success) {
                // Record in Firestore
                await addDoc(collection(db, "sms_announcements"), {
                    message,
                    target: target === 'all' ? 'All Users' :
                        target === 'homeowners' ? 'Homeowners' :
                            target === 'workers' ? 'Skilled Workers' :
                                `${selectedUsers.length} Selected Users`,
                    sentAt: serverTimestamp(),
                    status: 'sent',
                    recipientsCount: recipients.length
                });

                setMessage("");
                setSelectedUsers([]);
                setTarget("all");
                alert(`Announcement sent successfully to ${recipients.length} recipients!`);
                fetchHistory();
            } else {
                throw new Error(actionResult.error || "Failed to send SMS via Action");
            }

        } catch (error) {
            console.error("SMS Error:", error);
            alert("Failed to send SMS. Check your connection or API key.");
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = allPotentialUsers.filter(u =>
        u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phoneNumber.includes(userSearch)
    );

    return (
        <>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-text">SMS Announcements</h1>
                    <div className="h-1 w-12 bg-gradient-to-r from-primary to-accent rounded-full mt-2"></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-2xl shadow-md border border-border/50">
                        <h3 className="text-lg font-bold text-text mb-6 flex items-center gap-2">
                            <Send className="w-5 h-5 text-primary" />
                            Compose New Announcement
                        </h3>

                        <form onSubmit={handleSend} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-text mb-2 ml-1">Select Audience</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { id: 'all', label: 'All Users', icon: <Users className="w-4 h-4" /> },
                                        { id: 'homeowners', label: 'Homeowners', icon: <MessageSquare className="w-4 h-4" /> },
                                        { id: 'workers', label: 'Workers', icon: <Users className="w-4 h-4" /> },
                                        { id: 'specific', label: 'Specific', icon: <UserCheck className="w-4 h-4" /> },
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setTarget(item.id);
                                                if (item.id === 'specific' && allPotentialUsers.length === 0) {
                                                    fetchAllUsers();
                                                    setShowUserModal(true);
                                                } else if (item.id === 'specific') {
                                                    setShowUserModal(true);
                                                }
                                            }}
                                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${target === item.id
                                                ? 'border-primary bg-primary/5 text-primary shadow-inner'
                                                : 'border-border text-text-light hover:border-primary/30'
                                                }`}
                                        >
                                            {item.icon}
                                            <span className="text-[10px] font-bold mt-2 uppercase tracking-wider">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {target === 'specific' && selectedUsers.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedUsers.map(u => (
                                            <span key={u.id} className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                                                {u.fullName}
                                                <button onClick={() => toggleUserSelection(u)} className="ml-1 hover:text-error"><X className="w-3 h-3" /></button>
                                            </span>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setShowUserModal(true)}
                                            className="text-[10px] font-bold text-primary underline"
                                        >
                                            Edit Selection ({selectedUsers.length})
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-text mb-2 ml-1">Message Body</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                    className="block w-full p-4 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none pr-10"
                                    placeholder="Type your message here..."
                                    maxLength={160}
                                ></textarea>
                                <div className="flex items-center justify-between mt-2 px-1">
                                    <span className="text-[10px] text-text-light font-bold">Max 160 characters for a single SMS</span>
                                    <span className={`text-[10px] font-bold ${message.length > 140 ? 'text-error' : 'text-text-light'}`}>
                                        {message.length}/160
                                    </span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !message.trim() || (target === 'specific' && selectedUsers.length === 0)}
                                className="w-full bg-primary hover:bg-primary-light text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                {target === 'specific' ? `Send to ${selectedUsers.length} Selected` : 'Broadcast Announcement'}
                            </button>
                        </form>
                    </div>

                    <div className="bg-primary/5 border border-primary/10 p-6 rounded-2xl flex items-start gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-primary text-sm mb-1">Important Note</h4>
                            <p className="text-primary/70 text-xs leading-relaxed">
                                Messages are sent via Semaphore. API Key: <code className="bg-primary/10 px-1 rounded">{SEMAPHORE_API_KEY.slice(0, 5)}...</code>
                                Broadcasts to multiple users will use your Semaphore credits.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-md border border-border/50 overflow-hidden flex flex-col max-h-[700px]">
                    <div className="p-6 border-b border-border/50 flex items-center justify-between bg-background/50 sticky top-0 z-10">
                        <h3 className="font-bold text-text flex items-center gap-2">
                            <History className="w-5 h-5 text-accent" />
                            Announcement History
                        </h3>
                        <button onClick={fetchHistory} className="hover:rotate-180 transition-transform duration-500">
                            <RefreshCw className={`w-4 h-4 text-primary ${historyLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {historyLoading ? (
                            <div className="p-20 flex flex-col items-center gap-3">
                                <RefreshCw className="w-8 h-8 animate-spin text-primary/30" />
                                <span className="text-xs font-bold text-text-light uppercase tracking-widest">Loading Records...</span>
                            </div>
                        ) : history.length > 0 ? (
                            <div className="divide-y divide-border/50">
                                {history.map((item) => (
                                    <div key={item.id} className="p-6 hover:bg-background/50 transition-colors group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex gap-2">
                                                <span className="px-2 py-1 text-[9px] font-extrabold uppercase rounded-lg bg-primary/5 text-primary border border-primary/10">
                                                    {item.target}
                                                </span>
                                                <span className="px-2 py-1 text-[9px] font-extrabold uppercase rounded-lg bg-success/5 text-success border border-success/10">
                                                    {item.recipientsCount} Recipients
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-text-light font-bold">
                                                <Clock className="w-3 h-3" />
                                                {item.sentAt?.toDate ? item.sentAt.toDate().toLocaleString() : 'Recent'}
                                            </div>
                                        </div>
                                        <p className="text-sm text-text bg-white p-3 rounded-lg border border-border/50 shadow-sm transition-all group-hover:border-primary/20">
                                            "{item.message}"
                                        </p>
                                        <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-success uppercase">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Sent Successfully
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-20 text-center text-text-light">
                                No history available.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* User Selection Modal */}
            {showUserModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-text/60 backdrop-blur-sm" onClick={() => setShowUserModal(false)}></div>
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-text">Select Individual Recipients</h3>
                                <p className="text-xs text-text-light font-medium">Choosing specific homeowners or skilled workers</p>
                            </div>
                            <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-background rounded-full transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 bg-background/50 border-b border-border/50">
                            <div className="relative">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                                <input
                                    type="text"
                                    placeholder="Search by name or number..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {fetchingUsers ? (
                                <div className="p-20 text-center font-bold text-text-light animate-pulse">Loading users...</div>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => toggleUserSelection(user)}
                                        className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${selectedUsers.find(u => u.id === user.id)
                                            ? 'bg-primary/5 border-primary shadow-inner'
                                            : 'bg-white border-transparent hover:bg-background'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${user.type === 'homeowner' ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'
                                                }`}>
                                                {user.fullName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-text">{user.fullName}</p>
                                                <p className="text-[11px] font-mono text-text-light">{user.phoneNumber}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${user.type === 'homeowner' ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'
                                                }`}>
                                                {user.type}
                                            </span>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedUsers.find(u => u.id === user.id)
                                                ? 'bg-primary border-primary text-white scale-110'
                                                : 'border-border'
                                                }`}>
                                                {selectedUsers.find(u => u.id === user.id) && <CheckCircle2 className="w-4 h-4" />}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-20 text-center text-text-light">No users matching "{userSearch}"</div>
                            )}
                        </div>

                        <div className="p-6 bg-background border-t border-border/50 flex items-center justify-between rounded-b-3xl">
                            <span className="text-xs font-bold text-text-light">{selectedUsers.length} users selected</span>
                            <button
                                onClick={() => setShowUserModal(false)}
                                className="px-8 py-3 bg-primary text-white font-black text-xs uppercase rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                Confirm Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
