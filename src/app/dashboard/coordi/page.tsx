"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, CalendarPlus, QrCode, LogOut, CheckCircle2 } from "lucide-react";
import { collection, query, onSnapshot, addDoc, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { UserProfile, SessionEvent, AttendanceRecord } from "@/lib/types";

export default function CoordiDashboard() {
    const { user, profile, loading: authLoading } = useAuth();
    const [diris, setDiris] = useState<(UserProfile & { attendancePercentage: number, attendedEvents: number })[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
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
            const usersData = usersSnap.docs.map(doc => doc.data() as UserProfile);
            setAllUsers(usersData);
            const dirisList = usersData.filter(u => u.role === "diri");

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
                const attendances = attSnap.docs.map(d => d.data() as AttendanceRecord);

                const enriched = dirisList.map(j => {
                    const userAtts = attendances.filter(a => a.userId === j.uid);
                    // Only count as "attended" if they are explicitly present (or legacy undefined)
                    const presentCount = userAtts.filter(a => a.status !== "late").length;

                    return {
                        ...j,
                        attendedEvents: presentCount,
                        attendancePercentage: totalEvents === 0 ? 100 : Math.round((presentCount / totalEvents) * 100)
                    };
                });

                // Filter and sort the table to show lowest percentage first
                setDiris(enriched.sort((a, b) => a.attendancePercentage - b.attendancePercentage));
            });

            return () => {
                unsubEvents();
                unsubAtt();
            };
        });

        return () => unsubUsers();
    }, [user, totalEvents]);

    useEffect(() => {
        if (!authLoading && (!user || (profile?.role !== "coordi" && profile?.role !== "asesor"))) {
            router.push("/");
        }
    }, [user, profile, authLoading, router]);

    if (authLoading || !user || (profile?.role !== "coordi" && profile?.role !== "asesor")) {
        return (
            <div className="min-h-screen bg-brand-negro flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-rojo" />
            </div>
        );
    }

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/");
    };

    const handleCreateSession = async (type: "asamblea" | "junta") => {
        setCreating(true);
        try {
            if (!user) return;
            await addDoc(collection(db, "events"), {
                date: Date.now(),
                createdBy: user.uid,
                lateMode: false,
                type: type
            });
            // Force short delay for feedback
            setTimeout(() => setCreating(false), 800);
        } catch (e) {
            console.error("Error creating session", e);
            setCreating(false);
        }
    };

    const handleRoleChange = async (targetUid: string, newRole: string) => {
        try {
            const userRef = doc(db, "users", targetUid);
            await updateDoc(userRef, { role: newRole });
        } catch (error) {
            console.error("Error updating role:", error);
        }
    };

    const isToday = (ms: number) => {
        const d = new Date(ms);
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    };

    const hasEventToday = currentEvent && isToday(currentEvent.date);

    return (
        <div className="min-h-screen bg-brand-negro text-brand-blanco p-6 relative overflow-hidden pb-32">
            {/* Background blobs */}
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-brand-vino/20 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-center mb-10 relative z-10 max-w-4xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-rojo to-brand-naranja">
                        Panel Administrativo
                    </h1>
                    <p className="text-brand-gris mt-1 flex items-center gap-2">
                        Sesiones totales: <span className="text-brand-naranja font-mono font-bold bg-[#111] px-2 py-0.5 rounded">{totalEvents}</span>
                    </p>
                </div>
                <button onClick={handleLogout} className="p-3 bg-[#111] border border-stone-800 hover:bg-[#222] rounded-2xl transition-all active:scale-95 text-brand-gris">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 mb-8">

                {/* Create Session Card */}
                {profile?.role === "coordi" && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#111]/80 backdrop-blur-xl border border-stone-800 rounded-3xl p-8 flex flex-col justify-between"
                    >
                        <div>
                            <div className="bg-brand-rojo/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-brand-rojo/30">
                                <CalendarPlus className="w-6 h-6 text-brand-rojo" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Nueva Sesión</h2>
                            <p className="text-sm text-brand-gris mb-6">Genera una nueva asamblea o junta para el día de hoy.</p>
                        </div>

                        {hasEventToday ? (
                            <div className="w-full bg-[#222] text-brand-naranja font-semibold rounded-xl px-4 py-3 flex items-center justify-center gap-2 border border-brand-naranja/20">
                                <CheckCircle2 className="w-5 h-5" />
                                {currentEvent.type === 'asamblea' ? 'Asamblea Activa' : 'Junta Activa'} ({new Date(currentEvent.date).toLocaleDateString('es-ES')})
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    disabled={creating}
                                    onClick={() => handleCreateSession("asamblea")}
                                    className="flex-1 bg-brand-vino hover:bg-[#52130b] text-brand-blanco font-semibold rounded-xl px-2 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-sm"
                                >
                                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Asamblea</>}
                                </button>
                                <button
                                    disabled={creating}
                                    onClick={() => handleCreateSession("junta")}
                                    className="flex-1 bg-brand-rojo hover:bg-[#b03a31] text-brand-blanco font-semibold rounded-xl px-2 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-sm"
                                >
                                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Junta</>}
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Scanner Link Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-brand-cafe/10 backdrop-blur-xl border border-brand-cafe/20 rounded-3xl p-8 flex flex-col justify-between"
                >
                    <div>
                        <div className="bg-brand-cafe/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-brand-cafe/30">
                            <QrCode className="w-6 h-6 text-brand-naranja" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Modo Escáner</h2>
                        <p className="text-sm text-brand-gris mb-6">Abre la cámara para comenzar a registrar llegadas masivamente. Funciona para el evento más reciente.</p>
                    </div>

                    <Link href="/dashboard/coordi/scanner">
                        <button
                            disabled={!currentEvent}
                            className="w-full bg-brand-naranja hover:bg-[#e08922] text-brand-negro font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:bg-[#222] disabled:text-stone-500"
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
                className="max-w-4xl mx-auto bg-[#111]/80 backdrop-blur-xl border border-stone-800 rounded-3xl p-6 md:p-8"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-brand-blanco">
                        <CheckCircle2 className="w-5 h-5 text-brand-naranja" />
                        Estado del Grupo ({diris.length} diris)
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-brand-gris text-sm font-medium">
                                <th className="pb-3 px-4 font-normal">Nombre</th>
                                <th className="pb-3 px-4 font-normal text-center">Asistencias</th>
                                <th className="pb-3 px-4 font-normal text-right">Porcentaje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {diris.map((diri) => {
                                const isDanger = totalEvents > 0 && diri.attendancePercentage < 80;
                                return (
                                    <tr
                                        key={diri.uid}
                                        onClick={() => router.push(`/dashboard/coordi/diri/${diri.uid}`)}
                                        className="bg-[#222]/30 hover:bg-[#222]/80 transition-colors group cursor-pointer"
                                    >
                                        <td className="py-4 px-4 rounded-l-xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${isDanger ? 'bg-brand-rojo' : 'bg-brand-naranja'}`} />
                                                <span className="font-medium text-brand-blanco">{diri.displayName || "Sin nombre"}</span>
                                            </div>
                                            <span className="text-xs text-brand-gris font-mono ml-5 block mt-0.5">{diri.email}</span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="text-brand-blanco font-mono bg-[#111] py-1 px-3 rounded-lg border border-stone-800 group-hover:border-brand-naranja/30 transition-colors">
                                                {diri.attendedEvents} / {totalEvents}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 rounded-r-xl text-right flex justify-end">
                                            <div className={`font-bold font-mono px-3 py-1 rounded-lg inline-block w-20 text-center ${isDanger
                                                ? 'bg-brand-rojo/10 text-brand-rojo border border-brand-rojo/20'
                                                : 'bg-brand-naranja/10 text-brand-naranja border border-brand-naranja/20'
                                                }`}>
                                                {diri.attendancePercentage}%
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {diris.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center py-8 text-stone-500 bg-stone-800/20 rounded-xl">
                                        No hay diris registrados aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Role Management Section (Only for Coordi) */}
            {profile?.role === "coordi" && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="max-w-4xl mx-auto bg-[#111]/60 border border-stone-800 rounded-3xl p-6 md:p-8 mt-8"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-brand-blanco">
                            Administración de Roles
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-brand-gris text-sm font-medium">
                                    <th className="pb-3 px-4 font-normal">Usuario</th>
                                    <th className="pb-3 px-4 font-normal text-right">Rol de Sistema</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allUsers.map((u) => (
                                    <tr key={u.uid} className="bg-[#222]/20 hover:bg-[#222]/40 transition-colors">
                                        <td className="py-3 px-4 rounded-l-xl">
                                            <span className="font-medium text-brand-blanco block">{u.displayName || "Sin nombre"}</span>
                                            <span className="text-xs text-brand-gris font-mono">{u.email}</span>
                                        </td>
                                        <td className="py-3 px-4 rounded-r-xl text-right">
                                            <select
                                                value={u.role}
                                                onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                                className={`bg-stone-900 text-sm rounded-lg border px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-rojo transition-colors ${u.role === "coordi" ? "border-brand-vino text-brand-vino" :
                                                    u.role === "asesor" ? "border-brand-naranja text-brand-naranja" :
                                                        "border-stone-700 text-brand-gris"
                                                    }`}
                                            >
                                                <option value="diri">Diri</option>
                                                <option value="asesor">Asesor</option>
                                                <option value="coordi">Coordi</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

        </div>
    );
}
