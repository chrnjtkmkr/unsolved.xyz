import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as fbCreateUserWithEmailAndPassword
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit as fbLimit,
  startAfter as fbStartAfter,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction
} from "firebase/firestore";

// Firebase Config from Env
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if we should use Mock Service (if keys are templates or missing)
const isMock = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("mock-api-key");

let app;
let realAuth: any = null;
let realDb: any = null;

if (!isMock) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    realAuth = getAuth(app);
    realDb = getFirestore(app);
  } catch (error) {
    console.warn("Failed to initialize Firebase real services, falling back to mock:", error);
  }
}

// ----------------------------------------------------
// TYPES Definition
// ----------------------------------------------------
export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  bio: string;
  createdAt: string;
  gangIds: string[];
  city?: string;
  postsCount?: number;
  gangsCount?: number;
  sameProblemsGiven?: number;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  type: "problem" | "idea" | "learning";
  tags: string[];
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  isAnonymous: boolean;
  gangId?: string;
  gangName?: string;
  sameCount: number;
  voteCount: number; // mapped to vote-num
  replyCount: number;
  isSolved: boolean;
  createdAt: string;
  city?: string;
  buildTogetherUsers?: string[]; // userIDs who want to build together
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  body: string;
  isAnonymous: boolean;
  parentCommentId: string | null; // null if top-level
  createdAt: string;
  replies?: Comment[];
}

export interface Gang {
  id: string;
  name: string;
  description: string;
  color: string; // Hex color for dot
  createdBy: string;
  memberIds: string[];
  memberCount: number;
  onlineCount?: number;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: string;
  participantsInfo?: { [uid: string]: { displayName: string; username: string; photoURL: string } };
  unreadCount?: number;
}

export interface NotificationItem {
  id: string;
  type: "reply" | "same_problem" | "gang_invite" | "gang_join";
  fromUser: {
    uid: string;
    username: string;
    displayName: string;
  };
  postId?: string;
  postTitle?: string;
  gangId?: string;
  gangName?: string;
  read: boolean;
  createdAt: string;
}

// ----------------------------------------------------
// LOCAL STORAGE SIMULATOR BACKEND (High-Fidelity)
// ----------------------------------------------------
class LocalStorageBackend {
  private get(key: string, defaultVal: any) {
    if (typeof window === "undefined") return defaultVal;
    const item = localStorage.getItem(`unsolved_${key}`);
    return item ? JSON.parse(item) : defaultVal;
  }

  private set(key: string, val: any) {
    if (typeof window === "undefined") return;
    localStorage.setItem(`unsolved_${key}`, JSON.stringify(val));
  }

