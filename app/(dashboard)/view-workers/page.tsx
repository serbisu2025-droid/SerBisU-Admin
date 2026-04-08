"use client";


import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import {
    Search,
    Toolbox,
    Loader2,
    MapPin,
    RefreshCw,
    User,
    Mail,
    Phone,
    Calendar,
    Briefcase,
    Activity,
    UserCheck,
    AlertCircle,
    Star,
    ChevronDown,
    X,
    MessageSquare,
    ThumbsUp,
    ThumbsDown,
    Clock
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Fix #8: Normalize names to title case
function toTitleCase(str?: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

interface SkilledWorker {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    age: string | number;
    address: string;
    serviceType: string;
    experience: string;
    activityStatus: "active" | "inactive" | "offline";
    gender?: string;
    profileImage?: string;
    rating?: number;
    jobsCompleted?: number;
    servicePricing?: Record<string, {
        baseRate?: number | string;
        rateType?: string;
    }>;
    priceRate?: {
        baseRate?: number | string;
        rateType?: string;
    };
}

export default function ViewWorkersPage() {
    const [workers, setWorkers] = useState<SkilledWorker[]>([]);
    const [filteredWorkers, setFilteredWorkers] = useState<SkilledWorker[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAddress, setSelectedAddress] = useState("All Addresses");
    const [selectedService, setSelectedService] = useState("All Services");
    const [selectedAge, setSelectedAge] = useState("All Ages");
    const [selectedGender, setSelectedGender] = useState("All Genders");
    const [selectedWorker, setSelectedWorker] = useState<SkilledWorker | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const uniqueAddresses = useMemo(() => {
        const addresses = Array.from(new Set(workers.map(w => w.address).filter(Boolean)));
        return ["All Addresses", ...addresses.sort()];
    }, [workers]);

    const uniqueServices = useMemo(() => {
        const services = Array.from(new Set(workers.map(w => w.serviceType).filter(Boolean)));
        return ["All Services", ...services.sort()];
    }, [workers]);

    const uniqueAges = useMemo(() => {
        const ages = Array.from(new Set(workers.map(w => w.age?.toString()).filter(a => a && a !== 'N/A')));
        return ["All Ages", ...ages.sort((a, b) => parseInt(a) - parseInt(b))];
    }, [workers]);

    const uniqueGenders = useMemo(() => {
        const genders = Array.from(new Set(workers.map(w => w.gender).filter(g => g && g !== 'N/A')));
        return ["All Genders", ...genders.sort()];
    }, [workers]);

    const fetchWorkerData = async () => {
        setLoading(true);
        try {
            // Fetch all bookings to calculate real job counts if the DB counter is out of sync
            const bookingsSnap = await getDocs(collection(db, "bookings"));
            const bookingsMap: Record<string, number> = {};
            
            bookingsSnap.docs.forEach(doc => {
                const bData = doc.data();
                const rawStatus = (bData.status || bData.getStatus || "").toString().toLowerCase();
                const rating = bData.rating || 0;
                
                // Get worker ID (handling string, object, or Reference)
                let workerId = bData.workerId || bData.worker?.id;
                if (workerId && typeof workerId === 'object' && 'id' in workerId) {
                    workerId = (workerId as any).id;
                }
                
                // Be more inclusive with "completed" status
                const isCompleted = 
                    rawStatus === 'completed' || 
                    rawStatus === 'finished' || 
                    rawStatus === 'complete' ||
                    rating > 0; // If it's rated, it's completed
                
                if (workerId && typeof workerId === 'string' && isCompleted) {
                    bookingsMap[workerId] = (bookingsMap[workerId] || 0) + 1;
                }
            });

            const workersSnap = await getDocs(collection(db, "skilled_workers"));
            const workersData = workersSnap.docs
                .map(doc => {
                    const data = doc.data();

                    // Determine activity status (Inactive if not seen for 7+ days)
                    let activityStatus: "active" | "inactive" | "offline" = 'inactive';
                    const now = new Date();
                    const lastSeen = data.lastSeen ? data.lastSeen.toDate() : null;

                    if (lastSeen) {
                        const daysSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysSinceLastSeen >= 7) {
                            activityStatus = 'inactive';
                        } else {
                            activityStatus = 'active';
                        }
                    } else {
                        activityStatus = data.isOnline ? 'active' : 'inactive';
                    }

                    // Use the dynamic count from bookings if available, fallback to DB counter
                    const dynamicCount = bookingsMap[doc.id] || 0;
                    const dbCount = data.jobsCompleted || 0;

                    return {
                        id: doc.id,
                        fullName: toTitleCase(data.personalInfo?.fullName || data.fullName || 'Unknown'),
                        email: data.personalInfo?.email || data.email || 'N/A',
                        phoneNumber: data.personalInfo?.mobileNumber || data.personalInfo?.phoneNumber || data.phone || data.phoneNumber || 'N/A',
                        age: data.personalInfo?.age || data.age || 'N/A',
                        gender: data.personalInfo?.gender || data.gender || 'N/A',
                        address: data.personalInfo?.address || data.location?.address || data.address || 'Unknown',
                        serviceType: data.serviceInfo?.serviceType || data.serviceType || 'General',
                        experience: data.serviceInfo?.experience || data.experience || 'N/A',
                        activityStatus,
                        profileImage: data.profileImage,
                        isVerified: data.status === 'verified' || data.isVerified === true,
                        rating: data.rating || 0,
                        jobsCompleted: Math.max(dynamicCount, dbCount),
                        servicePricing: data.servicePricing || {},
                        priceRate: data.priceRate || {}
                    } as any;
                })
                .filter(w => w.isVerified);

            setWorkers(workersData as SkilledWorker[]);
            setFilteredWorkers(workersData);
        } catch (error) {
            console.error("Error fetching workers:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkerData();
    }, []);

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const result = workers.filter(w => {
            const matchesSearch = (w.fullName || "").toLowerCase().includes(term) ||
                (w.serviceType || "").toLowerCase().includes(term) ||
                (w.email || "").toLowerCase().includes(term);
            const matchesAddress = selectedAddress === "All Addresses" || w.address === selectedAddress;
            const matchesService = selectedService === "All Services" || w.serviceType === selectedService;
            const matchesAge = selectedAge === "All Ages" || w.age?.toString() === selectedAge;
            const matchesGender = selectedGender === "All Genders" || w.gender === selectedGender;
            
            return matchesSearch && matchesAddress && matchesService && matchesAge && matchesGender;
        });
        setFilteredWorkers(result);
    }, [searchTerm, selectedAddress, selectedService, selectedAge, selectedGender, workers]);

    const fetchReviews = async (worker: SkilledWorker) => {
        setSelectedWorker(worker);
        setIsModalOpen(true);
        setReviewsLoading(true);
        setReviews([]);

        try {
            const q = query(
                collection(db, "bookings"),
                where("workerId", "==", worker.id),
                where("rating", ">", 0),
                orderBy("rating", "desc")
            );

            const snap = await getDocs(q);
            const reviewData = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setReviews(reviewData);
        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setReviewsLoading(false);
        }
    };

    const goodReviews = reviews.filter(r => r.rating >= 3);
    const badReviews = reviews.filter(r => r.rating < 3);

    const formatDate = (ts: any) => {
        if (!ts) return "N/A";
        const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <>
            <div className="space-y-8 animate-in fade-in duration-700">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] shadow-sm border border-border/50">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/10 rounded-2xl">
                                <Toolbox className="w-6 h-6 text-primary" />
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-text">Skilled Worker Directory</h1>
                        </div>
                        <p className="text-text-light font-medium ml-1">Monitor and view all registered skilled workers</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Address Filter */}
                        <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light group-focus-within:text-primary transition-colors z-10" />
                            <select
                                value={selectedAddress}
                                onChange={(e) => setSelectedAddress(e.target.value)}
                                className="pl-10 pr-10 py-4 bg-background border-2 border-transparent rounded-2xl w-full md:w-[180px] focus:outline-none focus:border-primary/20 focus:bg-white transition-all font-bold text-[11px] uppercase tracking-wider shadow-inner appearance-none cursor-pointer relative z-0"
                            >
                                {uniqueAddresses.map(addr => (
                                    <option key={addr} value={addr}>
                                        {addr.length > 20 ? addr.substring(0, 20) + "..." : addr}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light pointer-events-none transition-transform group-focus-within:rotate-180" />
                        </div>

                        {/* Service Filter */}
                        <div className="relative group">
                            <Toolbox className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light group-focus-within:text-primary transition-colors z-10" />
                            <select
                                value={selectedService}
                                onChange={(e) => setSelectedService(e.target.value)}
                                className="pl-10 pr-10 py-4 bg-background border-2 border-transparent rounded-2xl w-full md:w-[160px] focus:outline-none focus:border-primary/20 focus:bg-white transition-all font-bold text-[11px] uppercase tracking-wider shadow-inner appearance-none cursor-pointer relative z-0"
                            >
                                {uniqueServices.map(service => (
                                    <option key={service} value={service}>{service}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light pointer-events-none transition-transform group-focus-within:rotate-180" />
                        </div>

                        {/* Age Filter */}
                        <div className="relative group">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light group-focus-within:text-primary transition-colors z-10" />
                            <select
                                value={selectedAge}
                                onChange={(e) => setSelectedAge(e.target.value)}
                                className="pl-10 pr-10 py-4 bg-background border-2 border-transparent rounded-2xl w-full md:w-[130px] focus:outline-none focus:border-primary/20 focus:bg-white transition-all font-bold text-[11px] uppercase tracking-wider shadow-inner appearance-none cursor-pointer relative z-0"
                            >
                                {uniqueAges.map(age => (
                                    <option key={age} value={age}>{age}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light pointer-events-none transition-transform group-focus-within:rotate-180" />
                        </div>

                        {/* Gender Filter */}
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light group-focus-within:text-primary transition-colors z-10" />
                            <select
                                value={selectedGender}
                                onChange={(e) => setSelectedGender(e.target.value)}
                                className="pl-10 pr-10 py-4 bg-background border-2 border-transparent rounded-2xl w-full md:w-[130px] focus:outline-none focus:border-primary/20 focus:bg-white transition-all font-bold text-[11px] uppercase tracking-wider shadow-inner appearance-none cursor-pointer relative z-0"
                            >
                                {uniqueGenders.map(gender => (
                                    <option key={gender} value={gender}>{gender}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light pointer-events-none transition-transform group-focus-within:rotate-180" />
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search Name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12 pr-6 py-4 bg-background border-2 border-transparent rounded-2xl w-full md:w-[200px] focus:outline-none focus:border-primary/20 focus:bg-white transition-all font-bold text-sm shadow-inner"
                            />
                        </div>
                        <button
                            onClick={fetchWorkerData}
                            className="p-4 bg-background hover:bg-white border-2 border-transparent hover:border-primary/20 rounded-2xl transition-all shadow-sm active:scale-95"
                        >
                            <RefreshCw className={cn("w-5 h-5 text-text-light", loading && "animate-spin text-primary")} />
                        </button>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-border/50 flex items-center gap-5">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                            <UserCheck className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-text-light/50 tracking-widest">Total Registered</p>
                            <h3 className="text-2xl font-black text-text">{workers.length}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-border/50 flex items-center gap-5">
                        <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center text-success shadow-inner">
                            <Activity className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-text-light/50 tracking-widest">Active (Past 7 Days)</p>
                            <h3 className="text-2xl font-black text-text">{workers.filter(w => w.activityStatus === 'active').length}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-border/50 flex items-center gap-5">
                        <div className="w-14 h-14 bg-error/10 rounded-2xl flex items-center justify-center text-error shadow-inner">
                            <AlertCircle className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-text-light/50 tracking-widest">Inactive</p>
                            <h3 className="text-2xl font-black text-text">{workers.filter(w => w.activityStatus === 'inactive').length}</h3>
                        </div>
                    </div>
                </div>
                {/* Main Table */}
                <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-border/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background/50 border-b border-border/50">
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Name & Email</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Contact & Age</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Service Offer</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-text-light whitespace-nowrap">Experience Level</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Address</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                                <p className="text-text-light font-black uppercase tracking-widest text-[10px]">Assembling Worker Data...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredWorkers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center text-text-light/50 font-black uppercase tracking-widest">No workers found matching your search.</td>
                                    </tr>
                                ) : (
                                    filteredWorkers.map((worker) => (
                                        <tr key={worker.id} className="hover:bg-primary/[0.02] transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border-2 border-white shadow-md overflow-hidden flex items-center justify-center shrink-0">
                                                        {worker.profileImage ? (
                                                            <img src={worker.profileImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User className="w-6 h-6 text-primary" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-black text-text truncate group-hover:text-primary transition-colors">{worker.fullName}</p>
                                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg shadow-sm">
                                                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                                <span className="text-[10px] font-black text-text leading-none">{worker.rating?.toFixed(1) || "0.0"}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <Mail className="w-3 h-3 text-text-light/40" />
                                                            <p className="text-[10px] font-bold text-text-light/70 truncate">{worker.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-3">
                                                        <span className="text-[9px] font-black text-text-light/40 uppercase tracking-widest leading-none">{worker.jobsCompleted || 0} Jobs Completed</span>
                                                        <button
                                                            onClick={() => fetchReviews(worker)}
                                                            className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1 leading-none"
                                                        >
                                                            <MessageSquare className="w-2 h-2" />
                                                            View Reviews
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-success/10 rounded-lg">
                                                            <Phone className="w-3 h-3 text-success" />
                                                        </div>
                                                        <span className="text-xs font-bold text-text">{worker.phoneNumber}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-blue-500/10 rounded-lg">
                                                            <Calendar className="w-3 h-3 text-blue-500" />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-text-light">{worker.age} Years Old • {worker.gender}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-sm font-black text-text">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-primary/10 rounded-xl">
                                                        <Toolbox className="w-3.5 h-3.5 text-primary" />
                                                    </div>
                                                    {worker.serviceType}
                                                </div>
                                                {worker.servicePricing && Object.keys(worker.servicePricing).length > 0 ? (
                                                    <div className="mt-2 space-y-1">
                                                        {Object.entries(worker.servicePricing).slice(0, 1).map(([service, price]) => (
                                                            <div key={service} className="text-[10px] font-bold text-primary flex items-center gap-1">
                                                                <span>₱{price.baseRate} {price.rateType === 'Per Hour' ? '/hr' : price.rateType === 'Per Day' ? '/day' : '/job'}</span>
                                                            </div>
                                                        ))}
                                                        {Object.keys(worker.servicePricing).length > 1 && (
                                                            <span className="text-[9px] text-text-light italic">+{Object.keys(worker.servicePricing).length - 1} more rates</span>
                                                        )}
                                                    </div>
                                                ) : worker.priceRate?.baseRate ? (
                                                    <div className="mt-2 text-[10px] font-bold text-primary">
                                                        ₱{worker.priceRate.baseRate} {worker.priceRate.rateType === 'Per Hour' ? '/hr' : worker.priceRate.rateType === 'Per Day' ? '/day' : '/job'}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2 text-xs font-bold text-text-light">
                                                    <Briefcase className="w-3.5 h-3.5 text-accent" />
                                                    {worker.experience} Level
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-start gap-2 max-w-[180px]">
                                                    <MapPin className="w-3 h-3 text-error shrink-0 mt-0.5" />
                                                    <p className="text-[10px] font-medium text-text-light line-clamp-2 leading-tight">{worker.address}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className={cn(
                                                    "inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2",
                                                    worker.activityStatus === 'active'
                                                        ? "bg-success/10 text-success border-success/30 shadow-lg shadow-success/10"
                                                        : "bg-error/10 text-error border-error/30 opacity-60"
                                                )}>
                                                    <div className={cn("w-2 h-2 rounded-full", worker.activityStatus === 'active' ? "bg-success" : "bg-error")} />
                                                    {worker.activityStatus === 'active' ? "Active" : "Inactive"}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Review Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-text/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 bg-background/50 border-b border-border/50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <MessageSquare className="w-7 h-7 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-text tracking-tight">{selectedWorker?.fullName}</h2>
                                    <p className="text-text-light font-bold text-xs uppercase tracking-widest">Worker Performance Reviews</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-3 hover:bg-error/10 hover:text-error rounded-2xl transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth">
                            {reviewsLoading ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-4">
                                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                    <p className="font-black text-[10px] uppercase tracking-[0.2em] text-text-light">Fetching reviews...</p>
                                </div>
                            ) : reviews.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-4 text-text-light/40">
                                    <AlertCircle className="w-12 h-12" />
                                    <p className="font-black text-[10px] uppercase tracking-[0.2em]">No reviews found for this worker</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Good Reviews */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 pb-2 border-b-2 border-success/20">
                                            <ThumbsUp className="w-5 h-5 text-success" />
                                            <h3 className="font-black text-text uppercase tracking-widest text-sm">Good Reviews ({goodReviews.length})</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {goodReviews.length === 0 ? (
                                                <p className="text-[10px] font-bold text-text-light/40 uppercase italic py-4">No positive feedback yet.</p>
                                            ) : (
                                                goodReviews.map((r) => (
                                                    <ReviewCard key={r.id} review={r} type="good" formatDate={formatDate} />
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Bad Reviews */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 pb-2 border-b-2 border-error/20">
                                            <ThumbsDown className="w-5 h-5 text-error" />
                                            <h3 className="font-black text-text uppercase tracking-widest text-sm">Bad Reviews ({badReviews.length})</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {badReviews.length === 0 ? (
                                                <p className="text-[10px] font-bold text-text-light/40 uppercase italic py-4">No negative feedback found.</p>
                                            ) : (
                                                badReviews.map((r) => (
                                                    <ReviewCard key={r.id} review={r} type="bad" formatDate={formatDate} />
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function ReviewCard({ review, type, formatDate }: { review: any, type: 'good' | 'bad', formatDate: (ts: any) => string }) {
    return (
        <div className={cn(
            "p-5 rounded-[2rem] border transition-all hover:shadow-lg",
            type === 'good'
                ? "bg-success/5 border-success/10 hover:border-success/30"
                : "bg-error/5 border-error/10 hover:border-error/30"
        )}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shadow-inner",
                        type === 'good' ? "bg-success/20 text-success" : "bg-error/20 text-error"
                    )}>
                        {review.rating}.0
                    </div>
                    <div>
                        <p className="text-sm font-black text-text">{review.clientName || review.customerName || "Anonymous User"}</p>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-text-light/50 uppercase tracking-widest mt-0.5">
                            <Clock className="w-3 h-3" />
                            {formatDate(review.ratedAt || review.createdAt)}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-0.5 pt-1">
                    {[...Array(5)].map((_, i) => (
                        <Star
                            key={i}
                            className={cn(
                                "w-3 h-3",
                                i < review.rating
                                    ? type === 'good' ? "text-success fill-success" : "text-error fill-error"
                                    : "text-text-light/10 fill-text-light/10"
                            )}
                        />
                    ))}
                </div>
            </div>
            <div className="bg-white/80 p-4 rounded-2xl border border-white/20 shadow-sm mt-4">
                <p className="text-xs font-bold text-text-light leading-loose italic">
                    "{review.ratingComment || "The homeowner did not provide specific text feedback for this job."}"
                </p>
            </div>
            {(review.serviceType || review.jobType) && (
                <div className="mt-4 flex items-center gap-2">
                    <div className="p-1 px-3 bg-white border border-border/50 rounded-full shadow-sm">
                        <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">{review.serviceType || review.jobType}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
