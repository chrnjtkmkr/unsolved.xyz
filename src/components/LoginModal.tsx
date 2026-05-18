"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { dbService } from "@/lib/firebase";
import { Mail, Phone, LogIn, ArrowRight, ShieldCheck, X, Check, AlertCircle } from "lucide-react";

export default function LoginModal() {
  const { 
    showLoginModal, 
    setShowLoginModal, 
    user, 
    profile, 
    loginWithGoogle, 
    loginWithEmail, 
    signupWithEmail, 
    loginWithPhone,
    claimUsername 
  } = useAuth();

  const [mode, setMode] = useState<"options" | "email_login" | "email_signup" | "phone_auth" | "username_claim">("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Username claiming states
  const [chosenUsername, setChosenUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  // Determine modal step on auth status change
  useEffect(() => {
    if (user) {
      if (profile && !profile.username) {
        setMode("username_claim");
      } else if (profile && profile.username) {
        setShowLoginModal(false);
      }
    } else {
      setMode("options");
    }
  }, [user, profile]);

  // Real-time username validation
  useEffect(() => {
    if (mode !== "username_claim" || !chosenUsername) {
      setUsernameStatus("idle");
      return;
    }

    const clean = chosenUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean !== chosenUsername) {
      setChosenUsername(clean);
    }

    if (clean.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");
    const delayDebounce = setTimeout(async () => {
      try {
        const isUnique = await dbService.isUsernameUnique(clean, user?.uid);
        setUsernameStatus(isUnique ? "available" : "taken");
      } catch (err) {
        setUsernameStatus("idle");
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [chosenUsername, mode, user]);

  if (!showLoginModal) return null;

  const handleClose = () => {
    // Only allow closing if they have a username set, or if they aren't logged in at all
    if (user && profile && !profile.username) {
      setError("Please choose a username before proceeding.");
      return;
    }
    setShowLoginModal(false);
    setError("");
    // Reset states
    setEmail("");
    setPassword("");
    setPhone("");
    setOtp("");
    setOtpSent(false);
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "Failed to log in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "email_login") {
        await loginWithEmail(email, password);
      } else {
        await signupWithEmail(email, password);
        setMode("username_claim");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSend = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
      setError("");
    }, 1000);
  };

  const handlePhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp !== "123456" && otp.length !== 6) {
      setError("Incorrect code. Try '123456' for the demo.");
      return;
    }
    setLoading(true);
    try {
      await loginWithPhone(phone);
    } catch (err: any) {
      setError(err.message || "Phone verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (usernameStatus !== "available") {
      setError("Please choose an available username.");
      return;
    }
    setLoading(true);
    try {
      const success = await claimUsername(chosenUsername);
      if (success) {
        setShowLoginModal(false);
      } else {
        setError("Could not claim username. Please try another one.");
      }
    } catch (err: any) {
      setError(err.message || "Username saving failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border-tertiary bg-bg-primary shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        {(!user || (profile && profile.username)) && (
          <button 
            onClick={handleClose} 
            className="absolute top-4 right-4 p-1 rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-bg-secondary transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        {/* Modal Content */}
        <div className="flex flex-col items-center text-center">
          {/* Logo & Tagline */}
          <div className="text-2xl font-bold tracking-tight mb-1 text-txt-primary">
            un<span className="text-brand-orange">solved</span>
          </div>
          <div className="text-xs text-txt-secondary font-medium tracking-wide mb-8">
            real problems. real people.
          </div>

          {error && (
            <div className="w-full flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-md mb-4 text-left">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: LOGIN OPTIONS */}
          {mode === "options" && (
            <div className="w-full space-y-3">
              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border-tertiary hover:border-txt-secondary bg-bg-primary hover:bg-bg-secondary text-txt-primary text-sm font-semibold rounded-md transition duration-150 disabled:opacity-55 shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.9-2.7 3.42-4.51 6.76-4.51z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.99 3.7-8.62z" />
                  <path fill="#FBBC05" d="M5.24 14.81c-.23-.69-.37-1.43-.37-2.2s.13-1.51.37-2.2L1.39 7.56C.5 9.36 0 11.37 0 13.5s.5 4.14 1.39 5.94l3.85-2.99z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.51 1.18-4.23 1.18-3.34 0-5.86-1.81-6.76-4.51L1.39 16.8C3.37 20.33 7.35 23 12 23z" />
                </svg>
                Continue with Google
              </button>

              <button 
                onClick={() => setMode("email_login")}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border-tertiary hover:border-txt-secondary bg-bg-primary hover:bg-bg-secondary text-txt-primary text-sm font-medium rounded-md transition duration-150"
              >
                <Mail size={18} />
                Continue with Email
              </button>

              <button 
                onClick={() => setMode("phone_auth")}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border-tertiary hover:border-txt-secondary bg-bg-primary hover:bg-bg-secondary text-txt-primary text-sm font-medium rounded-md transition duration-150"
              >
                <Phone size={18} />
                Continue with Phone
              </button>
            </div>
          )}

          {/* Step 2: EMAIL LOGIN/SIGNUP */}
          {(mode === "email_login" || mode === "email_signup") && (
            <form onSubmit={handleEmailAuth} className="w-full text-left space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                  Email Address
                </label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-sm outline-none focus:border-txt-secondary focus:ring-0 transition"
                  placeholder="e.g. you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                  Password
                </label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-sm outline-none focus:border-txt-secondary focus:ring-0 transition"
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-orange hover:bg-brand-orangeHover text-white text-sm font-semibold rounded-md shadow-md transition disabled:opacity-55"
              >
                {loading ? "Authenticating..." : mode === "email_login" ? "Login" : "Sign Up"}
                <LogIn size={16} />
              </button>

              <div className="text-center mt-3">
                {mode === "email_login" ? (
                  <p className="text-xs text-txt-secondary">
                    Don&apos;t have an account?{" "}
                    <button 
                      type="button" 
                      onClick={() => setMode("email_signup")}
                      className="text-brand-orange hover:underline font-semibold"
                    >
                      Sign Up
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-txt-secondary">
                    Already have an account?{" "}
                    <button 
                      type="button" 
                      onClick={() => setMode("email_login")}
                      className="text-brand-orange hover:underline font-semibold"
                    >
                      Login
                    </button>
                  </p>
                )}
                <button 
                  type="button"
                  onClick={() => setMode("options")}
                  className="text-xs text-txt-tertiary hover:text-txt-secondary hover:underline block mx-auto mt-4"
                >
                  ← Other login options
                </button>
              </div>
            </form>
          )}

          {/* Step 3: PHONE NUMBER AUTH */}
          {mode === "phone_auth" && (
            <div className="w-full text-left">
              {!otpSent ? (
                <form onSubmit={handlePhoneSend} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                      Phone Number
                    </label>
                    <input 
                      type="tel" 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-sm outline-none focus:border-txt-secondary focus:ring-0 transition"
                      placeholder="e.g. +919876543210"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-orange hover:bg-brand-orangeHover text-white text-sm font-semibold rounded-md shadow-md transition disabled:opacity-55"
                  >
                    {loading ? "Sending SMS..." : "Send Verification Code"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePhoneVerify} className="space-y-4">
                  <div className="bg-bg-secondary p-3 rounded-md border border-border-tertiary text-xs text-txt-secondary mb-3">
                    Demo Mode: Use OTP code <span className="font-semibold text-brand-orange">123456</span> to sign in.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                      6-Digit OTP Code
                    </label>
                    <input 
                      type="text" 
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary text-center tracking-widest font-semibold rounded-md text-sm outline-none focus:border-txt-secondary focus:ring-0 transition"
                      placeholder="123456"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-orange hover:bg-brand-orangeHover text-white text-sm font-semibold rounded-md shadow-md transition disabled:opacity-55"
                  >
                    {loading ? "Verifying..." : "Verify Code & Sign In"}
                    <ShieldCheck size={16} />
                  </button>
                </form>
              )}
              <button 
                type="button"
                onClick={() => { setMode("options"); setOtpSent(false); }}
                className="text-xs text-txt-tertiary hover:text-txt-secondary hover:underline block mx-auto mt-6"
              >
                ← Other login options
              </button>
            </div>
          )}

          {/* Step 4: CLAIM USERNAME (Post-Login first time registration) */}
          {mode === "username_claim" && (
            <form onSubmit={handleClaimUsername} className="w-full text-left space-y-4">
              <div className="bg-brand-orange/5 border border-brand-orange/15 rounded-md p-3 text-xs text-txt-secondary mb-2 text-center">
                Welcome to <span className="font-semibold text-brand-orange">unsolved</span>! Let&apos;s pick a unique username for your profile.
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                  Choose Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-txt-tertiary text-sm select-none">@</span>
                  <input 
                    type="text" 
                    required
                    minLength={3}
                    maxLength={15}
                    value={chosenUsername}
                    onChange={(e) => setChosenUsername(e.target.value)}
                    className="w-full pl-7 pr-10 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-sm outline-none focus:border-txt-secondary focus:ring-0 transition font-medium"
                    placeholder="username"
                  />
                  <div className="absolute right-3 top-2.5 flex items-center">
                    {usernameStatus === "checking" && (
                      <div className="w-4 h-4 border-2 border-txt-tertiary border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {usernameStatus === "available" && (
                      <Check size={16} className="text-green-500 font-bold" />
                    )}
                    {usernameStatus === "taken" && (
                      <AlertCircle size={16} className="text-red-500" />
                    )}
                  </div>
                </div>
                
                {usernameStatus === "available" && (
                  <p className="text-[11px] text-green-500 mt-1">Username is available!</p>
                )}
                {usernameStatus === "taken" && (
                  <p className="text-[11px] text-red-500 mt-1">Username is already taken.</p>
                )}
                {chosenUsername && chosenUsername.length < 3 && (
                  <p className="text-[11px] text-txt-tertiary mt-1">Must be at least 3 characters.</p>
                )}
              </div>

              <button 
                type="submit"
                disabled={loading || usernameStatus !== "available"}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-orange hover:bg-brand-orangeHover text-white text-sm font-semibold rounded-md shadow-md transition disabled:opacity-55"
              >
                {loading ? "Registering..." : "Complete Registration"}
                <Check size={16} />
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
