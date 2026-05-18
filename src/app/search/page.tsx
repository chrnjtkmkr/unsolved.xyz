"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { dbService, Post, Gang, UserProfile } from "@/lib/firebase";
import PostCard from "@/components/PostCard";
import { getAvatarColor } from "@/lib/utils";
import Link from "next/link";
import { 
  Search as SearchIcon, 
  BookOpen, 
  Users, 
  User, 
  Compass, 
  ArrowRight 
} from "lucide-react";

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-txt-secondary font-semibold">Loading search...</span>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  // Search States
  const [queryVal, setQueryVal] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<"posts" | "gangs" | "people">("posts");
  const [loading, setLoading] = useState(false);

  // Search Results
  const [postsResults, setPostsResults] = useState<Post[]>([]);
  const [gangsResults, setGangsResults] = useState<Gang[]>([]);
  const [peopleResults, setPeopleResults] = useState<UserProfile[]>([]);

  const triggerSearch = async (term: string) => {
    if (!term.trim()) {
      setPostsResults([]);
      setGangsResults([]);
      setPeopleResults([]);
      return;
    }

    setLoading(true);
    const cleanTerm = term.toLowerCase().trim();
    try {
      // 1. Search Posts
      const postsRes = await dbService.getPosts({ searchQuery: cleanTerm, pageSize: 30 });
      setPostsResults(postsRes.posts);

      // 2. Search Gangs
      const allGangs = await dbService.getGangs();
      const matchedGangs = allGangs.filter(
        g => g.name.toLowerCase().includes(cleanTerm) || 
             g.description.toLowerCase().includes(cleanTerm)
      );
      setGangsResults(matchedGangs);

      // 3. Search People
      if (typeof window !== "undefined") {
        const allUsersObj = JSON.parse(localStorage.getItem("unsolved_users") || "{}");
        const matchedUsers = Object.values(allUsersObj).filter(
          (u: any) => u.displayName.toLowerCase().includes(cleanTerm) || 
                      u.username.toLowerCase().includes(cleanTerm) ||
                      (u.bio && u.bio.toLowerCase().includes(cleanTerm))
        ) as UserProfile[];
        setPeopleResults(matchedUsers);
      }
    } catch (e) {
      console.error("Search operations failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Sync state if URL query changes
  useEffect(() => {
    setQueryVal(initialQuery);
    triggerSearch(initialQuery);
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(queryVal.trim())}`);
  };

  return (
    <div className="w-full flex flex-col gap-5 animate-fade-in text-left pb-10">
      
      {/* 1. Header Search Form */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-txt-primary flex items-center gap-2">
          <SearchIcon size={18} className="text-brand-orange" />
          Explore Unsolved
        </h2>
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <input
            type="search"
            required
            value={queryVal}
            onChange={(e) => setQueryVal(e.target.value)}
            placeholder="Type problems, startup ideas, gangs, developers..."
            className="w-full h-11 pl-11 pr-4 text-xs sm:text-sm bg-bg-secondary text-txt-primary placeholder:text-txt-tertiary border border-border-tertiary rounded-md focus:outline-none focus:border-txt-secondary transition font-semibold"
          />
          <SearchIcon size={16} className="absolute left-3.5 top-3.5 text-txt-tertiary" />
        </form>
      </div>

      {/* 2. Results Tabs Selectors */}
      <div className="border-b border-border-tertiary flex gap-4">
        {[
          { id: "posts", label: "posts", count: postsResults.length, icon: BookOpen },
          { id: "gangs", label: "gangs", count: gangsResults.length, icon: Users },
          { id: "people", label: "people", count: peopleResults.length, icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 pb-2 text-xs font-semibold uppercase tracking-wider relative transition duration-150 ${
                isActive ? "text-brand-orange font-bold" : "text-txt-secondary hover:text-txt-primary"
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {queryVal.trim() && (
                <span className="text-[10px] bg-bg-secondary border border-border-tertiary rounded px-1 text-txt-secondary">
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Search Results stream */}
      <div className="flex flex-col gap-1">
        {loading ? (
          <div className="space-y-4 py-2 animate-pulse">
            {[1, 2].map((n) => (
              <div key={n} className="h-24 bg-bg-secondary/40 border border-border-tertiary rounded-xl"></div>
            ))}
          </div>
        ) : !queryVal.trim() ? (
          // Welcome default search state
          <div className="py-16 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/10">
            <Compass size={36} className="text-txt-tertiary mx-auto mb-3 animate-pulse" />
            <h4 className="text-xs font-bold text-txt-primary">Search community archives</h4>
            <p className="text-[11px] text-txt-secondary max-w-xs mx-auto leading-relaxed mt-1">
              Type a keyword on top to look up deep cold-storage MP farming problems, recursive software algorithms, or niche builder directories!
            </p>
          </div>
        ) : activeTab === "posts" ? (
          // POSTS SEARCH STREAM
          postsResults.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/10">
              <span className="text-xs text-txt-secondary">No matching posts found. Try another search query.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {postsResults.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post}
                  onPostUpdate={(updated) => setPostsResults(prev => prev.map(p => p.id === updated.id ? updated : p))}
                />
              ))}
            </div>
          )
        ) : activeTab === "gangs" ? (
          // GANGS SEARCH STREAM
          gangsResults.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/10">
              <span className="text-xs text-txt-secondary">No matching gangs found. Try another search query.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gangsResults.map((gang) => (
                <Link
                  key={gang.id}
                  href={`/gangs/${gang.id}`}
                  className="group border border-border-tertiary hover:border-txt-secondary bg-bg-primary hover:bg-bg-secondary/30 rounded-xl p-4.5 shadow-sm transition duration-150 flex flex-col justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-txt-primary flex items-center gap-1.5 mb-1.5 group-hover:text-brand-orange transition-colors">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: gang.color }} />
                      g/{gang.name}
                    </h4>
                    <p className="text-[11px] text-txt-secondary leading-relaxed line-clamp-2">
                      {gang.description}
                    </p>
                  </div>
                  <div className="text-[9px] text-txt-tertiary pt-2 mt-3 border-t border-border-tertiary/20 font-semibold flex items-center justify-between">
                    <span>{gang.memberCount} members</span>
                    <span className="text-brand-orange hover:underline inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      visit <ArrowRight size={10} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          // PEOPLE SEARCH STREAM
          peopleResults.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/10">
              <span className="text-xs text-txt-secondary">No matching people profiles found. Try another search query.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {peopleResults.map((p) => {
                const pStyle = getAvatarColor(p.uid);
                const initials = p.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <Link
                    key={p.uid}
                    href={`/profile/${p.username}`}
                    className="group border border-border-tertiary hover:border-txt-secondary bg-bg-primary hover:bg-bg-secondary/30 rounded-xl p-4 flex gap-3 shadow-sm transition duration-150 text-left items-start"
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border border-border-tertiary"
                      style={{ backgroundColor: pStyle.bg, color: pStyle.text }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-txt-primary truncate group-hover:text-brand-orange transition-colors">
                        {p.displayName}
                      </h4>
                      <p className="text-[10px] text-txt-secondary font-medium">@{p.username}</p>
                      <p className="text-[11px] text-txt-secondary line-clamp-2 mt-1 font-medium leading-relaxed">
                        {p.bio || "Community developer exploring problems."}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}
      </div>

    </div>
  );
}