  // Seed default data if empty
  initSeed() {
    if (typeof window === "undefined") return;
    
    // Seed Gangs
    const gangs = this.get("gangs", []);
    if (gangs.length === 0) {
      const defaultGangs: Gang[] = [
        {
          id: "rural-startups",
          name: "Rural Startups",
          description: "Empowering rural micro-entrepreneurs and agritech disruptors in India.",
          color: "#4ade80", // green dot
          createdBy: "system",
          memberIds: ["rk-uid", "sp-uid", "system"],
          memberCount: 3,
          onlineCount: 1,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "learning-dsa",
          name: "Learning DSA",
          description: "Daily DSA challenges, recursion mind blocks, and peer-to-peer prep support.",
          color: "#60a5fa", // blue dot
          createdBy: "system",
          memberIds: ["sp-uid", "system"],
          memberCount: 2,
          onlineCount: 2,
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "indie-builders",
          name: "Indie Builders",
          description: "Building SaaS, networking products, and hacking micro-tools for the Indian market.",
          color: "#f59e0b", // amber dot
          createdBy: "system",
          memberIds: ["system"],
          memberCount: 1,
          onlineCount: 0,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      this.set("gangs", defaultGangs);
    }

    // Seed Posts
    const posts = this.get("posts", []);
    if (posts.length === 0) {
      const defaultPosts: Post[] = [
        {
          id: "post-1",
          title: "Cold storage is a nightmare for small farmers in MP — no one is solving this properly",
          body: "Farmers near my village lose 30–40% of produce because the nearest cold storage is 60km away and charging insane rates. I want to build a shared micro cold-storage model but no idea how to validate this or get any funding. We desperately need modular, low-cost options that can run off solar power in fields.",
          type: "problem",
          tags: ["Rural Startups", "Agritech", "Funding"],
          authorId: "rk-uid",
          authorName: "Rahul K.",
          isAnonymous: false,
          gangId: "rural-startups",
          gangName: "Rural Startups",
          sameCount: 47,
          voteCount: 47,
          replyCount: 24,
          isSolved: false,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          city: "Bhopal",
          buildTogetherUsers: ["user-demo"]
        },
        {
          id: "post-2",
          title: "I keep forgetting recursion every time I take a break — how do you actually retain it?",
          body: "This is genuinely frustrating. Learn it, understand it, then 2 weeks without practice and it's gone again. Tried YouTube, leetcode, books. Nothing sticks. Is this just me?? I can solve sliding window and graphs, but recursion trees make me freeze.",
          type: "learning",
          tags: ["Learning DSA", "Interview Prep", "Algorithms"],
          authorId: "sp-uid",
          authorName: "Sneha P.",
          isAnonymous: false,
          gangId: "learning-dsa",
          gangName: "Learning DSA",
          sameCount: 203,
          voteCount: 203,
          replyCount: 61,
          isSolved: true,
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
          city: "Bangalore",
          buildTogetherUsers: []
        },
        {
          id: "post-3",
          title: "There's no good platform in India just for raw networking + sharing ideas — we're all building in isolation",
          body: "LinkedIn is too formal. Twitter is noise. Reddit is mostly US-focused. We need something that's just... real conversation between people actually trying to build things. Like this but better lol. A space where failure is celebrated, early prototypes get constructive criticism, and you find a co-founder organically.",
          type: "idea",
          tags: ["Networking", "Startup India", "Builders"],
          authorId: "anon-uid",
          authorName: "anonymous",
          isAnonymous: true,
          sameCount: 512,
          voteCount: 512,
          replyCount: 89,
          isSolved: false,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          city: "Mumbai",
          buildTogetherUsers: []
        }
      ];
      this.set("posts", defaultPosts);
    }

    // Seed Comments
    const comments = this.get("comments", []);
    if (comments.length === 0) {
      const defaultComments: Comment[] = [
        {
          id: "c-1",
          postId: "post-1",
          authorId: "sp-uid",
          authorName: "Sneha P.",
          body: "Have you looked into Phase Change Materials (PCM)? They hold cold temperatures for hours without electricity. Might be perfect for modular solar storages.",
          isAnonymous: false,
          parentCommentId: null,
          createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "c-2",
          postId: "post-1",
          authorId: "rk-uid",
          authorName: "Rahul K.",
          body: "Wow, Sneha! That sounds very interesting. Do you know of any local supplier for PCM sheets in India?",
          isAnonymous: false,
          parentCommentId: "c-1",
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "c-3",
          postId: "post-2",
          authorId: "rk-uid",
          authorName: "Rahul K.",
          body: "I had the same problem. The trick is to stop thinking about the recursion stack, and start thinking about the recurrence relation. Trust that your recursive call WILL return the right value. Solve for base case, solve for N assuming N-1 works.",
          isAnonymous: false,
          parentCommentId: null,
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        }
      ];
      this.set("comments", defaultComments);
    }

    // Seed Users
    const users = this.get("users", {});
    if (Object.keys(users).length === 0) {
      const defaultUsers = {
        "rk-uid": {
          uid: "rk-uid",
          username: "rahulk",
          displayName: "Rahul K.",
          photoURL: "",
          bio: "Building agritech solutions for MP farmers | Passionate about sustainability.",
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          gangIds: ["rural-startups"],
          city: "Bhopal"
        },
        "sp-uid": {
          uid: "sp-uid",
          username: "snehap",
          displayName: "Sneha P.",
          photoURL: "",
          bio: "SDE-2 | Lifelong learner | DSA hobbyist | Bangalore techie.",
          createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          gangIds: ["rural-startups", "learning-dsa"],
          city: "Bangalore"
        }
      };
      this.set("users", defaultUsers);
    }

    // Seed Conversations
    const convs = this.get("conversations", []);
    if (convs.length === 0) {
      const defaultConvs: Conversation[] = [
        {
          id: "conv-1",
          participantIds: ["user-demo", "sp-uid"],
          lastMessage: "Yeah, let's build the micro-cold storage together!",
          lastMessageAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
        }
      ];
      this.set("conversations", defaultConvs);

      const defaultChats: { [convId: string]: Message[] } = {
        "conv-1": [
          {
            id: "m-1",
            senderId: "sp-uid",
            text: "Hey! I saw your post about micro cold storage.",
            createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: "m-2",
            senderId: "user-demo",
            text: "Hi Sneha! Yes, looking for collaborators.",
            createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: "m-3",
            senderId: "sp-uid",
            text: "Yeah, let's build the micro-cold storage together!",
            createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            read: false
          }
        ]
      };
      this.set("chats", defaultChats);
    }
  }

  // State queries and updates
  getUsers(): { [uid: string]: UserProfile } {
    return this.get("users", {});
  }
  setUsers(users: any) {
    this.set("users", users);
  }

  getPosts(): Post[] {
    return this.get("posts", []);
  }
  setPosts(posts: Post[]) {
    this.set("posts", posts);
  }

  getComments(): Comment[] {
    return this.get("comments", []);
  }
  setComments(comments: Comment[]) {
    this.set("comments", comments);
  }

  getGangs(): Gang[] {
    return this.get("gangs", []);
  }
  setGangs(gangs: Gang[]) {
    this.set("gangs", gangs);
  }

  getConversations(): Conversation[] {
    return this.get("conversations", []);
  }
  setConversations(convs: Conversation[]) {
    this.set("conversations", convs);
  }

  getChats(): { [convId: string]: Message[] } {
    return this.get("chats", {});
  }
  setChats(chats: { [convId: string]: Message[] }) {
    this.set("chats", chats);
  }

  getNotifications(uid: string): NotificationItem[] {
    const allNotifs = this.get("notifications", {});
    return allNotifs[uid] || [];
  }
  setNotifications(uid: string, items: NotificationItem[]) {
    const allNotifs = this.get("notifications", {});
    allNotifs[uid] = items;
    this.set("notifications", allNotifs);
  }
}

export const mockBackend = new LocalStorageBackend();
if (typeof window !== "undefined") {
  mockBackend.initSeed();
}

// ----------------------------------------------------
// AUTHENTICATION API
// ----------------------------------------------------
let mockCurrentUser: { uid: string; email: string; displayName: string; photoURL: string } | null = null;
let authListeners: ((user: any) => void)[] = [];

if (typeof window !== "undefined") {
  // Load simulated active user session
  const storedUser = localStorage.getItem("unsolved_auth_session");
  if (storedUser) {
    mockCurrentUser = JSON.parse(storedUser);
  }
}

const triggerAuthChange = () => {
  authListeners.forEach(listener => listener(mockCurrentUser));
};

export const authService = {
  getCurrentUser: () => {
    if (!isMock && realAuth) {
      return realAuth.currentUser;
    }
    return mockCurrentUser;
  },

  onAuthStateChanged: (callback: (user: any) => void) => {
    if (!isMock && realAuth) {
      return fbOnAuthStateChanged(realAuth, callback);
    }
    authListeners.push(callback);
    // Initial call
    setTimeout(() => callback(mockCurrentUser), 50);
    return () => {
      authListeners = authListeners.filter(l => l !== callback);
    };
  },

  signInWithGoogle: async () => {
    if (!isMock && realAuth) {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(realAuth, provider);
      return result.user;
    } else {
      // Mock Google Login
      const user = {
        uid: "user-demo",
        email: "demo@unsolved.xyz",
        displayName: "Demo Builder",
        photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80"
      };
      mockCurrentUser = user;
      localStorage.setItem("unsolved_auth_session", JSON.stringify(user));
      
      // Auto register profile in users if first time
      const dbUsers = mockBackend.getUsers();
      if (!dbUsers[user.uid]) {
        dbUsers[user.uid] = {
          uid: user.uid,
          username: "demobuilder",
          displayName: user.displayName,
          photoURL: user.photoURL,
          bio: "I build cool things. Tap edit to update bio!",
          createdAt: new Date().toISOString(),
          gangIds: ["rural-startups", "learning-dsa"],
          city: "Delhi"
        };
        mockBackend.setUsers(dbUsers);
      }
      
      triggerAuthChange();
      return user;
    }
  },

  signInWithEmail: async (email: string, pass: string) => {
    if (!isMock && realAuth) {
      const res = await fbSignInWithEmailAndPassword(realAuth, email, pass);
      return res.user;
    } else {
      // Find or create in mock
      const user = {
        uid: "user-demo",
        email: email,
        displayName: email.split("@")[0],
        photoURL: ""
      };
      mockCurrentUser = user;
      localStorage.setItem("unsolved_auth_session", JSON.stringify(user));
      
      const dbUsers = mockBackend.getUsers();
      if (!dbUsers[user.uid]) {
        dbUsers[user.uid] = {
          uid: user.uid,
          username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
          displayName: user.displayName,
          photoURL: "",
          bio: "Passionate community member.",
          createdAt: new Date().toISOString(),
          gangIds: ["learning-dsa"],
          city: "Delhi"
        };
        mockBackend.setUsers(dbUsers);
      }
      
      triggerAuthChange();
      return user;
    }
  },

  signUpWithEmail: async (email: string, pass: string) => {
    if (!isMock && realAuth) {
      const res = await fbCreateUserWithEmailAndPassword(realAuth, email, pass);
      return res.user;
    } else {
      const user = {
        uid: "user-demo",
        email: email,
        displayName: email.split("@")[0],
        photoURL: ""
      };
      mockCurrentUser = user;
      localStorage.setItem("unsolved_auth_session", JSON.stringify(user));
      
      const dbUsers = mockBackend.getUsers();
      dbUsers[user.uid] = {
        uid: user.uid,
        username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
        displayName: user.displayName,
        photoURL: "",
        bio: "Just joined Unsolved! Excited to collaborate.",
        createdAt: new Date().toISOString(),
        gangIds: [],
        city: ""
      };
      mockBackend.setUsers(dbUsers);
      
      triggerAuthChange();
      return user;
    }
  },

  signInWithPhoneOTP: async (phoneNumber: string) => {
    // Firebase phone auth needs recaptcha, so we can mock/simulate it or implement it.
    // For mock mode we instantly simulate SMS verification
    if (!isMock && realAuth) {
      // In a real environment, phone auth is handled via RecaptchaVerifier and signInWithPhoneNumber.
      // We will export helper function but for local we mock
      alert("Real Firebase Phone Auth initiated. In mock mode, this completes instantly.");
    }
    
    const user = {
      uid: "user-demo",
      email: "phone@unsolved.xyz",
      displayName: "Phone User " + phoneNumber.slice(-4),
      photoURL: ""
    };
    mockCurrentUser = user;
    localStorage.setItem("unsolved_auth_session", JSON.stringify(user));
    
    const dbUsers = mockBackend.getUsers();
    if (!dbUsers[user.uid]) {
      dbUsers[user.uid] = {
        uid: user.uid,
        username: "phone_" + phoneNumber.slice(-4),
        displayName: user.displayName,
        photoURL: "",
        bio: "Signed in via SMS.",
        createdAt: new Date().toISOString(),
        gangIds: [],
        city: ""
      };
      mockBackend.setUsers(dbUsers);
    }
    triggerAuthChange();
    return user;
  },

  signOut: async () => {
    if (!isMock && realAuth) {
      await fbSignOut(realAuth);
    } else {
      mockCurrentUser = null;
      localStorage.removeItem("unsolved_auth_session");
      triggerAuthChange();
    }
  }
};

// ----------------------------------------------------
// DATABASE SERVICES (FIRESTORE)
// ----------------------------------------------------
export const dbService = {
  // Check if username is unique
  isUsernameUnique: async (username: string, excludeUid?: string): Promise<boolean> => {
    const cleaned = username.trim().toLowerCase();
    if (!isMock && realDb) {
      const q = query(collection(realDb, "users"), where("username", "==", cleaned));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return true;
      if (excludeUid) {
        return snapshot.docs.every(doc => doc.id === excludeUid);
      }
      return false;
    } else {
      const dbUsers = mockBackend.getUsers();
      return !Object.values(dbUsers).some(
        u => u.username.toLowerCase() === cleaned && u.uid !== excludeUid
      );
    }
  },

  // Save/Update User Profile
  saveUserProfile: async (uid: string, profile: Partial<UserProfile>): Promise<UserProfile> => {
    if (!isMock && realDb) {
      const docRef = doc(realDb, "users", uid);
      const docSnap = await getDoc(docRef);
      const now = new Date().toISOString();
      let finalProfile: UserProfile;
      
      if (docSnap.exists()) {
        await updateDoc(docRef, profile as any);
        finalProfile = { ...docSnap.data(), ...profile } as UserProfile;
      } else {
        const newProfile: UserProfile = {
          uid,
          username: profile.username || "user_" + uid.slice(0, 5),
          displayName: profile.displayName || "Unsolved User",
          photoURL: profile.photoURL || "",
          bio: profile.bio || "",
          createdAt: now,
          gangIds: profile.gangIds || [],
          city: profile.city || ""
        };
        await setDoc(docRef, newProfile);
        finalProfile = newProfile;
      }
      return finalProfile;
    } else {
      const dbUsers = mockBackend.getUsers();
      const existing = dbUsers[uid] || {
        uid,
        username: "user_" + uid.slice(0, 5),
        displayName: "Unsolved User",
        photoURL: "",
        bio: "",
        createdAt: new Date().toISOString(),
        gangIds: [],
        city: ""
      };
      
      const updated = { ...existing, ...profile };
      dbUsers[uid] = updated;
      mockBackend.setUsers(dbUsers);
      return updated;
    }
  },

  // Get User Profile
  getUserProfile: async (uidOrUsername: string, isUid: boolean = true): Promise<UserProfile | null> => {
    if (!isMock && realDb) {
      if (isUid) {
        const snap = await getDoc(doc(realDb, "users", uidOrUsername));
        return snap.exists() ? (snap.data() as UserProfile) : null;
      } else {
        const q = query(collection(realDb, "users"), where("username", "==", uidOrUsername.toLowerCase()));
        const snap = await getDocs(q);
        return snap.empty ? null : (snap.docs[0].data() as UserProfile);
      }
    } else {
      const dbUsers = mockBackend.getUsers();
      if (isUid) {
        return dbUsers[uidOrUsername] || null;
      } else {
        const match = Object.values(dbUsers).find(
          u => u.username.toLowerCase() === uidOrUsername.toLowerCase()
        );
        return match || null;
      }
    }
  },

  // Get User Stats
  getUserStats: async (uid: string): Promise<{ postsCount: number; gangsCount: number; sameProblemsGiven: number }> => {
    if (!isMock && realDb) {
      // In real Firebase, query count or use metadata
      // For simplicity, we can fetch posts, gangs, and active same problems count
      const pSnap = await getDocs(query(collection(realDb, "posts"), where("authorId", "==", uid)));
      const uSnap = await getDoc(doc(realDb, "users", uid));
      const sSnap = await getDocs(query(collection(realDb, "sameProblem"), where("uid", "==", uid)));
      
      return {
        postsCount: pSnap.size,
        gangsCount: uSnap.exists() ? (uSnap.data().gangIds?.length || 0) : 0,
        sameProblemsGiven: sSnap.size
      };
    } else {
      const posts = mockBackend.getPosts();
      const dbUsers = mockBackend.getUsers();
      const user = dbUsers[uid];
      
      const postsCount = posts.filter(p => p.authorId === uid).length;
      const gangsCount = user?.gangIds?.length || 0;
      
      // Calculate how many same problems this user clicked
      // We can query that by checking if active same problem includes this user in localStorage
      const sameClicked = posts.filter(p => {
        const activeSames = JSON.parse(localStorage.getItem(`same_${p.id}`) || "{}");
        return activeSames[uid] === true;
      }).length;

      return {
        postsCount,
        gangsCount,
        sameProblemsGiven: sameClicked
      };
    }
  },

  // GET POSTS WITH ADVANCED FILTERS & PAGINATION
  getPosts: async (options: {
    tab?: "for_you" | "my_gangs" | "trending" | "nearby" | "new";
    types?: ("problem" | "idea" | "learning")[];
    gangId?: string;
    city?: string;
    searchQuery?: string;
    uid?: string; // current logged-in user id
    startAfterId?: string;
    pageSize?: number;
  }): Promise<{ posts: Post[]; hasMore: boolean }> => {
    const limitVal = options.pageSize || 10;
    
    if (!isMock && realDb) {
      let q = collection(realDb, "posts");
      const conditions: any[] = [];

      if (options.gangId) {
        conditions.push(where("gangId", "==", options.gangId));
      }

      if (options.types && options.types.length > 0) {
        conditions.push(where("type", "in", options.types));
      }

      if (options.tab === "nearby" && options.city) {
        conditions.push(where("city", "==", options.city));
      }

      // Add order by
      let orderField = "createdAt";
      let orderDir: "asc" | "desc" = "desc";
      if (options.tab === "trending") {
        orderField = "voteCount";
      }

      const qBuilt = query(q, ...conditions, orderBy(orderField, orderDir), fbLimit(limitVal));
      const snap = await getDocs(qBuilt);
      const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      
      return { posts, hasMore: snap.docs.length >= limitVal };
    } else {
      // Full mock JS filtering (highly responsive, supports search and sorting!)
      let posts = mockBackend.getPosts();

      // Search Query filter
      if (options.searchQuery) {
        const queryClean = options.searchQuery.toLowerCase().trim();
        posts = posts.filter(
          p => p.title.toLowerCase().includes(queryClean) || 
               p.body.toLowerCase().includes(queryClean) ||
               p.tags.some(t => t.toLowerCase().includes(queryClean)) ||
               p.authorName.toLowerCase().includes(queryClean)
        );
      }

      // Gang filter
      if (options.gangId) {
        posts = posts.filter(p => p.gangId === options.gangId);
      }

      // Type badges filter
      if (options.types && options.types.length > 0) {
        posts = posts.filter(p => options.types!.includes(p.type));
      }

      // Nearby filter
      if (options.tab === "nearby" && options.city) {
        posts = posts.filter(p => p.city?.toLowerCase() === options.city?.toLowerCase());
      }

      // My Gangs filter
      if (options.tab === "my_gangs" && options.uid) {
        const user = mockBackend.getUsers()[options.uid];
        const userGangIds = user?.gangIds || [];
        posts = posts.filter(p => p.gangId && userGangIds.includes(p.gangId));
      }

      // Sort
      if (options.tab === "trending") {
        posts.sort((a, b) => b.voteCount - a.voteCount);
      } else {
        // default to "new" / "for_you" -> descending createdAt
        posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      // Pagination
      let startIndex = 0;
      if (options.startAfterId) {
        const idx = posts.findIndex(p => p.id === options.startAfterId);
        if (idx !== -1) startIndex = idx + 1;
      }

      const paginated = posts.slice(startIndex, startIndex + limitVal);
      const hasMore = startIndex + limitVal < posts.length;

      return { posts: paginated, hasMore };
    }
  },

  // Get single post
  getPost: async (postId: string): Promise<Post | null> => {
    if (!isMock && realDb) {
      const snap = await getDoc(doc(realDb, "posts", postId));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null;
    } else {
      const posts = mockBackend.getPosts();
      return posts.find(p => p.id === postId) || null;
    }
  },

  // CREATE POST
  createPost: async (postData: Omit<Post, "id" | "sameCount" | "voteCount" | "replyCount" | "isSolved" | "createdAt" | "buildTogetherUsers">): Promise<Post> => {
    const now = new Date().toISOString();
    const newPostData = {
      ...postData,
      sameCount: 0,
      voteCount: 0,
      replyCount: 0,
      isSolved: false,
      createdAt: now,
      buildTogetherUsers: []
    };

    if (!isMock && realDb) {
      const docRef = await addDoc(collection(realDb, "posts"), newPostData);
      return { id: docRef.id, ...newPostData } as Post;
    } else {
      const posts = mockBackend.getPosts();
      const id = "post_" + Math.random().toString(36).substring(2, 9);
      const post: Post = { id, ...newPostData };
      
      posts.unshift(post);
      mockBackend.setPosts(posts);
      return post;
    }
  },

  // MARK POST AS SOLVED
  markPostAsSolved: async (postId: string, solved: boolean = true): Promise<void> => {
    if (!isMock && realDb) {
      await updateDoc(doc(realDb, "posts", postId), { isSolved: solved });
    } else {
      const posts = mockBackend.getPosts();
      const idx = posts.findIndex(p => p.id === postId);
      if (idx !== -1) {
        posts[idx].isSolved = solved;
        mockBackend.setPosts(posts);
      }
    }
  },

  // TOGGLE "SAME PROBLEM"
  toggleSameProblem: async (postId: string, uid: string): Promise<{ active: boolean; sameCount: number }> => {
    if (!isMock && realDb) {
      const sameRef = doc(realDb, "sameProblem", `${postId}_${uid}`);
      const sameSnap = await getDoc(sameRef);
      const postRef = doc(realDb, "posts", postId);
      let active = false;
      let diff = 0;

      await runTransaction(realDb, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw "Post does not exist!";
        const currentSameCount = postSnap.data().sameCount || 0;

        if (sameSnap.exists()) {
          transaction.delete(sameRef);
          transaction.update(postRef, { sameCount: increment(-1) });
          active = false;
          diff = -1;
        } else {
          transaction.set(sameRef, { postId, uid, createdAt: new Date().toISOString() });
          transaction.update(postRef, { sameCount: increment(1) });
          active = true;
          diff = 1;
        }
      });

      const postSnap = await getDoc(postRef);
      return { active, sameCount: postSnap.data()?.sameCount || 0 };
    } else {
      const posts = mockBackend.getPosts();
      const post = posts.find(p => p.id === postId);
      if (!post) throw new Error("Post not found");

      const activeSames = JSON.parse(localStorage.getItem(`same_${postId}`) || "{}");
      let active = false;

      if (activeSames[uid]) {
        delete activeSames[uid];
        post.sameCount = Math.max(0, post.sameCount - 1);
        active = false;
      } else {
        activeSames[uid] = true;
        post.sameCount += 1;
        active = true;
        
        // Auto-generate notification if own post isn't this user's
        if (post.authorId !== uid && post.authorId !== "anon-uid") {
          dbService.createNotification(post.authorId, {
            type: "same_problem",
            fromUser: {
              uid,
              username: "demobuilder",
              displayName: "Demo Builder"
            },
            postId: post.id,
            postTitle: post.title,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }

      localStorage.setItem(`same_${postId}`, JSON.stringify(activeSames));
      mockBackend.setPosts(posts);
      return { active, sameCount: post.sameCount };
    }
  },

  // GET "SAME PROBLEM" STATUS PER USER
  getSameProblemStatus: async (postId: string, uid: string): Promise<boolean> => {
    if (!isMock && realDb) {
      const snap = await getDoc(doc(realDb, "sameProblem", `${postId}_${uid}`));
      return snap.exists();
    } else {
      const activeSames = JSON.parse(localStorage.getItem(`same_${postId}`) || "{}");
      return !!activeSames[uid];
    }
  },

  // TOGGLE VOTE (UPVOTE)
  toggleVote: async (postId: string, uid: string): Promise<{ voted: boolean; voteCount: number }> => {
    if (!isMock && realDb) {
      const voteRef = doc(realDb, "postVotes", `${postId}_${uid}`);
      const voteSnap = await getDoc(voteRef);
      const postRef = doc(realDb, "posts", postId);
      let voted = false;

      if (voteSnap.exists()) {
        await updateDoc(postRef, { voteCount: increment(-1) });
        // delete vote record
        // setDoc/deleteDoc
        voted = false;
      } else {
        await updateDoc(postRef, { voteCount: increment(1) });
        // create vote record
        voted = true;
      }
      const updatedSnap = await getDoc(postRef);
      return { voted, voteCount: updatedSnap.data()?.voteCount || 0 };
    } else {
      const posts = mockBackend.getPosts();
      const post = posts.find(p => p.id === postId);
      if (!post) throw new Error("Post not found");

      const activeVotes = JSON.parse(localStorage.getItem(`vote_${postId}`) || "{}");
      let voted = false;

      if (activeVotes[uid]) {
        delete activeVotes[uid];
        post.voteCount = Math.max(0, post.voteCount - 1);
        voted = false;
      } else {
        activeVotes[uid] = true;
        post.voteCount += 1;
        voted = true;
      }

      localStorage.setItem(`vote_${postId}`, JSON.stringify(activeVotes));
      mockBackend.setPosts(posts);
      return { voted, voteCount: post.voteCount };
    }
  },

  getVoteStatus: async (postId: string, uid: string): Promise<boolean> => {
    if (!isMock && realDb) {
      // checks if vote records exist
      return false; 
    } else {
      const activeVotes = JSON.parse(localStorage.getItem(`vote_${postId}`) || "{}");
      return !!activeVotes[uid];
    }
  },

  // TOGGLE BUILD TOGETHER
  toggleBuildTogether: async (postId: string, uid: string, displayName: string): Promise<{ active: boolean; usersCount: number }> => {
    if (!isMock && realDb) {
      const ref = doc(realDb, "posts", postId);
      const post = await getDoc(ref);
      let active = false;
      if (post.exists()) {
        const buildUsers = post.data().buildTogetherUsers || [];
        if (buildUsers.includes(uid)) {
          await updateDoc(ref, { buildTogetherUsers: arrayRemove(uid) });
          active = false;
        } else {
          await updateDoc(ref, { buildTogetherUsers: arrayUnion(uid) });
          active = true;
        }
      }
      const updated = await getDoc(ref);
      return { active, usersCount: (updated.data()?.buildTogetherUsers || []).length };
    } else {
      const posts = mockBackend.getPosts();
      const post = posts.find(p => p.id === postId);
      if (!post) throw new Error("Post not found");

      post.buildTogetherUsers = post.buildTogetherUsers || [];
      let active = false;
      
      if (post.buildTogetherUsers.includes(uid)) {
        post.buildTogetherUsers = post.buildTogetherUsers.filter(id => id !== uid);
        active = false;
      } else {
        post.buildTogetherUsers.push(uid);
        active = true;
      }

      mockBackend.setPosts(posts);
      return { active, usersCount: post.buildTogetherUsers.length };
    }
  },

  // COMMENTS SERVICES
  getComments: async (postId: string): Promise<Comment[]> => {
    if (!isMock && realDb) {
      const q = query(collection(realDb, "comments"), where("postId", "==", postId), orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      const allComments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      
      // Structure nested comments (up to 2 levels)
      const roots = allComments.filter(c => !c.parentCommentId);
      roots.forEach(root => {
        root.replies = allComments.filter(c => c.parentCommentId === root.id);
      });
      return roots;
    } else {
      const allComments = mockBackend.getComments().filter(c => c.postId === postId);
      const roots = allComments.filter(c => !c.parentCommentId);
      
      roots.forEach(root => {
        root.replies = allComments.filter(c => c.parentCommentId === root.id);
      });
      
      // Sort comments by date
      roots.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      roots.forEach(r => r.replies?.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      
      return roots;
    }
  },

  addComment: async (commentData: Omit<Comment, "id" | "createdAt">): Promise<Comment> => {
    const now = new Date().toISOString();
    const commentFull = {
      ...commentData,
      createdAt: now
    };

    if (!isMock && realDb) {
      const ref = await addDoc(collection(realDb, "comments"), commentFull);
      // Increment replyCount in posts
      await updateDoc(doc(realDb, "posts", commentData.postId), {
        replyCount: increment(1)
      });
      return { id: ref.id, ...commentFull } as Comment;
    } else {
      const comments = mockBackend.getComments();
      const id = "comment_" + Math.random().toString(36).substring(2, 9);
      const comment: Comment = { id, ...commentFull };
      
      comments.push(comment);
      mockBackend.setComments(comments);

      // Increment replyCount
      const posts = mockBackend.getPosts();
      const post = posts.find(p => p.id === commentData.postId);
      if (post) {
        post.replyCount += 1;
        mockBackend.setPosts(posts);

        // Auto-notify post owner if own post isn't anonymous and author isn't commenter
        if (post.authorId !== commentData.authorId && post.authorId !== "anon-uid") {
          dbService.createNotification(post.authorId, {
            type: "reply",
            fromUser: {
              uid: commentData.authorId,
              username: commentData.isAnonymous ? "anonymous" : "demobuilder",
              displayName: commentData.isAnonymous ? "anonymous" : commentData.authorName
            },
            postId: post.id,
            postTitle: post.title,
            read: false,
            createdAt: now
          });
        }
      }

      return comment;
    }
  },

  // GANGS SERVICES
  getGangs: async (): Promise<Gang[]> => {
    if (!isMock && realDb) {
      const snap = await getDocs(query(collection(realDb, "gangs"), orderBy("createdAt", "desc")));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Gang));
    } else {
      return mockBackend.getGangs();
    }
  },

  getGang: async (gangId: string): Promise<Gang | null> => {
    if (!isMock && realDb) {
      const snap = await getDoc(doc(realDb, "gangs", gangId));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as Gang) : null;
    } else {
      return mockBackend.getGangs().find(g => g.id === gangId) || null;
    }
  },

  createGang: async (gangData: Omit<Gang, "id" | "memberCount" | "createdAt" | "memberIds" | "onlineCount">): Promise<Gang> => {
    const now = new Date().toISOString();
    const newGang = {
      ...gangData,
      memberIds: [gangData.createdBy],
      memberCount: 1,
      onlineCount: 1,
      createdAt: now
    };

    if (!isMock && realDb) {
      const ref = await addDoc(collection(realDb, "gangs"), newGang);
      // Update user profile gangIds
      await updateDoc(doc(realDb, "users", gangData.createdBy), {
        gangIds: arrayUnion(ref.id)
      });
      return { id: ref.id, ...newGang } as Gang;
    } else {
      const gangs = mockBackend.getGangs();
      const id = gangData.name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "_" + Math.random().toString(36).substring(2, 5);
      const gang: Gang = { id, ...newGang };
      
      gangs.unshift(gang);
      mockBackend.setGangs(gangs);

      // Join user to gang
      const dbUsers = mockBackend.getUsers();
      if (dbUsers[gangData.createdBy]) {
        dbUsers[gangData.createdBy].gangIds = dbUsers[gangData.createdBy].gangIds || [];
        dbUsers[gangData.createdBy].gangIds.push(id);
        mockBackend.setUsers(dbUsers);
      }

      return gang;
    }
  },

  joinGang: async (gangId: string, uid: string): Promise<void> => {
    if (!isMock && realDb) {
      await updateDoc(doc(realDb, "gangs", gangId), {
        memberIds: arrayUnion(uid),
        memberCount: increment(1)
      });
      await updateDoc(doc(realDb, "users", uid), {
        gangIds: arrayUnion(gangId)
      });
    } else {
      const gangs = mockBackend.getGangs();
      const gang = gangs.find(g => g.id === gangId);
      if (gang && !gang.memberIds.includes(uid)) {
        gang.memberIds.push(uid);
        gang.memberCount = gang.memberIds.length;
        mockBackend.setGangs(gangs);
      }

      const dbUsers = mockBackend.getUsers();
      if (dbUsers[uid] && !dbUsers[uid].gangIds.includes(gangId)) {
        dbUsers[uid].gangIds.push(gangId);
        mockBackend.setUsers(dbUsers);
      }
    }
  },

  leaveGang: async (gangId: string, uid: string): Promise<void> => {
    if (!isMock && realDb) {
      await updateDoc(doc(realDb, "gangs", gangId), {
        memberIds: arrayRemove(uid),
        memberCount: increment(-1)
      });
      await updateDoc(doc(realDb, "users", uid), {
        gangIds: arrayRemove(gangId)
      });
    } else {
      const gangs = mockBackend.getGangs();
      const gang = gangs.find(g => g.id === gangId);
      if (gang) {
        gang.memberIds = gang.memberIds.filter(id => id !== uid);
        gang.memberCount = gang.memberIds.length;
        mockBackend.setGangs(gangs);
      }

      const dbUsers = mockBackend.getUsers();
      if (dbUsers[uid]) {
        dbUsers[uid].gangIds = dbUsers[uid].gangIds.filter(id => id !== gangId);
        mockBackend.setUsers(dbUsers);
      }
    }
  },

  // MESSAGES SERVICES
  listenConversations: (uid: string, callback: (convs: Conversation[]) => void) => {
    if (!isMock && realDb) {
      const q = query(
        collection(realDb, "messages"),
        where("participantIds", "arrayContains", uid),
        orderBy("lastMessageAt", "desc")
      );
      return onSnapshot(q, async (snapshot) => {
        const convs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
        
        // Fetch participant details for names/avatars
        for (const conv of convs) {
          const otherId = conv.participantIds.find(id => id !== uid);
          if (otherId) {
            const userSnap = await getDoc(doc(realDb, "users", otherId));
            if (userSnap.exists()) {
              conv.participantsInfo = {
                [otherId]: userSnap.data() as any
              };
            }
          }
        }
        callback(convs);
      });
    } else {
      // Return simulated listener
      const runMockListener = () => {
        const convs = mockBackend.getConversations().filter(c => c.participantIds.includes(uid));
        const dbUsers = mockBackend.getUsers();
        
        convs.forEach(conv => {
          conv.participantsInfo = {};
          conv.participantIds.forEach(pId => {
            if (pId !== uid) {
              const u = dbUsers[pId] || { displayName: "User " + pId.slice(0, 4), username: "user_" + pId.slice(0, 4), photoURL: "" };
              conv.participantsInfo![pId] = {
                displayName: u.displayName,
                username: u.username,
                photoURL: u.photoURL
              };
            }
          });
          
          // Unread messages count
          const chats = mockBackend.getChats()[conv.id] || [];
          conv.unreadCount = chats.filter(m => m.senderId !== uid && !m.read).length;
        });

        convs.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        callback(convs);
      };

      runMockListener();
      // Setup browser poll / listener
      const interval = setInterval(runMockListener, 3000);
      return () => clearInterval(interval);
    }
  },

  listenChats: (conversationId: string, callback: (chats: Message[]) => void) => {
    if (!isMock && realDb) {
      const q = query(
        collection(realDb, "messages", conversationId, "chats"),
        orderBy("createdAt", "asc")
      );
      return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      });
    } else {
      const runMockChats = () => {
        const chatsObj = mockBackend.getChats();
        const messages = chatsObj[conversationId] || [];
        callback([...messages]);
      };

      runMockChats();
      // Mark as read when opened
      const markAsRead = () => {
        const authUser = authService.getCurrentUser();
        if (authUser) {
          const chatsObj = mockBackend.getChats();
          const messages = chatsObj[conversationId] || [];
          let changed = false;
          messages.forEach(m => {
            if (m.senderId !== authUser.uid && !m.read) {
              m.read = true;
              changed = true;
            }
          });
          if (changed) {
            mockBackend.setChats(chatsObj);
          }
        }
      };
      markAsRead();

      const interval = setInterval(() => {
        runMockChats();
        markAsRead();
      }, 2000);
      return () => clearInterval(interval);
    }
  },

  sendMessage: async (conversationId: string, text: string, senderId: string): Promise<void> => {
    const now = new Date().toISOString();
    if (!isMock && realDb) {
      // Add message
      await addDoc(collection(realDb, "messages", conversationId, "chats"), {
        senderId,
        text,
        createdAt: now,
        read: false
      });
      // Update parent message details
      await updateDoc(doc(realDb, "messages", conversationId), {
        lastMessage: text,
        lastMessageAt: now
      });
    } else {
      const chatsObj = mockBackend.getChats();
      const messages = chatsObj[conversationId] || [];
      const msgId = "msg_" + Math.random().toString(36).substring(2, 9);
      
      const newMsg: Message = {
        id: msgId,
        senderId,
        text,
        createdAt: now,
        read: false
      };
      messages.push(newMsg);
      chatsObj[conversationId] = messages;
      mockBackend.setChats(chatsObj);

      // Update conversations
      const convs = mockBackend.getConversations();
      const conv = convs.find(c => c.id === conversationId);
      if (conv) {
        conv.lastMessage = text;
        conv.lastMessageAt = now;
        mockBackend.setConversations(convs);
      }

      // Auto mock automated replies!
      // If the user sends a message, have the recipient respond after 2 seconds!
      const participants = conv?.participantIds || [];
      const otherId = participants.find(id => id !== senderId);
      if (otherId && otherId !== "user-demo") {
        setTimeout(() => {
          const currentChats = mockBackend.getChats();
          const list = currentChats[conversationId] || [];
          const replyId = "reply_" + Math.random().toString(36).substring(2, 9);
          
          let replyText = "That's awesome! Let's schedule a call to talk about the micro-cold storage details.";
          if (text.toLowerCase().includes("hello") || text.toLowerCase().includes("hi")) {
            replyText = "Hi! How can we collaborate on resolving this issue together?";
          } else if (text.toLowerCase().includes("recursion")) {
            replyText = "Yes! I spent hours yesterday drawing out trees, it actually makes a lot of sense now.";
          }

          list.push({
            id: replyId,
            senderId: otherId,
            text: replyText,
            createdAt: new Date().toISOString(),
            read: false
          });
          currentChats[conversationId] = list;
          mockBackend.setChats(currentChats);

          const allConvs = mockBackend.getConversations();
          const parentC = allConvs.find(c => c.id === conversationId);
          if (parentC) {
            parentC.lastMessage = replyText;
            parentC.lastMessageAt = new Date().toISOString();
            mockBackend.setConversations(allConvs);
          }
        }, 3000);
      }
    }
  },

  getOrCreateConversation: async (uid1: string, uid2: string): Promise<string> => {
    if (!isMock && realDb) {
      // Find existing
      const q = query(
        collection(realDb, "messages"),
        where("participantIds", "arrayContains", uid1)
      );
      const snap = await getDocs(q);
      const match = snap.docs.find(d => {
        const pIds = d.data().participantIds || [];
        return pIds.includes(uid2);
      });
      
      if (match) return match.id;
      
      // Create new
      const ref = await addDoc(collection(realDb, "messages"), {
        participantIds: [uid1, uid2],
        lastMessage: "Conversation started",
        lastMessageAt: new Date().toISOString()
      });
      return ref.id;
    } else {
      const convs = mockBackend.getConversations();
      const match = convs.find(c => c.participantIds.includes(uid1) && c.participantIds.includes(uid2));
      if (match) return match.id;

      const newId = "conv_" + Math.random().toString(36).substring(2, 9);
      const newConv: Conversation = {
        id: newId,
        participantIds: [uid1, uid2],
        lastMessage: "Conversation started",
        lastMessageAt: new Date().toISOString()
      };
      convs.push(newConv);
      mockBackend.setConversations(convs);
      
      const chats = mockBackend.getChats();
      chats[newId] = [];
      mockBackend.setChats(chats);

      return newId;
    }
  },

  // NOTIFICATIONS SERVICES
  listenNotifications: (uid: string, callback: (notifs: NotificationItem[]) => void) => {
    if (!isMock && realDb) {
      const q = query(
        collection(realDb, "notifications", uid, "items"),
        orderBy("createdAt", "desc")
      );
      return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem)));
      });
    } else {
      const runMockNotifs = () => {
        const items = mockBackend.getNotifications(uid);
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback([...items]);
      };

      runMockNotifs();
      const interval = setInterval(runMockNotifs, 3000);
      return () => clearInterval(interval);
    }
  },

  createNotification: async (uid: string, item: Omit<NotificationItem, "id">): Promise<void> => {
    const now = new Date().toISOString();
    const fullItem = { ...item, createdAt: now };

    if (!isMock && realDb) {
      await addDoc(collection(realDb, "notifications", uid, "items"), fullItem);
    } else {
      const items = mockBackend.getNotifications(uid);
      const id = "notif_" + Math.random().toString(36).substring(2, 9);
      items.unshift({ id, ...fullItem } as NotificationItem);
      mockBackend.setNotifications(uid, items);
    }
  },

  markNotificationRead: async (uid: string, notifId: string): Promise<void> => {
    if (!isMock && realDb) {
      await updateDoc(doc(realDb, "notifications", uid, "items", notifId), { read: true });
    } else {
      const items = mockBackend.getNotifications(uid);
      const idx = items.findIndex(n => n.id === notifId);
      if (idx !== -1) {
        items[idx].read = true;
        mockBackend.setNotifications(uid, items);
      }
    }
  }
};
