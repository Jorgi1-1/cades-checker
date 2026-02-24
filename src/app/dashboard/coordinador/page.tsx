"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, CalendarPlus, QrCode, LogOut, CheckCircle2 } from "lucide-react";
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { UserProfile, SessionEvent } from "@/lib/types";

export default function CoordinadorDashboard() {
    const { user, profile, loading: authLoading } = useAuth();
    const [jovenes, setJovenes] = useState<(UserProfile & { attendancePercentage: number, attendedEvents: number })[]>([]);
    const [currentEvent, setCurrentEvent] = useState<SessionEvent | null>(null);
    const [totalEvents, setTotalEvents] = useState(0);
    const router = useRouter();
    const [creating, setCreating] = useState(false);

    // Initialize data subscriptions
    useEffect(() => {
        if (!user) return;

        // Listen to ALL young users
        const qUsers = query(collection(db, "users"));
        const unsubUsers = onSnapshot(qUsers, async (usersSnap) => {
            const allUsers = usersSnap.docs.map(doc => doc.data() as UserProfile);
            const jovenesList = allUsers.filter(u => u.role === "joven");

            // Listen to total events
            const eventsRef = collection(db, "events");
            const unsubEvents = onSnapshot(eventsRef, (eventsSnap) => {
                setTotalEvents(eventsSnap.size);
                const lastEvent = eventsSnap.docs.sort((a, b) => b.data().date - a.data().date)[0];
                setCurrentEvent(lastEvent ? { id: lastEvent.id, ...lastEvent.data() } as SessionEvent : null);
            });

            // Listen to all attendance to calculate percentages
            const attRef = collection(db, "attendance");
            const unsubAtt = onSnapshot(attRef, (attSnap) => {
                const attendances = attSnap.docs.map(d => d.data());

                const enriched = jovenesList.map(j => {
                    const attended = attendances.filter(a => a.userId === j.uid).length;
                    return {
                        ...j,
                        attendedEvents: attended,
                        attendancePercentage: totalEvents === 0 ? 100 : Math.round((attended / totalEvents) * 100)
                    };
                });

                // Filter and sort the table to show lowest percentage first
                setJovenes(enriched.sort((a, b) => a.attendancePercentage - b.attendancePercentage));
            });

            return () => {
                unsubEvents();
                unsubAtt();
            };
        });

        return () => unsubUsers();
    }, [user, totalEvents]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/");
    };

    const handleCreateSession = async () => {
        setCreating(true);
        try {
            if (!user) return;
            await addDoc(collection(db, "events"), {
                date: Date.now(),
                createdBy: user.uid,
            });
            // Force short delay for feedback
            setTimeout(() => setCreating(false), 800);
        } catch (e) {
            console.error("Error creating session", e);
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-stone-950 text-stone-100 p-6 relative overflow-hidden pb-32">
            {/* Background blobs */}
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-center mb-10 relative z-10 max-w-4xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
                        Panel de Coordinación
                    </h1>
                    <p className="text-stone-400 mt-1 flex items-center gap-2">
                        Sesiones totales: <span className="text-emerald-400 font-mono font-bold bg-stone-800 px-2 py-0.5 rounded">{totalEvents}</span>
                    </p>
                </div>
                <button onClick={handleLogout} className="p-3 bg-stone-900 border border-stone-800 hover:bg-stone-800 rounded-2xl transition-all active:scale-95 text-stone-300">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 mb-8">

                {/* Create Session Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-stone-900/60 backdrop-blur-xl border border-stone-800 rounded-3xl p-8 flex flex-col justify-between"
                >
                    <div>
                        <div className="bg-indigo-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-indigo-500/30">
                            <CalendarPlus className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Crear nueva sesión</h2>
                        <p className="text-sm text-stone-400 mb-6">Genera un nuevo evento en el contador global y abre la posibilidad de escaneo.</p>
                    </div>

                    <button
                        disabled={creating}
                        onClick={handleCreateSession}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Iniciar Sesión de Hoy</>}
                    </button>
                </motion.div>

                {/* Scanner Link Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-emerald-950/30 backdrop-blur-xl border border-emerald-900/50 rounded-3xl p-8 flex flex-col justify-between"
                >
                    <div>
                        <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/30">
                            <QrCode className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Modo Escáner</h2>
                        <p className="text-sm text-stone-400 mb-6">Abre la cámara para comenzar a registrar llegadas masivamente. Funciona para el evento más reciente.</p>
                    </div>

                    <Link href="/dashboard/coordinador/scanner">
                        <button
                            disabled={!currentEvent}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:bg-stone-800 disabled:text-stone-500"
                        >
                            <QrCode className="w-5 h-5" />
                            {currentEvent ? "Abrir Cámara" : "Crea una sesión primero"}
                        </button>
                    </Link>
                </motion.div>
            </div>

            {/* Roster / Control Panel */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-4xl mx-auto bg-stone-900/60 backdrop-blur-xl border border-stone-800 rounded-3xl p-6 md:p-8"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-teal-400" />
                        Estado del Grupo ({jovenes.length} jóvenes)
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-stone-500 text-sm font-medium">
                                <th className="pb-3 px-4 font-normal">Nombre</th>
                                <th className="pb-3 px-4 font-normal text-center">Asistencias</th>
                                <th className="pb-3 px-4 font-normal text-right">Porcentaje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jovenes.map((joven) => {
                                const isDanger = totalEvents > 0 && joven.attendancePercentage < 80;
                                return (
                                    <tr key={joven.uid} className="bg-stone-800/30 hover:bg-stone-800/60 transition-colors group rounded-xl">
                                        <td className="py-4 px-4 rounded-l-xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${isDanger ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                <span className="font-medium text-stone-200">{joven.displayName || "Sin nombre"}</span>
                                            </div>
                                            <span className="text-xs text-stone-500 font-mono ml-5 block mt-0.5">{joven.email}</span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="text-stone-300 font-mono bg-stone-800/50 py-1 px-3 rounded-lg border border-stone-800">
                                                {joven.attendedEvents} / {totalEvents}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 rounded-r-xl text-right flex justify-end">
                                            <div className={`font-bold font-mono px-3 py-1 rounded-lg inline-block w-20 text-center ${isDanger
                                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                }`}>
                                                {joven.attendancePercentage}%
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {jovenes.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center py-8 text-stone-500 bg-stone-800/20 rounded-xl">
                                        No hay jóvenes registrados aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
