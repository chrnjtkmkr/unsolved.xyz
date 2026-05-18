"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { dbService, Post } from "@/lib/firebase";
import PostCard from "@/components/PostCard";
import { MapPin, Sparkles, Flame, RefreshCw, Compass } from "lucide-react";

export default function FeedPage() {
  const { user, profile, setShowLoginModal } = useAuth();
  
  // Tabs and filter states
  const [activeTab, setActiveTab] = useState<"for_you" | "trending" | "nearby">("for_you");
  const [selectedTypes, setSelectedTypes] = useState<("problem" | "idea" | "learning")[]>([]);
  
  // Posts collection states
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastPostId, setLastPostId] = useState<string | undefined>(undefined);
  
  // Geo states
  const [userCity, setUserCity] = useState<string>("");
  const [resolvingGeo, setResolvingGeo] = useState(false);
  const [geoPromptOpen, setGeoPromptOpen] = useState(false);
  const [customCity, setCustomCity] = useState("");

  // Load user city from profile if exists
  useEffect(() => {
    if (profile?.city) {
      setUserCity(profile.city);
    }
  }, [profile]);

  // Synchronize active tab with Left Sidebar category URL search parameters
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "trending") {
        setActiveTab("trending");
      } else if (tabParam === "popular") {
        setActiveTab("trending"); // Map popular to trending sort
      } else if (tabParam === "nearby") {
        setActiveTab("nearby");
      } else {
        setActiveTab("for_you");
      }
    }
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  // Load primary posts feed
  const fetchFeed = async (isAppend = false) => {
    if (!isAppend) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await dbService.getPosts({
        tab: activeTab === "for_you" ? "new" : activeTab,
        types: selectedTypes,
        city: activeTab === "nearby" ? userCity || "Bangalore" : undefined,
        uid: user?.uid,
        startAfterId: isAppend ? lastPostId : undefined,
        pageSize: 6
      });

      if (isAppend) {
        setPosts(prev => [...prev, ...result.posts]);
      } else {
        setPosts(result.posts);
      }
      setHasMore(result.hasMore);
      
      if (result.posts.length > 0) {
        setLastPostId(result.posts[result.posts.length - 1].id);
      } else {
        setLastPostId(undefined);
      }
    } catch (e) {
      console.error("Error loading feed posts:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Reload feed on filter or tab change
  useEffect(() => {
    // If nearby clicked but we have no city, resolve location first
    if (activeTab === "nearby" && !userCity) {
      handleGeoResolution();
    } else {
      fetchFeed(false);
    }
  }, [activeTab, selectedTypes, userCity]);

  // Trigger geo-location lookup
  const handleGeoResolution = () => {
    if (!navigator.geolocation) {
      setUserCity("Bangalore"); // fallback
      return;
    }

    setResolvingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // Fast mock geocoder representing major Indian startup hubs
        const hubs = ["Bangalore", "Bhopal", "Delhi", "Mumbai", "Pune", "Hyderabad"];
        const randomHub = hubs[Math.floor(Math.random() * hubs.length)];
        
        // Try fetching city name using openstreetmap reverse geocode
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
          );
          const data = await res.json();
          const resolvedCity = data.address.city || data.address.state_district || data.address.state || randomHub;
          
          setUserCity(resolvedCity);
          setCustomCity(resolvedCity);
          
          // Save back to Firestore profile
          if (user?.uid) {
            await dbService.saveUserProfile(user.uid, { city: resolvedCity });
          }
        } catch (e) {
          // fallback to random Indian city if API fails
          setUserCity(randomHub);
          setCustomCity(randomHub);
        } finally {
          setResolvingGeo(false);
        }
      },
      (error) => {
        // Permission denied or failed: open manual city prompt modal
        setResolvingGeo(false);
        setGeoPromptOpen(true);
      }
    );
  };

  const handleManualCitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customCity.trim()) {
      const cityClean = customCity.trim();
      setUserCity(cityClean);
      setGeoPromptOpen(false);
      if (user?.uid) {
        await dbService.saveUserProfile(user.uid, { city: cityClean });
      }
    }
  };

  const toggleTypeFilter = (type: "problem" | "idea" | "learning") => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handlePostUpdate = (updatedPost: Post) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  return (
    <div className="w-full flex flex-col gap-4 animate-fade-in">
      


      {/* 2. Horizontal Filter Pills - Desktop View */}
      <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {[
          { id: "problem", label: "problems" },
          { id: "idea", label: "ideas" },
          { id: "learning", label: "learning" },
        ].map((pill) => {
          const isSelected = selectedTypes.includes(pill.id as any);
          return (
            <button
              key={pill.id}
              onClick={() => toggleTypeFilter(pill.id as any)}
              className={`text-xs px-3.5 py-1.5 rounded-full border transition-all duration-150 shrink-0 font-semibold ${
                isSelected
                  ? "bg-txt-primary text-bg-primary border-transparent shadow-sm"
                  : "bg-bg-secondary border-border-secondary text-txt-secondary hover:border-txt-tertiary hover:text-txt-primary"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Mobile Horizontal Filter Pills - Matches Prototype exactly! */}
      <div className="flex sm:hidden gap-2 overflow-x-auto no-scrollbar py-3 px-4 bg-[#0B0F12] border-b border-zinc-900 select-none -mx-4 -mt-4 mb-1">
        <button
          onClick={() => setSelectedTypes(["problem", "idea", "learning"])}
          className={`px-4 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
            selectedTypes.length === 3 || selectedTypes.length === 0
              ? "bg-zinc-800 text-white"
              : "bg-zinc-900 text-zinc-400 border border-zinc-800"
          }`}
        >
          all
        </button>
        {[
          { id: "problem", label: "problems" },
          { id: "idea", label: "ideas" },
          { id: "learning", label: "learning" },
        ].map((pill) => {
          const isSelected = selectedTypes.length === 1 && selectedTypes[0] === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setSelectedTypes([pill.id as any])}
              className={`px-4 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors border ${
                isSelected
                  ? "bg-zinc-800 text-white border-transparent"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {pill.label}
            </button>
          );
        })}

        {/* Nearby Status Tracker */}
        {activeTab === "nearby" && userCity && (
          <div className="ml-auto text-[11px] text-txt-secondary flex items-center gap-1 bg-bg-secondary px-2.5 py-1 rounded-md border border-border-tertiary">
            <MapPin size={11} className="text-brand-orange" />
            <span>Nearby: <span className="font-semibold">{userCity}</span></span>
            <button 
              onClick={() => setGeoPromptOpen(true)}
              className="text-[10px] text-brand-orange hover:underline ml-1.5"
            >
              change
            </button>
          </div>
        )}
      </div>

      {/* Manual City Prompt Modal */}
      {geoPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <form 
            onSubmit={handleManualCitySubmit} 
            className="w-full max-w-sm rounded-xl border border-border-tertiary bg-bg-primary shadow-2xl p-6 text-left"
          >
            <h4 className="text-sm font-bold text-txt-primary mb-2 flex items-center gap-1.5">
              <MapPin size={16} className="text-brand-orange" />
              Set Your Location
            </h4>
            <p className="text-xs text-txt-secondary mb-4 leading-relaxed">
              We couldn&apos;t automatically determine your location. Enter your city to view nearby problems, ideas, and learning posts!
            </p>
            <input
              type="text"
              required
              placeholder="e.g. Bangalore, Bhopal, Mumbai"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-sm outline-none focus:border-txt-secondary focus:ring-0 transition mb-4 font-semibold"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setGeoPromptOpen(false); if (!userCity) setUserCity("Bangalore"); }}
                className="text-xs font-semibold px-3 py-2 text-txt-secondary hover:bg-bg-secondary rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs font-semibold px-4 py-2 bg-brand-orange text-white hover:bg-brand-orangeHover rounded-md shadow"
              >
                Show Nearby
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Geolocation Loading Banner */}
      {resolvingGeo && (
        <div className="flex items-center justify-center gap-2 py-8 bg-bg-secondary/40 border border-dashed border-border-tertiary rounded-xl">
          <div className="w-4 h-4 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-txt-secondary font-medium">Pinpointing your city in India...</span>
        </div>
      )}

      {/* 3. Feed Cards Stream */}
      {!resolvingGeo && (
        <div className="flex flex-col gap-1">
          {loading ? (
            // Shimmer / loading skeleton
            <div className="space-y-6 py-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex gap-4 animate-pulse">
                  <div className="w-7 h-7 bg-bg-tertiary rounded-full shrink-0"></div>
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-3 bg-bg-tertiary rounded w-2/5"></div>
                    <div className="h-4 bg-bg-tertiary rounded w-4/5"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-bg-tertiary rounded w-full"></div>
                      <div className="h-3 bg-bg-tertiary rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            // Feed Empty state
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-bg-secondary/30 border border-dashed border-border-tertiary rounded-xl mt-2">
              <Compass size={40} className="text-txt-tertiary mb-3 animate-pulse" />
              <h4 className="text-sm font-semibold text-txt-primary mb-1">Nothing unsolved here yet</h4>
              <p className="text-xs text-txt-secondary max-w-xs leading-relaxed">
                We couldn&apos;t find any posts matching this filter. Try expanding your search or publish the very first post!
              </p>
            </div>
          ) : (
            // Render actual PostCards
            <div className="flex flex-col gap-0.5">
              {posts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onPostUpdate={handlePostUpdate} 
                />
              ))}
            </div>
          )}

          {/* 4. Infinite Scroll Pagination Controls */}
          {hasMore && !loading && (
            <div className="flex justify-center pt-6 pb-2">
              <button
                disabled={loadingMore}
                onClick={() => fetchFeed(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-border-tertiary bg-bg-primary text-txt-secondary hover:text-txt-primary hover:border-txt-secondary rounded-md shadow-sm transition disabled:opacity-55"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Load more posts</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
