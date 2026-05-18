"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "next-themes";
import { dbService } from "@/lib/firebase";
import { getAvatarColor } from "@/lib/utils";
import LoginModal from "./LoginModal";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { 
  Home, 
  Search, 
  PlusSquare, 
  MessageSquare, 
  User, 
  Sun, 
  Moon, 
  Plus, 
  MessageCircle,
  Bell,
  LogOut,
  Users,
  TrendingUp,
  Flame,
  Bookmark,
  Settings,
  Globe
} from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, setShowLoginModal, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [searchVal, setSearchVal] = useState("");
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Responsive Sidebar States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Restructured Sidebar States
  const [activeCategory, setActiveCategory] = useState("home");
  
  // Dynamic stateful Spaces list
  const [spaces, setSpaces] = useState([
    { id: "rural-startups", label: "g/RuralStartups", href: "/gangs/rural-startups" },
    { id: "learning-dsa", label: "g/LearningDSA", href: "/gangs/learning-dsa" },
    { id: "ai-builders", label: "g/AIBuilders", href: "/gangs/ai-builders" }
  ]);

  // Dynamic stateful bookmarks grouped by category
  const [bookmarks, setBookmarks] = useState<{ label: string; href: string }[]>([]);

  // Function to load and group saved posts from LocalStorage category-wise
  const loadDynamicSaves = () => {
    if (typeof window !== "undefined") {
      const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
      const savedData = JSON.parse(savedDataStr);
      
      // Extract unique categories
      const categoriesSet = new Set<string>();
      Object.values(savedData).forEach((item: any) => {
        if (item.category) {
          categoriesSet.add(item.category);
        }
      });
      
      // Map categories to beautiful sidebar list items with item counts!
      const listItems = Array.from(categoriesSet).map((catName) => {
        const count = Object.values(savedData).filter((item: any) => item.category === catName).length;
        return {
          label: `${catName} Saves (${count})`,
          href: `/search?q=${encodeURIComponent(catName)}`
        };
      });
      
      // Fallback state if no bookmarks exist yet
      if (listItems.length === 0) {
        setBookmarks([
          { label: "Save posts to see categories!", href: "#" }
        ]);
      } else {
        setBookmarks(listItems);
      }
    }
  };

  useEffect(() => {
    loadDynamicSaves();

    // Listen to custom cross-component sync event
    window.addEventListener("unsolved_saves_updated", loadDynamicSaves);
    return () => {
      window.removeEventListener("unsolved_saves_updated", loadDynamicSaves);
    };
  }, []);

  // Create Space modal states
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");

  const handleCreateSpaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (newSpaceName.trim()) {
      const spaceSlug = newSpaceName.trim().toLowerCase();
      const newSpace = {
        id: spaceSlug,
        label: `g/${newSpaceName.trim()}`,
        href: `/gangs/${spaceSlug}`
      };
      setSpaces(prev => [...prev, newSpace]);
      setNewSpaceName("");
      setNewSpaceDesc("");
      setShowCreateSpaceModal(false);
      alert(`Success! g/${newSpaceName.trim()} space created dynamically in your sidebar.`);
    }
  };

  // Sync active category tab with URL query parameters
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.search.includes("tab=trending")) {
        setActiveCategory("trending");
      } else if (window.location.search.includes("tab=popular")) {
        setActiveCategory("popular");
      } else if (pathname === "/") {
        setActiveCategory("home");
      } else {
        setActiveCategory("");
      }
    }
  }, [pathname, typeof window !== "undefined" ? window.location.search : ""]);

  // Sidebar categories config
  const categories = [
    { label: "Home", href: "/", icon: Home, active: activeCategory === "home" },
    { label: "Trending", href: "/?tab=trending", icon: TrendingUp, active: activeCategory === "trending" },
    { label: "Popular", href: "/?tab=popular", icon: Flame, active: activeCategory === "popular" }
  ];

  // Sync real-time unread message counts
  useEffect(() => {
    if (!user) {
      setUnreadMsgCount(0);
      return;
    }

    const unsubscribe = dbService.listenConversations(user.uid, (conversations) => {
      const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
      setUnreadMsgCount(totalUnread);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync real-time notification counts
  useEffect(() => {
    if (!user) {
      setUnreadNotifCount(0);
      return;
    }

    const unsubscribe = dbService.listenNotifications(user.uid, (notifications) => {
      const totalUnread = notifications.filter(n => !n.read).length;
      setUnreadNotifCount(totalUnread);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleWriteClick = () => {
    if (!user) {
      setShowLoginModal(true);
    } else {
      router.push("/write");
    }
  };

  const toggleSidebar = () => {
    if (window.innerWidth > 992) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setMobileSidebarOpen(!mobileSidebarOpen);
    }
  };

  // Profile Avatar Color & Initials
  const avatarInitials = profile?.displayName
    ? profile.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";
  const avatarColor = getAvatarColor(profile?.username || "");

  return (
    <div className="min-h-screen bg-bg-primary text-txt-primary flex flex-col font-sans transition-colors duration-200 pb-16 sm:pb-0">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full bg-[#0b0f12] sm:bg-bg-primary border-b border-zinc-900 sm:border-border-secondary">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          
          {/* Logo & Menu Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={toggleSidebar}
              className="p-2 rounded-full border border-border-tertiary text-txt-secondary hover:text-txt-primary hover:border-txt-secondary transition shrink-0 hidden sm:flex lg:hidden items-center justify-center w-9 h-9"
              aria-label="Toggle Navigation Drawer"
            >
              <span className="text-xs font-bold leading-none select-none">☰</span>
            </button>
            <Link href="/" className="logo text-xl font-bold tracking-tight text-white select-none">
              unsolved
            </Link>
          </div>
 
          {/* Perfectly Centered Search Bar (Desktop Only) */}
          <div className="hidden sm:block flex-grow max-w-[380px] mx-auto">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="search"
                placeholder="Search problems, ideas, gangs, people..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="w-full h-9 pl-4 pr-10 text-xs bg-bg-secondary text-txt-primary placeholder:text-txt-tertiary border border-border-tertiary rounded-full focus:outline-none focus:border-txt-secondary focus:ring-1 focus:ring-brand-orange/40 transition-all duration-200"
              />
              <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-txt-tertiary pointer-events-none" />
            </form>
          </div>
 
          {/* Mobile Action Buttons (Search & Plus Post) - Matches Prototype HTML exactly! */}
          <div className="flex sm:hidden items-center gap-3 shrink-0 ml-auto select-none">
            <Link href="/search" className="text-zinc-400 hover:text-white p-1">
              <Search size={20} />
            </Link>
            <button
              onClick={handleWriteClick}
              className="bg-[#FF4500] text-white p-2 rounded-full hover:bg-orange-600 transition-colors flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0"
              aria-label="Create Post"
              title="Create Post"
            >
              <Plus size={20} className="stroke-[3]" />
            </button>
          </div>

          {/* Right Action Icons Group */}
          <div className="flex items-center gap-3 shrink-0">

            <div className="hidden sm:flex items-center gap-3 text-txt-secondary">
              {/* Notifications (Bell) */}
              {user && (
                <Link 
                  href="/notifications" 
                  className={`relative p-2 rounded-full hover:bg-bg-secondary transition hover:text-txt-primary ${pathname === "/notifications" ? "text-brand-orange" : ""} hidden sm:inline-flex`}
                  aria-label="Notifications Log"
                >
                  <Bell size={18} />
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#cc4343] text-white text-[9px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center">
                      {unreadNotifCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Direct Messages (Chat Bubble) */}
              <Link 
                href={user ? "/messages" : "#"} 
                onClick={(e) => {
                  if (!user) {
                    e.preventDefault();
                    setShowLoginModal(true);
                  }
                }}
                className={`relative p-2 rounded-full hover:bg-bg-secondary transition hover:text-txt-primary ${pathname === "/messages" ? "text-brand-orange" : ""} hidden sm:inline-flex`}
                aria-label="Chats Portal"
              >
                <MessageCircle size={18} />
                {unreadMsgCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#cc4343] text-white text-[9px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center">
                    {unreadMsgCount}
                  </span>
                )}
              </Link>

              {/* Dark/Light Switcher */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-bg-secondary transition hover:text-txt-primary"
                aria-label="Toggle Brightness Theme"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>

            {/* Create Post CTA Pill - Upgraded layout shape, padding, colors & height */}
            <button
              onClick={handleWriteClick}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 bg-brand-orange hover:bg-brand-orangeHover text-white px-5 h-9 rounded-full text-xs font-bold transition shadow-sm shrink-0"
            >
              <span>+</span> post
            </button>

            {/* Profile Menu Trigger - Standardized heights and alignment */}
            {user ? (
              <div className="hidden sm:flex items-center gap-2 select-none shrink-0 border-l border-border-secondary pl-3">
                <Link
                  href={`/profile/${profile?.username || "unknown"}`}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border border-border-tertiary overflow-hidden transition hover:scale-105"
                  style={!profile?.photoURL ? { backgroundColor: avatarColor.bg, color: avatarColor.text } : undefined}
                >
                  {profile?.photoURL ? (
                    <img 
                      src={profile.photoURL} 
                      alt={profile.displayName || "User Profile"} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    avatarInitials
                  )}
                </Link>
                <button
                  onClick={logout}
                  className="hidden md:inline-flex p-2 rounded-full text-txt-tertiary hover:text-red-500 hover:bg-bg-secondary transition"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="hidden sm:flex text-xs font-bold px-5 h-9 border border-border-tertiary bg-bg-secondary text-txt-primary rounded-full hover:bg-bg-primary hover:border-txt-secondary transition shrink-0 items-center justify-center"
              >
                sign in
              </button>
            )}


          </div>
        </div>
      </header>

      {/* Responsive Three-Column Workspace Grid */}
      <div className="max-w-[1440px] w-full mx-auto flex-1 flex relative">
        
        {/* Backdrop for mobile active sidebar */}
        {mobileSidebarOpen && (
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm hidden sm:block lg:hidden animate-fade-in"
          />
        )}

        {/* 1. LEFT SIDEBAR PANEL: Categories, Groups/Gangs, and Info */}
        <aside 
          className={`
            shrink-0 h-[calc(100vh-3.5rem)] bg-bg-primary text-left transition-all duration-300 ease-in-out border-r border-border-secondary flex-col justify-between p-4.5 hidden sm:flex
            ${sidebarOpen ? "w-[240px]" : "w-[70px]"}
            ${mobileSidebarOpen ? "translate-x-0 flex" : "-translate-x-full sm:hidden"}
            lg:translate-x-0 lg:flex lg:sticky lg:z-10 lg:shadow-none
            fixed z-40 left-0 top-14 shadow-2xl
          `}
        >  
          
          {/* Absolutely Positioned Partition border line menu toggle button */}
          <button
            onClick={toggleSidebar}
            className="absolute top-[28px] right-0 translate-x-1/2 z-40 w-9 h-9 rounded-full border border-border-tertiary bg-bg-secondary text-txt-secondary hover:text-txt-primary hover:border-txt-secondary hover:scale-105 shadow-md transition-all duration-150 hidden lg:flex items-center justify-center"
            title={sidebarOpen ? "Collapse Navigation Drawer" : "Expand Navigation Drawer"}
          >
            <span className="text-xs font-bold leading-none select-none">☰</span>
          </button>

          {/* Fade-out container to leave narrow sidebar completely empty and blank when collapsed */}
          <div className={`flex flex-col justify-between h-full w-full transition-all duration-200 ${sidebarOpen ? "opacity-100 px-0" : "opacity-0 invisible pointer-events-none"}`}>
            
            {/* Top Navigation Stream (Categories, Spaces, Bookmarks) */}
            <div className="flex flex-col gap-6 overflow-y-auto no-scrollbar pr-1">
              
              {/* SECTION A: CATEGORIES */}
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase mb-1.5 px-3 select-none">
                  Feeds & Categories
                </div>
                {categories.map((cat, idx) => {
                  const Icon = cat.icon;
                  return (
                    <Link
                      key={idx}
                      href={cat.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={`
                        w-full flex items-center justify-start gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border border-transparent
                        ${cat.active 
                          ? "bg-bg-secondary text-brand-orange font-bold border-border-tertiary shadow-sm" 
                          : "text-txt-secondary hover:text-txt-primary hover:bg-bg-secondary/40"}
                      `}
                    >
                      <Icon size={16} className={`shrink-0 ${cat.active ? "text-brand-orange" : ""}`} />
                      <span className="truncate">{cat.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* SECTION B: SPACES / COMMUNITIES */}
              <div className="flex flex-col gap-1 border-t border-border-secondary/30 pt-4">
                <div className="flex items-center justify-between mb-1.5 px-3 select-none">
                  <span className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase">Spaces</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {spaces.map((sp, idx) => (
                    <Link
                      key={idx}
                      href={sp.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-txt-secondary hover:text-txt-primary hover:bg-bg-secondary/40 transition truncate"
                    >
                      <span className="text-brand-orange font-bold">g/</span>
                      <span className="truncate">{sp.label.replace("g/", "")}</span>
                    </Link>
                  ))}
                  
                  {/* Create Space CTA Button */}
                  <button
                    onClick={() => setShowCreateSpaceModal(true)}
                    className="w-full mt-1.5 border border-dashed border-border-tertiary hover:border-brand-orange text-txt-secondary hover:text-brand-orange rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition bg-transparent"
                  >
                    <Plus size={14} className="shrink-0" />
                    <span>Create a Space</span>
                  </button>
                </div>
              </div>

              {/* SECTION C: SAVED / BOOKMARKS */}
              <div className="flex flex-col gap-1 border-t border-border-secondary/30 pt-4">
                <div className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase mb-1.5 px-3 select-none">
                  Bookmarks & Saved
                </div>
                <div className="flex flex-col gap-0.5">
                  {bookmarks.map((bm, idx) => (
                    <Link
                      key={idx}
                      href={bm.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-txt-secondary hover:text-txt-primary hover:bg-bg-secondary/40 transition truncate"
                    >
                      <Bookmark size={13} className="text-brand-orange shrink-0" />
                      <span className="truncate leading-relaxed">{bm.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>

            {/* Bottom Settings & Info Footer */}
            <div className="mt-auto pt-4 border-t border-border-secondary/30">
              <div className="flex flex-col gap-3">
                {/* Settings and Language links */}
                <div className="flex flex-col gap-2 px-1">
                  <button
                    onClick={() => alert("Settings panel coming soon!")}
                    className="flex items-center gap-2.5 text-xs text-txt-secondary hover:text-brand-orange transition font-semibold"
                  >
                    <Settings size={14} className="shrink-0 text-txt-tertiary" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => alert("Language: English (US)")}
                    className="flex items-center gap-2.5 text-xs text-txt-secondary hover:text-brand-orange transition font-semibold"
                  >
                    <Globe size={14} className="shrink-0 text-txt-tertiary" />
                    <span>Language: English</span>
                  </button>
                </div>

                {/* Reddit-style inline micro links */}
                <div className="flex flex-wrap gap-x-2 gap-y-1 px-1 text-[10px] text-txt-tertiary font-bold tracking-tight border-t border-border-secondary/10 pt-2.5">
                  <span onClick={() => alert("Help Center is coming soon!")} className="hover:text-txt-secondary cursor-pointer hover:underline transition">Help</span>
                  <span>•</span>
                  <span onClick={() => alert("unsolved — a community platform for builders to collaborate and validate ideas.")} className="hover:text-txt-secondary cursor-pointer hover:underline transition">About</span>
                  <span>•</span>
                  <span onClick={() => alert("Contact us at support@unsolved.xyz")} className="hover:text-txt-secondary cursor-pointer hover:underline transition">Contact Us</span>
                </div>
              </div>
            </div>

          </div>
        </aside>

        {/* 2. CENTER SECTION: Scrollable Main Content Stream */}
        <main className="flex-grow w-full max-w-[840px] px-0 sm:px-6 py-0 sm:py-6 mx-auto overflow-x-hidden min-h-[calc(100vh-3.5rem)] bg-[#0B0F12] sm:bg-transparent">
          {children}
        </main>

        {/* 3. RIGHT SIDEBAR PANEL: Stats widgets (Hidden under 1200px) */}
        <aside className="hidden xl:flex w-[280px] flex-col gap-6 py-6 px-4 bg-bg-primary border-l border-border-secondary shrink-0 text-left h-[calc(100vh-3.5rem)] sticky top-14">
          
          {/* Active Discussions Widget */}
          <div className="bg-bg-secondary border border-border-secondary rounded-xl p-5 shadow-sm">
            <div className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase mb-3 select-none">
              ACTIVE DISCUSSIONS
            </div>
            <ul className="space-y-3">
              {[
                { label: "AI startup ideas in India", q: "ai" },
                { label: "College founder networks", q: "founder" },
                { label: "Rural micro cold-storage model", q: "storage" }
              ].map((disc, idx) => (
                <li key={idx}>
                  <Link 
                    href={`/search?q=${disc.q}`}
                    className="text-xs font-semibold text-txt-secondary hover:text-txt-primary hover:text-brand-orange transition leading-relaxed block truncate"
                  >
                    #{disc.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform Stats Widget */}
          <div className="bg-bg-secondary border border-border-secondary rounded-xl p-5 shadow-sm">
            <div className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase mb-3 select-none">
              PLATFORM STATS
            </div>
            <div className="space-y-3">
              {[
                { label: "builders online", val: "12.4k" },
                { label: "problems today", val: "847" },
                { label: "ideas validated", val: "291" }
              ].map((stat, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-medium">
                  <span className="text-txt-secondary">{stat.label}</span>
                  <span className="text-txt-primary font-bold">{stat.val}</span>
                </div>
              ))}
            </div>
          </div>

        </aside>

      </div>

      {/* Mobile Bottom Navigation Bar (Visible under 640px) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-primary/95 backdrop-blur-md border-t border-border-secondary h-14 flex items-center justify-around px-4 shadow-lg">
        {/* Tab 1: Home */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${pathname === "/" ? "text-brand-orange" : "text-txt-secondary hover:text-txt-primary"}`}
        >
          <Home size={18} />
          <span>Home</span>
        </Link>

        {/* Tab 2: Chat */}
        <Link
          href={user ? "/messages" : "#"}
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              setShowLoginModal(true);
            }
          }}
          className={`relative flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${pathname === "/messages" ? "text-brand-orange" : "text-txt-secondary hover:text-txt-primary"}`}
        >
          <MessageSquare size={18} />
          {unreadMsgCount > 0 && (
            <span className="absolute top-0 right-1.5 bg-[#cc4343] text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-bg-primary">
              {unreadMsgCount}
            </span>
          )}
          <span>Chat</span>
        </Link>

        {/* Tab 3: Profile */}
        <Link
          href={user ? `/profile/${profile?.username || "unknown"}` : "#"}
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              setShowLoginModal(true);
            }
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition ${pathname.startsWith("/profile") ? "text-brand-orange" : "text-txt-secondary hover:text-txt-primary"}`}
        >
          <User size={18} />
          <span>{user ? "Profile" : "Sign In"}</span>
        </Link>
      </nav>

      {/* Create Space Modal */}
      {showCreateSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowCreateSpaceModal(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
          />
          <div className="bg-bg-secondary border border-border-tertiary w-full max-w-md rounded-2xl p-6 shadow-2xl z-10 animate-scale-up text-txt-primary">
            <h3 className="text-base font-bold mb-1">Create a New Space</h3>
            <p className="text-xs text-txt-tertiary mb-4">Launch your specialized builder community instantly.</p>
            
            <form onSubmit={handleCreateSpaceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">Space Name</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-txt-tertiary">g/</span>
                  <input
                    type="text"
                    required
                    placeholder="SaaSBuilders"
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                    className="w-full h-10 pl-7 pr-3 bg-bg-primary border border-border-tertiary rounded-xl text-xs focus:outline-none focus:border-brand-orange transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-txt-secondary mb-1.5">Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What is this community about?"
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  className="w-full p-3 bg-bg-primary border border-border-tertiary rounded-xl text-xs focus:outline-none focus:border-brand-orange transition resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSpaceModal(false)}
                  className="px-4 h-9 rounded-full border border-border-tertiary hover:bg-bg-primary text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 h-9 bg-brand-orange hover:bg-brand-orangeHover text-white text-xs font-bold rounded-full transition shadow-md"
                >
                  Create Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Unified Auth Modal */}
      <LoginModal />
    </div>
  );
}
