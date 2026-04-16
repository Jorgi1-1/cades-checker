"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, CalendarPlus, QrCode, LogOut, CheckCircle2, Trash2, X, AlertTriangle } from "lucide-react";
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, where, writeBatch } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Link from "next/link";
import QRCode from "react-qr-code";
import { UserProfile, SessionEvent, AttendanceRecord } from "@/lib/types";

export default function CoordiDashboard() {
    const { user, profile, loading: authLoading } = useAuth();
    const [diris, setDiris] = useState<(UserProfile & { attendancePercentage: number, attendedEvents: number })[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [currentEvent, setCurrentEvent] = useState<SessionEvent | null>(null);
    const [totalEvents, setTotalEvents] = useState(0);
    const [eventsList, setEventsList] = useState<SessionEvent[]>([]);
    const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const [showMyQR, setShowMyQR] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    // Extra Event State
    const [showExtraModal, setShowExtraModal] = useState(false);
    const [extraName, setExtraName] = useState("");
    const [extraDate, setExtraDate] = useState("");

    // Initialize data subscriptions
    useEffect(() => {
        if (!user) return;

        const unsubUsers = onSnapshot(query(collection(db, "users")), (snap) => {
            setAllUsers(snap.docs.map(doc => doc.data() as UserProfile));
        });

        const unsubEvents = onSnapshot(collection(db, "events"), (snap) => {
            const evts = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEvent));
            setEventsList(evts);
            setTotalEvents(evts.length);
            const lastEvent = [...evts].sort((a, b) => b.date - a.date)[0];
            setCurrentEvent(lastEvent || null);
        });

        const unsubAtt = onSnapshot(collection(db, "attendance"), (snap) => {
            setAttendanceList(snap.docs.map(d => d.data() as AttendanceRecord));
        });

        return () => {
            unsubUsers();
            unsubEvents();
            unsubAtt();
        };
    }, [user]);

    // Compute derived state for percentages
    useEffect(() => {
        if (!allUsers.length) return;

        const validEventIds = new Set(eventsList.map(e => e.id));

        const enriched = allUsers.map(j => {
            const userAtts = attendanceList.filter(a => a.userId === j.uid && validEventIds.has(a.eventId));
            // Only count as "attended" if they are explicitly present (or legacy undefined)
            const presentCount = userAtts.filter(a => a.status === "present" || !a.status).length;
            const excusedCount = userAtts.filter(a => a.status === "excused").length;
            const effectiveTotal = eventsList.length - excusedCount;

            return {
                ...j,
                attendedEvents: presentCount,
                attendancePercentage: effectiveTotal <= 0 ? 100 : Math.round((presentCount / effectiveTotal) * 100)
            };
        });

        // Filter and sort the table to show lowest percentage first
        setDiris(enriched.sort((a, b) => a.attendancePercentage - b.attendancePercentage));
    }, [allUsers, eventsList, attendanceList]);

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

    const handleDeleteEvent = async () => {
        if (!currentEvent) return;
        setDeleting(true);
        try {
            // Delete the event doc
            await deleteDoc(doc(db, "events", currentEvent.id));
            
            // Query all attendance docs linked to this event
            const qAtt = query(collection(db, "attendance"), where("eventId", "==", currentEvent.id));
            const attDocs = await getDocs(qAtt);
            
            // Use batch to delete them safely
            const batch = writeBatch(db);
            attDocs.forEach(d => {
                batch.delete(d.ref);
            });
            await batch.commit();

            setShowDeleteModal(false);
            setDeleteConfirm(false);
        } catch (e) {
            console.error("Error deleting session and attendance:", e);
        } finally {
            setDeleting(false);
        }
    };

    const handleCreateExtra = async () => {
        if (!extraName.trim() || !extraDate || !user) return;
        setCreating(true);
        try {
            const [year, month, day] = extraDate.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone shifts

            await addDoc(collection(db, "events"), {
                date: dateObj.getTime(),
                createdBy: user.uid,
                lateMode: false,
                type: "extraordinario",
                customName: extraName.trim()
            });
            setShowExtraModal(false);
            setExtraName("");
            setExtraDate("");
            setTimeout(() => setCreating(false), 800);
        } catch (e) {
            console.error("Error creating extra session", e);
            setCreating(false);
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
                        Panel de {profile?.role === 'coordi' ? 'Coordi' : 'Asesor'}
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
                            <div className="w-full bg-[#222] text-brand-naranja font-semibold rounded-xl px-4 py-3 flex items-center justify-between gap-2 border border-brand-naranja/20">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="truncate">{currentEvent.type === 'asamblea' ? 'Asamblea' : 'Junta'} ({new Date(currentEvent.date).toLocaleDateString('es-ES')})</span>
                                </div>
                                <button 
                                    onClick={() => setShowDeleteModal(true)} 
                                    className="p-1.5 hover:bg-brand-rojo/10 rounded-lg text-brand-rojo transition-colors flex-shrink-0"
                                    title="Borrar sesión del día"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
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
                                <button
                                    disabled={creating}
                                    onClick={() => {
                                        setExtraDate(new Date().toISOString().split('T')[0]);
                                        setShowExtraModal(true);
                                    }}
                                    className="w-12 bg-stone-800 hover:bg-stone-700 text-brand-blanco font-semibold rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 border border-stone-700"
                                    title="Evento Extraordinario"
                                >
                                    <Plus className="w-5 h-5 text-stone-400" />
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
                        <p className="text-sm text-brand-gris mb-6">Abre la cámara para comenzar a registrar llegadas.</p>
                    </div>

                    <div className="flex gap-2">
                        <Link href="/dashboard/coordi/scanner" className="flex-1">
                            <button
                                disabled={!currentEvent}
                                className="w-full bg-brand-naranja hover:bg-[#e08922] text-brand-negro font-bold rounded-xl px-2 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:bg-[#222] disabled:text-stone-500 text-sm"
                            >
                                <QrCode className="w-5 h-5" />
                                Escáner
                            </button>
                        </Link>
                        {hasEventToday && (
                            <button 
                                onClick={() => setShowMyQR(true)}
                                className="flex-1 bg-stone-800 hover:bg-stone-700 text-brand-blanco font-bold rounded-xl px-2 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm border border-stone-700"
                            >
                                <QrCode className="w-5 h-5" />
                                Mi QR
                            </button>
                        )}
                    </div>
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
                        Estado de Asistencias ({diris.length} registros)
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
                                        No hay usuarios registrados aún.
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
                                    <th className="pb-3 px-4 font-normal text-right">Cargo</th>
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

            {/* My QR Modal */}
            {showMyQR && currentEvent && user && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#111] border border-stone-800 rounded-3xl p-8 max-w-sm w-full relative flex flex-col items-center"
                    >
                        <button 
                            onClick={() => setShowMyQR(false)}
                            className="absolute top-4 right-4 p-2 text-stone-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <h2 className="text-xl font-bold text-white mb-6">Pase de Lista</h2>
                        <div className="bg-white p-4 rounded-3xl mb-4 shadow-xl shadow-brand-blanco/5">
                            <QRCode value={JSON.stringify({ u: user.uid, e: currentEvent.id })} size={200} className="w-48 h-48" fgColor="#0c0a09" />
                        </div>
                        <p className="text-stone-400 font-mono text-sm tracking-wider opacity-70">ID: {user.uid.slice(0, 8).toUpperCase()}</p>
                    </motion.div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#111] border border-stone-800 rounded-3xl p-8 max-w-sm w-full relative"
                    >
                        <button 
                            onClick={() => {
                                setShowDeleteModal(false);
                                setDeleteConfirm(false);
                            }}
                            className="absolute top-4 right-4 p-2 text-stone-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="flex justify-center mb-4">
                            <div className="bg-brand-rojo/20 p-4 rounded-full border border-brand-rojo/30">
                                <AlertTriangle className="w-8 h-8 text-brand-rojo" />
                            </div>
                        </div>

                        <h2 className="text-xl font-bold text-white text-center mb-2">¿Borrar sesión?</h2>
                        <p className="text-stone-400 text-sm text-center mb-6">
                            Esta acción eliminará permanentemente la sesión actual y todos los pases de asistencia registrados en ella.
                        </p>

                        <label className="flex items-start gap-3 p-4 rounded-xl bg-[#222] border border-stone-800 cursor-pointer mb-6 group">
                            <input 
                                type="checkbox" 
                                checked={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.checked)}
                                className="mt-1 w-4 h-4 rounded border-stone-700 text-brand-rojo focus:ring-brand-rojo bg-[#111]"
                            />
                            <span className="text-sm text-stone-300 select-none group-hover:text-white transition-colors">
                                Confirmo que deseo borrar esta sesión y todas sus asistencias.
                            </span>
                        </label>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteConfirm(false);
                                }}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-stone-300 bg-stone-800 hover:bg-stone-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                disabled={!deleteConfirm || deleting}
                                onClick={handleDeleteEvent}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-brand-rojo hover:bg-[#d63d32] disabled:opacity-50 disabled:bg-[#441916] transition-colors flex justify-center items-center gap-2"
                            >
                                {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Borrar Sesión'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Create Extra Event Modal */}
            {showExtraModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#111] border border-stone-800 rounded-3xl p-8 max-w-md w-full relative"
                    >
                        <button 
                            onClick={() => setShowExtraModal(false)}
                            className="absolute top-4 right-4 p-2 text-stone-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <h2 className="text-xl font-bold text-white mb-2">Evento Extraordinario</h2>
                        <p className="text-stone-400 text-sm mb-6">Genera un evento manual asignándole un nombre y fecha (ej. Viacrucis, Campamento).</p>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="text-sm text-stone-400 block mb-1">Nombre del evento</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej. Viacrucis"
                                    value={extraName}
                                    onChange={(e) => setExtraName(e.target.value)}
                                    className="w-full bg-[#222] border border-stone-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-naranja focus:ring-1 focus:ring-brand-naranja transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-stone-400 block mb-1">Fecha</label>
                                <input 
                                    type="date" 
                                    value={extraDate}
                                    onChange={(e) => setExtraDate(e.target.value)}
                                    className="w-full bg-[#222] border border-stone-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-naranja focus:ring-1 focus:ring-brand-naranja transition-colors [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowExtraModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-stone-300 bg-stone-800 hover:bg-stone-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                disabled={!extraName.trim() || !extraDate || creating}
                                onClick={handleCreateExtra}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-black bg-brand-naranja hover:bg-[#e08922] disabled:opacity-50 disabled:bg-[#443316] transition-colors flex justify-center items-center gap-2"
                            >
                                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Añadir'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
