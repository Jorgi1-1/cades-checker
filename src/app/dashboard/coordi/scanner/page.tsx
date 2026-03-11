"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, Loader2, XCircle } from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot, getDocs, addDoc, where, updateDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { Scanner } from '@yudiel/react-qr-scanner';

export default function ScannerPage() {
    const { user, profile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [currentEventId, setCurrentEventId] = useState<string | null>(null);
    const [lateMode, setLateMode] = useState<boolean>(false);

    const [feedback, setFeedback] = useState<"success" | "duplicate" | "error" | "expired" | null>(null);
    const [processing, setProcessing] = useState(false);
    const isProcessingRef = useRef(false);

    // Get current event directly
    useEffect(() => {
        const q = query(collection(db, "events"), orderBy("date", "desc"), limit(1));
        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const eventDoc = snap.docs[0];
                setCurrentEventId(eventDoc.id);
                setLateMode(!!eventDoc.data().lateMode);
            }
        });

        return () => unsub();
    }, []);


    const handleScan = async (result: unknown) => {
        if (!result || !currentEventId || processing || isProcessingRef.current || !user) return;

        // The library usually returns an array of results or an object with text
        const scannedText = typeof result === 'string' ? result : (((result as { rawValue?: string }[])?.[0]?.rawValue) || ((result as { text?: string })?.text) || null);

        if (!scannedText) return;

        isProcessingRef.current = true;
        setProcessing(true);


        try {
            // Decrypt QR Payload
            // Format is { u: string, e: string }
            let payload;
            try {
                payload = JSON.parse(scannedText);
            } catch {
                // Not a JSON QR (legacy string QR). For security, we reject it now.
                setFeedback("error");
                setTimeout(() => resetScanner(), 2000);
                return;
            }

            const scannedUserId = payload.u;
            const scannedEventId = payload.e;

            if (!scannedUserId || !scannedEventId) {
                setFeedback("error");
                setTimeout(() => resetScanner(), 2000);
                return;
            }

            // Anti-Fraud: Does the QR Event ID match the Door's Active Event ID?
            if (scannedEventId !== currentEventId) {
                setFeedback("expired");
                setTimeout(() => resetScanner(), 3000);
                return;
            }

            // 1. Verify user exists
            const userQuery = query(collection(db, "users"), where("uid", "==", scannedUserId));
            const userSnaps = await getDocs(userQuery);

            if (userSnaps.empty) {
                setFeedback("error");
                setTimeout(() => resetScanner(), 2000);
                return;
            }

            // 2. Check for duplicate scan
            const attQuery = query(
                collection(db, "attendance"),
                where("eventId", "==", currentEventId),
                where("userId", "==", scannedUserId)
            );
            const attSnaps = await getDocs(attQuery);

            if (!attSnaps.empty) {
                setFeedback("duplicate");
                setTimeout(() => resetScanner(), 2000);
                return;
            }

            // 3. Register Attendance
            await setDoc(doc(db, "attendance", `${currentEventId}_${scannedUserId}`), {
                userId: scannedUserId,
                eventId: currentEventId,
                // eslint-disable-next-line react-hooks/purity
                timestamp: Date.now(),
                scannedBy: user.uid,
                status: lateMode ? "late" : "present"
            });

            // Show success feedback
            // Play a tiny beep would be good here, but we'll stick to visual for now
            if (typeof window !== "undefined") {
                try {
                    // Attempting native beep if supported or just visual
                    navigator.vibrate?.([100, 50, 100]);
                } catch { }
            }

            setFeedback("success");
            setTimeout(() => resetScanner(), 1500);

        } catch (e) {
            console.error(e);
            setFeedback("error");
            setTimeout(() => resetScanner(), 2000);
        }
    };

    const resetScanner = () => {
        setFeedback(null);
        setProcessing(false);
        isProcessingRef.current = false;
    };

    const toggleLateMode = async () => {
        if (!currentEventId) return;
        try {
            await updateDoc(doc(db, "events", currentEventId), {
                lateMode: !lateMode
            });
        } catch (e) {
            console.error("Error toggling late mode", e);
        }
    };

    if (authLoading || !currentEventId || (!profile || (profile.role !== "coordi" && profile.role !== "asesor"))) {
        return (
            <div className="min-h-screen bg-brand-negro flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-rojo" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-brand-negro flex flex-col items-center justify-center p-4">

            {/* Back Button */}
            <button
                onClick={() => router.back()}
                className={`absolute top-8 left-8 p-3 backdrop-blur-md rounded-full text-brand-blanco z-50 transition-colors ${lateMode ? 'bg-brand-naranja/80 hover:bg-[#e08922]' : 'bg-[#111]/80 hover:bg-[#222]'}`}
            >
                <ArrowLeft className="w-6 h-6" />
            </button>

            {/* Late Mode Toggle Button */}
            <button
                onClick={toggleLateMode}
                className={`absolute top-8 right-8 px-4 py-3 backdrop-blur-md rounded-2xl text-brand-blanco font-bold text-sm tracking-wider uppercase z-50 transition-all shadow-lg flex items-center gap-2 ${lateMode
                    ? 'bg-brand-naranja hover:bg-[#e08922] text-brand-negro shadow-brand-naranja/20'
                    : 'bg-[#111] border-2 border-stone-800 hover:border-[#333] text-brand-gris'
                    }`}
            >
                {lateMode ? (
                    <>Modo Retardo Activo</>
                ) : (
                    <>Activar Retardos</>
                )}
            </button>

            <div className="text-center mb-8 relative z-20">
                <h1 className="text-2xl font-bold text-brand-blanco mb-2">Escaneando Pase</h1>
                <p className="text-brand-gris">Centra el código QR del diri en el recuadro</p>
            </div>

            <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-brand-negro shadow-2xl border-4 border-[#222]">

                {/* The active scanner */}
                <div className="absolute inset-0">
                    {!processing && !feedback && (
                        <Scanner
                            onScan={handleScan}
                            onError={(error: unknown) => console.log((error as Error)?.message)}
                            components={{
                                finder: false
                            }}
                        />
                    )}
                </div>

                {/* Viewfinder Target */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className={`w-64 h-64 border-2 rounded-xl flex flex-col justify-between transition-colors ${lateMode ? 'border-brand-naranja/50' : 'border-brand-rojo/50'}`}>
                        <div className="flex justify-between w-full h-8">
                            <div className={`w-8 border-t-4 border-l-4 rounded-tl-lg transition-colors ${lateMode ? 'border-brand-naranja' : 'border-brand-rojo'}`}></div>
                            <div className={`w-8 border-t-4 border-r-4 rounded-tr-lg transition-colors ${lateMode ? 'border-brand-naranja' : 'border-brand-rojo'}`}></div>
                        </div>
                        <div className="flex justify-between w-full h-8">
                            <div className={`w-8 border-b-4 border-l-4 rounded-bl-lg transition-colors ${lateMode ? 'border-brand-naranja' : 'border-brand-rojo'}`}></div>
                            <div className={`w-8 border-b-4 border-r-4 rounded-br-lg transition-colors ${lateMode ? 'border-brand-naranja' : 'border-brand-rojo'}`}></div>
                        </div>
                    </div>
                </div>

                {/* Overlays for Feedback */}
                <AnimatePresence>
                    {feedback === "success" && (
                        <motion.div
                            initial={{ backgroundColor: "transparent" }}
                            animate={{ backgroundColor: "rgba(146, 104, 60, 0.95)" }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-sm"
                        >
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 200 }}
                            >
                                <CheckCircle className="w-24 h-24 text-white drop-shadow-lg mb-4" />
                            </motion.div>
                            <h2 className="text-2xl font-bold text-white tracking-widest uppercase">REGISTRADO</h2>
                        </motion.div>
                    )}

                    {feedback === "duplicate" && (
                        <motion.div
                            initial={{ backgroundColor: "transparent" }}
                            animate={{ backgroundColor: "rgba(241, 158, 56, 0.95)" }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-sm"
                        >
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 200 }}
                            >
                                <CheckCircle className="w-24 h-24 text-white drop-shadow-lg mb-4 opacity-50" />
                            </motion.div>
                            <h2 className="text-2xl font-bold text-white tracking-widest uppercase text-center px-4">YA ESTABA <br />REGISTRADO</h2>
                        </motion.div>
                    )}

                    {feedback === "expired" && (
                        <motion.div
                            initial={{ backgroundColor: "transparent" }}
                            animate={{ backgroundColor: "rgba(219, 73, 62, 0.95)" }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-sm"
                        >
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 200 }}
                            >
                                <XCircle className="w-24 h-24 text-white drop-shadow-lg mb-4" />
                            </motion.div>
                            <h2 className="text-2xl font-bold text-white tracking-widest text-center">QR CADUCADO</h2>
                            <p className="text-white/80 font-medium mt-2 max-w-xs text-center">Este pase pertenece a una asamblea/junta anterior o es inválido.</p>
                        </motion.div>
                    )}

                    {feedback === "error" && (
                        <motion.div
                            initial={{ backgroundColor: "transparent" }}
                            animate={{ backgroundColor: "rgba(219, 73, 62, 0.95)" }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-sm"
                        >
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 200 }}
                            >
                                <XCircle className="w-24 h-24 text-white drop-shadow-lg mb-4" />
                            </motion.div>
                            <h2 className="text-2xl font-bold text-white tracking-widest">QR INVÁLIDO</h2>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}
