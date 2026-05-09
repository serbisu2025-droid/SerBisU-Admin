"use client";


import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, where, orderBy, addDoc, onSnapshot } from "firebase/firestore";
import {
    Search,
    Mail,
    Phone,
    Filter,
    Toolbox,
    Star,
    CheckCircle2,
    XCircle,
    Loader2,
    MapPin,
    RefreshCw,
    Download,
    Eye,
    ChevronDown,
    Clock,
    User,
    Check,
    X,
    FileText,
    ShieldCheck,
    Briefcase,
    Calendar,
    ArrowUp,
    ArrowDown,
    Undo2,
    AlertCircle,
    Monitor,
    Flag,
    AlertTriangle
} from "lucide-react";
import Image from "next/image";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/rbac";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Fix #8: Utility to normalize names into Title Case
function toTitleCase(str?: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

interface Service {
    id: string;
    name: string;
    category: string;
}

interface VerificationData {
    detectedIdType?: string;
    extractedFields?: {
        idNumber?: string;
        licenseNumber?: string;
        firstName?: string;
        middleName?: string;
        lastName?: string;
        fullName?: string;
        dateOfBirth?: string;
        address?: string;
    };
    extractedName?: string;
    extractedLicenseNumber?: string;
    extractedDOB?: string;
    extractedAddress?: string;
    rawOcrText?: string;
}

interface SkilledWorker {
    id: string;
    fullName?: string;
    age?: number | string;
    email?: string;
    phoneNumber?: string;
    experience?: string;
    address?: string;
    employmentStatus?: string;
    personalInfo?: {
        fullName?: string;
        email?: string;
        phoneNumber?: string;
        mobileNumber?: string;
        age?: number | string;
        address?: string;
        employmentStatus?: string;
    };
    serviceInfo?: {
        serviceType?: string;
        providerType?: string;
        bio?: string;
        experience?: string;
        workingHours?: {
            from?: string;
            to?: string;
        };
    };
    serviceType?: string;
    services?: string[];
    providerType?: string;
    rating?: number;
    jobsCompleted?: number;
    orders?: number;
    isVerified?: boolean;
    status?: string; // 'pending' | 'preliminary_verified' | 'verified' | 'rejected'
    location?: any;
    lastSeen?: any;
    isOnline?: boolean;
    gender?: string;
    rejectionReason?: string;
    activeJobs?: number;
    profileImage?: string;
    serviceAreas?: string[];
    servicePricing?: Record<string, {
        baseRate?: number | string;
        rateType?: string;
    }>;
    priceRate?: {
        baseRate?: number | string;
        rateType?: string;
    };
    // Documents
    idFrontPath?: string;
    idBackPath?: string;
    faceScanPath?: string;
    brgyClearancePath?: string;
    resumePath?: string;
    tesdaCertPath?: string;
    businessPermitPath?: string;
    sectRegistrationPath?: string;
    proofOfWorkPaths?: string[];
    verificationData?: VerificationData;
    // Two-tier verification
    preliminaryVerifiedBy?: string;
    preliminaryVerifiedAt?: any;
    finalVerifiedBy?: string;
    finalVerifiedAt?: any;
}

export default function SkilledWorkersPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Loading verification portal...</div>}>
            <SkilledWorkersContent />
        </Suspense>
    );
}

