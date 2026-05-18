"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { authService, dbService, UserProfile } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<any>;
  loginWithEmail: (email: string, pass: string) => Promise<any>;
  signupWithEmail: (email: string, pass: string) => Promise<any>;
  loginWithPhone: (phone: string) => Promise<any>;
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
      const uProfile = await dbService.getUserProfile(uid);
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
    const unsubscribe = authService.onAuthStateChanged(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        const uProfile = await fetchProfile(authUser.uid);
        // If logged in but has no username set, prompt them
        if (uProfile && !uProfile.username) {
          setShowLoginModal(true);
        }
      } else {
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
      const u = await authService.signInWithGoogle();
      await fetchProfile(u.uid);
      setShowLoginModal(false);
      return u;
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
      const u = await authService.signInWithEmail(email, pass);
      await fetchProfile(u.uid);
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
      const u = await authService.signUpWithEmail(email, pass);
      await fetchProfile(u.uid);
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
      const u = await authService.signInWithPhoneOTP(phone);
      await fetchProfile(u.uid);
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
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
    router.push("/");
  };

  const claimUsername = async (username: string): Promise<boolean> => {
    if (!user) return false;
    const isUnique = await dbService.isUsernameUnique(username, user.uid);
    if (!isUnique) return false;

    const updated = await dbService.saveUserProfile(user.uid, {
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
