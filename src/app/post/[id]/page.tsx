"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { dbService, Post, Comment } from "@/lib/firebase";
import { getAvatarColor, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { 
  ArrowLeft, 
  ArrowUp, 
  MessageSquare, 
  Users, 
  Share2, 
  Hand, 
  Ghost, 
  CheckCircle2, 
  Lock, 
  Reply, 
  Check, 
  Send 
} from "lucide-react";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile, setShowLoginModal } = useAuth();
  const postId = params.id as string;

  // Primary data states
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Post Actions Internal States
  const [voted, setVoted] = useState(false);
  const [sameActive, setSameActive] = useState(false);
  const [builtActive, setBuiltActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedActive, setSavedActive] = useState(false);

  // Comment Input States
  const [newCommentBody, setNewCommentBody] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [nestedReplyBody, setNestedReplyBody] = useState("");

  // Collaborators profile details
  const [collaborators, setCollaborators] = useState<{ uid: string; displayName: string; username: string }[]>([]);

  const loadPostDetails = async () => {
    try {
      const data = await dbService.getPost(postId);
      if (data) {
        setPost(data);
        
        // Load comments
        const thread = await dbService.getComments(postId);
        setComments(thread);

        // Load Collaborators profile details
        if (data.buildTogetherUsers && data.buildTogetherUsers.length > 0) {
          const collabUsers = await Promise.all(
            data.buildTogetherUsers.map(async (uId) => {
              const uProf = await dbService.getUserProfile(uId);
              return uProf 
                ? { uid: uId, displayName: uProf.displayName, username: uProf.username }
                : { uid: uId, displayName: "Builder " + uId.slice(0, 4), username: "builder_" + uId.slice(0, 4) };
            })
          );
          setCollaborators(collabUsers);
        } else {
          setCollaborators([]);
        }
      }
    } catch (e) {
      console.error("Error loading post details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      loadPostDetails();
    }
  }, [postId]);

  useEffect(() => {
    if (post && user) {
      dbService.getVoteStatus(post.id, user.uid).then(setVoted);
      dbService.getSameProblemStatus(post.id, user.uid).then(setSameActive);
      setBuiltActive(post.buildTogetherUsers?.includes(user.uid) || false);

      // Load saved state from localStorage
      const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
      const savedData = JSON.parse(savedDataStr);
      setSavedActive(!!savedData[post.id]);
    }
  }, [post, user]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-txt-secondary font-medium">Fetching thread...</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-16 text-center">
        <h3 className="text-lg font-bold text-txt-primary">Post not found</h3>
        <p className="text-xs text-txt-secondary mt-1">This thread may have been deleted or archived.</p>
        <button 
          onClick={() => router.push("/")}
          className="text-xs font-semibold text-brand-orange hover:underline block mx-auto mt-4"
        >
          ← Return to feed
        </button>
      </div>
    );
  }

  // Interactive Post Actions
  const handleVote = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    try {
      const res = await dbService.toggleVote(post.id, user.uid);
      setVoted(res.voted);
      setPost(prev => prev ? { ...prev, voteCount: res.voteCount } : null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSameProblem = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    try {
      const res = await dbService.toggleSameProblem(post.id, user.uid);
      setSameActive(res.active);
      setPost(prev => prev ? { ...prev, sameCount: res.sameCount } : null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBuildTogether = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    try {
      const res = await dbService.toggleBuildTogether(post.id, user.uid, profile?.displayName || user.displayName || "Builder");
      setBuiltActive(res.active);
      
      // Update local post state
      const currentBuildList = post.buildTogetherUsers || [];
      const updatedList = res.active 
        ? [...currentBuildList, user.uid] 
        : currentBuildList.filter(id => id !== user.uid);
      setPost(prev => prev ? { ...prev, buildTogetherUsers: updatedList } : null);
      
      // Trigger reload of collaborators list
      loadPostDetails();
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    const savedDataStr = localStorage.getItem("unsolved_saved_posts") || "{}";
    const savedData = JSON.parse(savedDataStr);
    
    if (savedActive) {
      delete savedData[post.id];
      localStorage.setItem("unsolved_saved_posts", JSON.stringify(savedData));
      setSavedActive(false);
      window.dispatchEvent(new Event("unsolved_saves_updated"));
    } else {
      savedData[post.id] = {
        id: post.id,
        title: post.title,
        category: "General",
        savedAt: Date.now()
      };
      localStorage.setItem("unsolved_saved_posts", JSON.stringify(savedData));
      setSavedActive(true);
      window.dispatchEvent(new Event("unsolved_saves_updated"));
    }
  };

  // Toggle "Solved" Status by Author
  const handleToggleSolvedStatus = async () => {
    if (!user || user.uid !== post.authorId) return;
    const nextStatus = !post.isSolved;
    try {
      await dbService.markPostAsSolved(post.id, nextStatus);
      setPost(prev => prev ? { ...prev, isSolved: nextStatus } : null);
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Comments (Top-Level or Sub-Reply)
  const handleSubmitComment = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const bodyText = parentId ? nestedReplyBody : newCommentBody;
    if (!bodyText.trim()) return;

    setSubmittingComment(true);
    try {
      await dbService.addComment({
        postId: post.id,
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || "Builder",
        authorPhoto: profile?.photoURL || user.photoURL || "",
        body: bodyText.trim(),
        isAnonymous: commentAnonymous,
        parentCommentId: parentId
      });

      // Reset Inputs
      if (parentId) {
        setNestedReplyBody("");
        setReplyingToId(null);
      } else {
        setNewCommentBody("");
      }
      
      // Refresh Comment Stream
      const thread = await dbService.getComments(post.id);
      setComments(thread);
      
      // Update replies count in local post state
      setPost(prev => prev ? { ...prev, replyCount: prev.replyCount + 1 } : null);
    } catch (err) {
      console.error("Comment submission failed:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const authorInitials = post.isAnonymous 
    ? "" 
    : post.authorName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const authorAvatarStyle = getAvatarColor(post.isAnonymous ? "anonymous" : post.authorId);

  return (
    <div className="w-full flex flex-col gap-5 animate-fade-in pb-10">
      
      {/* Back button link */}
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-1 text-xs font-semibold text-txt-secondary hover:text-txt-primary mr-auto"
      >
        <ArrowLeft size={14} />
        <span>back</span>
      </button>

      {/* Main Full Thread Card */}
      <article className="border border-border-tertiary bg-bg-primary rounded-xl p-6 shadow-sm text-left">
        {/* Solved Status Green Strip */}
        {post.isSolved && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded py-2 px-3 mb-4">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>this problem got solved — see top reply</span>
          </div>
        )}

        {/* Header Metadata */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {post.isAnonymous ? (
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center border border-border-tertiary shrink-0"
              style={{ backgroundColor: authorAvatarStyle.bg, color: authorAvatarStyle.text }}
            >
              <Ghost size={14} />
            </div>
          ) : (
            <Link
              href={`/profile/${post.authorName}`}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border border-border-tertiary hover:scale-105 transition"
              style={{ backgroundColor: authorAvatarStyle.bg, color: authorAvatarStyle.text }}
            >
              {authorInitials}
            </Link>
          )}

          <div className="flex flex-col">
            <span className="text-xs font-bold text-txt-primary">
              {post.isAnonymous ? "anonymous" : post.authorName}
            </span>
            <span className="text-[10px] text-txt-tertiary">
              {formatRelativeTime(post.createdAt)}
            </span>
          </div>

          {post.gangId && post.gangName && (
            <>
              <span className="text-txt-tertiary text-xs">•</span>
              <Link 
                href={`/gangs/${post.gangId}`}
                className="text-xs font-semibold text-brand-orange hover:underline bg-brand-orange/5 px-2.5 py-0.5 rounded-full"
              >
                g/{post.gangName}
              </Link>
            </>
          )}

          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shrink-0 ml-auto border bg-bg-secondary text-txt-secondary border-border-tertiary`}>
            {post.type}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-base sm:text-lg font-bold text-txt-primary leading-snug mb-3">
          {post.title}
        </h2>

        {/* Full Text Body */}
        <p className="text-xs sm:text-sm text-txt-secondary leading-relaxed whitespace-pre-wrap mb-5">
          {post.body}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-6">
            {post.tags.map((tag, idx) => (
              <span 
                key={idx}
                className="text-[10px] font-semibold bg-bg-secondary text-txt-secondary border border-border-tertiary rounded px-2.5 py-1"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Action Panel Footer */}
        <div className="flex items-center gap-4 flex-wrap pt-3 border-t border-border-tertiary text-xs">
          {/* Vote counter */}
          <button 
            onClick={handleVote}
            className={`flex items-center gap-1 px-3 py-1.5 border.5 rounded-md transition-all duration-150 ${
              voted 
                ? "bg-[#FCEBEB] border-[#F09595] text-[#A32D2D]" 
                : "border-border-tertiary text-txt-secondary hover:text-txt-primary hover:bg-bg-secondary"
            }`}
          >
            <ArrowUp size={14} className={voted ? "stroke-[2.5px]" : ""} />
            <span>upvote · {post.voteCount}</span>
          </button>

          {/* Collaborator join trigger */}
          <button 
            onClick={handleBuildTogether}
            className={`flex items-center gap-1.5 px-3 py-1.5 border.5 rounded-md transition-all duration-150 ${
              builtActive 
                ? "bg-green-500/10 border-green-500/30 text-green-500 font-semibold" 
                : "border-border-tertiary text-txt-secondary hover:text-txt-primary hover:bg-bg-secondary"
            }`}
          >
            <Users size={14} />
            <span>{builtActive ? "joined build" : "build together"}</span>
          </button>

          {/* Same problem signature button */}
          <button
            onClick={handleSameProblem}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border.5 transition-all duration-150 ${
              sameActive 
                ? "bg-[#E6F1FB] border-[#85B7EB] text-[#185FA5] font-semibold" 
                : "border-border-tertiary text-txt-secondary hover:bg-[#E6F1FB] hover:text-[#185FA5] hover:border-[#85B7EB]"
            }`}
          >
            <Hand size={13} className={sameActive ? "fill-current" : ""} />
            <span>same problem {post.sameCount > 0 ? `· ${post.sameCount}` : ""}</span>
          </button>

          {/* Save/Bookmark button */}
          <button
            onClick={handleSave}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all duration-150 ${
              savedActive 
                ? "bg-brand-orange/10 border-brand-orange text-brand-orange font-semibold" 
                : "border-border-tertiary text-txt-secondary hover:text-brand-orange hover:border-brand-orange/45"
            }`}
          >
            <span>🔖</span>
            <span>{savedActive ? "saved" : "save"}</span>
          </button>

          {/* Share link copies */}
          <button 
            onClick={handleShare}
            className="flex items-center gap-1 text-txt-tertiary hover:text-txt-secondary py-1.5 transition ml-auto"
          >
            {copied ? (
              <>
                <Check size={13} className="text-green-500" />
                <span className="text-green-500">copied!</span>
              </>
            ) : (
              <>
                <Share2 size={13} />
                <span>share</span>
              </>
            )}
          </button>
        </div>

        {/* Collaborators List Drawer (Only if build together count > 0) */}
        {collaborators.length > 0 && (
          <div className="mt-5 p-4 bg-bg-secondary/40 border border-border-tertiary rounded-lg">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary mb-2 flex items-center gap-1.5">
              <Users size={12} className="text-brand-orange" />
              Build Together Collaborators ({collaborators.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {collaborators.map((c, idx) => {
                const cStyle = getAvatarColor(c.uid);
                return (
                  <Link 
                    key={idx}
                    href={`/profile/${c.username}`}
                    className="inline-flex items-center gap-1.5 text-xs bg-bg-primary hover:border-brand-orange border border-border-tertiary rounded px-2.5 py-1 text-txt-primary transition"
                  >
                    <span 
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                      style={{ backgroundColor: cStyle.bg, color: cStyle.text }}
                    >
                      {c.displayName[0].toUpperCase()}
                    </span>
                    <span className="font-semibold">{c.displayName}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* "Mark as Solved" Toggle Box (Post author control) */}
        {user && user.uid === post.authorId && (
          <div className="mt-5 pt-4 border-t border-border-tertiary/50 flex items-center justify-between">
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-txt-primary">Author Admin Dashboard</span>
              <span className="text-[10px] text-txt-secondary">Resolve your post and help peers discover solution paths.</span>
            </div>
            <button
              onClick={handleToggleSolvedStatus}
              className={`text-xs font-semibold px-4 py-2 rounded-md shadow-sm border transition duration-150 ${
                post.isSolved
                  ? "bg-bg-secondary text-txt-secondary border-border-tertiary hover:border-txt-primary"
                  : "bg-green-500 hover:bg-green-600 text-white border-transparent"
              }`}
            >
              {post.isSolved ? "Mark as unsolved" : "Mark as solved"}
            </button>
          </div>
        )}
      </article>

      {/* ---------------------------------------------------- */}
      {/* COMMENTS / DISCUSSION SECTION */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col gap-4 text-left">
        <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary flex items-center gap-1.5">
          <MessageSquare size={13} />
          Discussion ({post.replyCount})
        </h3>

        {/* Comment Input Box (Main top level) */}
        <div className="border border-border-tertiary bg-bg-primary rounded-xl p-4 shadow-sm">
          {user ? (
            <form onSubmit={(e) => handleSubmitComment(e, null)} className="space-y-3">
              <textarea
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                required
                rows={3}
                placeholder="Share your experience, solution, or question..."
                className="w-full text-xs sm:text-sm bg-bg-secondary text-txt-primary placeholder:text-txt-tertiary border border-border-tertiary rounded-md p-3 focus:outline-none focus:border-txt-secondary transition resize-none"
              />

              <div className="flex items-center justify-between">
                {/* Anonymous switch */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={commentAnonymous}
                    onChange={(e) => setCommentAnonymous(e.target.checked)}
                    className="rounded border-border-tertiary text-brand-orange focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="text-[11px] font-semibold text-txt-secondary flex items-center gap-0.5">
                    <Ghost size={12} /> Post anonymously
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submittingComment || !newCommentBody.trim()}
                  className="flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orangeHover disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-sm transition"
                >
                  {submittingComment ? "Posting..." : "Post reply"}
                  <Send size={12} />
                </button>
              </div>
            </form>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-txt-secondary mb-3">Sign in to join the discussion on this problem</p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-xs font-bold bg-txt-primary text-bg-primary px-5 py-2 rounded-md shadow hover:opacity-90 transition"
              >
                sign in
              </button>
            </div>
          )}
        </div>

        {/* Comment Streams */}
        {comments.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/20">
            <span className="text-xs text-txt-secondary">No replies yet. Be the first to share your thoughts!</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => {
              const cInitials = comment.isAnonymous 
                ? "" 
                : comment.authorName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
              const cAvatar = getAvatarColor(comment.isAnonymous ? "anonymous" : comment.authorId);
              
              return (
                <div key={comment.id} className="flex flex-col gap-2">
                  
                  {/* LEVEL 1: Top-Level Comment */}
                  <div className="border border-border-tertiary bg-bg-primary rounded-xl p-4 shadow-sm flex gap-3">
                    {/* Avatar */}
                    {comment.isAnonymous ? (
                      <div 
                        className="w-7 h-7 rounded-full flex items-center justify-center border border-border-tertiary shrink-0"
                        style={{ backgroundColor: cAvatar.bg, color: cAvatar.text }}
                      >
                        <Ghost size={12} />
                      </div>
                    ) : (
                      <Link
                        href={`/profile/${comment.authorName}`}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 border border-border-tertiary hover:scale-105 transition"
                        style={{ backgroundColor: cAvatar.bg, color: cAvatar.text }}
                      >
                        {cInitials}
                      </Link>
                    )}

                    {/* Content */}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-txt-primary">
                          {comment.isAnonymous ? "anonymous" : comment.authorName}
                        </span>
                        <span className="text-txt-tertiary text-[10px]">•</span>
                        <span className="text-[10px] text-txt-tertiary">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-txt-secondary leading-relaxed">
                        {comment.body}
                      </p>

                      {/* Top level comment actions: Reply */}
                      {user && (
                        <button
                          onClick={() => {
                            if (replyingToId === comment.id) {
                              setReplyingToId(null);
                            } else {
                              setReplyingToId(comment.id);
                              setNestedReplyBody("");
                            }
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-txt-tertiary hover:text-brand-orange mt-1.5"
                        >
                          <Reply size={12} />
                          <span>Reply</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* LEVEL 2: Nested Sub-Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="pl-6 border-l-2 border-border-tertiary/70 ml-3.5 space-y-2 flex flex-col">
                      {comment.replies.map((reply) => {
                        const rInitials = reply.isAnonymous 
                          ? "" 
                          : reply.authorName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                        const rAvatar = getAvatarColor(reply.isAnonymous ? "anonymous" : reply.authorId);
                        
                        return (
                          <div key={reply.id} className="border border-border-tertiary bg-bg-secondary/40 rounded-xl p-3.5 flex gap-2.5">
                            {reply.isAnonymous ? (
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center border border-border-tertiary shrink-0"
                                style={{ backgroundColor: rAvatar.bg, color: rAvatar.text }}
                              >
                                <Ghost size={10} />
                              </div>
                            ) : (
                              <Link
                                href={`/profile/${reply.authorName}`}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 border border-border-tertiary hover:scale-105 transition"
                                style={{ backgroundColor: rAvatar.bg, color: rAvatar.text }}
                              >
                                {rInitials}
                              </Link>
                            )}

                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-txt-primary">
                                  {reply.isAnonymous ? "anonymous" : reply.authorName}
                                </span>
                                <span className="text-txt-tertiary text-[10px]">•</span>
                                <span className="text-[9px] text-txt-tertiary">
                                  {formatRelativeTime(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-txt-secondary leading-relaxed">
                                {reply.body}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Reply Form (Shown only under active top comment) */}
                  {replyingToId === comment.id && user && (
                    <form 
                      onSubmit={(e) => handleSubmitComment(e, comment.id)} 
                      className="pl-6 ml-3.5 space-y-2 mt-1"
                    >
                      <div className="border border-border-tertiary bg-bg-secondary/30 rounded-xl p-3 flex flex-col gap-2">
                        <textarea
                          value={nestedReplyBody}
                          onChange={(e) => setNestedReplyBody(e.target.value)}
                          required
                          rows={2}
                          placeholder={`Reply to ${comment.isAnonymous ? "anonymous" : comment.authorName}...`}
                          className="w-full text-xs bg-bg-primary text-txt-primary placeholder:text-txt-tertiary border border-border-tertiary rounded-md p-2 focus:outline-none focus:border-txt-secondary transition resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyingToId(null)}
                            className="text-[11px] font-semibold px-2.5 py-1 hover:bg-bg-secondary rounded text-txt-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submittingComment || !nestedReplyBody.trim()}
                            className="bg-brand-orange hover:bg-brand-orangeHover text-white text-[11px] font-semibold px-3.5 py-1 rounded shadow-sm transition disabled:opacity-50"
                          >
                            Send reply
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
