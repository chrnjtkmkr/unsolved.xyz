"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { dbService, Gang } from "@/lib/firebase";
import { Lock, Ghost, Plus, X, AlertCircle } from "lucide-react";

export default function WritePostPage() {
  const router = useRouter();
  const { user, profile, setShowLoginModal } = useAuth();

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"problem" | "idea" | "learning">("problem");
  const [selectedGangId, setSelectedGangId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Core status states
  const [myGangs, setMyGangs] = useState<Gang[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow body textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [body]);

  // Load only gangs the user is currently in
  useEffect(() => {
    if (!user) return;
    
    const loadGangs = async () => {
      try {
        const allGangs = await dbService.getGangs();
        const joinedGangs = allGangs.filter(
          g => g.memberIds.includes(user.uid) || profile?.gangIds?.includes(g.id)
        );
        setMyGangs(joinedGangs);
      } catch (err) {
        console.error("Failed to load user gangs:", err);
      }
    };

    loadGangs();
  }, [user, profile]);

  // Block rendering if not logged in (handled by middleware, but showing nice placeholder)
  if (!user) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
        <Lock size={32} className="text-txt-tertiary mb-3" />
        <h3 className="text-sm font-bold text-txt-primary">Authentication Required</h3>
        <p className="text-xs text-txt-secondary mt-1 mb-6 leading-relaxed">
          You must sign in to write new posts, ask problems, share startup ideas, or upload DSA learning paths.
        </p>
        <button
          onClick={() => setShowLoginModal(true)}
          className="w-full py-2.5 px-4 bg-brand-orange hover:bg-brand-orangeHover text-white text-xs font-semibold rounded-md shadow transition"
        >
          sign in to continue
        </button>
      </div>
    );
  }

  // Handle tag addition on Enter
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tagClean = tagInput.trim().replace(/[^a-zA-Z0-9]/g, ""); // strip hashes/commas
      if (tagClean && !tags.includes(tagClean)) {
        if (tags.length >= 5) {
          setError("You can add up to 5 tags only.");
          return;
        }
        setTags([...tags, tagClean]);
        setTagInput("");
        setError("");
      }
    }
  };

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Post
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || title.trim().length < 8) {
      setError("Please enter a descriptive title (at least 8 characters).");
      return;
    }
    if (!body.trim()) {
      setError("Please write some content inside the post body.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedGang = myGangs.find(g => g.id === selectedGangId);
      
      const newPost = await dbService.createPost({
        title: title.trim(),
        body: body.trim(),
        type,
        tags,
        authorId: user.uid,
        authorName: profile?.displayName || user.displayName || "Builder",
        isAnonymous,
        gangId: selectedGangId || undefined,
        gangName: selectedGang?.name || undefined,
        city: profile?.city || "Bangalore" // tag post with user's city for geolocation matching!
      });

      // Redirect back to home feed or gang detail page
      if (selectedGangId) {
        router.push(`/gangs/${selectedGangId}`);
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create post. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 animate-fade-in text-left pb-10">
      <div className="flex flex-col">
        <h2 className="text-lg font-bold text-txt-primary">Create a Post</h2>
        <p className="text-xs text-txt-secondary">Share an unsolved problem, prototype idea, or DSA learning block with peers.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-md">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Type Selector Toggle Pills */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-2">
            Post Category <span className="text-brand-orange">*</span>
          </label>
          <div className="flex gap-2">
            {[
              { id: "problem", label: "Problem", desc: "A real-world frustration needing a solution" },
              { id: "idea", label: "Idea", desc: "A draft product, SaaS prototype, or project" },
              { id: "learning", label: "Learning", desc: "Interview tips, DSA mind blocks, concepts" },
            ].map((pill) => {
              const isSelected = type === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setType(pill.id as any)}
                  className={`flex-1 text-xs py-2.5 px-3 rounded-md border text-center transition-all duration-150 ${
                    isSelected
                      ? "bg-txt-primary text-bg-primary border-transparent font-semibold shadow-sm"
                      : "border-border-tertiary text-txt-secondary hover:text-txt-primary hover:border-txt-secondary bg-bg-primary"
                  }`}
                >
                  <div>{pill.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-2">
            Post Title <span className="text-brand-orange">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Cold storage is a nightmare for small farmers in MP — no one is solving this..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-sm outline-none focus:border-txt-secondary focus:ring-0 transition font-semibold"
          />
        </div>

        {/* Dynamic Body Textarea */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-2">
            Post Body Content <span className="text-brand-orange">*</span>
          </label>
          <textarea
            ref={textareaRef}
            required
            rows={5}
            placeholder="Give context. Explain the details, who it affects, or why you are stuck..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full min-h-[120px] px-3 py-2.5 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-sm outline-none focus:border-txt-secondary focus:ring-0 transition resize-none leading-relaxed"
          />
        </div>

        {/* Gang Selector Dropdown */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
            Post inside a Gang (Optional)
          </label>
          <p className="text-[10px] text-txt-tertiary mb-2">Publishing inside a community makes it visible to specific gang members.</p>
          {myGangs.length > 0 ? (
            <select
              value={selectedGangId}
              onChange={(e) => setSelectedGangId(e.target.value)}
              className="w-full px-3 py-2.5 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-xs font-medium outline-none focus:border-txt-secondary transition cursor-pointer"
            >
              <option value="">No Gang (Publish to Global Feed)</option>
              {myGangs.map((gang) => (
                <option key={gang.id} value={gang.id}>
                  g/{gang.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-bg-secondary/40 border border-border-tertiary rounded-md text-xs text-txt-secondary">
              You haven&apos;t joined any Gangs yet. You can still publish to the global feed or explore{" "}
              <button 
                type="button" 
                onClick={() => router.push("/gangs")}
                className="text-brand-orange hover:underline font-semibold"
              >
                Gangs here
              </button> to join one!
            </div>
          )}
        </div>

        {/* Removable Tags Input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
            Add Tags
          </label>
          <p className="text-[10px] text-txt-tertiary mb-2">Type a tag word and press Enter or Comma to add it.</p>
          
          <div className="w-full flex flex-wrap items-center gap-1.5 p-2 bg-bg-secondary border.5 border-border-tertiary rounded-md">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-bg-primary text-txt-secondary border border-border-tertiary rounded-md py-0.5 pl-2.5 pr-1.5"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  className="p-0.5 rounded-full hover:bg-bg-tertiary text-txt-tertiary hover:text-red-500 transition"
                  aria-label="Remove tag"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="flex-1 min-w-[100px] bg-transparent text-txt-primary border-none outline-none text-xs focus:ring-0 py-0.5"
              placeholder={tags.length === 0 ? "e.g. Agritech, DSA, SaaS" : ""}
            />
          </div>
        </div>

        {/* Anonymous Toggle Switch */}
        <div className="flex items-center justify-between p-3.5 bg-bg-secondary/30 border border-border-tertiary rounded-lg select-none">
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-txt-primary flex items-center gap-1">
              <Ghost size={14} className="text-txt-secondary" />
              Publish Anonymously
            </span>
            <span className="text-[10px] text-txt-secondary">Hide your identity and initials from the post. Perfect for raw net sharing!</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-secondary after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-orange"></div>
          </label>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-orange hover:bg-brand-orangeHover disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-md transition"
        >
          {submitting ? "Publishing post..." : "Publish post"}
          <Plus size={16} />
        </button>

      </form>
    </div>
  );
}
