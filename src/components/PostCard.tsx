"use client";

import React, { useState, useEffect } from "react";
import { Post, dbService } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { getAvatarColor, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowUp, 
  MessageSquare, 
  Users, 
  Share2, 
  Hand, 
  Ghost, 
  CheckCircle2,
  Check
} from "lucide-react";

interface PostCardProps {
  post: Post;
  onPostUpdate?: (updatedPost: Post) => void;
}

export default function PostCard({ post, onPostUpdate }: PostCardProps) {
  const { user, setShowLoginModal } = useAuth();
  const router = useRouter();

  // Internal reactive states for fast UI feedback
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(post.voteCount);
  const [sameActive, setSameActive] = useState(false);
  const [sameCount, setSameCount] = useState(post.sameCount);
  const [builtActive, setBuiltActive] = useState(false);
  const [buildCount, setBuildCount] = useState(post.buildTogetherUsers?.length || 0);
  const [copied, setCopied] = useState(false);

  // Bookmark save states
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [savedActive, setSavedActive] = useState(false);
  const [savedCategory, setSavedCategory] = useState("");

  // Sync with prop values on mount or change
  useEffect(() => {
    setVoteCount(post.voteCount);
    setSameCount(post.sameCount);
    setBuildCount(post.buildTogetherUsers?.length || 0);
    
    if (user) {
      dbService.getVoteStatus(post.id, user.uid).then(setVoted);
      dbService.getSameProblemStatus(post.id, user.uid).then(setSameActive);
      setBuiltActive(post.buildTogetherUsers?.includes(user.uid) || false);
      
      // Load bookmark saved status from LocalStorage
      if (typeof window !== "undefined") {
        const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
        const savedData = JSON.parse(savedDataStr);
        if (savedData[post.id]) {
          setSavedActive(true);
          setSavedCategory(savedData[post.id].category || "General");
        } else {
          setSavedActive(false);
          setSavedCategory("");
        }
      }
    } else {
      setVoted(false);
      setSameActive(false);
      setBuiltActive(false);
      setSavedActive(false);
      setSavedCategory("");
    }
  }, [post, user]);

  const handleVote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    // Pessimistic/Optimistic hybrid update
    try {
      const res = await dbService.toggleVote(post.id, user.uid);
      setVoted(res.voted);
      setVoteCount(res.voteCount);
      if (onPostUpdate) {
        onPostUpdate({ ...post, voteCount: res.voteCount });
      }
    } catch (err) {
      console.error("Upvote failed:", err);
    }
  };

  const handleSameProblem = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      const res = await dbService.toggleSameProblem(post.id, user.uid);
      setSameActive(res.active);
      setSameCount(res.sameCount);
      if (onPostUpdate) {
        onPostUpdate({ ...post, sameCount: res.sameCount });
      }
    } catch (err) {
      console.error("Same problem toggle failed:", err);
    }
  };

  const handleBuildTogether = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      const res = await dbService.toggleBuildTogether(post.id, user.uid, user.displayName || "");
      setBuiltActive(res.active);
      setBuildCount(res.usersCount);
      if (onPostUpdate) {
        const currentBuildList = post.buildTogetherUsers || [];
        const updatedList = res.active 
          ? [...currentBuildList, user.uid] 
          : currentBuildList.filter(id => id !== user.uid);
        onPostUpdate({ ...post, buildTogetherUsers: updatedList });
      }
    } catch (err) {
      console.error("Build together toggle failed:", err);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.body,
          url,
        });
      } catch (err) {
        console.log("Web Share API failed, falling back to copy.");
      }
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setShowSaveDropdown(!showSaveDropdown);
  };

  const handleMobileSaveToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (savedActive) {
      const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
      const savedData = JSON.parse(savedDataStr);
      delete savedData[post.id];
      localStorage.setItem("unsolved_saved_posts", JSON.stringify(savedData));
      setSavedActive(false);
      setSavedCategory("");
      window.dispatchEvent(new Event("unsolved_saves_updated"));
    } else {
      const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
      const savedData = JSON.parse(savedDataStr);
      savedData[post.id] = {
        id: post.id,
        title: post.title,
        category: "General",
        savedAt: Date.now()
      };
      localStorage.setItem("unsolved_saved_posts", JSON.stringify(savedData));
      setSavedActive(true);
      setSavedCategory("General");
      window.dispatchEvent(new Event("unsolved_saves_updated"));
    }
  };

  const selectCategoryAndSave = (categoryName: string) => {
    const cleanCategory = categoryName.trim() || "General";
    const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
    const savedData = JSON.parse(savedDataStr);
    
    savedData[post.id] = {
      id: post.id,
      title: post.title,
      category: cleanCategory,
      savedAt: Date.now()
    };
    
    localStorage.setItem("unsolved_saved_posts", JSON.stringify(savedData));
    setSavedActive(true);
    setSavedCategory(cleanCategory);
    setShowSaveDropdown(false);
    
    // Dispatch custom browser event to sync the Left Sidebar!
    window.dispatchEvent(new Event("unsolved_saves_updated"));
  };

  const handleUnsave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
    const savedData = JSON.parse(savedDataStr);
    delete savedData[post.id];
    
    localStorage.setItem("unsolved_saved_posts", JSON.stringify(savedData));
    setSavedActive(false);
    setSavedCategory("");
    setShowSaveDropdown(false);
    
    // Dispatch custom browser event to sync the Left Sidebar!
    window.dispatchEvent(new Event("unsolved_saves_updated"));
  };

  const navigateToDetails = () => {
    router.push(`/post/${post.id}`);
  };

  // Avatar Initials & Color
  const initials = post.isAnonymous 
    ? "" 
    : post.authorName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const avatarStyle = getAvatarColor(post.isAnonymous ? "anonymous" : post.authorId);

  // Type Badges styling
  const typeBadgeColors = {
    problem: "bg-red-500/10 text-red-500 border border-red-500/20",
    idea: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    learning: "bg-blue-500/10 text-blue-500 border border-blue-500/20"
  };

  return (
    <article 
      onClick={navigateToDetails}
      className="group w-full bg-[#0b0f12] sm:bg-bg-secondary border-b border-zinc-900 sm:border sm:border-border-secondary sm:rounded-xl p-4 sm:p-5 cursor-pointer hover:bg-zinc-950/40 sm:hover:bg-bg-secondary/80 active:bg-zinc-950/60 transition-colors duration-150 text-left flex gap-4 select-none sm:mb-4"
    >
      {/* Upvote Column Controls Workspace (Visible ONLY on Desktop) */}
      <div className="hidden sm:flex flex-col items-center w-9 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleVote}
          className={`text-lg p-1 transition-colors duration-150 select-none ${
            voted 
              ? "text-brand-orange scale-110" 
              : "text-txt-tertiary hover:text-txt-secondary"
          }`}
          aria-label="Upvote post"
        >
          ▲
        </button>
        <span className={`text-xs font-bold transition-colors select-none ${
          voted ? "text-brand-orange" : "text-txt-secondary"
        }`}>
          {voteCount}
        </span>
      </div>

      {/* Post Main Block */}
      <div className="flex-1 min-w-0">
        
        {/* Mobile Solved Banner - Matches Prototype exactly! */}
        {post.isSolved && (
          <div className="flex sm:hidden items-center gap-1.5 text-emerald-500 text-[11px] font-medium mb-2.5 bg-emerald-950/20 border border-emerald-900/30 px-2.5 py-1 rounded-md w-fit select-none">
            <span>✓</span>
            <span>This problem got solved — see top reply</span>
          </div>
        )}

        {/* Integrated Custom Green Success Top Banner (Desktop Only) */}
        {post.isSolved && (
          <div className="hidden sm:flex resolved-success-banner items-center gap-1.5 text-[11px] font-semibold text-[#10b981] bg-[#10b981]/5 border border-[#10b981]/25 rounded-md py-2 px-3.5 mb-3.5">
            <span className="font-bold">✓</span>
            <span>this problem got solved — see top reply</span>
          </div>
        )}

        {/* Mobile-Only Metadata Row - Matches Prototype HTML exactly! */}
        <div className="flex sm:hidden items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 select-none">
            {post.type === "problem" && (
              <div className="w-5 h-5 rounded-full bg-orange-600/20 text-orange-500 flex items-center justify-center font-bold text-[10px]">r/</div>
            )}
            {post.type === "idea" && (
              <div className="w-5 h-5 rounded-full bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">i/</div>
            )}
            {post.type === "learning" && (
              <div className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">d/</div>
            )}
            
            <span className="font-semibold text-zinc-200">
              g/{post.gangName || "General"}
            </span>
            <span>•</span>
            <span>{formatRelativeTime(post.createdAt)}</span>
            <span>•</span>
            <span className="text-zinc-500">by {post.isAnonymous ? "anonymous" : post.authorName}</span>
          </div>

          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
            post.type === "problem" 
              ? "bg-red-950/50 text-red-400 border-red-900/50" 
              : post.type === "idea"
                ? "bg-amber-950/50 text-amber-400 border-amber-900/50"
                : "bg-blue-950/50 text-blue-400 border-blue-900/50"
          }`}>
            {post.type}
          </span>
        </div>

        {/* Desktop-Only Metadata Row */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap mb-2.5">
          {/* User Mini Avatar */}
          {post.isAnonymous ? (
            <div 
              className="w-5.5 h-5.5 rounded-full flex items-center justify-center bg-[#374151] text-white shrink-0 text-[9px] font-bold"
            >
              👤
            </div>
          ) : (
            <Link
              href={`/profile/${post.authorName}`}
              onClick={(e) => e.stopPropagation()}
              className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 border border-border-tertiary hover:scale-105 transition"
              style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}
            >
              {initials}
            </Link>
          )}

          {/* Author Name */}
          <span className="text-xs font-semibold text-txt-primary hover:underline">
            {post.isAnonymous ? (
              <span className="text-txt-secondary">anonymous</span>
            ) : (
              <Link href={`/profile/${post.authorName}`} onClick={(e) => e.stopPropagation()}>
                {post.authorName}
              </Link>
            )}
          </span>

          <span className="text-txt-tertiary text-[10px]">•</span>

          {/* Timestamp */}
          <span className="text-xs text-txt-tertiary shrink-0">
            {formatRelativeTime(post.createdAt)}
          </span>

          {/* Gang Name Tag */}
          {post.gangId && post.gangName && (
            <>
              <span className="text-txt-tertiary text-[10px]">•</span>
              <Link 
                href={`/gangs/${post.gangId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-semibold text-brand-orange hover:underline shrink-0"
              >
                g/{post.gangName}
              </Link>
            </>
          )}

          {/* Generic Category Badge */}
          <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shrink-0 sm:ml-auto ${typeBadgeColors[post.type]}`}>
            {post.type}
          </span>
        </div>

        {/* Post Title */}
        <h2 className="text-base sm:text-[16px] font-semibold text-white sm:text-txt-primary leading-snug mb-1.5 group-hover:text-brand-orange transition-colors duration-150">
          {post.title}
        </h2>

        {/* Post Body Clamped Description */}
        <p className="text-sm text-zinc-400 sm:text-[13px] sm:text-txt-secondary leading-relaxed mb-4 line-clamp-2">
          {post.body}
        </p>

        {/* Post Action Control Footer Strip (Desktop Only) */}
        <div className="hidden sm:flex items-center gap-4 flex-wrap pt-3.5 text-xs text-txt-tertiary border-t border-border-secondary">
          
          {/* Replies link */}
          <button 
            onClick={navigateToDetails}
            className="flex items-center gap-1 hover:text-txt-secondary transition-colors"
          >
            <span>💬</span>
            <span>{post.replyCount} replies</span>
          </button>

          {/* Build together */}
          <button 
            onClick={handleBuildTogether}
            className={`flex items-center gap-1 transition-colors ${builtActive ? "text-[#10b981] font-semibold" : "hover:text-txt-secondary"}`}
          >
            <span>👥</span>
            <span>
              {builtActive ? "joined build" : "build together"} {buildCount > 0 ? `(${buildCount})` : ""}
            </span>
          </button>

          {/* Share */}
          <button 
            onClick={handleShare}
            className="flex items-center gap-1 hover:text-txt-secondary transition-colors relative"
          >
            {copied ? (
              <span className="text-green-500 font-semibold flex items-center gap-0.5">✓ copied!</span>
            ) : (
              <>
                <span>🔗</span>
                <span>share</span>
              </>
            )}
          </button>

          {/* Save / Bookmark Post Button with dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={handleSaveClick}
              className={`flex items-center gap-1.5 transition-colors ${savedActive ? "text-brand-orange font-semibold" : "hover:text-txt-secondary"}`}
              aria-label="Save or Bookmark post"
            >
              <span>🔖</span>
              <span>{savedActive ? `saved (${savedCategory})` : "save"}</span>
            </button>

            {showSaveDropdown && (
              <div className="absolute bottom-full left-0 mb-2.5 z-20 w-52 bg-bg-secondary border border-border-tertiary rounded-xl p-3 shadow-2xl animate-fade-in text-left text-txt-primary">
                <div className="text-[10px] font-bold text-txt-tertiary tracking-wider uppercase mb-2 select-none">
                  Select Save Category
                </div>
                
                {/* Predefined Categories List */}
                <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto no-scrollbar mb-2">
                  {["SaaS", "Agritech", "DSA", "General"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => selectCategoryAndSave(cat)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition ${
                        savedActive && savedCategory === cat 
                          ? "bg-brand-orange/15 text-brand-orange font-bold" 
                          : "hover:bg-bg-primary text-txt-secondary hover:text-txt-primary"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Custom Category input */}
                <div className="border-t border-border-secondary pt-2">
                  <input
                    type="text"
                    placeholder="New category..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        selectCategoryAndSave(e.currentTarget.value);
                      }
                    }}
                    className="w-full h-8 px-2 bg-bg-primary border border-border-tertiary rounded-lg text-xs focus:outline-none focus:border-brand-orange transition"
                  />
                  <div className="text-[8px] text-txt-tertiary mt-1 select-none">Type category & press Enter</div>
                </div>

                {/* Remove / Unsave option if active */}
                {savedActive && (
                  <button
                    type="button"
                    onClick={handleUnsave}
                    className="w-full text-center text-xs font-bold text-red-500 hover:bg-red-500/10 py-1.5 rounded-lg border border-red-500/20 mt-1 transition"
                  >
                    Unsave Post
                  </button>
                )}
              </div>
            )}
          </div>

          {/* same problem badge (aligned right on desktop, inline on mobile) */}
          <button
            onClick={handleSameProblem}
            className={`sm:ml-auto flex items-center gap-1 transition-colors ${
              sameActive 
                ? "text-brand-orange font-bold animate-pulse" 
                : "hover:text-txt-secondary text-txt-tertiary"
            }`}
          >
            <span>🔀</span>
            <span>
              same problem {sameCount > 0 ? `(${sameCount})` : ""}
            </span>
          </button>

        </div>

        {/* Dedicated Mobile Post Card Footer Actions - Matches Prototype HTML exactly! (Visible only on mobile) */}
        <div className="flex sm:hidden items-center gap-5 text-txt-secondary text-xs pt-3.5 border-t border-zinc-900/60 select-none" onClick={(e) => e.stopPropagation()}>
          {/* Upvote/Downvote Pill Capsule */}
          <div className="flex items-center gap-1.5 bg-zinc-900/60 px-2.5 py-1.5 rounded-full border border-border-secondary/25">
            <button 
              onClick={handleVote}
              className={`p-0.5 transition-colors ${voted ? "text-[#FF4500]" : "text-zinc-400 hover:text-[#FF4500]"}`}
              aria-label="Upvote"
            >
              ▲
            </button>
            <span className={`font-bold min-w-[16px] text-center text-[11px] ${voted ? "text-[#FF4500]" : "text-zinc-300"}`}>
              {voteCount}
            </span>
            <button 
              onClick={handleVote}
              className="text-zinc-400 hover:text-blue-500 p-0.5"
              aria-label="Downvote"
            >
              ▼
            </button>
          </div>

          {/* Replies button */}
          <button 
            onClick={navigateToDetails}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white"
          >
            <span>💬</span>
            <span className="text-[11px] font-medium">{post.replyCount || 0} replies</span>
          </button>

          {/* Share button */}
          <button 
            onClick={handleShare}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white ml-auto"
          >
            {copied ? (
              <span className="text-green-500 font-semibold flex items-center gap-0.5 text-[11px]">✓ copied!</span>
            ) : (
              <>
                <span>🔗</span>
                <span className="text-[11px] font-medium">Share</span>
              </>
            )}
          </button>
        </div>

      </div>
    </article>
  );
}
