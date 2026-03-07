"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { QrCode, Loader2, LogIn } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/lib/context/AuthContext";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user: authUser, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && authUser && profile) {
      if (profile.role === "coordi" || profile.role === "asesor") {
        router.push("/dashboard/coordi");
      } else {
        router.push("/dashboard/diri");
      }
    }
  }, [authUser, profile, authLoading, router]);



  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Wait for AuthContext to detect auth change and useEffect to redirect
    } catch (err: unknown) {
      console.error(err);
      setError("Credenciales incorrectas o error de red.");
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!nombre.trim()) {
      setError("Por favor, ingresa tu nombre.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user's display name in Firebase Auth
      await updateProfile(user, {
        displayName: nombre
      });

      // Fire and forget: if AuthContext hits first, it will do it anyway.
      // But we specify the name here to ensure correct details.
      const docRef = doc(db, "users", user.uid);
      setDoc(docRef, {
        uid: user.uid,
        email: user.email,
        displayName: nombre,
        role: "diri",
        createdAt: Date.now()
      }).catch(console.error);

      // Wait for useEffect redirect
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error && 'code' in err && (err as Error & { code?: string }).code === 'auth/email-already-in-use') {
        setError("El correo electrónico ya está en uso.");
      } else {
        setError("Error al registrarse. Inténtalo de nuevo.");
      }
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // IMPORTANTE PARA MÓVILES: Ejecutar el PopUp ANTES de cualquier setState o await
    // para evitar que Safari/Chrome móvil bloqueen la ventana emergente al no detectar la acción directa.
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);

      setLoading(true);
      setError("");

      const user = userCredential.user;

      // Generar el perfil si no existe
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || "Usuario",
          role: "diri",
          createdAt: Date.now()
        });
      }
      // Wait for useEffect redirect
    } catch (err: unknown) {
      console.error("Error Google Popup:", err);
      const errorObj = err as Error & { code?: string };
      const code = errorObj.code || "";

      if (code === "auth/unauthorized-domain") {
        setError("Firebase: Dominio no autorizado. Agrega tu dominio o IP en Firebase.");
      } else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError("Se canceló el inicio de sesión de Google.");
      } else if (code === "auth/popup-blocked") {
        setError("El navegador bloqueó la ventana de Google.");
      } else {
        setError(`Error Google: ${code || errorObj.message || "Desconocido"}`);
      }
      setLoading(false);
    }
  };

  if (authLoading || (authUser && profile)) {
    return (
      <div className="min-h-screen bg-brand-negro flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-rojo" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-negro flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-rojo/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-brand-naranja/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-md w-full"
      >
        <div className="bg-[#111]/80 backdrop-blur-xl border border-stone-800 rounded-3xl p-8 shadow-2xl relative z-10 text-white">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-tr from-brand-rojo to-brand-naranja p-4 rounded-2xl shadow-lg shadow-brand-rojo/30">
              <QrCode className="w-10 h-10 text-brand-blanco" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">Cades Checker</h1>
          <p className="text-brand-gris text-center mb-8">Pase de lista Cadés</p>

          <div className="space-y-4">
            <div className="flex bg-[#222]/50 p-1 rounded-xl mb-6">
              <button
                onClick={() => { setIsLogin(true); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-brand-rojo text-brand-blanco shadow-md' : 'text-brand-gris hover:text-stone-200'}`}
              >
                Inicia Sesión
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-brand-rojo text-brand-blanco shadow-md' : 'text-brand-gris hover:text-stone-200'}`}
              >
                Regístrate
              </button>
            </div>

            <form onSubmit={isLogin ? handleEmailLogin : handleEmailRegister} className="space-y-4">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-sm font-medium text-stone-300 mb-1 mt-2">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    className="w-full bg-[#111] border border-stone-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-rojo focus:border-transparent transition-all placeholder:text-stone-500"
                    placeholder="Tu nombre"
                  />
                </motion.div>
              )}
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#111] border border-stone-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-rojo focus:border-transparent transition-all placeholder:text-stone-500"
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
                  className="w-full bg-[#111] border border-stone-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-rojo focus:border-transparent transition-all placeholder:text-stone-500"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center mb-4"
                >
                  {error}
                </motion.div>
              )}

              <button
                disabled={loading}
                type="submit"
                className="w-full bg-brand-rojo hover:bg-[#b03a31] text-brand-blanco font-semibold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-6"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
                  </>
                )}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-brand-negro text-brand-gris">O</span>
              </div>
            </div>

            <button
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full bg-white hover:bg-stone-100 text-stone-900 font-semibold rounded-xl px-4 py-3 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-6 shadow-md"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
