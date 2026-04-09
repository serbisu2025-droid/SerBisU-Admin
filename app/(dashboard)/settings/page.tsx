"use client";


import {
    collection,
    onSnapshot,
    query,
    orderBy,
    doc,
    updateDoc,
    deleteDoc,
    addDoc,
    serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { updatePassword, updateEmail } from "firebase/auth";
import {
    User,
    Users,
    Lock,
    Bell,
    Shield,
    Globe,
    Database,
    Save,
    Loader2,
    Camera,
    CheckCircle2,
    Plus,
    Trash2,
    Edit,
    Image as ImageIcon,
    Tag,
    Toolbox,
    Lightbulb,
    X,
    ChevronRight,
    LayoutDashboard,
    Key,
    UserPlus,
    Monitor,
    Smartphone,
    Mail,
    Phone,
    Clock,
    Calendar,
    Settings,
    AlertTriangle,
    CheckCircle,
    Info,
    Send
} from "lucide-react";

// Types derived from settings.html structure
interface AdminAccount {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: 'active' | 'inactive';
    photoURL?: string;
    canCreateAdmins?: boolean;
    createdAt?: any;
}

interface Banner {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    link?: string;
    status: 'active' | 'inactive';
    position?: number;
}

interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    status: 'active' | 'inactive';
    color?: string;
}

interface Service {
    id: string;
    name: string;
    categoryId: string;
    categoryName?: string;
    priceRange?: string;
    status: 'active' | 'inactive';
    icon?: string;
    skills?: string[];
}

interface PlatformTip {
    id: string;
    title: string;
    content: string;
    category: string;
    target: 'homeowner' | 'provider' | 'both';
    active: boolean;
    createdAt?: any;
    emoji?: string;
}

