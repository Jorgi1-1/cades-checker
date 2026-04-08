"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { motion } from "framer-motion";
import { Loader2, CalendarCheck, ShieldAlert, LogOut, History } from "lucide-react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

export default function DiriDashboard() {
    const { user, profile, loading: authLoading } = useAuth();
    const [events, setEvents] = useState<{ id: string; date: string | number; type?: string }[]>([]);
    const [latestEventId, setLatestEventId] = useState<string | null>(null);
    const [attendanceDict, setAttendanceDict] = useState<Record<string, { attended: boolean, late: boolean, excused: boolean }>>({});
    const [totalEvents, setTotalEvents] = useState(0);
    const [attendedEvents, setAttendedEvents] = useState(0);
    const router = useRouter();

    // Loading events calculations
    useEffect(() => {
        if (!user) return;

        // Listen to total events
        const qEvents = query(collection(db, "events"), orderBy("date", "desc"));
        const unsubEvents = onSnapshot(qEvents, (snap) => {
            const evts = snap.docs.map(d => ({ id: d.id, ...(d.data() as { date: string | number; type?: string }) }));
            setEvents(evts);
            setTotalEvents(snap.size); // The denominator

            if (!snap.empty) {
                setLatestEventId(snap.docs[0].id);
            } else {
                setLatestEventId(null);
            }
        });

        // Listen to attended events
        const qAttended = query(collection(db, "attendance"), where("userId", "==", user.uid));
        const unsubAttended = onSnapshot(qAttended, (snap) => {
            let presentCount = 0;
            let excusedCount = 0;
            const dict: Record<string, { attended: boolean, late: boolean, excused: boolean }> = {};

            snap.docs.forEach(d => {
                const data = d.data();
                const isLate = data.status === "late";
                const isExcused = data.status === "excused";
                dict[data.eventId] = { attended: !isExcused && !isLate, late: isLate, excused: isExcused };

                if (data.status === "present" || !data.status) presentCount++;
                if (isExcused) excusedCount++;
            });

            const effectiveTotal = totalEvents - excusedCount;
            setTotalEvents(effectiveTotal); // Overriding totalEvents inside this component to effectiveTotal
            setAttendedEvents(presentCount);
            setAttendanceDict(dict);
        });

        return () => {
            unsubEvents();
            unsubAttended();
        };
    }, [user]);

    useEffect(() => {
        if (!authLoading && (!user || profile?.role !== "diri")) {
            router.push("/");
        }
    }, [user, profile, authLoading, router]);

    if (authLoading || !user || profile?.role !== "diri") {
        return (
            <div className="min-h-screen bg-brand-negro flex items-center justify-center text-brand-rojo">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    const percentage = totalEvents === 0 ? 100 : Math.round((attendedEvents / totalEvents) * 100);
    const isDanger = percentage < 80 && totalEvents > 0;

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/");
    };

    return (
        <div className="min-h-screen bg-brand-negro text-brand-blanco p-6 relative overflow-hidden pb-32">
            {/* Background blobs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-brand-gris/10 to-transparent pointer-events-none" />
            <div className={`absolute -top-20 -left-20 w-80 h-80 rounded-full blur-[100px] pointer-events-none ${isDanger ? 'bg-brand-rojo/20' : 'bg-brand-naranja/20'}`} />

            {/* Header */}
            <div className="flex justify-between items-center mb-8 relative z-10 p-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Hola, {profile?.displayName?.split(" ")[0] || "Diri"}!</h1>
                    <p className="text-brand-gris text-sm mt-1">Pase de lista Cadés</p>
                </div>
                <button onClick={handleLogout} className="p-2 bg-[#111] border border-stone-800 hover:bg-[#222] rounded-full transition-colors active:scale-95 text-brand-gris">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            <div className="max-w-md mx-auto space-y-6 relative z-10">
                {/* QR Code Section */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, type: "spring" }}
                    className="bg-[#111] backdrop-blur-xl border border-stone-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center"
                >
                    {latestEventId ? (
                        <>
                            <div className="bg-brand-blanco p-4 rounded-3xl mb-4 shadow-xl shadow-brand-blanco/5">
                                <QRCode value={JSON.stringify({ u: user.uid, e: latestEventId })} size={200} className="w-48 h-48" fgColor="#0c0a09" />
                            </div>
                            <p className="text-brand-gris font-mono text-sm tracking-wider opacity-70">ID: {user.uid.slice(0, 8).toUpperCase()}</p>
                            <div className="mt-4 text-center">
                                <p className="text-brand-naranja font-medium text-sm flex items-center justify-center gap-2">
                                    <CalendarCheck className="w-4 h-4" />
                                    Pase válido para asamblea actual
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-stone-900 flex items-center justify-center mb-4">
                                <Loader2 className="w-8 h-8 text-brand-gris animate-spin" />
                            </div>
                            <p className="text-brand-blanco font-medium">Esperando asamblea/junta...</p>
                            <p className="text-brand-gris text-sm mt-2 max-w-[200px]">Tu código QR aparecerá aquí en cuanto un coordi inicie la asamblea de hoy.</p>
                        </div>
                    )}
                </motion.div>

                {/* Attendance Progress Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="bg-[#111] backdrop-blur-xl border border-stone-800 rounded-3xl p-6 shadow-2xl space-y-4"
                >
                    <div className="flex justify-between items-end">
                        <div>
                            <h2 className="text-brand-gris font-medium text-sm">Tu Asistencia</h2>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-4xl font-bold ${isDanger ? 'text-brand-rojo' : 'text-brand-naranja'}`}>
                                    {percentage}%
                                </span>
                                <span className="text-brand-gris font-medium text-sm">/ 100%</span>
                            </div>
                        </div>
                        {isDanger && (
                            <div className="bg-brand-rojo/10 text-brand-rojo p-2 rounded-xl flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5" />
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 w-full bg-stone-900 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${isDanger ? 'bg-gradient-to-r from-brand-vino to-brand-rojo' : 'bg-gradient-to-r from-brand-naranja to-brand-cafe'}`}
                        />
                    </div>

                    <div className="pt-2 border-t border-stone-800/50 flex flex-col gap-2 text-sm">
                        <span className="text-brand-gris">Has llegado a tiempo a {attendedEvents} de {totalEvents} asambleas y juntas.</span>
                        {isDanger ? (
                            <span className="text-brand-rojo font-medium px-2 py-1 bg-brand-rojo/10 border border-brand-rojo/20 rounded-md text-xs self-start">No tienes derecho de asistir a eventos por el momento</span>
                        ) : (
                            <span className="text-brand-cafe font-medium px-2 py-1 bg-brand-cafe/10 border border-brand-cafe/20 rounded-md text-xs self-start">¡Estás al corriente con tus asistencias!</span>
                        )}
                        <span className="text-brand-gris text-xs italic mt-1">*Los retardos y faltas reducen tu porcentaje.</span>
                    </div>
                </motion.div>

                {/* History Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="bg-[#111] backdrop-blur-xl border border-stone-800 rounded-3xl p-6 shadow-2xl space-y-4"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <History className="w-5 h-5 text-brand-naranja" />
                        <h2 className="font-medium text-sm">Historial de Asistencias</h2>
                    </div>

                    <div className="space-y-4">
                        {events.length === 0 ? (
                            <p className="text-brand-gris text-sm italic text-center py-4">Aún no hay asambleas o juntas registradas.</p>
                        ) : (
                            events.map(event => {
                                const record = attendanceDict[event.id];
                                const hasAttended = !!record?.attended;
                                const isLate = !!record?.late;
                                const isExcused = !!record?.excused;
                                const dateObj = new Date(event.date);
                                return (
                                    <div key={event.id} className="flex justify-between items-center p-3 rounded-2xl bg-stone-900 border border-stone-800">
                                        <div>
                                            <p className="text-sm font-medium text-brand-blanco capitalize">
                                                {event.type === 'extraordinario' && (event as any).customName ? (event as any).customName : (event.type || 'asamblea')} del {dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                                            </p>
                                        </div>
                                        <div>
                                            {hasAttended && !isExcused && !isLate && (
                                                <span className="text-brand-cafe text-xs font-bold px-2 py-1 bg-brand-cafe/10 border border-brand-cafe/20 rounded-lg">ASISTIÓ</span>
                                            )}
                                            {isLate && (
                                                <span className="text-brand-naranja text-xs font-bold px-2 py-1 bg-brand-naranja/10 border border-brand-naranja/20 rounded-lg">RETARDO</span>
                                            )}
                                            {isExcused && (
                                                <span className="text-stone-400 text-xs font-bold px-2 py-1 bg-stone-800 border border-stone-700 rounded-lg">(JUSTIFICADA)</span>
                                            )}
                                            {!hasAttended && !isLate && !isExcused && (
                                                <span className="text-brand-rojo text-xs font-bold px-2 py-1 bg-brand-rojo/10 border border-brand-rojo/20 rounded-lg">FALTA</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