function SkilledWorkersContent() {
    const [workers, setWorkers] = useState<SkilledWorker[]>([]);
    const [filteredWorkers, setFilteredWorkers] = useState<SkilledWorker[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedWorker, setSelectedWorker] = useState<SkilledWorker | null>(null);
    const [showModal, setShowModal] = useState(false);
    const { user } = useAuth();
    const searchParams = useSearchParams();

    // Fix: Deep linking for notifications
    useEffect(() => {
        if (!loading && workers.length > 0) {
            const workerId = searchParams.get('workerId');
            if (workerId) {
                const target = workers.find(w => w.id === workerId);
                if (target) {
                    setSelectedWorker(target);
                    setShowModal(true);
                }
            }
        }
    }, [loading, workers, searchParams]);

    // Filters
    const [filters, setFilters] = useState({
        category: "all",
        service: "all",
        status: "all",
        availability: "all"
    });
    const [adminNames, setAdminNames] = useState<Record<string, string>>({});

    // Fix #4: Real-time listener for skilled workers (no refresh needed)
    useEffect(() => {
        setLoading(true);

        // Fetch services and admins first (one-time)
        const fetchMeta = async () => {
            try {
                const adminsSnap = await getDocs(collection(db, "admins"));
                const adminsData: Record<string, string> = {};
                adminsSnap.docs.forEach(doc => {
                    adminsData[doc.id] = doc.data().fullName || "Unknown Admin";
                });
                setAdminNames(adminsData);

                const servicesSnap = await getDocs(collection(db, "services"));
                const servicesData = servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
                setServices(servicesData);
            } catch (error) {
                console.error("Error fetching admins/services:", error);
            }
        };
        fetchMeta();

        // Real-time listener for workers
        const unsubWorkers = onSnapshot(collection(db, "skilled_workers"), (snapshot) => {
            const workersData = snapshot.docs.map(doc => {
                const data = doc.data();

                let activityStatus = 'inactive';
                const now = new Date();
                const lastSeen = data.lastSeen ? data.lastSeen.toDate() : null;

                if (lastSeen) {
                    const minutesSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
                    const daysSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysSinceLastSeen >= 7) activityStatus = 'inactive';
                    else if (minutesSinceLastSeen <= 5) activityStatus = 'active';
                    else if (data.isOnline === true) activityStatus = 'active';
                    else activityStatus = 'active';
                } else {
                    activityStatus = data.isOnline ? 'active' : 'offline';
                }

                const docs = data.verificationDocuments || data.documents || data.personalInfo || data.verificationData || {};

                return {
                    id: doc.id,
                    ...data,
                    activityStatus,
                    // Fix #8: Normalize names to title case
                    profileImage: data.profileImage || docs.profileImage || data.profileImageUrl || docs.profileImageUrl || data.personalInfo?.profileImage || data.personalInfo?.profileImageUrl,
                    fullName: toTitleCase(data.personalInfo?.fullName || data.fullName || 'Unknown'),
                    email: data.personalInfo?.email || data.email || 'N/A',
                    phoneNumber: data.personalInfo?.mobileNumber || data.personalInfo?.phoneNumber || data.phone || data.phoneNumber || 'N/A',
                    serviceType: data.serviceInfo?.serviceType || data.serviceType || 'General',
                    providerType: data.serviceInfo?.providerType || data.providerType || 'Freelancer',
                    isVerified: data.status === 'verified',
                    jobsCompleted: data.orders || 0,
                    location: data.personalInfo?.address || data.location?.address || data.address || 'Unknown',
                    age: data.personalInfo?.age || data.age || 'N/A',
                    gender: data.personalInfo?.gender || data.gender || 'N/A',
                    employmentStatus: data.personalInfo?.employmentStatus || data.employmentStatus || 'N/A',
                    experience: data.serviceInfo?.experience || data.experience || 'N/A',
                    address: data.personalInfo?.address || data.location?.address || data.address || 'Unknown',
                    idFrontPath: data.idFrontPath || docs.idFrontPath || docs.idFront || data.idFront || data.id_front || docs.id_front || docs.idFrontImage || data.idFrontImage,
                    idBackPath: data.idBackPath || docs.idBackPath || docs.idBack || data.idBack || data.id_back || docs.id_back || docs.idBackImage || data.idBackImage,
                    faceScanPath: data.faceScanPath || docs.faceScanPath || docs.faceScan || data.faceScan || data.face_scan || docs.face_scan || docs.selfieUrl || data.selfieUrl || data.faceImage || docs.faceImage,
                    brgyClearancePath: data.brgyClearancePath || docs.brgyClearancePath || data.brgyClearanceUrl || docs.brgyClearanceUrl || docs.brgyClearance || data.brgyClearance || data.brgy_clearance || docs.brgy_clearance || data.barangayClearance || docs.barangayClearance,
                    resumePath: data.resumePath || docs.resumePath || data.resumeUrl || docs.resumeUrl || docs.resume || data.resume || data.biodata || docs.biodata,
                    tesdaCertPath: data.tesdaCertPath || docs.tesdaCertPath || data.tesdaUrl || docs.tesdaUrl || data.tesdaCertUrl || docs.tesdaCertUrl || docs.tesda || data.tesda || data.tesda_cert || docs.tesda_cert,
                    businessPermitPath: data.businessPermitPath || docs.businessPermitPath || data.businessPermitUrl || docs.businessPermitUrl || docs.businessPermit || data.businessPermit || data.business_permit || docs.business_permit || data.permitUrl || docs.permitUrl,
                    sectRegistrationPath: data.sectRegistrationPath || docs.sectRegistrationPath || data.sectRegistrationUrl || docs.sectRegistrationUrl || docs.sectRegistration || data.sectRegistration || data.sect_registration || docs.sect_registration || data.dtiUrl || docs.dtiUrl || data.secUrl || docs.secUrl,
                    servicePricing: data.servicePricing || {},
                    priceRate: data.priceRate || {},
                    proofOfWorkPaths: data.proofOfWorkPaths || docs.proofOfWorkPaths || data.proofOfWorkUrls || docs.proofOfWorkUrls || data.workSamples,
                } as SkilledWorker;
            });
            setWorkers(workersData);
            setFilteredWorkers(workersData);
            setLoading(false);
        }, (error) => {
            console.error("Error listening to workers:", error);
            setLoading(false);
        });

        return () => unsubWorkers();
    }, []);

    useEffect(() => {
        const applyFilters = () => {
            let result = workers;

            // Role-based initial filter (Two-Step Verification)
            if (user?.role === 'verifier_admin') {
                // PESO Admins see Pending, Tier 2, Final Verified, and Rejected workers
                result = result.filter(w => w.status === 'pending' || !w.status || w.status === 'preliminary_verified' || w.status === 'verified' || w.status === 'rejected');
            } else if (user?.role === 'super_admin') {
                // Super Admin sees ALL workers by default
            }

            // Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                result = result.filter(w =>
                    w.fullName?.toLowerCase().includes(term) ||
                    w.serviceType?.toLowerCase().includes(term) ||
                    w.id.toLowerCase().includes(term)
                );
            }

            // Dropdown Filters
            if (filters.category !== "all") {
                result = result.filter(w => {
                    const workerServices = w.services || [w.serviceType || ""];
                    return workerServices.some(s => {
                        const serviceObj = services.find(serv => serv.name === s);
                        return serviceObj && serviceObj.category === filters.category;
                    });
                });
            }

            if (filters.service !== "all") {
                result = result.filter(w =>
                    (w.services && w.services.includes(filters.service)) ||
                    w.serviceType === filters.service
                );
            }

            if (filters.status !== "all") {
                if (filters.status === "verified") result = result.filter(w => w.status === 'verified');
                else if (filters.status === "preliminary_verified") result = result.filter(w => w.status === 'preliminary_verified');
                else if (filters.status === "pending") result = result.filter(w => w.status === 'pending' || !w.status);
                else result = result.filter(w => w.status === filters.status);
            }

            if (filters.availability !== "all") {
                result = result.filter(w => (w as any).activityStatus === filters.availability);
            }

            setFilteredWorkers(result);
        };

        applyFilters();
    }, [searchTerm, filters, workers, services]);

    const sendSms = async (phone: string, message: string) => {
        try {
            if (!phone || phone === 'N/A') return;

            const response = await fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    numbers: phone // local API expects 'numbers'
                })
            });

            if (!response.ok) {
                console.error('Failed to send SMS, status:', response.status);
            }
        } catch (e) {
            console.error('Failed to send SMS:', e);
        }
    };

    const handleUpdateStatus = async (worker: SkilledWorker, newStatus: string) => {
        if (!user) {
            alert("Authentication required");
            return;
        }

        let reason = "";
        if (newStatus === "rejected") {
            reason = prompt("Please provide a reason for rejection:") || "";
            if (!reason) return;
        }

        const createAdminNotification = async (notification: any) => {
            try {
                await addDoc(collection(db, "admin_notifications"), {
                    ...notification,
                    createdAt: serverTimestamp(),
                    read: false
                });
            } catch (err) {
                console.warn("Failed to create admin notification (likely permissions):", err);
            }
        };

        try {
            const update: any = {
                updatedAt: serverTimestamp()
            };

            // Two-tier verification logic
            if (newStatus === 'verified') {
                // Check current status and user role
                const currentStatus = worker.status || 'pending';

                if (user.role === 'super_admin') {
                    // Super Admin can do full verification or preliminary review
                    update.status = 'verified';
                    update.finalVerifiedBy = user.uid;
                    update.finalVerifiedAt = serverTimestamp();
                    update.isVerified = true;
                    update.rejectionReason = null;
                } else if (user.role === 'verifier_admin') {
                    // Verifier admin (PESO) can also do direct final verification
                    update.status = 'verified';
                    update.finalVerifiedBy = user.uid;
                    update.finalVerifiedAt = serverTimestamp();
                    update.isVerified = true;
                    update.rejectionReason = null;
                }

                await updateDoc(doc(db, "skilled_workers", worker.id), update);

                // NOTIFY OTHER ADMIN ROLES ABOUT APPROVAL
                await createAdminNotification({
                    title: "Worker Verified",
                    message: `${worker.fullName} has been fully verified by ${user.role.replace('_', ' ')}.`,
                    type: "success",
                    targetRole: user.role === 'super_admin' ? 'verifier_admin' : 'super_admin'
                });

                const msg = `Hi ${worker.fullName}, your SerBisU provider account has been fully verified. You can now receive jobs.`;
                await sendSms(worker.phoneNumber || "", msg);

                setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, ...update, isVerified: true } : w));
                alert("Worker fully verified successfully.");
            } else if (newStatus === 'rejected') {
                update.status = 'rejected';
                update.isVerified = false;
                update.rejectionReason = reason;
                update.rejectedAt = serverTimestamp();
                update.rejectedBy = user.uid;

                await updateDoc(doc(db, "skilled_workers", worker.id), update);

                // NOTIFY OTHER ADMIN ROLE ABOUT REJECTION
                await createAdminNotification({
                    title: "Worker Application Rejected",
                    message: `${worker.fullName} was rejected by ${user.role.replace('_', ' ')}. Reason: ${reason}`,
                    type: "warning",
                    targetRole: user.role === 'super_admin' ? 'verifier_admin' : 'super_admin'
                });

                const msg = `Hi ${worker.fullName}, your SerBisU provider application was rejected: ${reason}. You may update your details and reapply.`;
                await sendSms(worker.phoneNumber || "", msg);

                setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, ...update, isVerified: false } : w));
                alert("Worker rejected.");
            } else {
                // Handle other status changes
                update.status = newStatus;
                update.isVerified = newStatus === 'verified';

                await updateDoc(doc(db, "skilled_workers", worker.id), update);
                setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, ...update } : w));
                alert(`Worker status updated to ${newStatus}.`);
            }
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status.");
        }
    };

    // Fix #2: PESO verification goes directly to verifier_admin
    // If current user is verifier_admin, they get pending workers directly
    // Fix #4 already handled via real-time listener above

    const exportToCSV = () => {
        const headers = ["Full Name", "Phone", "Type", "Service", "Location", "Rating", "Jobs", "Verified", "Status"];
        const rows = workers.map(w => [
            w.fullName,
            w.phoneNumber,
            w.providerType,
            w.serviceType,
            w.location,
            w.rating?.toFixed(1) || "0.0",
            w.jobsCompleted || 0,
            w.isVerified ? "Yes" : "No",
            w.status
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `skilled_workers_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const formatLastSeen = (date: any) => {
        if (!date) return 'Unknown';
        const d = date.toDate ? date.toDate() : new Date(date);
        const diff = (new Date().getTime() - d.getTime()) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        return d.toLocaleDateString();
    };

    const categories = Array.from(new Set(services.map(s => s.category)));

    return (
        <>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text uppercase">
                        {user?.role === 'super_admin' ? 'Verification' : 'PESO Verification'}
                    </h1>
                    <p className="text-text-light font-semibold uppercase tracking-widest text-[10px] mt-1">
                        {user?.role === 'super_admin'
                            ? 'Manage all skilled workers and handle direct approvals'
                            : 'Direct review and verification for skilled worker applications'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Fix #4: Real-time; Refresh reloads page to reinitialize listeners */}
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border rounded-xl text-sm font-semibold hover:bg-background transition-all shadow-sm active:scale-95"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Refresh
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-5 py-2.5 bg-success text-white rounded-xl text-sm font-bold hover:bg-success/90 transition-all shadow-sm active:scale-95"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Providers"
                    value={workers.length}
                    icon={<Toolbox className="w-6 h-6" />}
                    color="blue"
                    change="+8%"
                />
                <StatCard
                    title="Verified Providers"
                    value={workers.filter(w => w.isVerified).length}
                    icon={<CheckCircle2 className="w-6 h-6" />}
                    color="teal"
                    change="+12%"
                />
                <StatCard
                    title="Avg. Rating"
                    value={(workers.reduce((s, w) => s + (w.rating || 0), 0) / (workers.length || 1)).toFixed(1)}
                    icon={<Star className="w-6 h-6" />}
                    color="purple"
                    change="+0.2"
                />
                <StatCard
                    title="Active Jobs"
                    value={workers.reduce((s, w) => s + (w.activeJobs || 0), 0)}
                    icon={<Briefcase className="w-6 h-6" />}
                    color="orange"
                    change="-3%"
                    negative
                />
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/50 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                    <div className="lg:col-span-1">
                        <label className="text-xs font-extrabold text-text-light uppercase tracking-wider mb-2 block flex items-center gap-2">
                            <Search className="w-3 h-3 text-primary" /> Search
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                            <input
                                type="text"
                                placeholder="Name or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div>
                        <FilterLabel icon={<Filter className="w-3 h-3 text-primary" />} label="Category" />
                        <select
                            value={filters.category}
                            onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                            className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none transition-all font-semibold appearance-none cursor-pointer"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <FilterLabel icon={<Toolbox className="w-3 h-3 text-primary" />} label="Service" />
                        <select
                            value={filters.service}
                            onChange={(e) => setFilters(f => ({ ...f, service: e.target.value }))}
                            className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none transition-all font-semibold appearance-none cursor-pointer"
                        >
                            <option value="all">All Services</option>
                            {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <FilterLabel icon={<ShieldCheck className="w-3 h-3 text-primary" />} label="Verification" />
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                            className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none transition-all font-semibold appearance-none cursor-pointer"
                        >
                            <option value="all">All Statuses</option>
                            <option value="verified">Verified</option>
                            <option value="preliminary_verified">Waiting for PESO</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    <button
                        onClick={() => {
                            setFilters({ category: "all", service: "all", status: "all", availability: "all" });
                            setSearchTerm("");
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-background border border-border rounded-xl text-sm font-bold text-text-light hover:bg-border/30 transition-all active:scale-95"
                    >
                        <Undo2 className="w-4 h-4" />
                        Reset Filters
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-xl border border-border/50 overflow-hidden">
                {loading ? (
                    <div className="p-32 flex flex-col items-center justify-center text-text-light gap-6">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <p className="font-bold text-lg animate-pulse">Loading providers...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-background/80 backdrop-blur-sm text-text-light text-[11px] uppercase font-black tracking-[0.1em]">
                                <tr>
                                    <th className="px-8 py-5">Skilled Worker</th>
                                    <th className="px-8 py-5">Service & Experience</th>
                                    <th className="px-8 py-5">Contact & Age</th>
                                    <th className="px-8 py-5">Address</th>
                                    <th className="px-8 py-5">Verification</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {filteredWorkers.length > 0 ? (
                                    filteredWorkers.map((worker) => (
                                        <tr key={worker.id} className="hover:bg-primary/5 transition-all group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent overflow-hidden ring-4 ring-accent/5">
                                                            {worker.profileImage ? (
                                                                <img src={worker.profileImage} alt={worker.fullName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User className="w-6 h-6" />
                                                            )}
                                                        </div>
                                                        <div className={cn(
                                                            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white",
                                                            (worker as any).activityStatus === 'active' ? "bg-success" : "bg-text-light"
                                                        )}></div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-text group-hover:text-primary transition-colors flex items-center gap-2">
                                                            {worker.fullName}
                                                            <span className="flex items-center gap-0.5 text-yellow-500 bg-yellow-400/5 px-2 py-0.5 rounded-full border border-yellow-400/20 shadow-sm shadow-yellow-400/10">
                                                                <Star className="w-3 h-3 fill-current" />
                                                                <span className="text-[10px] font-black font-mono leading-none">{worker.rating?.toFixed(1) || "0.0"}</span>
                                                            </span>
                                                        </p>
                                                        <p className="text-[11px] font-bold text-text-light/60 mt-0.5 leading-tight truncate max-w-[180px]">{worker.email}</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className={cn(
                                                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full outline outline-1 outline-offset-1",
                                                                worker.providerType === 'Business' ? "bg-blue-600/10 text-blue-600 outline-blue-600/20" : "bg-teal-600/10 text-teal-600 outline-teal-600/20"
                                                            )}>
                                                                {worker.providerType}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-primary/10 rounded-lg">
                                                            <Toolbox className="w-3.5 h-3.5 text-primary" />
                                                        </div>
                                                        <span className="text-sm font-bold text-text">{worker.serviceType}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-blue-500/10 rounded-lg">
                                                            <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                                                        </div>
                                                        <span className="text-xs font-medium text-text-light">{worker.experience} Level</span>
                                                    </div>
                                                    {worker.servicePricing && Object.keys(worker.servicePricing).length > 0 ? (
                                                        <div className="mt-2 space-y-1">
                                                            {Object.entries(worker.servicePricing).slice(0, 2).map(([service, price]) => (
                                                                <div key={service} className="text-[10px] font-bold text-primary flex items-center gap-1">
                                                                    <span className="opacity-60 truncate max-w-[80px]">{service}:</span>
                                                                    <span>₱{price.baseRate} {price.rateType === 'Per Hour' ? '/hr' : price.rateType === 'Per Day' ? '/day' : '/job'}</span>
                                                                </div>
                                                            ))}
                                                            {Object.keys(worker.servicePricing).length > 2 && (
                                                                <span className="text-[9px] text-text-light italic">+{Object.keys(worker.servicePricing).length - 2} more rates</span>
                                                            )}
                                                        </div>
                                                    ) : worker.priceRate?.baseRate ? (
                                                        <div className="mt-2 text-[10px] font-bold text-primary">
                                                            ₱{worker.priceRate.baseRate} {worker.priceRate.rateType === 'Per Hour' ? '/hr' : worker.priceRate.rateType === 'Per Day' ? '/day' : '/job'}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-success/10 rounded-lg">
                                                            <Phone className="w-3.5 h-3.5 text-success" />
                                                        </div>
                                                        <span className="text-xs font-bold text-text">{worker.phoneNumber}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-orange-500/10 rounded-lg">
                                                            <User className="w-3.5 h-3.5 text-orange-500" />
                                                        </div>
                                                        <span className="text-xs font-medium text-text-light">{worker.age} Years Old • {worker.gender}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className={cn(
                                                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                                            worker.employmentStatus === 'Employed' ? "bg-success/10 text-success" :
                                                            worker.employmentStatus === 'Underemployed' ? "bg-orange-500/10 text-orange-500" :
                                                            worker.employmentStatus === 'Unemployed' ? "bg-error/10 text-error" :
                                                            "bg-text-light/10 text-text-light"
                                                        )}>
                                                            {worker.employmentStatus || 'N/A'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-start gap-2 max-w-[200px]">
                                                    <MapPin className="w-3 h-3 text-error shrink-0 mt-0.5" />
                                                    <p className="text-xs font-medium text-text-light line-clamp-2 leading-relaxed">
                                                        {worker.address}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {worker.status !== 'verified' && worker.status !== 'rejected' ? (
                                                    <select
                                                        value={worker.status || 'pending'}
                                                        onChange={(e) => handleUpdateStatus(worker, e.target.value)}
                                                        className={cn(
                                                            "text-[10px] font-black uppercase px-3 py-1.5 rounded-full border-2 transition-all cursor-pointer focus:outline-none appearance-none text-center min-w-[140px]",
                                                            worker.status === 'preliminary_verified'
                                                                ? "bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20"
                                                                : "bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20"
                                                        )}
                                                    >
                                                        <option value="pending">⊙ Pending Review</option>
                                                        <option value="preliminary_verified">⊙ Waiting for PESO</option>
                                                        <option value="verified">⊙ Fully Verified</option>
                                                        <option value="rejected">⊙ Rejected</option>
                                                    </select>
                                                ) : (
                                                    <span className={cn(
                                                        "text-[10px] font-black uppercase px-3 py-1.5 rounded-full border-2",
                                                        worker.status === 'verified' ? "bg-success/10 text-success border-success/30" : "bg-error/10 text-error border-error/30"
                                                    )}>
                                                        {worker.status === 'verified' ? 'Fully Verified' : 'Rejected'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-6">
                                                    <div className="flex flex-col items-end text-right">
                                                        <span className={cn(
                                                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full w-fit",
                                                            (worker as any).activityStatus === 'active' ? "bg-success/10 text-success" : "bg-text-light/10 text-text-light"
                                                        )}>
                                                            {(worker as any).activityStatus}
                                                        </span>
                                                        {worker.lastSeen && (
                                                            <span className="text-[10px] text-text-light/60 font-medium mt-1.5 flex items-center justify-end gap-1">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {formatLastSeen(worker.lastSeen)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => { setSelectedWorker(worker); setShowModal(true); }}
                                                        className="p-2.5 bg-white shadow-sm border border-border rounded-xl text-primary hover:bg-primary hover:text-white transition-all transform active:scale-90"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-32 text-center">
                                            <div className="flex flex-col items-center gap-4 text-text-light/40">
                                                <Toolbox className="w-16 h-16" />
                                                <p className="text-xl font-black uppercase tracking-widest">No providers found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && selectedWorker && (
                <WorkerDetailsModal
                    worker={selectedWorker}
                    onClose={() => { setShowModal(false); setSelectedWorker(null); }}
                    onStatusUpdate={handleUpdateStatus}
                    adminNames={adminNames}
                />
            )}
        </>
    );
}

function StatCard({ title, value, icon, color, change, negative }: any) {
    const colors = {
        blue: "bg-blue-600",
        teal: "bg-teal-500",
        purple: "bg-purple-600",
        orange: "bg-orange-500"
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/50 transition-all hover:-translate-y-1 hover:shadow-xl relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-full h-1 ${colors[color as keyof typeof colors]} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
            <div className="flex items-center gap-5">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", colors[color as keyof typeof colors])}>
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-black text-text-light/60 uppercase tracking-widest mb-1">{title}</h3>
                    <p className="text-2xl font-black text-text leading-none">{value}</p>
                    <div className={cn(
                        "flex items-center gap-1.5 mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full w-fit",
                        negative ? "bg-error/10 text-error" : "bg-success/10 text-success"
                    )}>
                        {negative ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                        {change}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FilterLabel({ icon, label }: any) {
    return (
        <label className="text-xs font-extrabold text-text-light uppercase tracking-wider mb-2 block flex items-center gap-2 ml-1">
            {icon} {label}
        </label>
    );
}

function WorkerDetailsModal({ worker, onClose, onStatusUpdate, adminNames }: { worker: SkilledWorker, onClose: () => void, onStatusUpdate: any, adminNames: Record<string, string> }) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [isProcessing, setIsProcessing] = useState(false);
    const isFreelancer = worker.providerType === 'Freelancer';

    const handleAction = async (newStatus: string) => {
        setIsProcessing(true);
        try {
            await onStatusUpdate(worker, newStatus);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 bg-text/60 backdrop-blur-md" onClick={onClose}></div>
            <div className="bg-white w-full max-w-4xl max-h-full overflow-y-auto rounded-3xl shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-bottom border-border/50 p-6 flex items-center justify-between z-20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text group-hover:text-primary transition-colors">
                                {worker.fullName}
                            </h2>
                            <p className="text-xs text-text-light font-bold uppercase tracking-wider opacity-60">Skilled Worker Details</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-background rounded-xl transition-all active:scale-90">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8">
                    {/* Top Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                        <div className="md:col-span-1">
                            <div className="aspect-square rounded-3xl overflow-hidden ring-8 ring-background mb-4 shadow-inner">
                                {worker.profileImage ? (
                                    <img src={worker.profileImage} alt={worker.fullName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-accent text-white flex items-center justify-center text-6xl font-black">
                                        {worker.fullName?.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <span className="bg-primary/10 text-primary text-[10px] font-black uppercase px-3 py-1 rounded-full">{worker.serviceType}</span>
                                <span className={cn(
                                    "text-[10px] font-black uppercase px-3 py-1 rounded-full",
                                    worker.isVerified ? "bg-success/10 text-success" : "bg-orange-500/10 text-orange-500"
                                )}>
                                    {worker.status === 'rejected' ? 'Rejected (Waiting for Resubmission)' : worker.status}
                                </span>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-6">
                            <div className="grid grid-cols-2 gap-6 bg-background/50 p-6 rounded-3xl border border-border/50">
                                <DetailItem icon={<Mail className="w-4 h-4" />} label="Email Address" value={worker.email} />
                                <DetailItem icon={<Phone className="w-4 h-4" />} label="Phone Number" value={worker.phoneNumber} />
                                <DetailItem icon={<Calendar className="w-4 h-4" />} label="Age / Gender" value={`${worker.age} Years Old / ${worker.gender}`} />
                                <DetailItem icon={<MapPin className="w-4 h-4" />} label="Main Location" value={worker.location} />
                                <DetailItem icon={<Briefcase className="w-4 h-4" />} label="Employment Status" value={
                                    <span className={cn(
                                        "text-xs font-black uppercase px-3 py-1 rounded-full",
                                        worker.employmentStatus === 'Employed' ? "bg-success/10 text-success" :
                                        worker.employmentStatus === 'Underemployed' ? "bg-orange-500/10 text-orange-500" :
                                        worker.employmentStatus === 'Unemployed' ? "bg-error/10 text-error" :
                                        "bg-text-light/10 text-text-light"
                                    )}>
                                        {worker.employmentStatus || 'Not Specified'}
                                    </span>
                                } />
                            </div>

                            <div className="flex items-center gap-10 px-6 py-4 bg-primary text-white rounded-3xl shadow-lg">
                                <div className="text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Total Rating</p>
                                    <div className="flex items-center gap-2">
                                        <Star className="w-5 h-5 text-yellow-400 fill-current" />
                                        <span className="text-2xl font-black">{worker.rating?.toFixed(1) || "0.0"}</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Activity</p>
                                    <span className="text-sm font-bold uppercase">{(worker as any).activityStatus}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Info Sections */}
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-sm font-black text-text uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" /> Professional Bio
                                </h3>
                                <div className="p-5 bg-background border-l-4 border-primary rounded-xl text-sm leading-relaxed font-medium">
                                    {worker.serviceInfo?.bio || "No professional biography available for this provider."}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-black text-text uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-primary" /> Experience & Skills
                                </h3>
                                <div className="space-y-4">
                                    <div className="p-5 bg-background rounded-xl border border-border/50">
                                        <p className="text-xs font-black text-text-light/60 uppercase mb-2">Years of Experience</p>
                                        <p className="text-sm font-bold text-text">{worker.serviceInfo?.experience || "Not specified"}</p>
                                    </div>
                                    <div className="p-5 bg-background rounded-xl border border-border/50">
                                        <p className="text-xs font-black text-text-light/60 uppercase mb-2">Working Hours</p>
                                        <p className="text-sm font-bold text-text">
                                            {worker.serviceInfo?.workingHours?.from || "9:00 AM"} to {worker.serviceInfo?.workingHours?.to || "5:00 PM"}
                                        </p>
                                    </div>
                                    <div className="p-5 bg-background rounded-xl border border-border/50">
                                        <p className="text-xs font-black text-text-light/60 uppercase mb-2">Service Jurisdictions</p>
                                        <p className="text-sm font-bold text-text">{worker.serviceAreas?.join(", ") || "Main location only"}</p>
                                    </div>
                                    
                                    {/* Service Rates Section */}
                                    <div className="p-5 bg-primary/5 rounded-xl border border-primary/20">
                                        <p className="text-xs font-black text-primary uppercase mb-3 flex items-center gap-2">
                                            <Star className="w-3 h-3" /> Service Rates
                                        </p>
                                        <div className="space-y-3">
                                            {worker.servicePricing && Object.keys(worker.servicePricing).length > 0 ? (
                                                Object.entries(worker.servicePricing).map(([service, price]) => (
                                                    <div key={service} className="flex items-center justify-between py-2 border-b border-primary/10 last:border-0">
                                                        <span className="text-sm font-bold text-text">{service}</span>
                                                        <span className="text-sm font-black text-primary">
                                                            ₱{price.baseRate} <span className="text-[10px] uppercase opacity-60">/ {price.rateType?.replace('Per ', '')}</span>
                                                        </span>
                                                    </div>
                                                ))
                                            ) : worker.priceRate?.baseRate ? (
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="text-sm font-bold text-text">Base Rate</span>
                                                    <span className="text-sm font-black text-primary">
                                                        ₱{worker.priceRate.baseRate} <span className="text-[10px] uppercase opacity-60">/ {worker.priceRate.rateType?.replace('Per ', '')}</span>
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-text-light italic">No rates specified</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Documents Section */}
                        <div className="space-y-8">
                            <h3 className="text-sm font-black text-text uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-primary" /> Verification Documents
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                {isFreelancer ? (
                                    <>
                                        <DocPreview label="ID Front" url={worker.idFrontPath} workerId={worker.id} />
                                        <DocPreview label="ID Back" url={worker.idBackPath} workerId={worker.id} />
                                        <DocPreview label="BRGY Clearance" url={worker.brgyClearancePath} workerId={worker.id} />
                                        <DocPreview label="Resume" url={worker.resumePath} workerId={worker.id} />
                                        <DocPreview label="TESDA Cert" url={worker.tesdaCertPath} workerId={worker.id} />
                                    </>
                                ) : (
                                    <>
                                        <DocPreview label="Business Permit" url={worker.businessPermitPath} workerId={worker.id} />
                                        <DocPreview label="SECT Registration" url={worker.sectRegistrationPath} workerId={worker.id} />
                                    </>
                                )}
                                <DocPreview label="Face Scan" url={worker.faceScanPath} workerId={worker.id} />
                            </div>

                            {/* Proof of Work Section */}
                            <div className="mt-8">
                                <h3 className="text-[11px] font-black text-text uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Monitor className="w-3.5 h-3.5 text-primary" /> Portfolio / Proof of Work
                                </h3>
                                {worker.proofOfWorkPaths && worker.proofOfWorkPaths.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {worker.proofOfWorkPaths.map((path, index) => (
                                            <DocPreview key={index} label={`Sample ${index + 1}`} url={path} workerId={worker.id} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 bg-background rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-text-light/20 mb-3">
                                            <Briefcase className="w-6 h-6" />
                                        </div>
                                        <p className="text-[10px] font-bold text-text-light/40 uppercase tracking-widest">No work samples uploaded</p>
                                    </div>
                                )}
                            </div>

                            {/* OCR Data */}
                            <div className="bg-text text-white p-6 rounded-3xl shadow-2xl">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2 text-primary">
                                    <Toolbox className="w-3 h-3" /> OCR Data Analytics
                                </h4>
                                {worker.verificationData ? (
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <OcrItem label="ID Type" value={worker.verificationData.detectedIdType} />
                                            {worker.verificationData.detectedIdType?.toLowerCase().includes("driver") ? (
                                                <OcrItem label="License Number" value={worker.verificationData.extractedFields?.licenseNumber} />
                                            ) : (
                                                <OcrItem label="ID Number" value={worker.verificationData.extractedFields?.idNumber} />
                                            )}
                                            <OcrItem label="Full Name" value={worker.verificationData.extractedFields?.fullName} />
                                            <OcrItem label="First Name" value={worker.verificationData.extractedFields?.firstName} />
                                            <OcrItem label="Middle Name" value={worker.verificationData.extractedFields?.middleName} />
                                            <OcrItem label="Last Name" value={worker.verificationData.extractedFields?.lastName} />
                                            <OcrItem label="Date of Birth" value={worker.verificationData.extractedFields?.dateOfBirth} />
                                        </div>
                                        <div className="pt-4 border-t border-white/10">
                                            <p className="text-[9px] font-black uppercase text-white/40 mb-2">Raw Data Dump</p>
                                            <pre className="text-[10px] bg-black/40 p-4 rounded-xl overflow-x-auto font-mono text-white/80 whitespace-pre-wrap max-h-32">
                                                {worker.verificationData.rawOcrText || "None"}
                                            </pre>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-10 text-center text-white/40 font-bold">
                                        No OCR intelligence extracted for this provider.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-12 pt-8 border-t border-border/50">
                        {/* Verification Tier Info */}
                        {(worker.preliminaryVerifiedBy || worker.finalVerifiedBy) && (
                            <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-2xl">
                                <h4 className="text-xs font-black uppercase text-blue-900 mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    Verification History
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {worker.preliminaryVerifiedBy && (
                                        <div className="bg-white p-4 rounded-xl">
                                            <p className="text-[9px] font-black text-text-light/60 uppercase mb-1">Admin Review (Tier 1)</p>
                                            <p className="text-sm font-bold text-text">Verify by: {adminNames[worker.preliminaryVerifiedBy] || `ID: ${worker.preliminaryVerifiedBy.slice(-6)}`}</p>
                                            {worker.preliminaryVerifiedAt && (
                                                <p className="text-xs text-text-light mt-1">
                                                    {(() => {
                                                        try {
                                                            const d = worker.preliminaryVerifiedAt.toDate ? worker.preliminaryVerifiedAt.toDate() : new Date(worker.preliminaryVerifiedAt);
                                                            if (isNaN(d.getTime())) return "Just now";
                                                            return d.toLocaleString();
                                                        } catch (e) {
                                                            return "Just now";
                                                        }
                                                    })()}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {worker.finalVerifiedBy && (
                                        <div className="bg-white p-4 rounded-xl">
                                            <p className="text-[9px] font-black text-text-light/60 uppercase mb-1">Verification Status</p>
                                            <p className="text-sm font-bold text-text">Verify by: {adminNames[worker.finalVerifiedBy] || `ID: ${worker.finalVerifiedBy.slice(-6)}`}</p>
                                            {worker.finalVerifiedAt && (
                                                <p className="text-xs text-text-light mt-1">
                                                    {(() => {
                                                        try {
                                                            const d = worker.finalVerifiedAt.toDate ? worker.finalVerifiedAt.toDate() : new Date(worker.finalVerifiedAt);
                                                            if (isNaN(d.getTime())) return "Just now";
                                                            return d.toLocaleString();
                                                        } catch (e) {
                                                            return "Just now";
                                                        }
                                                    })()}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex items-center gap-3">
                                {worker.status === 'preliminary_verified' && user?.role === 'super_admin' ? (
                                    <div className="px-6 py-3 bg-blue-500/10 text-blue-500 border-blue-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest border flex items-center gap-2">
                                        <Clock className="w-4 h-4" /> Waiting for PESO Verification
                                    </div>
                                ) : !(worker.status === 'verified' || worker.status === 'rejected') ? (
                                    <>
                                        <button
                                            onClick={() => handleAction('verified')}
                                            disabled={isProcessing}
                                            className="flex items-center gap-2 px-6 py-3 bg-success text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:scale-105 transition-all shadow-lg shadow-success/20 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed min-w-[200px] justify-center"
                                        >
                                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                            Approve and Verify Application
                                        </button>
                                        <button
                                            onClick={() => handleAction('rejected')}
                                            disabled={isProcessing}
                                            className="flex items-center gap-2 px-6 py-3 bg-error text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:scale-105 transition-all shadow-lg shadow-error/20 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                                        >
                                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                            Reject
                                        </button>
                                    </>
                                ) : (
                                    <div className={`px-6 py-3 ${worker.status === 'verified' ? 'bg-success/10 text-success border-success/30' : 'bg-error/10 text-error border-error/30'} rounded-2xl text-xs font-black uppercase tracking-widest border flex items-center gap-2`}>
                                        <ShieldCheck className="w-4 h-4" /> {worker.status === 'verified' ? 'Fully PESO Verified' : 'Application Rejected'}
                                    </div>
                                )}
                            </div>

                            {/* Fix #3: PESO Scam Reporting */}
                            {user?.role === 'verifier_admin' && (worker.status === 'verified' || worker.status === 'preliminary_verified') && (
                                <button
                                    onClick={async () => {
                                        const reason = prompt(`Report "${worker.fullName}" as a scam/unreliable worker?\n\nPlease specify the reason for this report:`);
                                        if (!reason) return;
                                        try {
                                            await addDoc(collection(db, "peso_reports"), {
                                                workerId: worker.id,
                                                workerName: worker.fullName,
                                                workerPhone: worker.phoneNumber,
                                                reason: reason,
                                                reportedBy: user?.uid || 'verifier_admin',
                                                reportedByName: 'PESO Admin',
                                                status: 'pending_review',
                                                createdAt: serverTimestamp(),
                                            });
                                            // Also notify Super Admin
                                            await addDoc(collection(db, "admin_notifications"), {
                                                title: "⚠️ Scam/Unreliable Worker Report",
                                                message: `PESO Admin reported ${worker.fullName} as unreliable/scam. Reason: ${reason}`,
                                                type: 'error',
                                                targetRole: 'super_admin',
                                                workerId: worker.id,
                                                read: false,
                                                createdAt: serverTimestamp(),
                                            });
                                            alert(`Report submitted successfully. Super Admin has been notified about ${worker.fullName}.`);
                                        } catch (err) {
                                            console.error('Report failed:', err);
                                            alert('Failed to submit report. Please try again.');
                                        }
                                    }}
                                    className="flex items-center gap-2 px-5 py-3 bg-orange-500/10 text-orange-600 border border-orange-500/30 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-orange-500 hover:text-white transition-all active:scale-95"
                                >
                                    <Flag className="w-4 h-4" />
                                    Report Scam / Unreliable
                                </button>
                            )}

                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-background border border-border rounded-2xl text-sm font-bold text-text-light hover:bg-border/30 transition-all font-bold"
                            >
                                Return to List
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DetailItem({ icon, label, value }: any) {
    return (
        <div className="space-y-1">
            <p className="text-[9px] font-black text-text-light/60 uppercase tracking-widest flex items-center gap-1.5">
                {icon} {label}
            </p>
            <p className="text-sm font-bold text-text truncate font-sans">{value}</p>
        </div>
    );
}

function DocPreview({ label, url, workerId }: { label: string, url?: string, workerId?: string }) {
    const [displayUrl, setDisplayUrl] = useState<string | undefined>(undefined);
    const [resolving, setResolving] = useState(false);

    useEffect(() => {
        const resolveUrl = async () => {
            if (!url) {
                setDisplayUrl(undefined);
                return;
            }

            // If it's already a full HTTP URL, use it
            if (url.startsWith('http')) {
                setDisplayUrl(url);
                return;
            }

            setResolving(true);
            try {
                const { ref, getDownloadURL } = await import('firebase/storage');
                const { storage } = await import('@/lib/firebase');

                let storagePath = url;

                // Handle gs:// URLs
                if (url.startsWith('gs://')) {
                    const storageRef = ref(storage, url);
                    const downloadUrl = await getDownloadURL(storageRef);
                    setDisplayUrl(downloadUrl);
                    return;
                }

                // Match the new storage structure: skilled_workers/[UID]/documents/[filename]
                if (workerId) {
                    const patterns = [
                        `skilled_workers/${workerId}/documents/${url}`, // NEW PATH
                        url                                           // AS IS
                    ];

                    for (const path of patterns) {
                        try {
                            const storageRef = ref(storage, path);
                            const downloadUrl = await getDownloadURL(storageRef);
                            setDisplayUrl(downloadUrl);
                            return; // Found it!
                        } catch (e) {
                            // Try next pattern if not found
                            continue;
                        }
                    }
                }

                // Default fallback if nothing worked
                setDisplayUrl(url);
            } catch (error) {
                console.error("Error resolving document URL:", error);
                setDisplayUrl(url);
            } finally {
                setResolving(false);
            }
        };

        resolveUrl();
    }, [url, workerId]);

    return (
        <div className="space-y-2">
            <p className="text-[10px] font-black text-text-light/60 uppercase ml-1">{label}</p>
            {resolving ? (
                <div className="aspect-[4/3] rounded-2xl bg-background border border-border flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary opacity-20" />
                </div>
            ) : displayUrl ? (
                <div
                    onClick={() => window.open(displayUrl, '_blank')}
                    className="relative group aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer border border-border/50 shadow-sm"
                >
                    {displayUrl.toLowerCase().includes('.pdf') || url?.toLowerCase().includes('.pdf') ? (
                        <div className="w-full h-full bg-background flex flex-col items-center justify-center p-4">
                            <div className="p-3 bg-red-100 rounded-2xl mb-2">
                                <FileText className="w-8 h-8 text-red-600" />
                            </div>
                            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest text-center line-clamp-2">
                                PDF Document
                            </span>
                        </div>
                    ) : (
                        <img src={displayUrl} alt={label} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-8 h-8 text-white" />
                    </div>
                </div>
            ) : (
                <div className="aspect-[4/3] rounded-2xl bg-background border border-dashed border-border flex items-center justify-center text-text-light/30 text-xs font-bold">
                    Missing
                </div>
            )}
        </div>
    );
}

function OcrItem({ label, value }: any) {
    return (
        <div>
            <p className="text-[9px] font-black text-white/40 uppercase mb-1">{label}</p>
            <p className="text-sm font-bold text-white bg-white/5 border border-white/10 p-2.5 rounded-xl break-words">{value || "Unrecognized"}</p>
        </div>
    );
}
