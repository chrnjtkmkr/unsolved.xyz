"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { dbService, UserProfile, Post, Comment, Gang } from "@/lib/firebase";
import PostCard from "@/components/PostCard";
import { getAvatarColor } from "@/lib/utils";
import Link from "next/link";
import { 
  Calendar, 
  MapPin, 
  BookOpen, 
  MessageSquare, 
  Users, 
  Edit2, 
  Check, 
  X, 
  Compass,
  ArrowRight,
  Settings,
  Plus
} from "lucide-react";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile: loggedInProfile, refreshProfile } = useAuth();
  const usernameParam = params.username as string;

  // Profile data states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ postsCount: 0, gangsCount: 0, sameProblemsGiven: 0 });

  // Tab selections
  const [activeTab, setActiveTab] = useState<"posts" | "comments" | "gangs">("posts");
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userComments, setUserComments] = useState<Comment[]>([]);
  const [userGangs, setUserGangs] = useState<Gang[]>([]);
  const [loadingTabData, setLoadingTabData] = useState(false);

  // Edit Profile States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");

  // Mobile Dashboard & Space Creation States
  const [spaces, setSpaces] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");

  const loadUserProfile = async () => {
    try {
      const uProf = await dbService.getUserProfile(usernameParam, false);
      if (uProf) {
        setProfile(uProf);
        
        // Load stats
        const uStats = await dbService.getUserStats(uProf.uid);
        setStats(uStats);

        // Prep Edit states in case it's own profile
        setDisplayName(uProf.displayName);
        setBio(uProf.bio || "");
        setCity(uProf.city || "");
        setPhotoURL(uProf.photoURL || "");
        
        // Fetch current active tab data
        loadTabData(uProf.uid, activeTab);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async (uid: string, tab: "posts" | "comments" | "gangs") => {
    setLoadingTabData(true);
    try {
      if (tab === "posts") {
        const result = await dbService.getPosts({ searchQuery: "", pageSize: 20 });
        const filtered = result.posts.filter(p => p.authorId === uid);
        setUserPosts(filtered);
      } else if (tab === "comments") {
        // Query comments where authorId is matching
        if (typeof window !== "undefined") {
          const allComments = JSON.parse(localStorage.getItem("unsolved_comments") || "[]");
          const filtered = allComments.filter((c: Comment) => c.authorId === uid);
          setUserComments(filtered);
        }
      } else if (tab === "gangs") {
        const allGangs = await dbService.getGangs();
        const filtered = allGangs.filter(g => g.memberIds.includes(uid));
        setUserGangs(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTabData(false);
    }
  };

  useEffect(() => {
    if (usernameParam) {
      loadUserProfile();
    }
  }, [usernameParam]);

  const loadMobileData = () => {
    if (typeof window !== "undefined") {
      // Load spaces
      const savedSpacesStr = localStorage.getItem("unsolved_spaces");
      if (savedSpacesStr) {
        setSpaces(JSON.parse(savedSpacesStr));
      } else {
        const defaults = [
          { id: "rural-startups", label: "g/RuralStartups", href: "/gangs/rural-startups" },
          { id: "learning-dsa", label: "g/LearningDSA", href: "/gangs/learning-dsa" },
          { id: "ai-builders", label: "g/AIBuilders", href: "/gangs/ai-builders" }
        ];
        localStorage.setItem("unsolved_spaces", JSON.stringify(defaults));
        setSpaces(defaults);
      }

      // Load bookmarks
      const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
      const savedData = JSON.parse(savedDataStr);
      const categoriesSet = new Set<string>();
      Object.values(savedData).forEach((item: any) => {
        if (item && item.category) {
          categoriesSet.add(item.category);
        }
      });
      const listItems = Array.from(categoriesSet).map((catName) => {
        const count = Object.values(savedData).filter((item: any) => item.category === catName).length;
        return {
          label: catName,
          count,
          href: `/search?q=${encodeURIComponent(catName)}`
        };
      });
      setBookmarks(listItems);
    }
  };

  useEffect(() => {
    loadMobileData();
    window.addEventListener("unsolved_spaces_updated", loadMobileData);
    window.addEventListener("unsolved_saves_updated", loadMobileData);
    return () => {
      window.removeEventListener("unsolved_spaces_updated", loadMobileData);
      window.removeEventListener("unsolved_saves_updated", loadMobileData);
    };
  }, []);

  const handleMobileCreateSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    const spaceSlug = newSpaceName.trim().toLowerCase();
    const newSpace = {
      id: spaceSlug,
      label: `g/${newSpaceName.trim()}`,
      href: `/gangs/${spaceSlug}`
    };
    const updated = [...spaces, newSpace];
    setSpaces(updated);
    localStorage.setItem("unsolved_spaces", JSON.stringify(updated));
    window.dispatchEvent(new Event("unsolved_spaces_updated"));
    setNewSpaceName("");
    setShowCreateSpaceModal(false);
    alert(`Success! g/${newSpaceName.trim()} space created dynamically in your explore dashboard.`);
  };

  // Sync tab data when tab toggles
  useEffect(() => {
    if (profile) {
      loadTabData(profile.uid, activeTab);
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-txt-secondary font-medium">Resolving profile bio...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-16 text-center">
        <h3 className="text-lg font-bold text-txt-primary">User not found</h3>
        <p className="text-xs text-txt-secondary mt-1">Check the spelling of the username g/{usernameParam}.</p>
        <button 
          onClick={() => router.push("/")}
          className="text-xs font-semibold text-brand-orange hover:underline block mx-auto mt-4"
        >
          ← Return to feed
        </button>
      </div>
    );
  }

  const isOwnProfile = user && user.uid === profile.uid;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Profile picture size must be under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName.trim() || displayName.trim().length < 3) {
      setError("Display Name must be at least 3 characters.");
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await dbService.saveUserProfile(profile.uid, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        city: city.trim(),
        photoURL: photoURL // Save Base64 image
      });
      
      setProfile(updated);
      setEditModalOpen(false);
      
      // Sync global state
      await refreshProfile();
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const pStyle = getAvatarColor(profile.uid);
  const initials = profile.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in text-left pb-10">
      
      {/* 1. Header Profile Banner card */}
      <div className="border border-border-tertiary bg-bg-primary rounded-xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar Icon */}
          <div 
            onClick={isOwnProfile ? () => setEditModalOpen(true) : undefined}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 border border-border-tertiary select-none overflow-hidden relative ${
              isOwnProfile ? "cursor-pointer group/avatar" : ""
            }`}
            style={!profile.photoURL ? { backgroundColor: pStyle.bg, color: pStyle.text } : undefined}
          >
            {profile.photoURL ? (
              <img 
                src={profile.photoURL} 
                alt={profile.displayName} 
                className="w-full h-full object-cover" 
              />
            ) : (
              initials
            )}
            
            {isOwnProfile && (
              <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition duration-150 select-none">
                📷 Change
              </div>
            )}
          </div>

          {/* Name Tags */}
          <div className="flex-1 min-w-[200px] text-left space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-txt-primary">
                {profile.displayName}
              </h2>
              {isOwnProfile && (
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-orange bg-brand-orange/5 border border-brand-orange/15 rounded py-0.5 px-2 hover:bg-brand-orange hover:text-white transition duration-150"
                >
                  <Edit2 size={10} /> Edit
                </button>
              )}
            </div>
            
            <p className="text-xs text-txt-secondary font-semibold">@{profile.username}</p>
            
            {/* Bio text */}
            <p className="text-xs text-txt-secondary leading-relaxed pt-1.5 max-w-lg">
              {profile.bio || "No bio added yet. An explorer identifying local startup blocks and DSA challenges."}
            </p>
          </div>
        </div>

        {/* Location & Join Date bar */}
        <div className="pt-4 border-t border-border-tertiary/60 flex flex-wrap gap-4 text-xs text-txt-tertiary font-semibold">
          {profile.city && (
            <span className="flex items-center gap-1">
              <MapPin size={13} className="text-brand-orange" />
              <span>Based in: <span className="text-txt-secondary">{profile.city}</span></span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={13} />
            <span>Joined: <span className="text-txt-secondary">{new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span></span>
          </span>
        </div>
      </div>

      {/* 2. STATS CARDS PANEL */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Posts Created", val: stats.postsCount, icon: BookOpen },
          { label: "Gangs Joined", val: stats.gangsCount, icon: Users },
          { label: "Same Problems", val: stats.sameProblemsGiven, icon: MessageSquare },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="border border-border-tertiary bg-bg-secondary/40 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Icon size={14} className="text-txt-tertiary mb-1" />
              <span className="text-sm sm:text-base font-bold text-txt-primary">{stat.val}</span>
              <span className="text-[10px] text-txt-secondary font-medium tracking-wide">{stat.label}</span>
            </div>
          );
        })}
      </div>

      {/* MOBILE EXPLORE & SPACES HUB - Beautifully organised like modern Reddit/Quora dashboard! */}
      <div className="flex flex-col sm:hidden gap-5 border border-border-tertiary bg-bg-primary rounded-xl p-5 shadow-sm select-none">
        
        {/* Hub Categories Section */}
        <div>
          <h4 className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase mb-2 px-1">
            Feeds & Categories
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Home", href: "/", icon: "🏠" },
              { label: "Trending", href: "/?tab=trending", icon: "🔥" },
              { label: "Popular", href: "/?tab=popular", icon: "✨" }
            ].map((feed) => (
              <Link
                key={feed.label}
                href={feed.href}
                className="flex flex-col items-center justify-center gap-1 p-2 bg-bg-secondary border border-border-tertiary rounded-xl hover:border-brand-orange hover:bg-bg-primary transition text-center"
              >
                <span className="text-base">{feed.icon}</span>
                <span className="text-[10px] font-bold text-txt-primary">{feed.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Hub Spaces Section */}
        <div className="border-t border-border-tertiary/40 pt-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <h4 className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase">
              Spaces & Communities
            </h4>
            <button
              onClick={() => setShowCreateSpaceModal(true)}
              className="text-[10px] font-bold text-brand-orange hover:underline uppercase"
            >
              + Create
            </button>
          </div>

          {spaces.length === 0 ? (
            <div className="p-3 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/10">
              <span className="text-[10px] text-txt-secondary">No spaces created yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto no-scrollbar">
              {spaces.map((sp) => (
                <Link
                  key={sp.id}
                  href={sp.href}
                  className="flex items-center gap-2 p-2 bg-bg-secondary border border-border-tertiary rounded-lg hover:border-brand-orange transition text-left truncate"
                >
                  <span className="text-xs shrink-0 text-brand-orange font-bold">g/</span>
                  <span className="text-[11px] font-semibold text-txt-primary truncate">{sp.label.replace("g/", "")}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Saved & Support Section */}
        <div className="border-t border-border-tertiary/40 pt-4 grid grid-cols-2 gap-4">
          
          {/* Saved Categories Hub */}
          <div>
            <h4 className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase mb-2 px-1">
              Saved Bookmarks
            </h4>
            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto no-scrollbar">
              {bookmarks.length === 0 ? (
                <div className="p-2 text-center rounded bg-bg-secondary/20 border border-dashed border-border-tertiary">
                  <span className="text-[9px] text-txt-tertiary">No saves cataloged yet.</span>
                </div>
              ) : (
                bookmarks.map((bm) => (
                  <Link
                    key={bm.label}
                    href={bm.href}
                    className="flex items-center justify-between text-[10px] px-2 py-1 bg-bg-secondary hover:bg-bg-primary rounded border border-border-tertiary transition truncate"
                  >
                    <span className="font-semibold truncate">📁 {bm.label}</span>
                    <span className="text-[9px] text-brand-orange font-bold">({bm.count})</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick Settings & Help */}
          <div>
            <h4 className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase mb-2 px-1">
              App Settings & Support
            </h4>
            <div className="flex flex-col gap-1 text-[10px] font-semibold text-txt-secondary">
              <button 
                onClick={() => setEditModalOpen(true)}
                className="flex items-center gap-1.5 p-1.5 hover:bg-bg-secondary hover:text-txt-primary rounded transition text-left"
              >
                ⚙️ Edit Account Settings
              </button>
              <div 
                onClick={() => alert("Language: English (US)")}
                className="flex items-center gap-1.5 p-1.5 hover:bg-bg-secondary hover:text-txt-primary rounded transition cursor-pointer select-none"
              >
                🌐 Language: English
              </div>
              <div 
                onClick={() => alert("Help Center, About, and support channels are coming soon!")}
                className="flex items-center gap-1.5 p-1.5 hover:bg-bg-secondary hover:text-txt-primary rounded transition cursor-pointer select-none"
              >
                ❓ Support & Help Desk
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Create Space Mobile Modal */}
      {showCreateSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in text-left">
          <form 
            onSubmit={handleMobileCreateSpace} 
            className="w-full max-w-sm bg-bg-primary border border-border-tertiary rounded-xl shadow-2xl p-6 text-txt-primary"
          >
            <h3 className="text-sm font-bold mb-1">Create a new Space</h3>
            <p className="text-xs text-txt-tertiary mb-4 leading-relaxed">
              Create a custom community space where users can submit and vote on problems, ideas, or lessons.
            </p>
            <div className="space-y-3.5 mb-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-txt-tertiary mb-1 select-none">Space Name</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-brand-orange">g/</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FintechIndia"
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    className="w-full h-9 pl-7 pr-3 bg-bg-secondary border border-border-tertiary text-txt-primary rounded-lg text-xs font-semibold outline-none focus:border-brand-orange transition"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowCreateSpaceModal(false); setNewSpaceName(""); }}
                className="text-xs font-semibold px-3 py-2 text-txt-secondary hover:bg-bg-secondary rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs font-bold px-4 py-2 bg-brand-orange text-white hover:bg-brand-orangeHover rounded-lg shadow-sm transition"
              >
                Create Space
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TABS SELECTOR & FEED */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col gap-4">
        
        {/* Tab switcher */}
        <div className="border-b border-border-tertiary flex overflow-x-auto no-scrollbar gap-5">
          {[
            { id: "posts", label: "their posts" },
            { id: "comments", label: "their comments" },
            { id: "gangs", label: "gangs in" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider relative transition duration-150 ${
                  isActive ? "text-brand-orange" : "text-txt-secondary hover:text-txt-primary"
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content stream */}
        <div className="flex flex-col gap-1">
          {loadingTabData ? (
            <div className="space-y-4 pt-1">
              {[1, 2].map((n) => (
                <div key={n} className="h-28 border border-border-tertiary bg-bg-secondary/40 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : activeTab === "posts" ? (
            // POSTS TAB
            userPosts.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/20">
                <Compass size={32} className="text-txt-tertiary mx-auto mb-2.5 animate-pulse" />
                <span className="text-xs text-txt-secondary">No public posts written by this user.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {userPosts.map((post) => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    onPostUpdate={(updated) => setUserPosts(prev => prev.map(p => p.id === updated.id ? updated : p))} 
                  />
                ))}
              </div>
            )
          ) : activeTab === "comments" ? (
            // COMMENTS SNIPPETS TAB
            userComments.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/20">
                <MessageSquare size={32} className="text-txt-tertiary mx-auto mb-2.5" />
                <span className="text-xs text-txt-secondary">No discussion comments written by this user.</span>
              </div>
            ) : (
              <div className="space-y-3.5">
                {userComments.map((comment) => (
                  <Link 
                    key={comment.id}
                    href={`/post/${comment.postId}`}
                    className="group border border-border-tertiary bg-bg-primary hover:bg-bg-secondary/30 rounded-xl p-4 block text-left shadow-sm transition duration-150"
                  >
                    <div className="flex items-center justify-between text-[10px] text-txt-tertiary font-semibold mb-1.5">
                      <span>Comment snippet in thread</span>
                      <span>{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-txt-secondary leading-relaxed line-clamp-2 italic mb-2.5 group-hover:text-txt-primary transition-colors">
                      &ldquo;{comment.body}&rdquo;
                    </p>
                    <span className="text-[10px] font-bold text-brand-orange inline-flex items-center gap-1">
                      View full thread discussion <ArrowRight size={10} />
                    </span>
                  </Link>
                ))}
              </div>
            )
          ) : (
            // GANGS JOINED TAB
            userGangs.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/20">
                <Users size={32} className="text-txt-tertiary mx-auto mb-2.5" />
                <span className="text-xs text-txt-secondary">This user hasn&apos;t joined any gangs yet.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {userGangs.map((gang) => (
                  <Link
                    key={gang.id}
                    href={`/gangs/${gang.id}`}
                    className="border border-border-tertiary hover:border-txt-secondary bg-bg-primary hover:bg-bg-secondary/30 rounded-xl p-4 shadow-sm transition duration-150 flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-txt-primary flex items-center gap-1.5 mb-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: gang.color }} />
                        g/{gang.name}
                      </h4>
                      <p className="text-[11px] text-txt-secondary leading-relaxed line-clamp-2">
                        {gang.description}
                      </p>
                    </div>
                    <div className="text-[9px] text-txt-tertiary pt-2 mt-2 border-t border-border-tertiary/20 font-semibold">
                      {gang.memberCount} members
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>

      </div>

      {/* EDIT PROFILE MODAL (OWN PROFILE) */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form 
            onSubmit={handleEditProfileSubmit}
            className="w-full max-w-md rounded-xl border border-border-tertiary bg-bg-primary shadow-2xl p-6 text-left max-h-[90vh] overflow-y-auto"
          >
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 border-b border-border-tertiary pb-2.5">
              <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5">
                <Edit2 size={16} className="text-brand-orange" />
                Edit Profile Dashboard
              </h3>
              <button 
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-bg-secondary transition"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-2.5 rounded-md mb-4">
                <span>{error}</span>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-4">
              {/* Profile Photo Uploader Section */}
              <div className="flex items-center gap-4 border-b border-border-tertiary/40 pb-4 mb-2">
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 border border-border-tertiary select-none overflow-hidden bg-bg-secondary"
                >
                  {photoURL ? (
                    <img 
                      src={photoURL} 
                      alt="Profile preview" 
                      className="w-full h-full object-cover animate-fade-in" 
                    />
                  ) : (
                    initials
                  )}
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary select-none">
                    Profile Picture
                  </label>
                  <div className="flex gap-2">
                    <label 
                      className="cursor-pointer text-[10px] font-bold uppercase tracking-wider bg-brand-orange hover:bg-brand-orangeHover text-white py-1.5 px-3 rounded-lg transition shadow-sm select-none"
                    >
                      Choose Photo
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    {photoURL && (
                      <button
                        type="button"
                        onClick={() => setPhotoURL("")}
                        className="text-[10px] font-bold uppercase tracking-wider bg-transparent hover:bg-red-500/10 border border-red-500/20 text-red-500 py-1.5 px-3 rounded-lg transition select-none"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <span className="text-[9px] text-txt-tertiary select-none">JPG, PNG or WEBP (Max 2MB)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                  Display Name
                </label>
                <input 
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-xs font-semibold outline-none focus:border-txt-secondary transition"
                  placeholder="e.g. Rahul Kumar"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                  Short Bio
                </label>
                <textarea 
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-xs outline-none focus:border-txt-secondary transition resize-none leading-relaxed"
                  placeholder="Tell others what you do or what you are building..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                  Current City (Tech Hub)
                </label>
                <input 
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-xs font-semibold outline-none focus:border-txt-secondary transition"
                  placeholder="e.g. Bangalore, Bhopal, Delhi"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 justify-end mt-6 pt-3 border-t border-border-tertiary/50">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-xs font-semibold px-3 py-2 text-txt-secondary hover:bg-bg-secondary rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="text-xs font-semibold px-4.5 py-2 bg-brand-orange hover:bg-brand-orangeHover text-white rounded-md shadow-md disabled:opacity-50 transition"
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
