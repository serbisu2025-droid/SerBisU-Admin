"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
    ShieldCheck,
    Mail,
    Lock,
    ArrowRight,
    Eye,
    EyeOff
} from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import Image from "next/image";


export default function LoginPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { executeRecaptcha } = useGoogleReCaptcha();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Auto-redirect if already logged in
    useEffect(() => {
        if (!authLoading && user) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Check if reCAPTCHA is available
            if (!executeRecaptcha) {
                throw new Error("reCAPTCHA not loaded yet. Please try again.");
            }

            // Execute reCAPTCHA verification
            const recaptchaToken = await executeRecaptcha("login");
            console.log("reCAPTCHA token obtained:", recaptchaToken.substring(0, 20) + "...");

            // Verify reCAPTCHA token on backend (Firebase Cloud Function)
            const verifyResponse = await fetch("https://api-ohnpss3o4q-uc.a.run.app/verify-recaptcha", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ token: recaptchaToken }),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyData.success) {
                console.error("❌ reCAPTCHA Error Details:", verifyData);
                throw new Error(verifyData.error || "reCAPTCHA verification failed");
            }

            console.log("reCAPTCHA verified! Score:", verifyData.score);

            // Proceed with Firebase authentication
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/dashboard");
        } catch (err: any) {
            console.error(err);
            if (err.message?.includes("reCAPTCHA")) {
                setError("Security verification failed. Please try again.");
            } else {
                setError("Invalid email or password. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-primary relative overflow-hidden px-4">
            {/* Background Ornaments */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-light rounded-full blur-3xl opacity-20 -mr-48 -mt-48"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent rounded-full blur-3xl opacity-10 -ml-48 -mb-48"></div>

            {/* Background Image Workers */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 opacity-25 grayscale-0 contrast-110">
                    <Image
                        src="/assets/Workers1180x746-removebg-preview.png"
                        alt="Workers"
                        fill
                        className="object-cover object-top"
                        priority
                    />

                </div>
                {/* Subtle gradient overlay to maintain text readability while allowing the image to be "full" */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/30 to-primary/60"></div>
            </div>




            <div className="w-full max-w-md relative z-10">
                <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 border border-white/20">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <ShieldCheck className="w-10 h-10 text-primary" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-primary">
                            SerBisU<span className="text-accent underline decoration-accent/30 underline-offset-4">Admin</span>
                        </h1>
                        <p className="text-text-light mt-2 font-medium">Please sign in to your dashboard</p>
                    </div>

                    {/* Official Disclaimer for Security/Transparency */}
                    <div className="mb-8 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider mb-1">Official Security Notice</h4>
                                <p className="text-[11px] leading-relaxed text-text-light font-medium">
                                    <span className="font-bold text-primary">SerBisU – Admin Portal:</span> This is an official system developed to support community service matching and local employment facilitation in coordination with PESO.
                                </p>
                                <p className="text-[11px] leading-relaxed text-text-light font-medium mt-1">
                                    The platform is intended for authorized administrators only. This system does not collect or process user credentials for any third-party services and is not associated with or imitating any external platforms.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-text mb-2 ml-1">Email Address</label>
                            <div className="relative group">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-text-light group-focus-within:text-primary transition-colors">
                                    <Mail className="w-5 h-5" />
                                </span>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    placeholder="admin@serbisu.com"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2 ml-1">
                                <label className="text-sm font-semibold text-text">Password</label>
                                <button type="button" className="text-xs font-semibold text-primary hover:text-primary-light transition-colors">
                                    Forgot Password?
                                </button>
                            </div>
                            <div className="relative group">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-text-light group-focus-within:text-primary transition-colors">
                                    <Lock className="w-5 h-5" />
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-11 pr-12 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-light hover:text-text transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-xs font-medium animate-shake">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary-light text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* reCAPTCHA Notice */}
                    <div className="mt-6 text-center">
                        <p className="text-xs text-text-light">
                            This site is protected by reCAPTCHA and the Google{" "}
                            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                Privacy Policy
                            </a>{" "}
                            and{" "}
                            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                Terms of Service
                            </a>{" "}
                            apply.
                        </p>
                    </div>

                    <div className="mt-10 pt-8 border-t border-border flex items-center justify-center gap-6">
                        <span className="text-xs text-text-light">© 2024 SerBisU Team</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
                        <a href="#" className="text-xs text-text-light hover:text-primary transition-colors">Help Center</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
