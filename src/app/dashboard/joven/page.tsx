"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { motion } from "framer-motion";
import { Loader2, CalendarCheck, ShieldAlert, LogOut } from "lucide-react";
import { collection, query, getDocs, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

export default function JovenDashboard() {
    const { user, profile, loading: authLoading } = useAuth();
    const [totalEvents, setTotalEvents] = useState(0);
    const [attendedEvents, setAttendedEvents] = useState(0);
    const router = useRouter();

    // Loading events calculations
    useEffect(() => {
        if (!user) return;

        // Listen to total events
        const qEvents = query(collection(db, "events"));
        const unsubEvents = onSnapshot(qEvents, (snap) => {
            setTotalEvents(snap.size); // The denominator
        });

        // Listen to attended events
        const qAttended = query(collection(db, "attendance"), where("userId", "==", user.uid));
        const unsubAttended = onSnapshot(qAttended, (snap) => {
            setAttendedEvents(snap.size); // The numerator
        });

        return () => {
            unsubEvents();
            unsubAttended();
        };
    }, [user]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center text-emerald-500">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (!user || profile?.role !== "joven") {
        // Basic protection
        router.push("/");
        return null;
    }

    const percentage = totalEvents === 0 ? 100 : Math.round((attendedEvents / totalEvents) * 100);
    const isDanger = percentage < 80 && totalEvents > 0;

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/");
    };

    return (
        <div className="min-h-screen bg-stone-950 text-stone-100 p-6 relative overflow-hidden pb-32">
            {/* Background blobs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-stone-900/50 to-transparent pointer-events-none" />
            <div className={`absolute -top-20 -left-20 w-80 h-80 rounded-full blur-[100px] pointer-events-none ${isDanger ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`} />

            {/* Header */}
            <div className="flex justify-between items-center mb-8 relative z-10 p-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Hola, {profile?.displayName?.split(" ")[0] || "Joven"} 👋</h1>
                    <p className="text-stone-400 text-sm mt-1">Cades Escáner Invertido</p>
                </div>
                <button onClick={handleLogout} className="p-2 bg-stone-800/50 hover:bg-stone-800 rounded-full transition-colors active:scale-95 text-stone-300">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            <div className="max-w-md mx-auto space-y-6 relative z-10">
                {/* QR Code Section */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, type: "spring" }}
                    className="bg-stone-900/80 backdrop-blur-xl border border-stone-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center"
                >
                    <div className="bg-white p-4 rounded-3xl mb-4 shadow-xl shadow-white/5">
                        <QRCode value={user.uid} size={200} className="w-48 h-48" fgColor="#0c0a09" />
                    </div>
                    <p className="text-stone-300 font-mono text-sm tracking-wider opacity-70">ID: {user.uid.slice(0, 8).toUpperCase()}</p>
                    <div className="mt-4 text-center">
                        <p className="text-emerald-400 font-medium text-sm flex items-center justify-center gap-2">
                            <CalendarCheck className="w-4 h-4" />
                            Escaneo estático en la entrada
                        </p>
                    </div>
                </motion.div>

                {/* Attendance Progress Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="bg-stone-900/80 backdrop-blur-xl border border-stone-800 rounded-3xl p-6 shadow-2xl space-y-4"
                >
                    <div className="flex justify-between items-end">
                        <div>
                            <h2 className="text-stone-400 font-medium text-sm">Tu Asistencia</h2>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-4xl font-bold ${isDanger ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {percentage}%
                                </span>
                                <span className="text-stone-500 font-medium text-sm">/ 100%</span>
                            </div>
                        </div>
                        {isDanger && (
                            <div className="bg-rose-500/10 text-rose-400 p-2 rounded-xl flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5" />
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 w-full bg-stone-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${isDanger ? 'bg-gradient-to-r from-rose-500 to-orange-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                        />
                    </div>

                    <div className="pt-2 border-t border-stone-800/50 flex justify-between items-center text-sm">
                        <span className="text-stone-400">Has asistido a {attendedEvents} de {totalEvents} eventos creados.</span>
                        {isDanger ? (
                            <span className="text-rose-400 font-medium px-2 py-1 bg-rose-500/10 rounded-md text-xs">¡Meta peliaguda!</span>
                        ) : (
                            <span className="text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded-md text-xs">¡Meta en curso!</span>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
