import { createClient } from "@supabase/supabase-js";

// Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "mock-supabase-url";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-supabase-anon-key";

// Determine if we should run in mock mode
const isMockSupabase = 
  !process.env.NEXT_PUBLIC_SUPABASE_URL || 
  supabaseUrl.includes("mock-supabase-url") ||
  supabaseAnonKey.includes("mock-supabase-anon-key");

// Initialize real Supabase client (only if not in mock mode)
export const supabase = !isMockSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ----------------------------------------------------
// HIGH-FIDELITY SUPABASE AUTHENTICATION SIMULATOR
// ----------------------------------------------------
class SupabaseAuthSimulator {
  private listeners: ((event: string, session: any) => void)[] = [];
  private currentUser: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("unsolved_supabase_session");
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }
    }
  }

  private triggerChange(event: "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED") {
    const session = this.currentUser ? { user: this.currentUser } : null;
    this.listeners.forEach(cb => cb(event, session));
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    // Execute callback initially with current state
    const session = this.currentUser ? { user: this.currentUser } : null;
    setTimeout(() => callback("INITIAL_SESSION", session), 50);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(l => l !== callback);
          }
        }
      }
    };
  }

  // Email Sign Up
  async signUp(email: string, pass: string) {
    if (pass.length < 6) {
      throw new Error("Password should be at least 6 characters.");
    }
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const simulatedUser = {
      id: "sb-" + Math.random().toString(36).substring(2, 11),
      email: email,
      phone: null,
      user_metadata: {
        full_name: email.split("@")[0],
        avatar_url: ""
      },
      created_at: new Date().toISOString()
    };

    // Save profile to database simulator
    const dbUsers = this.getSimulatedProfiles();
    dbUsers[simulatedUser.id] = {
      uid: simulatedUser.id,
      username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
      displayName: simulatedUser.user_metadata.full_name,
      photoURL: "",
      bio: "Joined via Supabase Email Auth! Tap Edit to complete your builder bio.",
      createdAt: simulatedUser.created_at,
      gangIds: ["learning-dsa"],
      city: "Bangalore"
    };
    this.setSimulatedProfiles(dbUsers);

    this.currentUser = simulatedUser;
    localStorage.setItem("unsolved_supabase_session", JSON.stringify(simulatedUser));
    this.triggerChange("SIGNED_IN");
    return { data: { user: simulatedUser, session: { user: simulatedUser } }, error: null };
  }

  // Email Login
  async signInWithPassword(email: string, pass: string) {
    await new Promise(resolve => setTimeout(resolve, 800));

    // Verify password check (demo accepts any valid password >= 6 chars)
    if (pass.length < 6) {
      throw new Error("Invalid password credentials.");
    }

    const simulatedUser = {
      id: "sb-demo-user-id",
      email: email,
      phone: null,
      user_metadata: {
        full_name: email.split("@")[0],
        avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80"
      },
      created_at: new Date().toISOString()
    };

    const dbUsers = this.getSimulatedProfiles();
    if (!dbUsers[simulatedUser.id]) {
      dbUsers[simulatedUser.id] = {
        uid: simulatedUser.id,
        username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
        displayName: simulatedUser.user_metadata.full_name,
        photoURL: simulatedUser.user_metadata.avatar_url,
        bio: "Joined via Supabase Email Auth! Tap Edit to complete your builder bio.",
        createdAt: simulatedUser.created_at,
        gangIds: ["rural-startups", "learning-dsa"],
        city: "Bhopal"
      };
      this.setSimulatedProfiles(dbUsers);
    }

    this.currentUser = simulatedUser;
    localStorage.setItem("unsolved_supabase_session", JSON.stringify(simulatedUser));
    this.triggerChange("SIGNED_IN");
    return { data: { user: simulatedUser, session: { user: simulatedUser } }, error: null };
  }

  // Google OAuth Login
  async signInWithGoogle() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const simulatedUser = {
      id: "sb-google-user",
      email: "google@unsolved.xyz",
      phone: null,
      user_metadata: {
        full_name: "Google Builder",
        avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80"
      },
      created_at: new Date().toISOString()
    };

    const dbUsers = this.getSimulatedProfiles();
    if (!dbUsers[simulatedUser.id]) {
      dbUsers[simulatedUser.id] = {
        uid: simulatedUser.id,
        username: "googlebuilder",
        displayName: simulatedUser.user_metadata.full_name,
        photoURL: simulatedUser.user_metadata.avatar_url,
        bio: "Joined via Supabase Google SSO!",
        createdAt: simulatedUser.created_at,
        gangIds: ["rural-startups", "indie-builders"],
        city: "Delhi"
      };
      this.setSimulatedProfiles(dbUsers);
    }

    this.currentUser = simulatedUser;
    localStorage.setItem("unsolved_supabase_session", JSON.stringify(simulatedUser));
    this.triggerChange("SIGNED_IN");
    return { data: { user: simulatedUser, session: { user: simulatedUser } }, error: null };
  }

  // Phone Auth OTP trigger
  async signInWithPhone(phone: string) {
    await new Promise(resolve => setTimeout(resolve, 800));
    // In mock mode, we trigger an OTP code requirement
    return { data: { message: "OTP code sent to phone" }, error: null };
  }

  // Phone Auth Verify OTP
  async verifyPhoneOTP(phone: string, code: string) {
    await new Promise(resolve => setTimeout(resolve, 800));

    if (code !== "123456") {
      throw new Error("Invalid OTP code. Use '123456' for testing.");
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const simulatedUser = {
      id: "sb-phone-" + cleanPhone.slice(-4),
      email: null,
      phone: phone,
      user_metadata: {
        full_name: "Supabase Phone User " + cleanPhone.slice(-4),
        avatar_url: ""
      },
      created_at: new Date().toISOString()
    };

    const dbUsers = this.getSimulatedProfiles();
    if (!dbUsers[simulatedUser.id]) {
      dbUsers[simulatedUser.id] = {
        uid: simulatedUser.id,
        username: "supabase_phone_" + cleanPhone.slice(-4),
        displayName: simulatedUser.user_metadata.full_name,
        photoURL: "",
        bio: "Joined via Supabase Phone SMS Auth!",
        createdAt: simulatedUser.created_at,
        gangIds: ["indie-builders"],
        city: "Mumbai"
      };
      this.setSimulatedProfiles(dbUsers);
    }

    this.currentUser = simulatedUser;
    localStorage.setItem("unsolved_supabase_session", JSON.stringify(simulatedUser));
    this.triggerChange("SIGNED_IN");
    return { data: { user: simulatedUser, session: { user: simulatedUser } }, error: null };
  }

  // Sign Out
  async signOut() {
    this.currentUser = null;
    localStorage.removeItem("unsolved_supabase_session");
    this.triggerChange("SIGNED_OUT");
    return { error: null };
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // Utility database operations inside the simulator
  private getSimulatedProfiles() {
    if (typeof window === "undefined") return {};
    const item = localStorage.getItem("unsolved_users");
    return item ? JSON.parse(item) : {};
  }

  private setSimulatedProfiles(users: any) {
    if (typeof window === "undefined") return;
    localStorage.setItem("unsolved_users", JSON.stringify(users));
  }
}

export const supabaseAuthSimulator = new SupabaseAuthSimulator();

// ----------------------------------------------------
// UNIFIED AUTH SERVICE WRAPPER
// Intercepts and directs to real Supabase or simulated
// ----------------------------------------------------
export const supabaseAuthService = {
  getCurrentUser: () => {
    if (!isMockSupabase && supabase) {
      // Supabase has auth.getUser() which is async, this returns active session
      const { data } = supabase.auth.onAuthStateChange(() => {});
      data.subscription.unsubscribe();
      return supabase.auth.getUser();
    }
    return supabaseAuthSimulator.getCurrentUser();
  },

  onAuthStateChanged: (callback: (user: any) => void) => {
    if (!isMockSupabase && supabase) {
      // Fetch initial session asynchronously to handle timing constraints
      supabase.auth.getSession().then(({ data: { session } }) => {
        callback(session?.user || null);
      });
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user || null);
      });
      return () => subscription.unsubscribe();
    }
    
    // Fallback to simulator
    const { data: { subscription } } = supabaseAuthSimulator.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });
    return () => subscription.unsubscribe();
  },

  signInWithGoogle: async () => {
    if (!isMockSupabase && supabase) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined
        }
      });
      if (error) throw error;
      return data;
    }
    return supabaseAuthSimulator.signInWithGoogle();
  },

  signInWithEmail: async (email: string, pass: string) => {
    if (!isMockSupabase && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
      if (error) throw error;
      return data.user;
    }
    const res = await supabaseAuthSimulator.signInWithPassword(email, pass);
    return res.data.user;
  },

  signUpWithEmail: async (email: string, pass: string) => {
    if (!isMockSupabase && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass
      });
      if (error) throw error;
      return data.user;
    }
    const res = await supabaseAuthSimulator.signUp(email, pass);
    return res.data.user;
  },

  signInWithPhoneOTP: async (phone: string) => {
    if (!isMockSupabase && supabase) {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: phone
      });
      if (error) throw error;
      return data;
    }
    return supabaseAuthSimulator.signInWithPhone(phone);
  },

  verifyPhoneOTP: async (phone: string, code: string) => {
    if (!isMockSupabase && supabase) {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: code,
        type: "sms"
      });
      if (error) throw error;
      return data.user;
    }
    return supabaseAuthSimulator.verifyPhoneOTP(phone, code);
  },

  signOut: async () => {
    if (!isMockSupabase && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return;
    }
    return supabaseAuthSimulator.signOut();
  }
};

