"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { dbService, Gang, Post, UserProfile } from "@/lib/firebase";
import PostCard from "@/components/PostCard";
import { getAvatarColor } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Users, Globe, RefreshCw, Compass } from "lucide-react";

export default function GangDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gangId = params.id as string;
  const { user, profile, setShowLoginModal, refreshProfile } = useAuth();

  // Data states
  const [gang, setGang] = useState<Gang | null>(null);
  const [gangMembers, setGangMembers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  
  // Feed filters & paging states
  const [selectedTypes, setSelectedTypes] = useState<("problem" | "idea" | "learning")[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastPostId, setLastPostId] = useState<string | undefined>(undefined);

  const loadGangDetails = async () => {
    try {
      const gData = await dbService.getGang(gangId);
      if (gData) {
        setGang(gData);
        
        // Resolve member profiles
        const membersData = await Promise.all(
          gData.memberIds.slice(0, 8).map(async (mId) => {
            const mProf = await dbService.getUserProfile(mId);
            return mProf || { uid: mId, username: "user", displayName: "Builder" } as UserProfile;
          })
        );
        setGangMembers(membersData);
      }
    } catch (e) {
      console.error("Error fetching gang details:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGangPosts = async (isAppend = false) => {
    if (!isAppend) {
      setLoadingPosts(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await dbService.getPosts({
        gangId,
        types: selectedTypes,
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
      console.error("Error fetching gang posts:", e);
    } finally {
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (gangId) {
      loadGangDetails();
    }
  }, [gangId]);

  useEffect(() => {
    if (gangId) {
      fetchGangPosts(false);
    }
  }, [gangId, selectedTypes]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-txt-secondary font-medium">Entering Gang territory...</span>
      </div>
    );
  }

  if (!gang) {
    return (
      <div className="py-16 text-center">
        <h3 className="text-lg font-bold text-txt-primary">Gang not found</h3>
        <p className="text-xs text-txt-secondary mt-1">This community may have been archived or removed.</p>
        <button 
          onClick={() => router.push("/gangs")}
          className="text-xs font-semibold text-brand-orange hover:underline block mx-auto mt-4"
        >
          ← Return to gangs list
        </button>
      </div>
    );
  }

  const isMember = user ? gang.memberIds.includes(user.uid) || profile?.gangIds?.includes(gang.id) : false;

  const handleJoinLeave = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      if (isMember) {
        await dbService.leaveGang(gang.id, user.uid);
      } else {
        await dbService.joinGang(gang.id, user.uid);
      }
      await refreshProfile();
      await loadGangDetails();
    } catch (e) {
      console.error(e);
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
    <div className="w-full flex flex-col gap-5 animate-fade-in text-left pb-10">
      
      {/* Back button */}
      <button 
        onClick={() => router.push("/gangs")}
        className="flex items-center gap-1 text-xs font-semibold text-txt-secondary hover:text-txt-primary mr-auto"
      >
        <ArrowLeft size={14} />
        <span>communities</span>
      </button>

      {/* Gang Banner Card */}
      <div className="border border-border-tertiary bg-bg-primary rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left Details */}
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <h2 className="text-base sm:text-lg font-bold text-txt-primary flex items-center gap-2">
              <span 
                className="w-3 h-3 rounded-full shrink-0 border border-black/10" 
                style={{ backgroundColor: gang.color }}
              />
              g/{gang.name}
            </h2>
            <p className="text-xs text-txt-secondary leading-relaxed max-w-lg">
              {gang.description}
            </p>
          </div>

          {/* Join CTA */}
          <button
            onClick={handleJoinLeave}
            className={`text-xs font-bold py-2 px-6 rounded-md shadow-sm border transition duration-150 ${
              isMember
                ? "bg-bg-secondary text-txt-secondary border-border-tertiary hover:border-red-500 hover:text-red-500 hover:bg-red-500/5"
                : "bg-brand-orange hover:bg-brand-orangeHover text-white border-transparent"
            }`}
          >
            {isMember ? "Joined" : "Join Gang"}
          </button>
        </div>

        {/* Member Details */}
        <div className="mt-6 pt-5 border-t border-border-tertiary/60 flex items-center justify-between flex-wrap gap-4 text-xs text-txt-tertiary">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <Users size={13} />
              <span className="font-bold text-txt-secondary">{gang.memberCount}</span> members
            </span>
            <span className="flex items-center gap-1.5">
              <Globe size={12} className="text-green-500" />
              <span className="font-semibold text-green-500">{(gang.onlineCount || 0) + (isMember ? 1 : 0)} online</span>
            </span>
          </div>

          {/* User initials avatars list */}
          {gangMembers.length > 0 && (
            <div className="flex items-center -space-x-1.5 overflow-hidden">
              {gangMembers.map((m, idx) => {
                const mStyle = getAvatarColor(m.uid);
                const initials = m.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <Link
                    key={idx}
                    href={`/profile/${m.username}`}
                    title={m.displayName}
                    className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-[9px] font-bold border border-bg-primary ring-1 ring-border-tertiary/20 hover:-translate-y-0.5 transition shrink-0"
                    style={{ backgroundColor: mStyle.bg, color: mStyle.text }}
                  >
                    {initials}
                  </Link>
                );
              })}
              {gang.memberCount > 8 && (
                <div className="w-6.5 h-6.5 rounded-full bg-bg-tertiary text-txt-secondary flex items-center justify-center text-[8px] font-bold border border-bg-primary shrink-0">
                  +{gang.memberCount - 8}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* GANG FEED SECTION */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col gap-4">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
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
                className={`text-[11px] px-3.5 py-1.5 rounded-full border transition-all duration-150 shrink-0 ${
                  isSelected
                    ? "bg-txt-primary text-bg-primary border-transparent font-medium"
                    : "border-border-primary text-txt-secondary hover:text-txt-primary bg-transparent"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Post Card stream */}
        <div className="flex flex-col gap-1">
          {loadingPosts ? (
            <div className="space-y-4 pt-2">
              {[1, 2].map((n) => (
                <div key={n} className="h-28 border border-border-tertiary bg-bg-secondary/40 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-14 px-4 bg-bg-secondary/20 border border-dashed border-border-tertiary rounded-xl">
              <Compass size={32} className="text-txt-tertiary mb-3 animate-pulse" />
              <h4 className="text-xs font-bold text-txt-primary mb-0.5">Nothing posted in this gang yet</h4>
              <p className="text-[11px] text-txt-secondary max-w-xs leading-relaxed">
                Be the icebreaker! Share a relevant problem, idea, or learning post inside this gang.
              </p>
              {isMember && (
                <button
                  onClick={() => router.push(`/write?gang=${gang.id}`)}
                  className="mt-4 bg-brand-orange hover:bg-brand-orangeHover text-white text-xs font-semibold px-4.5 py-1.5 rounded-md shadow-sm transition"
                >
                  Write First Post
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border-tertiary/20">
              {posts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onPostUpdate={handlePostUpdate} 
                />
              ))}
            </div>
          )}

          {/* Infinite Scroll Pagination */}
          {hasMore && !loadingPosts && (
            <div className="flex justify-center pt-5">
              <button
                disabled={loadingMore}
                onClick={() => fetchGangPosts(true)}
                className="flex items-center gap-1 text-[11px] font-bold px-3.5 py-2 border border-border-tertiary bg-bg-primary text-txt-secondary hover:text-txt-primary hover:border-txt-secondary rounded-md shadow-sm transition"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Load more posts</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
