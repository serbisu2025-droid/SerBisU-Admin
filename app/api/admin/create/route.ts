import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Helper to get Firebase Admin services
function getAdminServices() {
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.FBASE_PROJECT_ID,
                clientEmail: process.env.FBASE_CLIENT_EMAIL,
                privateKey: process.env.FBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }
    return {
        auth: getAuth(),
        db: getFirestore(),
    };
}

export async function POST(request: NextRequest) {
    try {
        const { auth, db } = getAdminServices();
        const body = await request.json();
        const { email, password, fullName, role, photoURL } = body;

        // Validate required fields
        if (!email || !password || !fullName || !role) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate role
        if (role !== 'super_admin' && role !== 'verifier_admin') {
            return NextResponse.json(
                { error: 'Invalid role. Must be super_admin or verifier_admin' },
                { status: 400 }
            );
        }

        // Validate password length
        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Create Firebase Auth user
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: fullName,
            photoURL: photoURL || undefined,
        });

        // Create Firestore admin document
        await db.collection('admins').doc(userRecord.uid).set({
            fullName,
            email,
            role,
            status: 'active',
            photoURL: photoURL || null,
            createdAt: new Date(),
            createdBy: 'system', // You can pass the current admin's UID here if needed
        });

        return NextResponse.json({
            success: true,
            uid: userRecord.uid,
            message: 'Admin account created successfully',
        });
    } catch (error: any) {
        console.error('Error creating admin account:', error);

        // Handle specific Firebase errors
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json(
                { error: 'Email already exists' },
                { status: 400 }
            );
        }

        if (error.code === 'auth/invalid-email') {
            return NextResponse.json(
                { error: 'Invalid email address' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Failed to create admin account' },
            { status: 500 }
        );
    }
}
