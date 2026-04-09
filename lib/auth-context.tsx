"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserRole } from './rbac';

interface AdminUser {
    uid: string;
    email: string | null;
    role: UserRole;
    fullName?: string;
    photoURL?: string;
}

interface AuthContextType {
    user: AdminUser | null;
    loading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAuthenticated: false
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeDoc: (() => void) | undefined;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setLoading(true); // Restart loading while we fetch the doc
                // Listen to real-time updates from Firestore admin doc
                unsubscribeDoc = onSnapshot(doc(db, 'admins', firebaseUser.uid), (adminDoc) => {
                    if (adminDoc.exists()) {
                        const adminData = adminDoc.data();
                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            role: adminData.role || 'super_admin',
                            fullName: adminData.fullName,
                            photoURL: adminData.photoURL
                        });
                    } else {
                        // If no admin doc exists yet
                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            role: 'super_admin'
                        });
                    }
                    setLoading(false);
                }, (error) => {
                    console.error('Error listening to admin data:', error);
                    setLoading(false);
                });
            } else {
                if (unsubscribeDoc) unsubscribeDoc();
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeDoc) unsubscribeDoc();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
