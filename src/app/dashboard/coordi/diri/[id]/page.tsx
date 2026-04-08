"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Check, X, Calendar as CalendarIcon, ShieldAlert, Clock, FileText } from "lucide-react";
import { collection, query, onSnapshot, where, addDoc, deleteDoc, doc, getDoc, orderBy, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useRouter, useParams } from "next/navigation";
import { UserProfile, SessionEvent, AttendanceRecord } from "@/lib/types";

export default function GestorManualDiri() {
    const { user, profile, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [diri, setDiri] = useState<UserProfile | null>(null);
    const [events, setEvents] = useState<SessionEvent[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && (!user || (profile?.role !== "coordi" && profile?.role !== "asesor"))) {
            router.push("/");
        }
    }, [user, profile, authLoading, router]);

    useEffect(() => {
        if (!id) return;

        // Fetch user data
        const fetchUser = async () => {
            const userSnap = await getDoc(doc(db, "users", id));
            if (userSnap.exists()) {
                setDiri(userSnap.data() as UserProfile);
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

    const handleStatusChange = async (eventId: string, currentRecord: AttendanceRecord | undefined, newStatus: "present" | "late" | "excused" | null) => {
        setToggling(eventId);
        try {
            if (newStatus === null) {
                // Delete record entirely (Absent)
                if (currentRecord) {
                    await deleteDoc(doc(db, "attendance", currentRecord.id));
                }
            } else if (currentRecord) {
                // Update existing record
                await setDoc(doc(db, "attendance", currentRecord.id), {
                    ...currentRecord,
                    status: newStatus
                });
            } else {
                // Add new record
                await setDoc(doc(db, "attendance", `${eventId}_${id}`), {
                    userId: id,
                    eventId: eventId,
                    timestamp: Date.now(),
                    scannedBy: user?.uid || "manual",
                    status: newStatus
                });
            }
        } catch (e) {
            console.error("Error toggling attendance", e);
        } finally {
            setToggling(null);
        }
    };

    if (authLoading || loading || !profile || (profile.role !== "coordi" && profile.role !== "asesor")) {
        return (
            <div className="min-h-screen bg-brand-negro flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-rojo" />
            </div>
        );
    }

    if (!diri) {
        return (
            <div className="min-h-screen bg-brand-negro text-brand-blanco flex flex-col items-center justify-center gap-4">
                <p>Diri no encontrado.</p>
                <button onClick={() => router.back()} className="text-brand-naranja">Volver</button>
            </div>
        );
    }

    // Calculate attendance ignoring excused sessions
    const presentCount = attendance.filter(a => a.status === "present" || !a.status).length;
    const excusedCount = attendance.filter(a => a.status === "excused").length;
    const effectiveTotal = events.length - excusedCount;
    const percentage = effectiveTotal <= 0 ? 100 : Math.round((presentCount / effectiveTotal) * 100);
    const isDanger = effectiveTotal > 0 && percentage < 80;

    return (
        <div className="min-h-screen bg-brand-negro text-brand-blanco p-6 relative overflow-hidden pb-32">
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-brand-cafe/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-brand-gris hover:text-brand-blanco transition-colors mb-6"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver al Panel</span>
                </button>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#111]/80 backdrop-blur-xl border border-[#222] rounded-3xl p-6 md:p-8 mb-8"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-brand-blanco mb-2">
                                {diri.displayName || "Sin nombre"}
                            </h1>
                            <p className="text-brand-gris font-mono text-sm">{diri.email}</p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-brand-gris text-sm mb-1 text-center">Asistencia Mínima</p>
                                <div className={`font-mono text-xl font-bold px-4 py-2 rounded-xl flex items-center gap-2 ${isDanger ? 'bg-brand-rojo/10 text-brand-rojo border border-brand-rojo/30' : 'bg-[#222] text-brand-naranja border border-brand-naranja/20'}`}>
                                    {isDanger && <ShieldAlert className="w-5 h-5" />}
                                    {percentage}%
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="mb-4 flex items-center gap-3">
                    <CalendarIcon className="w-6 h-6 text-brand-gris" />
                    <h2 className="text-xl font-bold text-brand-blanco">Historial de asistencias</h2>
                </div>

                <div className="space-y-3">
                    {events.length === 0 && (
                        <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-center text-brand-gris">
                            No hay asambleas o juntas registradas.
                        </div>
                    )}

                    {events.map((event, i) => {
                        const record = attendance.find(a => a.eventId === event.id);
                        const isToggling = toggling === event.id;
                        const eventDate = new Date(event.date);

                        const currentStatus = record ? (record.status === "late" ? "late" : record.status === "excused" ? "excused" : "present") : "absent";

                        return (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-[#111] backdrop-blur-xl border border-[#222] p-4 md:p-5 rounded-2xl flex items-center justify-between group hover:border-[#333] transition-colors"
                            >
                                <div>
                                    <p className="text-brand-blanco font-medium capitalize">
                                        {event.type || 'asamblea'} de {eventDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                    <p className="text-brand-gris text-sm mt-1">
                                        ID: <span className="font-mono text-xs">{event.id.slice(0, 8)}</span>
                                    </p>
                                </div>

                                {/* Manual Action Buttons (For Coordi & Asesor) */}
                                {(profile.role === "coordi" || profile.role === "asesor") && (
                                    <div className="flex gap-2">
                                        {isToggling ? (
                                            <div className="h-10 w-32 flex items-center justify-center border border-[#222] rounded-xl bg-[#111]">
                                                <Loader2 className="w-5 h-5 animate-spin text-brand-gris" />
                                            </div>
                                        ) : (
                                            <>
                                                {/* Absent Button */}
                                                <button
                                                    onClick={() => handleStatusChange(event.id, record, null)}
                                                    className={`p-2 rounded-xl border transition-all active:scale-95 ${currentStatus === "absent"
                                                        ? "bg-brand-rojo/20 text-brand-rojo border-brand-rojo/30"
                                                        : "bg-transparent text-[#555] border-[#222] hover:text-brand-rojo hover:border-brand-rojo/30 hover:bg-brand-rojo/5"
                                                        }`}
                                                    title="Marcar Falta"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>

                                                {/* Justify Button */}
                                                <button
                                                    onClick={() => handleStatusChange(event.id, record, "excused")}
                                                    className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 ${currentStatus === "excused"
                                                        ? "bg-stone-800 text-stone-300 border-stone-600"
                                                        : "bg-transparent text-[#555] border-[#222] hover:text-stone-300 hover:border-stone-600 hover:bg-stone-800/50"
                                                        }`}
                                                    title="Falta Justificada"
                                                >
                                                    <span className="text-xs font-bold px-1.5">J</span>
                                                </button>

                                                {/* Late Button */}
                                                <button
                                                    onClick={() => handleStatusChange(event.id, record, "late")}
                                                    className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 ${currentStatus === "late"
                                                        ? "bg-brand-naranja/20 text-brand-naranja border-brand-naranja/30"
                                                        : "bg-transparent text-[#555] border-[#222] hover:text-brand-naranja hover:border-brand-naranja/30 hover:bg-brand-naranja/5"
                                                        }`}
                                                    title="Marcar Retardo"
                                                >
                                                    <Clock className="w-5 h-5" />
                                                    <span className="text-xs font-bold mr-1">R</span>
                                                </button>

                                                {/* Present Button */}
                                                <button
                                                    onClick={() => handleStatusChange(event.id, record, "present")}
                                                    className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1 ${currentStatus === "present"
                                                        ? "bg-brand-cafe/20 text-brand-cafe border-brand-cafe/30"
                                                        : "bg-transparent text-[#555] border-[#222] hover:text-brand-cafe hover:border-brand-cafe/30 hover:bg-brand-cafe/5"
                                                        }`}
                                                    title="Marcar Asistencia"
                                                >
                                                    <Check className="w-5 h-5" />
                                                    <span className="text-xs font-bold mr-1">A</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