// ----------------------------------------------------
// RESILIENT DATABASE SERVICE WITH AUTOMATIC LOCAL FALLBACK
// ----------------------------------------------------
export const supabaseDbService = {
  // Check unique username
  isUsernameUnique: async (username: string, excludeUid?: string): Promise<boolean> => {
    const cleaned = username.trim().toLowerCase();
    
    if (!isMockSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("uid")
          .eq("username", cleaned);
        
        if (error) throw error;
        if (!data || data.length === 0) return true;
        if (excludeUid) {
          return data.every(row => row.uid === excludeUid);
        }
        return false;
      } catch (err) {
        console.warn("Supabase profiles lookup failed, falling back to local storage profile tracking:", err);
      }
    }
    
    // Local Storage Simulator fallback
    if (typeof window === "undefined") return true;
    const storedUsers = JSON.parse(localStorage.getItem("unsolved_users") || "{}");
    return !Object.values(storedUsers).some(
      (u: any) => u.username?.toLowerCase() === cleaned && u.uid !== excludeUid
    );
  },

  // Save or Update User Profile
  saveUserProfile: async (uid: string, profile: Partial<any>): Promise<any> => {
    const now = new Date().toISOString();
    
    if (!isMockSupabase && supabase) {
      try {
        // Upsert into real Supabase profiles table
        const { data, error } = await supabase
          .from("profiles")
          .upsert({
            uid,
            username: profile.username || undefined,
            displayName: profile.displayName || undefined,
            photoURL: profile.photoURL || undefined,
            bio: profile.bio || undefined,
            city: profile.city || undefined,
            updated_at: now
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase profiles write failed, falling back to local storage profile tracking:", err);
      }
    }
    
    // Local Storage Simulator fallback
    if (typeof window === "undefined") return profile;
    const storedUsers = JSON.parse(localStorage.getItem("unsolved_users") || "{}");
    const existing = storedUsers[uid] || {
      uid,
      username: "user_" + uid.substring(0, 5),
      displayName: "Supabase User",
      photoURL: "",
      bio: "",
      createdAt: now,
      gangIds: [],
      city: "Bangalore"
    };

    const updated = { ...existing, ...profile, updated_at: now };
    storedUsers[uid] = updated;
    localStorage.setItem("unsolved_users", JSON.stringify(storedUsers));
    return updated;
  },

  // Retrieve User Profile
  getUserProfile: async (uidOrUsername: string, isUid: boolean = true): Promise<any | null> => {
    if (!isMockSupabase && supabase) {
      try {
        const queryField = isUid ? "uid" : "username";
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq(queryField, isUid ? uidOrUsername : uidOrUsername.toLowerCase())
          .maybeSingle();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn("Supabase profiles fetch failed, falling back to local storage profile tracking:", err);
      }
    }
    
    // Local Storage Simulator fallback
    if (typeof window === "undefined") return null;
    const storedUsers = JSON.parse(localStorage.getItem("unsolved_users") || "{}");
    
    if (isUid) {
      return storedUsers[uidOrUsername] || null;
    } else {
      const match = Object.values(storedUsers).find(
        (u: any) => u.username?.toLowerCase() === uidOrUsername.toLowerCase()
      );
      return match || null;
    }
  }
};