export default function SettingsPage() {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState(currentUser?.role === 'verifier_admin' ? "profile" : "general");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data states
    const [admins, setAdmins] = useState<AdminAccount[]>([]);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [tips, setTips] = useState<PlatformTip[]>([]);

    // Form states for modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'admin' | 'banner' | 'category' | 'service' | 'tip' | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Modal Form Values
    const [adminForm, setAdminForm] = useState({ fullName: '', email: '', password: '', role: 'super_admin', status: 'active', photoURL: '' });
    const [bannerForm, setBannerForm] = useState({ title: '', description: '', imageUrl: '', status: 'active' });
    const [categoryForm, setCategoryForm] = useState({ name: '', color: '#3b82f6', status: 'active', icon: '' });
    const [serviceForm, setServiceForm] = useState({ name: '', categoryId: '', status: 'active', priceRange: '', icon: '', skills: '' });
    const [tipForm, setTipForm] = useState({ title: '', content: '', category: '', target: 'both', active: true, emoji: '💡' });

    // File upload states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLoading(true);

        // Listeners for all collections
        const unsubAdmins = onSnapshot(collection(db, "admins"), (snap) => {
            setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminAccount)));
        });

        const unsubBanners = onSnapshot(collection(db, "banners"), (snap) => {
            setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
        });

        const unsubCategories = onSnapshot(collection(db, "categories"), (snap) => {
            setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
        });

        const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
            setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
        });

        const unsubTips = onSnapshot(query(collection(db, "tips"), orderBy("createdAt", "desc")), (snap) => {
            setTips(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlatformTip)));
        });

        setLoading(false);

        return () => {
            unsubAdmins();
            unsubBanners();
            unsubCategories();
            unsubServices();
            unsubTips();
        };
    }, []);

    const tabs = useMemo(() => {
        if (currentUser?.role === 'verifier_admin') {
            return [
                { id: 'profile', icon: <User className="w-4 h-4" />, label: 'My Profile' },
                { id: 'security', icon: <Key className="w-4 h-4" />, label: 'Security' },
            ];
        }
        return [
            { id: 'general', icon: <Settings className="w-4 h-4" />, label: 'General' },
            { id: 'banners', icon: <Monitor className="w-4 h-4" />, label: 'Banners' },
            { id: 'registry', icon: <Toolbox className="w-4 h-4" />, label: 'Services' },
            { id: 'tips', icon: <Lightbulb className="w-4 h-4" />, label: 'Tips' },
            { id: 'admins', icon: <UserPlus className="w-4 h-4" />, label: 'Admin Accounts' },
            { id: 'security', icon: <Key className="w-4 h-4" />, label: 'Security' },
        ];
    }, [currentUser]);

    // Form state for current user profile update
    const [profileForm, setProfileForm] = useState({
        fullName: currentUser?.fullName || '',
        email: currentUser?.email || '',
        photoURL: currentUser?.photoURL || ''
    });

    useEffect(() => {
        if (currentUser) {
            setProfileForm({
                fullName: currentUser.fullName || '',
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || ''
            });
        }
    }, [currentUser]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setSaving(true);
        try {
            let photoURL = profileForm.photoURL;
            if (selectedFile) {
                photoURL = await uploadImage(selectedFile, 'admin_photos');
            }

            // Update Firestore
            await updateDoc(doc(db, 'admins', currentUser.uid), {
                fullName: profileForm.fullName,
                photoURL: photoURL
            });

            alert('Profile updated successfully!');
            setSelectedFile(null);
            setPreviewUrl(null);
        } catch (error) {
            console.error("Profile update failed:", error);
            alert('Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (coll: string, id: string) => {
        if (confirm("Are you sure you want to delete this? This action cannot be undone.")) {
            try {
                await deleteDoc(doc(db, coll, id));
            } catch (error) {
                console.error("Delete operation failed:", error);
            }
        }
    };

    const toggleStatus = async (coll: string, id: string, current: string | boolean) => {
        try {
            const newVal = typeof current === 'boolean' ? !current : (current === 'active' ? 'inactive' : 'active');
            const field = typeof current === 'boolean' ? 'active' : 'status';
            await updateDoc(doc(db, coll, id), { [field]: newVal });
        } catch (error) {
            console.error("Update operation failed:", error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const uploadImage = async (file: File, path: string) => {
        const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            let collectionName = '';
            let payload: any = {};

            // ── Fix #1: Duplicate Entry Trapping (Global — across ALL categories) ──
            if (modalType === 'category' && !editingId) {
                const dupName = categoryForm.name.trim().toLowerCase();
                const conflictCat = categories.find(c => c.name.trim().toLowerCase() === dupName);
                if (conflictCat) {
                    alert(`⚠️ Duplicate Category: "${categoryForm.name.trim()}" already exists.\nPlease choose a different category name.`);
                    setSaving(false);
                    return;
                }
            }

            if (modalType === 'service' && !editingId) {
                const newServiceName = serviceForm.name.trim().toLowerCase();

                // Check against ALL locally loaded services (across all categories)
                const localConflict = services.find(s => s.name.trim().toLowerCase() === newServiceName);
                if (localConflict) {
                    // Resolve category name - check categoryId first, then fall back to categoryName
                    const conflictCatName = categories.find(c => c.id === localConflict.categoryId)?.name
                        || localConflict.categoryName
                        || 'another category';
                    alert(
                        `⚠️ Duplicate Service: "${serviceForm.name.trim()}" already exists under "${conflictCatName}".\n\nService names must be unique across ALL categories.\nPlease use a different name.`
                    );
                    setSaving(false);
                    return;
                }

                // Also do a live Firestore check in case the page state is stale
                try {
                    const { getDocs: _getDocs, collection: _collection, query: _query, where: _where } = await import('firebase/firestore');
                    const liveSnap = await _getDocs(_collection(db, 'services'));
                    const liveConflict = liveSnap.docs.find(
                        d => (d.data().name || '').trim().toLowerCase() === newServiceName
                    );
                    if (liveConflict) {
                        const liveData = liveConflict.data();
                        const liveCatName = categories.find(c => c.id === liveData.categoryId)?.name
                            || liveData.category
                            || liveData.categoryName
                            || 'another category';
                        alert(
                            `⚠️ Duplicate Service: "${serviceForm.name.trim()}" already exists under "${liveCatName}".\n\nService names must be unique across ALL categories.\nPlease use a different name.`
                        );
                        setSaving(false);
                        return;
                    }
                } catch (checkErr) {
                    console.warn('Live duplicate check failed (non-fatal):', checkErr);
                    // If the live check fails, we already passed the local check above, so continue.
                }
            }

            if (modalType === 'admin' && !editingId) {
                const dupEmail = adminForm.email.trim().toLowerCase();
                const exists = admins.some(a => a.email?.trim().toLowerCase() === dupEmail);
                if (exists) {
                    alert(`⚠️ Duplicate Admin: An account with email "${adminForm.email.trim()}" already exists.`);
                    setSaving(false);
                    return;
                }
            }
            // ─────────────────────────────────────────────────────────────────

            let imageUrl = '';
            if (selectedFile) {
                const path = modalType === 'admin' ? 'admin_photos' :
                    modalType === 'banner' ? 'banners' :
                        modalType === 'category' ? 'category_icons' : 'service_icons';
                imageUrl = await uploadImage(selectedFile, path);
            }

            switch (modalType) {
                case 'admin':
                    // Use API endpoint for admin creation
                    if (!editingId) {
                        // Creating new admin
                        if (!adminForm.password || adminForm.password.length < 6) {
                            alert('Password must be at least 6 characters');
                            setSaving(false);
                            return;
                        }

                        const response = await fetch('/api/admin/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: adminForm.email,
                                password: adminForm.password,
                                fullName: adminForm.fullName,
                                role: adminForm.role,
                                photoURL: imageUrl || adminForm.photoURL || null,
                            }),
                        });

                        const data = await response.json();

                        if (!response.ok) {
                            alert(data.error || 'Failed to create admin account');
                            setSaving(false);
                            return;
                        }

                        alert('Admin account created successfully! The admin can now log in with their email and password.');
                        setIsModalOpen(false);
                        setEditingId(null);
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setSaving(false);
                        return;
                    } else {
                        // Updating existing admin (without password change)
                        collectionName = 'admins';
                        payload = {
                            fullName: adminForm.fullName,
                            email: adminForm.email,
                            role: adminForm.role,
                            status: adminForm.status
                        };
                        if (imageUrl) payload.photoURL = imageUrl;
                    }
                    break;
                case 'banner':
                    collectionName = 'banners';
                    payload = {
                        ...bannerForm,
                        active: bannerForm.status === 'active'
                    };
                    if (imageUrl) payload.image = imageUrl; // Mobile expects 'image'
                    break;
                case 'category':
                    collectionName = 'categories';
                    payload = {
                        ...categoryForm,
                        active: categoryForm.status === 'active'
                    };
                    if (imageUrl) payload.icon = imageUrl;
                    break;
                case 'service':
                    collectionName = 'services';
                    const selectedCategory = categories.find(c => c.id === serviceForm.categoryId);
                    payload = {
                        ...serviceForm,
                        category: selectedCategory?.name || 'General', // Mobile expects 'category'
                        categoryName: selectedCategory?.name || 'General', // Keep for Admin UI
                        active: serviceForm.status === 'active', // Mobile expects boolean 'active'
                        skills: serviceForm.skills.split(',').map(s => s.trim()).filter(s => s !== ''),
                        iconBgColor: selectedCategory?.color || '#3b82f6' // Mobile uses this for circle bg
                    };
                    if (imageUrl) payload.icon = imageUrl;
                    break;
                case 'tip': collectionName = 'tips'; payload = { ...tipForm, createdAt: serverTimestamp() }; break;
            }

            if (editingId) {
                await updateDoc(doc(db, collectionName, editingId), payload);
            } else {
                await addDoc(collection(db, collectionName), payload);
            }

            setIsModalOpen(false);
            setEditingId(null);
            setSelectedFile(null);
            setPreviewUrl(null);
        } catch (error) {
            console.error("Save failed:", error);
            alert('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const openCreateModal = (type: typeof modalType) => {
        setModalType(type);
        setEditingId(null);
        setSelectedFile(null);
        setPreviewUrl(null);
        // Reset forms
        setAdminForm({ fullName: '', email: '', password: '', role: 'super_admin', status: 'active', photoURL: '' });
        setBannerForm({ title: '', description: '', imageUrl: '', status: 'active' });
        setCategoryForm({ name: '', color: '#3b82f6', status: 'active', icon: '' });
        setServiceForm({ name: '', categoryId: '', status: 'active', priceRange: '', icon: '', skills: '' });
        setTipForm({ title: '', content: '', category: '', target: 'both', active: true, emoji: '💡' });
        setIsModalOpen(true);
    };

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
                <div>
                    <h1 className="text-3xl font-black text-text tracking-tight flex items-center gap-3 uppercase">
                        Platform Settings
                    </h1>
                    <p className="text-sm font-bold text-text-light/60 uppercase tracking-widest mt-1">Configure platform features and system preferences</p>
                    <div className="h-1.5 w-24 bg-gradient-to-r from-primary via-accent to-transparent rounded-full mt-3"></div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 px-2 pb-20">
                {/* Navigation Sidebar */}
                <div className="w-full lg:w-72 shrink-0">
                    <div className="bg-white rounded-[2rem] shadow-xl border border-border/40 p-3 overflow-hidden sticky top-24">
                        <div className="px-6 py-4 mb-2 border-b border-border/10">
                            <p className="text-[10px] font-black text-text-light uppercase tracking-widest">Settings Menu</p>
                        </div>
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-4 px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all mb-1 ${activeTab === tab.id
                                    ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]'
                                    : 'text-text-light hover:bg-primary/5 hover:text-primary'
                                    }`}
                            >
                                <span className={`p-2 rounded-lg ${activeTab === tab.id ? 'bg-white/10' : 'bg-background'}`}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                                {activeTab === tab.id && <ChevronRight className="w-4 h-4 ml-auto animate-pulse" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Panel */}
                <div className="flex-1 min-w-0">
                    {loading ? (
                        <div className="p-32 flex flex-col items-center justify-center text-text-light gap-6">
                            <Loader2 className="w-12 h-12 animate-spin text-primary" />
                            <p className="font-black text-lg animate-pulse uppercase tracking-[0.2em]">Loading Settings...</p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

                            {/* My Profile Tab (For Verifiers) */}
                            {activeTab === 'profile' && (
                                <div className="space-y-8">
                                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 p-12">
                                        <h3 className="text-xl font-black text-text uppercase tracking-wider mb-10 flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                            Update Profile
                                        </h3>
                                        <form onSubmit={handleUpdateProfile} className="space-y-8">
                                            <div className="flex items-center gap-8 mb-10">
                                                <div className="relative group">
                                                    <div className="w-32 h-32 rounded-[2.5rem] bg-background border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center ring-8 ring-primary/5">
                                                        {previewUrl ? (
                                                            <img src={previewUrl} className="w-full h-full object-cover" />
                                                        ) : profileForm.photoURL ? (
                                                            <img src={profileForm.photoURL} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User className="w-12 h-12 text-primary/20" />
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="absolute -bottom-2 -right-2 p-3 bg-primary text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"
                                                    >
                                                        <Camera className="w-5 h-5" />
                                                    </button>
                                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-black text-text uppercase">{profileForm.fullName || 'New Administrator'}</h4>
                                                    <p className="text-[10px] font-black text-text-light/50 uppercase tracking-widest mt-1">{currentUser?.role?.replace('_', ' ')} Account</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <InputItem
                                                    label="Full Name"
                                                    value={profileForm.fullName}
                                                    onChange={(e: any) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                                                />
                                                <InputItem
                                                    label="Email Address"
                                                    value={profileForm.email}
                                                    readonly
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="flex items-center gap-3 px-10 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                            >
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                Save Profile Info
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* General Tab */}
                            {activeTab === 'general' && (
                                <div className="space-y-8">
                                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 p-12">
                                        <h3 className="text-xl font-black text-text uppercase tracking-wider mb-10 flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                            General Settings
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                                            <InputItem label="Admin Email" value="admin@serbisu.com" readonly />
                                            <InputItem label="Platform Name" value="SerBisU" readonly />
                                            <InputItem label="Support Phone" value="+63 945 123 4567" readonly />
                                            <InputItem label="Time Zone" value="UTC+8 (Philippine Standard)" readonly />
                                        </div>
                                        <button className="flex items-center gap-3 px-10 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                                            <Save className="w-4 h-4" /> Save Changes
                                        </button>
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 p-12 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Bell className="w-24 h-24 text-primary" />
                                        </div>
                                        <h3 className="text-xl font-black text-text uppercase tracking-wider mb-10 flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-accent rounded-full"></div>
                                            Broadcast Templates
                                        </h3>
                                        <div className="space-y-4 max-w-2xl">
                                            {[
                                                { label: 'Welcome Protocol', desc: 'Message sent to newly synchronized homeowner nodes.' },
                                                { label: 'Incident Resolution', desc: 'Standard response template for support inquiries.' },
                                                { label: 'Security Breach Protocol', desc: 'Critical alert template for unauthorized access attempts.' },
                                            ].map((item, idx) => (
                                                <div key={idx} className="bg-background p-6 rounded-3xl border border-border/30 hover:border-primary/20 transition-all cursor-pointer">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-xs font-black text-text uppercase tracking-widest">{item.label}</h4>
                                                        <Edit className="w-3.5 h-3.5 text-primary" />
                                                    </div>
                                                    <p className="text-[10px] font-bold text-text-light/60 leading-relaxed">"{item.desc}"</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Banners Tab */}
                            {activeTab === 'banners' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between bg-white/50 p-6 rounded-[2rem] border border-border/20 backdrop-blur-md">
                                        <h2 className="text-xl font-black text-text uppercase tracking-wider">Banner Management</h2>
                                        <button
                                            onClick={() => openCreateModal('banner')}
                                            className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all"
                                        >
                                            <ImageIcon className="w-4 h-4" /> Add New Banner
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {banners.length > 0 ? banners.map(banner => (
                                            <div key={banner.id} className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 flex flex-col group overflow-hidden transition-all hover:border-blue-500/30">
                                                <div className="h-48 bg-background overflow-hidden relative">
                                                    <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                                    <div className="absolute bottom-6 left-8 right-8 text-white">
                                                        <h3 className="text-lg font-black uppercase tracking-tighter">{banner.title}</h3>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-white/60 truncate">{banner.link || 'App Link'}</p>
                                                    </div>
                                                </div>
                                                <div className="p-8 space-y-4">
                                                    <p className="text-xs text-text-light/70 font-bold line-clamp-2">"{banner.description}"</p>
                                                    <div className="flex items-center justify-between pt-6 border-t border-border/10">
                                                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border ${banner.status === 'active' ? 'bg-success/5 text-success border-success/20' : 'bg-error/5 text-error border-error/20'
                                                            }`}>
                                                            {banner.status}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingId(banner.id);
                                                                    setBannerForm({ title: banner.title, description: banner.description, imageUrl: banner.imageUrl, status: banner.status });
                                                                    setPreviewUrl(banner.imageUrl);
                                                                    setModalType('banner');
                                                                    setIsModalOpen(true);
                                                                }}
                                                                className="p-3 bg-background rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete('banners', banner.id)}
                                                                className="p-3 bg-background rounded-xl text-error/60 hover:bg-error hover:text-white transition-all shadow-sm"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="col-span-2 py-32 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-border/50 text-text-light/30 font-black uppercase tracking-widest">
                                                No Banners Found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Services Registry Tab */}
                            {activeTab === 'registry' && (
                                <div className="space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
                                        {/* Categories section */}
                                        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-border/40">
                                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/10">
                                                <h2 className="text-lg font-black text-text uppercase flex items-center gap-3">
                                                    <Tag className="w-5 h-5 text-primary" /> Categories
                                                </h2>
                                                <button
                                                    onClick={() => openCreateModal('category')}
                                                    className="p-3 bg-primary/10 text-primary rounded-2xl hover:bg-primary hover:text-white transition-all transform active:scale-95"
                                                >
                                                    <Plus className="w-6 h-6" />
                                                </button>
                                            </div>
                                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-primary/10">
                                                {categories.map(cat => (
                                                    <div key={cat.id} className="bg-background/50 p-6 rounded-3xl border border-border/40 flex items-center justify-between group hover:border-primary/30 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-background border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '20' }}>
                                                                {cat.icon ? <img src={cat.icon} className="w-full h-full object-cover" /> : <Tag className="w-4 h-4" style={{ color: cat.color }} />}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-text text-sm uppercase tracking-tight group-hover:text-primary transition-colors">{cat.name}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                                                    <span className={`text-[8px] font-black uppercase ${cat.status === 'active' ? 'text-success' : 'text-text/30'}`}>{cat.status}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => {
                                                                setEditingId(cat.id);
                                                                setCategoryForm({ name: cat.name, color: cat.color || '#3b82f6', status: cat.status, icon: cat.icon || '' });
                                                                setPreviewUrl(cat.icon || null);
                                                                setModalType('category');
                                                                setIsModalOpen(true);
                                                            }} className="p-2 text-primary/40 hover:text-primary transition-all"><Edit className="w-4 h-4" /></button>
                                                            <button onClick={() => handleDelete('categories', cat.id)} className="p-2 text-error/30 hover:text-error transition-all"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Services section */}
                                        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-border/40">
                                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/10">
                                                <h2 className="text-lg font-black text-text uppercase flex items-center gap-3">
                                                    <Toolbox className="w-5 h-5 text-accent" /> Services
                                                </h2>
                                                <button
                                                    onClick={() => openCreateModal('service')}
                                                    className="p-3 bg-accent/10 text-accent rounded-2xl hover:bg-accent hover:text-white transition-all transform active:scale-95"
                                                >
                                                    <Plus className="w-6 h-6" />
                                                </button>
                                            </div>
                                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-accent/10">
                                                {services.map(svc => (
                                                    <div key={svc.id} className="bg-background/50 p-6 rounded-3xl border border-border/40 group relative overflow-hidden transition-all hover:border-accent/30 hover:-translate-y-1">
                                                        <div className="flex gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-background border-2 border-border/20 flex items-center justify-center overflow-hidden shrink-0 shadow-sm group-hover:border-accent/40 transition-all">
                                                                {svc.icon ? <img src={svc.icon} className="w-full h-full object-cover" /> : <Toolbox className="w-5 h-5 text-accent/40" />}
                                                            </div>
                                                            <div className="flex-1 flex flex-col gap-1">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className="text-sm font-black text-text uppercase group-hover:text-accent transition-colors">{svc.name}</span>
                                                                    <span className="text-[10px] font-black text-success">{svc.priceRange || 'Competitive'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[9px] text-text-light/50 font-black uppercase tracking-[0.2em]">{svc.categoryName || 'General'}</span>
                                                                    <div className="w-1.5 h-1.5 bg-accent/20 rounded-full"></div>
                                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border ${svc.status === 'active' ? 'bg-success/5 text-success border-success/20' : 'bg-error/5 text-error border-error/20'}`}>
                                                                        {svc.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="absolute right-4 bottom-5 flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-x-12 group-hover:translate-x-0 transition-all duration-300">
                                                            <button onClick={() => {
                                                                setEditingId(svc.id);
                                                                setServiceForm({
                                                                    name: svc.name,
                                                                    categoryId: svc.categoryId,
                                                                    status: svc.status,
                                                                    priceRange: svc.priceRange || '',
                                                                    icon: svc.icon || '',
                                                                    skills: svc.skills ? svc.skills.join(', ') : ''
                                                                });
                                                                setPreviewUrl(svc.icon || null);
                                                                setModalType('service');
                                                                setIsModalOpen(true);
                                                            }} className="p-2 text-accent/40 hover:text-accent"><Edit className="w-4 h-4" /></button>
                                                            <button onClick={() => handleDelete('services', svc.id)} className="p-2 text-error/30 hover:text-error"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tips Tab */}
                            {activeTab === 'tips' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between bg-purple-600/5 p-8 rounded-[2rem] border border-purple-600/10">
                                        <div>
                                            <h2 className="text-xl font-black text-purple-600 uppercase">Platform Tips</h2>
                                            <p className="text-[10px] text-purple-600/50 font-black tracking-widest uppercase mt-1">Manage helpful app notifications</p>
                                        </div>
                                        <button
                                            onClick={() => openCreateModal('tip')}
                                            className="flex items-center gap-3 px-8 py-4 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-purple-600/30 hover:scale-105 active:scale-95 transition-all"
                                        >
                                            <Plus className="w-4 h-4" /> Add New Tip
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {tips.map(tip => (
                                            <div key={tip.id} className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-border/40 group overflow-hidden relative transition-all hover:border-purple-600/30">
                                                <div className="absolute -top-6 -right-6 w-24 h-24 bg-purple-600/5 rounded-full flex items-center justify-center text-4xl group-hover:scale-125 transition-transform duration-700">
                                                    {tip.emoji || '💡'}
                                                </div>
                                                <div className="flex items-center gap-3 mb-6">
                                                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border-2 ${tip.active ? 'bg-success/5 text-success border-success/20' : 'bg-error/5 text-error border-error/20'
                                                        }`}>
                                                        {tip.active ? 'Online' : 'Defunct'}
                                                    </span>
                                                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-lg">{tip.category}</span>
                                                </div>
                                                <h3 className="text-xl font-black text-text mb-4 uppercase leading-tight group-hover:text-purple-600 transition-colors">{tip.title}</h3>
                                                <p className="text-sm font-bold text-text-light/70 leading-relaxed line-clamp-4 mb-8">"{tip.content}"</p>
                                                <div className="flex items-center justify-between pt-8 border-t border-border/10 mt-auto">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex -space-x-2">
                                                            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs text-purple-600 font-black border-2 border-white shadow-sm">
                                                                {tip.target === 'both' ? 'All' : tip.target[0].toUpperCase()}
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-black text-text-light/50 uppercase tracking-tighter">Target: {tip.target}</span>
                                                        <Users className="w-3.5 h-3.5 text-text-light/30 ml-2" />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => { setEditingId(tip.id); setTipForm({ title: tip.title, content: tip.content, category: tip.category, target: tip.target, active: tip.active, emoji: tip.emoji || '💡' }); setModalType('tip'); setIsModalOpen(true); }}
                                                            className="p-3 bg-purple-50 rounded-xl text-purple-600 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('tips', tip.id)}
                                                            className="p-3 bg-error/5 rounded-xl text-error/60 hover:bg-error hover:text-white transition-all shadow-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Admins Tab */}
                            {activeTab === 'admins' && (
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between bg-primary/5 p-10 rounded-[2.5rem] border border-primary/10">
                                        <div>
                                            <h2 className="text-2xl font-black text-primary uppercase tracking-tighter">Admin Management</h2>
                                            <p className="text-[11px] text-primary/60 font-black uppercase tracking-[0.2em] mt-1">Manage system administrator accounts</p>
                                        </div>
                                        <button
                                            onClick={() => openCreateModal('admin')}
                                            className="px-10 py-5 bg-primary text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                                        >
                                            <UserPlus className="w-5 h-5" /> Add Admin Account
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {admins.map(admin => (
                                            <div key={admin.id} className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-border/40 hover:border-primary/30 transition-all group relative overflow-hidden flex flex-col items-center text-center">
                                                <div className="absolute top-0 right-0 p-6">
                                                    <div className={`w-3 h-3 rounded-full ${admin.status === 'active' ? 'bg-success animate-pulse' : 'bg-error'}`}></div>
                                                </div>
                                                <div className="w-24 h-24 rounded-[2rem] bg-background border-2 border-border/50 flex items-center justify-center text-primary font-black text-3xl mb-6 shadow-inner ring-8 ring-primary/5 group-hover:scale-110 transition-transform duration-500">
                                                    {admin.photoURL ? <img src={admin.photoURL} alt={admin.fullName} className="w-full h-full object-cover" /> : admin.fullName?.[0]}
                                                </div>
                                                <h3 className="text-lg font-black text-text uppercase tracking-tighter group-hover:text-primary transition-colors">{admin.fullName}</h3>
                                                <p className="text-[10px] font-black text-text-light/50 uppercase tracking-widest mt-1">{admin.role}</p>
                                                <div className="mt-8 pt-6 border-t border-border/10 w-full flex flex-col gap-4">
                                                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-text-light/70 leading-none">
                                                        <Mail className="w-3.5 h-3.5 text-primary/40" /> {admin.email}
                                                    </div>
                                                    <div className="flex items-center justify-center gap-3 mt-4">
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(admin.id);
                                                                setAdminForm({ fullName: admin.fullName, email: admin.email, password: '', role: admin.role, status: admin.status, photoURL: admin.photoURL || '' });
                                                                setPreviewUrl(admin.photoURL || null);
                                                                setModalType('admin');
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="flex-1 py-3 bg-background border border-border/50 rounded-xl text-[10px] font-black uppercase text-primary hover:bg-primary hover:text-white transition-all"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete('admins', admin.id)}
                                                            className="p-3 bg-background border border-border/50 rounded-xl text-error/40 hover:text-error transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Security Tab */}
                            {activeTab === 'security' && (
                                <div className="space-y-8">
                                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-border/40 p-12">
                                        <h3 className="text-lg font-black text-text uppercase tracking-widest mb-10 flex items-center gap-4">
                                            <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                            Change Password
                                        </h3>
                                        <div className="max-w-xl space-y-10">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-text uppercase tracking-[0.2em] ml-1">Current Password</label>
                                                <input type="password" placeholder="••••••••••••••••" className="w-full px-8 py-5 bg-background border-2 border-border/40 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm shadow-sm" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-text uppercase tracking-[0.2em] ml-1">New Password</label>
                                                <input type="password" id="new-password" placeholder="Min strength: 8 characters" className="w-full px-8 py-5 bg-background border-2 border-border/40 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm shadow-sm" />
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    const newPass = (document.getElementById('new-password') as HTMLInputElement).value;
                                                    if (!newPass || newPass.length < 8) {
                                                        alert('Password must be at least 8 characters');
                                                        return;
                                                    }
                                                    try {
                                                        const user = auth.currentUser;
                                                        if (user) {
                                                            await updatePassword(user, newPass);
                                                            alert('Password updated successfully!');
                                                            (document.getElementById('new-password') as HTMLInputElement).value = '';
                                                        }
                                                    } catch (e: any) {
                                                        alert(e.message || 'Error updating password');
                                                    }
                                                }}
                                                className="flex items-center gap-4 px-12 py-5 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
                                            >
                                                <Key className="w-5 h-5" /> Update Password
                                            </button>
                                        </div>

                                        {currentUser?.role === 'super_admin' && (
                                            <div className="mt-20 pt-12 border-t border-border/10">
                                                <h3 className="text-xl font-black text-text mb-10 uppercase tracking-[0.1em]">Security Options</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <SecurityToggle
                                                        title="Biometric Authentication"
                                                        desc="Require FaceID or Fingerprint for administrative changes."
                                                        icon={<Shield />}
                                                        enabled={true}
                                                    />
                                                    <SecurityToggle
                                                        title="Login Protection"
                                                        desc="Instantly block unrecognized login attempts from new devices."
                                                        icon={<Smartphone />}
                                                        enabled={false}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Entity Modification Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-text/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}></div>
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-border/10 bg-primary text-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl">
                                    {modalType === 'admin' ? <UserPlus className="w-6 h-6" /> :
                                        modalType === 'banner' ? <ImageIcon className="w-6 h-6" /> :
                                            modalType === 'tip' ? <Lightbulb className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-wider">{editingId ? 'Edit Item' : 'Add New Item'}</h2>
                                    <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Managing {modalType} information</p>
                                </div>
                            </div>
                            <button onClick={() => { setIsModalOpen(false); setSelectedFile(null); setPreviewUrl(null); }} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveItem} className="p-12 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {modalType === 'admin' && (
                                    <>
                                        <InputItem label="Full Name" value={adminForm.fullName} onChange={(e: any) => setAdminForm({ ...adminForm, fullName: e.target.value })} />
                                        <InputItem label="Email Address" value={adminForm.email} onChange={(e: any) => setAdminForm({ ...adminForm, email: e.target.value })} />
                                        {!editingId && (
                                            <div className="md:col-span-2 space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Password</label>
                                                <input
                                                    type="password"
                                                    value={adminForm.password}
                                                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                                                    placeholder="Minimum 6 characters"
                                                    className="w-full px-6 py-4 bg-background border-2 border-border/40 rounded-2xl focus:outline-none focus:border-primary transition-all font-bold text-sm shadow-sm"
                                                    required
                                                />
                                                <p className="text-[9px] text-text-light/50 font-bold mt-2">
                                                    🔒 Password must be at least 6 characters long
                                                </p>
                                            </div>
                                        )}
                                        <div className="md:col-span-2 space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light block">Profile Photo</label>
                                            <div className="flex items-center gap-6">
                                                <div className="w-20 h-20 rounded-2xl bg-background border-2 border-border/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-border" />}
                                                </div>
                                                <div className="flex-1">
                                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-background border-2 border-border/40 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-primary transition-all flex items-center gap-2">
                                                        <Camera className="w-4 h-4" /> {selectedFile ? 'Change Photo' : 'Upload Photo'}
                                                    </button>
                                                    <p className="text-[9px] text-text-light/40 font-black uppercase tracking-widest mt-2">{selectedFile ? selectedFile.name : 'No file chosen'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Admin Role</label>
                                            <select value={adminForm.role} onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })} className="w-full px-6 py-4 bg-background border-2 border-border/40 rounded-2xl font-bold uppercase text-[11px] tracking-widest">
                                                <option value="super_admin">Super Administrator</option>
                                                <option value="verifier_admin">Verifier Administrator</option>
                                            </select>
                                            <p className="text-[9px] text-text-light/50 font-bold mt-2">
                                                {adminForm.role === 'super_admin'
                                                    ? '✓ Full access to all features and settings'
                                                    : '✓ Limited to skilled worker verification and monitoring'}
                                            </p>
                                        </div>
                                    </>
                                )}
                                {modalType === 'banner' && (
                                    <>
                                        <InputItem label="Banner Title" value={bannerForm.title} onChange={(e: any) => setBannerForm({ ...bannerForm, title: e.target.value })} />
                                        <div className="md:col-span-2 space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light block">Banner Image</label>
                                            <div className="flex items-center gap-6">
                                                <div className="w-40 h-24 rounded-2xl bg-background border-2 border-border/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-border" />}
                                                </div>
                                                <div className="flex-1">
                                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-background border-2 border-border/40 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-primary transition-all flex items-center gap-2">
                                                        <ImageIcon className="w-4 h-4" /> {selectedFile ? 'Change Image' : 'Upload Image'}
                                                    </button>
                                                    <p className="text-[9px] text-text-light/40 font-black uppercase tracking-widest mt-2">{selectedFile ? selectedFile.name : 'No image chosen'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Description</label>
                                            <textarea value={bannerForm.description} onChange={(e) => setBannerForm({ ...bannerForm, description: e.target.value })} className="w-full px-6 py-4 bg-background border-2 border-border/40 rounded-2xl font-bold text-sm h-32 resize-none" />
                                        </div>
                                    </>
                                )}
                                {modalType === 'category' && (
                                    <>
                                        <InputItem label="Category Name" value={categoryForm.name} onChange={(e: any) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light block">Icon</label>
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-xl bg-background border-2 border-border/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <Tag className="w-6 h-6 text-border" />}
                                                </div>
                                                <div className="flex-1">
                                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-background border-2 border-border/40 rounded-xl hover:border-primary transition-all text-primary">
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Color</label>
                                            <input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} className="w-full h-14 rounded-2xl border-2 border-border/40 p-1 cursor-pointer bg-background" />
                                        </div>
                                    </>
                                )}
                                {modalType === 'service' && (
                                    <>
                                        <InputItem label="Service Name" value={serviceForm.name} onChange={(e: any) => setServiceForm({ ...serviceForm, name: e.target.value })} />
                                        <InputItem label="Price Range" value={serviceForm.priceRange} onChange={(e: any) => setServiceForm({ ...serviceForm, priceRange: e.target.value })} />
                                        <div className="md:col-span-2 space-y-4">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light block">Service Image</label>
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 rounded-2xl bg-background border-2 border-border/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <Toolbox className="w-6 h-6 text-border" />}
                                                </div>
                                                <div className="flex-1">
                                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-background border-2 border-border/40 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-primary transition-all flex items-center gap-2">
                                                        <Camera className="w-4 h-4" /> {selectedFile ? 'Change Image' : 'Upload Image'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Category</label>
                                            <select value={serviceForm.categoryId} onChange={(e) => setServiceForm({ ...serviceForm, categoryId: e.target.value })} className="w-full px-6 py-4 bg-background border-2 border-border/40 rounded-2xl font-bold uppercase text-[11px] tracking-widest">
                                                <option value="">Select Category...</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Associated Skills (Comma Separated)</label>
                                            <textarea
                                                value={serviceForm.skills}
                                                onChange={(e) => setServiceForm({ ...serviceForm, skills: e.target.value })}
                                                placeholder="e.g. Installation, Repair, Maintenance, Troubleshooting"
                                                className="w-full px-6 py-4 bg-background border-2 border-border/40 rounded-2xl font-bold text-sm h-32 resize-none"
                                            />
                                            <p className="text-[9px] text-text-light/50 font-bold mt-2">
                                                💡 These skills will be selectable by workers who offer this service in the mobile app.
                                            </p>
                                        </div>
                                    </>
                                )}
                                {modalType === 'tip' && (
                                    <>
                                        <InputItem label="Tip Title" value={tipForm.title} onChange={(e: any) => setTipForm({ ...tipForm, title: e.target.value })} />
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Audience</label>
                                            <select value={tipForm.target} onChange={(e: any) => setTipForm({ ...tipForm, target: e.target.value })} className="w-full px-6 py-4 bg-background border-2 border-border/40 rounded-2xl font-bold uppercase text-[11px] tracking-widest">
                                                <option value="both">Both</option>
                                                <option value="homeowner">Homeowners Only</option>
                                                <option value="provider">Skilled Workers Only</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light mb-2 block">Content</label>
                                            <textarea value={tipForm.content} onChange={(e) => setTipForm({ ...tipForm, content: e.target.value })} className="w-full px-6 py-4 bg-background border-2 border-border/40 rounded-2xl font-bold text-sm h-32 resize-none" />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-4 mt-8">
                                <button type="button" onClick={() => { setIsModalOpen(false); setSelectedFile(null); setPreviewUrl(null); }} className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-text-light hover:text-text transition-all">Cancel</button>
                                <button type="submit" disabled={saving} className="px-10 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editingId ? 'Save Changes' : 'Add New'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

function InputItem({ label, value, readonly, onChange, disabled }: { label: string, value: string, readonly?: boolean, onChange?: any, disabled?: boolean }) {
    const isReadOnly = readonly || !onChange;
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-text-light uppercase tracking-[0.2em] ml-1 opacity-60">{label}</label>
            <input
                type="text"
                value={value}
                onChange={onChange}
                readOnly={isReadOnly}
                disabled={disabled}
                placeholder={`INPUT_${label.toUpperCase()}_HERE...`}
                className={`w-full px-6 py-4 bg-background border-2 border-border/40 rounded-2xl focus:outline-none focus:border-primary transition-all font-bold text-sm shadow-sm ${isReadOnly || disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/20'}`}
            />
        </div>
    );
}

function MetaCard({ label, val, icon }: { label: string, val: string, icon: any }) {
    return (
        <div className="bg-background/80 p-8 rounded-[2rem] border border-border/30 group hover:bg-white hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
            <div className="text-primary mb-6 opacity-30 group-hover:opacity-100 transition-all transform group-hover:scale-125 duration-500">
                {icon}
            </div>
            <p className="text-[10px] uppercase font-black text-text-light/40 tracking-widest mb-1">{label}</p>
            <p className="text-sm font-black text-text uppercase tracking-tighter">{val}</p>
        </div>
    );
}

function SecurityToggle({ title, desc, icon, enabled }: { title: string, desc: string, icon: any, enabled: boolean }) {
    return (
        <div className={`p-10 rounded-[2.5rem] border-2 transition-all group ${enabled ? 'bg-primary/5 border-primary/30' : 'bg-background border-border/40 hover:border-border/60'}`}>
            <div className="flex items-start gap-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all group-hover:scale-110 group-hover:rotate-6 ${enabled ? 'bg-primary text-white shadow-primary/20' : 'bg-border text-text-light'}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className={`font-black uppercase text-xs tracking-[0.15em] ${enabled ? 'text-primary' : 'text-text-light'}`}>{title}</h4>
                        <div className={`w-14 h-7 rounded-full relative cursor-pointer transition-all duration-300 ring-4 ring-offset-4 ring-transparent hover:ring-primary/10 ${enabled ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-border'}`}>
                            <div className={`absolute top-1.5 left-1.5 w-4 h-4 bg-white rounded-full border shadow-sm transition-all duration-500 scale-125 ${enabled ? 'translate-x-7' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                    <p className="text-xs font-bold text-text-light/60 leading-relaxed opacity-80">
                        {desc}
                    </p>
                </div>
            </div>
        </div>
    );
}
