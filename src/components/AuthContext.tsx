"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile } from "@/lib/firebase";
import { supabaseAuthService, supabaseDbService } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<any>;
  loginWithEmail: (email: string, pass: string) => Promise<any>;
  signupWithEmail: (email: string, pass: string) => Promise<any>;
  loginWithPhone: (phone: string) => Promise<any>;
  verifyPhone: (phone: string, code: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  claimUsername: (username: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROTECTED_ROUTES = ["/write", "/messages", "/notifications", "/profile/edit"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (uid: string) => {
    try {
      const uProfile = await supabaseDbService.getUserProfile(uid);
      setProfile(uProfile);
      return uProfile;
    } catch (e) {
      console.error("Error fetching user profile:", e);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user?.uid) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = supabaseAuthService.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        // Map user.id to user.uid to preserve backwards-compatibility with the existing codebase
        authUser.uid = authUser.id;
        
        // Map user_metadata keys for display purposes
        if (authUser.user_metadata) {
          authUser.displayName = authUser.user_metadata.full_name || authUser.email?.split("@")[0] || "Builder";
          authUser.photoURL = authUser.user_metadata.avatar_url || "";
        }
        
        setUser(authUser);
        const uProfile = await fetchProfile(authUser.id);
        // If logged in but has no username set, prompt them
        if (uProfile && !uProfile.username) {
          setShowLoginModal(true);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Protected route check
  useEffect(() => {
    if (!loading) {
      const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
      if (isProtected && !user) {
        setShowLoginModal(true);
        router.push("/");
      }
    }
  }, [pathname, user, loading, router]);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await supabaseAuthService.signInWithGoogle();
      // If returning user directly (e.g. mock mode)
      if (result && (result as any).user) {
        const u = (result as any).user;
        u.uid = u.id;
        setUser(u);
        await fetchProfile(u.id);
        setShowLoginModal(false);
        return u;
      }
      return result;
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const u = await supabaseAuthService.signInWithEmail(email, pass);
      u.uid = u.id;
      setUser(u);
      await fetchProfile(u.id);
      setShowLoginModal(false);
      return u;
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const u = await supabaseAuthService.signUpWithEmail(email, pass);
      u.uid = u.id;
      setUser(u);
      await fetchProfile(u.id);
      return u;
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const loginWithPhone = async (phone: string) => {
    setLoading(true);
    try {
      const result = await supabaseAuthService.signInWithPhoneOTP(phone);
      return result;
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhone = async (phone: string, code: string) => {
    setLoading(true);
    try {
      const u = await supabaseAuthService.verifyPhoneOTP(phone, code);
      u.uid = u.id;
      setUser(u);
      await fetchProfile(u.id);
      setShowLoginModal(false);
      return u;
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    await supabaseAuthService.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
    router.push("/");
  };

  const claimUsername = async (username: string): Promise<boolean> => {
    if (!user) return false;
    const isUnique = await supabaseDbService.isUsernameUnique(username, user.uid);
    if (!isUnique) return false;

    const updated = await supabaseDbService.saveUserProfile(user.uid, {
      username: username.toLowerCase().trim(),
      displayName: profile?.displayName || user.displayName || username,
      photoURL: profile?.photoURL || user.photoURL || ""
    });
    setProfile(updated);
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        loginWithPhone,
        verifyPhone,
        logout,
        refreshProfile,
        showLoginModal,
        setShowLoginModal,
        claimUsername
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

