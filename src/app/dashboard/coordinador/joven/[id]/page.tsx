"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Check, X, Calendar as CalendarIcon, ShieldAlert } from "lucide-react";
import { collection, query, onSnapshot, where, getDocs, addDoc, deleteDoc, doc, getDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useRouter, useParams } from "next/navigation";
import { UserProfile, SessionEvent, AttendanceRecord } from "@/lib/types";

export default function GestorManualJoven() {
    const { user, profile, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [joven, setJoven] = useState<UserProfile | null>(null);
    const [events, setEvents] = useState<SessionEvent[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        // Fetch user data
        const fetchUser = async () => {
            const userSnap = await getDoc(doc(db, "users", id));
            if (userSnap.exists()) {
                setJoven(userSnap.data() as UserProfile);
            }
        };

        fetchUser();

        // Listen to all events sorted by date
        const qEvents = query(collection(db, "events"), orderBy("date", "desc"));
        const unsubEvents = onSnapshot(qEvents, (snap) => {
            const mappedEvents = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEvent));
            setEvents(mappedEvents);
        });

        // Listen to this user's attendance
        const qAtt = query(collection(db, "attendance"), where("userId", "==", id));
        const unsubAtt = onSnapshot(qAtt, (snap) => {
            const mappedAtt = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
            setAttendance(mappedAtt);
            setLoading(false);
        });

        return () => {
            unsubEvents();
            unsubAtt();
        };
    }, [id]);

    const handleToggleAttendance = async (eventId: string, hasAttended: boolean) => {
        setToggling(eventId);
        try {
            if (hasAttended) {
                // Find and delete the attendance record
                const targetRecord = attendance.find(a => a.eventId === eventId);
                if (targetRecord) {
                    await deleteDoc(doc(db, "attendance", targetRecord.id));
                }
            } else {
                // Add an attendance record
                await addDoc(collection(db, "attendance"), {
                    userId: id,
                    eventId: eventId,
                    timestamp: Date.now(),
                    scannedBy: user?.uid || "manual"
                });
            }
        } catch (e) {
            console.error("Error toggling attendance", e);
        } finally {
            setToggling(null);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!joven) {
        return (
            <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center gap-4">
                <p>Joven no encontrado.</p>
                <button onClick={() => router.back()} className="text-emerald-500">Volver</button>
            </div>
        );
    }

    const percentage = events.length === 0 ? 100 : Math.round((attendance.length / events.length) * 100);
    const isDanger = events.length > 0 && percentage < 80;

    return (
        <div className="min-h-screen bg-stone-950 text-stone-100 p-6 relative overflow-hidden pb-32">
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-6"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver al Panel</span>
                </button>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-stone-900/60 backdrop-blur-xl border border-stone-800 rounded-3xl p-6 md:p-8 mb-8"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                                {joven.displayName || "Sin nombre"}
                            </h1>
                            <p className="text-stone-400 font-mono text-sm">{joven.email}</p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-stone-400 text-sm mb-1 text-center">Asistencia Mínima</p>
                                <div className={`font-mono text-xl font-bold px-4 py-2 rounded-xl flex items-center gap-2 ${isDanger ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                                    {isDanger && <ShieldAlert className="w-5 h-5" />}
                                    {percentage}%
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="mb-4 flex items-center gap-3">
                    <CalendarIcon className="w-6 h-6 text-stone-400" />
                    <h2 className="text-xl font-bold text-stone-200">Historial de Eventos</h2>
                </div>

                <div className="space-y-3">
                    {events.length === 0 && (
                        <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 text-center text-stone-500">
                            No hay sesiones registradas.
                        </div>
                    )}

                    {events.map((event, i) => {
                        const hasAttended = attendance.some(a => a.eventId === event.id);
                        const isToggling = toggling === event.id;
                        const eventDate = new Date(event.date);

                        return (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-stone-900/60 backdrop-blur-xl border border-stone-800 p-4 md:p-5 rounded-2xl flex items-center justify-between group hover:border-stone-700 transition-colors"
                            >
                                <div>
                                    <p className="text-stone-200 font-medium">
                                        Sesión de {eventDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                    <p className="text-stone-500 text-sm mt-1">
                                        ID: <span className="font-mono text-xs">{event.id.slice(0, 8)}</span>
                                    </p>
                                </div>

                                <button
                                    disabled={isToggling}
                                    onClick={() => handleToggleAttendance(event.id, hasAttended)}
                                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl border transition-all active:scale-95 disabled:opacity-50 min-w-[130px] justify-center ${hasAttended
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                        : "bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700 hover:text-white"
                                        }`}
                                >
                                    {isToggling ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : hasAttended ? (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Asistió
                                        </>
                                    ) : (
                                        <>
                                            <X className="w-5 h-5" />
                                            Falta
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
