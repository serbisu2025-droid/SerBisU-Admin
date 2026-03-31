"use client";

import { useEffect, useRef } from "react";
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * This component listens to other collections in the database and 
 * automatically generates admin notifications when important events happen.
 * It acts as a client-side "Cloud Function" for demonstration purposes.
 */
export default function RealTimeTriggers() {
    const isMounted = useRef(false);
    const startTime = useRef(Timestamp.now());

    useEffect(() => {
        if (isMounted.current) return;
        isMounted.current = true;

        console.log("System Monitor: Active and listening for new events...");

        // 1. Listen for New Support Requests
        const supportQuery = query(
            collection(db, "support_requests"),
            where("createdAt", ">", startTime.current)
        );

        const unsubSupport = onSnapshot(supportQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const subject = data.subject || 'No Subject';
                    await addDoc(collection(db, "admin_notifications"), {
                        title: "New Support Ticket",
                        message: `${data.userName || 'User'} submitted a ticket: "${subject}"`,
                        type: data.priority === 'high' ? 'error' : 'warning',
                        read: false,
                        createdAt: serverTimestamp()
                    });
                }
            });
        });

        // 2. Listen for New Worker Registrations (Pending Verification)
        const workerQuery = query(
            collection(db, "skilled_workers"),
            where("createdAt", ">", startTime.current) // Assuming workers have createdAt
        );

        const unsubWorkers = onSnapshot(workerQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    if (data.status === 'pending' || !data.isVerified) {
                        // Extract fullName from personalInfo if direct field is missing
                        const workerName = data.fullName || data.personalInfo?.fullName || 'A new worker';
                        await addDoc(collection(db, "admin_notifications"), {
                            title: "Worker Application",
                            message: `${workerName} registered and is pending verification.`,
                            type: 'info',
                            read: false,
                            createdAt: serverTimestamp()
                        });
                    }
                }
            });
        });

        // 3. Listen for New Bookings
        const bookingQuery = query(
            collection(db, "bookings"),
            where("createdAt", ">", startTime.current)
        );

        const unsubBookings = onSnapshot(bookingQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    // jobType is used in Firestore instead of serviceName
                    const serviceName = data.jobType || data.serviceName || 'Service';
                    // customerName is used in Firestore instead of clientName
                    const homeownerName = data.customerName || data.clientName || 'Homeowner';
                    // worker name is usually in worker.name
                    const workerName = data.worker?.name || 'Worker';

                    await addDoc(collection(db, "admin_notifications"), {
                        title: "New Booking Received",
                        message: `${serviceName} booked by ${homeownerName} with ${workerName}.`,
                        type: 'success',
                        read: false,
                        createdAt: serverTimestamp()
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
