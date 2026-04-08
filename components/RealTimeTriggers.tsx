"use client";

import { useEffect, useRef } from "react";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * This component listens to other collections in the database and 
 * automatically generates admin notifications when important events happen.
 * Real-time updates - no refresh needed.
 * Fix #4: Auto-loads new worker registrations without refresh.
 * Fix #5: Double notifications - both Admin and PESO get notified.
 */
export default function RealTimeTriggers() {
    const isMounted = useRef(false);
    const startTime = useRef(Timestamp.now());
    // Track notified doc IDs to prevent duplicates on re-render
    const notifiedWorkers = useRef<Set<string>>(new Set());
    const notifiedBookings = useRef<Set<string>>(new Set());
    const notifiedSupport = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (isMounted.current) return;
        isMounted.current = true;

        console.log("System Monitor: Active and listening for new events (real-time)...");

        // Helper to create notification
        const createNotification = async (payload: any) => {
            try {
                await addDoc(collection(db, "admin_notifications"), {
                    ...payload,
                    read: false,
                    createdAt: serverTimestamp()
                });
            } catch (e) {
                console.warn("Failed to create notification:", e);
            }
        };

        // 1. Listen for New Support Requests (real-time)
        const supportQuery = query(
            collection(db, "support_requests"),
            where("createdAt", ">", startTime.current)
        );

        const unsubSupport = onSnapshot(supportQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added" && !notifiedSupport.current.has(change.doc.id)) {
                    notifiedSupport.current.add(change.doc.id);
                    const data = change.doc.data();
                    const subject = data.subject || 'No Subject';
                    await createNotification({
                        title: "New Support Ticket",
                        message: `${data.userName || 'User'} submitted a ticket: "${subject}"`,
                        type: data.priority === 'high' ? 'error' : 'warning',
                        ticketId: change.doc.id,
                    });
                }
            });
        });

        // 2. Real-time listener for New Worker Registrations
        // Fix #4: Uses onSnapshot so new workers appear instantly without refresh
        // Fix #5: Creates notifications for BOTH admin and PESO
        const workerQuery = query(
            collection(db, "skilled_workers"),
            where("createdAt", ">", startTime.current)
        );

        const unsubWorkers = onSnapshot(workerQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added" && !notifiedWorkers.current.has(change.doc.id)) {
                    notifiedWorkers.current.add(change.doc.id);
                    const data = change.doc.data();
                    if (data.status === 'pending' || !data.status || !data.isVerified) {
                        const workerName = data.personalInfo?.fullName || data.fullName || 'A new worker';

                        // Notification for Super Admin (for initial review)
                        await createNotification({
                            title: "🆕 New Worker Registration",
                            message: `${workerName} has registered and is pending your initial review.`,
                            type: 'info',
                            targetRole: 'super_admin',
                            workerId: change.doc.id,
                        });

                        // Also notify PESO Admin (verifier) so they are aware
                        await createNotification({
                            title: "🆕 New Worker Registration",
                            message: `${workerName} has registered. Awaiting Admin initial review before PESO verification.`,
                            type: 'info',
                            targetRole: 'verifier_admin',
                            workerId: change.doc.id,
                        });
                    }
                }
            });
        });

        // 3. Listen for New Bookings (real-time)
        const bookingQuery = query(
            collection(db, "bookings"),
            where("createdAt", ">", startTime.current)
        );

        const unsubBookings = onSnapshot(bookingQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added" && !notifiedBookings.current.has(change.doc.id)) {
                    notifiedBookings.current.add(change.doc.id);
                    const data = change.doc.data();
                    const serviceName = data.jobType || data.serviceName || 'Service';
                    const homeownerName = data.customerName || data.clientName || 'Homeowner';
                    const workerName = data.worker?.name || 'Worker';

                    await createNotification({
                        title: "New Booking Received",
                        message: `${serviceName} booked by ${homeownerName} with ${workerName}.`,
                        type: 'success',
                        bookingId: change.doc.id,
                    });
                }
            });
        });

        return () => {
            unsubSupport();
            unsubWorkers();
            unsubBookings();
        };
    }, []);

    return null; // This component renders nothing
}
