"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, Loader2, XCircle } from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot, getDocs, addDoc, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { Scanner } from '@yudiel/react-qr-scanner';

export default function ScannerPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [currentEventId, setCurrentEventId] = useState<string | null>(null);
    const [scannedUserId, setScannedUserId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<"success" | "duplicate" | "error" | null>(null);
    const [processing, setProcessing] = useState(false);

    // Get current event directly
    useEffect(() => {
        const q = query(collection(db, "events"), orderBy("date", "desc"), limit(1));
        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                setCurrentEventId(snap.docs[0].id);
            }
        });

        return () => unsub();
    }, []);


    const handleScan = async (result: unknown) => {
        if (!result || !currentEventId || processing || !user) return;

        // The library usually returns an array of results or an object with text
        const scannedText = typeof result === 'string' ? result : (((result as { rawValue?: string }[])?.[0]?.rawValue) || ((result as { text?: string })?.text) || null);

        if (!scannedText) return;

        setProcessing(true);
        setScannedUserId(scannedText);

        try {
            // 1. Verify user exists
            const userQuery = query(collection(db, "users"), where("uid", "==", scannedText));
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
                where("userId", "==", scannedText)
            );
            const attSnaps = await getDocs(attQuery);

            if (!attSnaps.empty) {
                setFeedback("duplicate");
                setTimeout(() => resetScanner(), 2000);
                return;
            }

            // 3. Register Attendance
            await addDoc(collection(db, "attendance"), {
                userId: scannedText,
                eventId: currentEventId,
                // eslint-disable-next-line react-hooks/purity
                timestamp: Date.now(),
                scannedBy: user.uid
            });

            // Show success feedback
            // Play a tiny beep would be good here, but we'll stick to visual for now
            if (typeof window !== "undefined") {
                try {
                    // Attempting native beep if supported or just visual
                    navigator.vibrate?.([100, 50, 100]);
                } catch (e) { }
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
        setScannedUserId(null);
        setProcessing(false);
    };

    if (authLoading || !currentEventId) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-stone-950 flex flex-col items-center justify-center p-4">

            {/* Back Button */}
            <button
                onClick={() => router.back()}
                className="absolute top-8 left-8 p-3 bg-stone-900/80 backdrop-blur-md rounded-full text-white z-50 hover:bg-stone-800 transition-colors"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="text-center mb-8 relative z-20">
                <h1 className="text-2xl font-bold text-white mb-2">Escaneando Pase</h1>
                <p className="text-stone-400">Centra el código QR del alumno en el recuadro</p>
            </div>

            <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-stone-900 shadow-2xl border-4 border-stone-800">

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
                    <div className="w-64 h-64 border-2 border-emerald-500/50 rounded-xl flex flex-col justify-between">
                        <div className="flex justify-between w-full h-8">
                            <div className="w-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                            <div className="w-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                        </div>
                        <div className="flex justify-between w-full h-8">
                            <div className="w-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                            <div className="w-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                        </div>
                    </div>
                </div>

                {/* Overlays for Feedback */}
                <AnimatePresence>
                    {feedback === "success" && (
                        <motion.div
                            initial={{ backgroundColor: "transparent" }}
                            animate={{ backgroundColor: "rgba(16, 185, 129, 0.9)" }}
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
                            animate={{ backgroundColor: "rgba(245, 158, 11, 0.95)" }}
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

                    {feedback === "error" && (
                        <motion.div
                            initial={{ backgroundColor: "transparent" }}
                            animate={{ backgroundColor: "rgba(239, 68, 68, 0.95)" }}
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
