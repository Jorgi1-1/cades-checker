"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { QrCode, LogIn, Loader2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Determine role from firestore
      const docRef = doc(db, "users", userCredential.user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const role = docSnap.data().role;
        if (role === "coordinador") {
          router.push("/dashboard/coordinador");
        } else {
          router.push("/dashboard/joven");
        }
      } else {
        // Fallback
        router.push("/dashboard/joven");
      }
    } catch (err: any) {
      console.error(err);
      setError("Credenciales incorrectas o error de red.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-md w-full"
      >
        <div className="bg-stone-900/60 backdrop-blur-xl border border-stone-800 rounded-3xl p-8 shadow-2xl relative z-10 text-white">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-4 rounded-2xl shadow-lg shadow-emerald-500/30">
              <QrCode className="w-10 h-10 text-stone-950" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">Cades Checker</h1>
          <p className="text-stone-400 text-center mb-8">Sistema de asistencia invertido</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-stone-500"
                placeholder="usuario@cades.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-stone-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center"
              >
                {error}
              </motion.div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-semibold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
