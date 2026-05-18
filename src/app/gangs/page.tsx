"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { dbService, Gang } from "@/lib/firebase";
import Link from "next/link";
import { Plus, Users, Globe, X, Check, Eye } from "lucide-react";

export default function GangsPage() {
  const { user, profile, setShowLoginModal, refreshProfile } = useAuth();
  
  // Data states
  const [gangs, setGangs] = useState<Gang[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [gangName, setGangName] = useState("");
  const [gangDesc, setGangDesc] = useState("");
  const [selectedColor, setSelectedColor] = useState("#4ade80"); // default green
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const presetColors = [
    "#4ade80", // Light Green
    "#60a5fa", // Blue
    "#f59e0b", // Amber
    "#f87171", // Red
    "#c084fc", // Purple
    "#2dd4bf", // Teal
    "#fb7185", // Rose
    "#6366f1", // Indigo
  ];

  const fetchGangs = async () => {
    try {
      const list = await dbService.getGangs();
      setGangs(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGangs();
  }, []);

  const handleJoinLeave = async (e: React.MouseEvent, gang: Gang) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const isMember = gang.memberIds.includes(user.uid) || profile?.gangIds?.includes(gang.id);

    try {
      if (isMember) {
        await dbService.leaveGang(gang.id, user.uid);
      } else {
        await dbService.joinGang(gang.id, user.uid);
      }
      
      // Refresh Auth Profile so navbar update triggers if needed
      await refreshProfile();
      
      // Re-fetch lists to get accurate counts
      await fetchGangs();
    } catch (err) {
      console.error("Join/Leave failed:", err);
    }
  };

  const handleCreateGangSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!gangName.trim() || gangName.trim().length < 3) {
      setError("Gang name must be at least 3 characters.");
      return;
    }
    if (!gangDesc.trim()) {
      setError("Please add a description for the gang.");
      return;
    }
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const created = await dbService.createGang({
        name: gangName.trim(),
        description: gangDesc.trim(),
        color: selectedColor,
        createdBy: user.uid
      });

      // Reset
      setGangName("");
      setGangDesc("");
      setSelectedColor("#4ade80");
      setModalOpen(false);
      
      // Refresh Lists
      await refreshProfile();
      await fetchGangs();
    } catch (err: any) {
      setError(err.message || "Failed to create gang.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 animate-fade-in text-left pb-10">
      
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border-tertiary pb-3">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-txt-primary">Communities (Gangs)</h2>
          <p className="text-xs text-txt-secondary">Join niche groups sharing problems, hacks, and learning logs.</p>
        </div>
        <button
          onClick={() => {
            if (!user) {
              setShowLoginModal(true);
            } else {
              setModalOpen(true);
            }
          }}
          className="flex items-center gap-1.5 h-8 px-4 text-xs font-semibold bg-txt-primary text-bg-primary hover:opacity-90 rounded-md shadow-sm transition"
        >
          <Plus size={14} /> Create Gang
        </button>
      </div>

      {/* Gangs List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-28 border border-border-tertiary bg-bg-secondary/40 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : gangs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/20">
          <Users size={32} className="text-txt-tertiary mx-auto mb-3" />
          <h4 className="text-xs font-bold text-txt-primary">No communities yet</h4>
          <p className="text-[11px] text-txt-secondary">Be the pioneer and build the first gang on Unsolved!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gangs.map((gang) => {
            const isMember = user ? gang.memberIds.includes(user.uid) || profile?.gangIds?.includes(gang.id) : false;
            
            return (
              <Link 
                key={gang.id}
                href={`/gangs/${gang.id}`}
                className="group border border-border-tertiary hover:border-txt-secondary bg-bg-primary hover:bg-bg-secondary/30 rounded-xl p-5 shadow-sm transition duration-150 flex flex-col justify-between"
              >
                <div>
                  {/* Title and Dot */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-txt-primary flex items-center gap-2 group-hover:text-brand-orange transition-colors">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" 
                        style={{ backgroundColor: gang.color }}
                      />
                      g/{gang.name}
                    </h3>
                    
                    {/* View Details Icon link */}
                    <span className="text-[10px] font-bold text-brand-orange inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      view <Eye size={10} />
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-txt-secondary line-clamp-2 leading-relaxed mb-4">
                    {gang.description}
                  </p>
                </div>

                {/* Footer details & Action */}
                <div className="flex items-center justify-between pt-3 border-t border-border-tertiary/20 text-[11px] text-txt-tertiary">
                  <div className="flex gap-3">
                    <span className="flex items-center gap-0.5">
                      <Users size={11} />
                      <span className="font-bold text-txt-secondary">{gang.memberCount}</span> members
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe size={11} className="text-green-500" />
                      <span className="font-semibold text-green-500">{(gang.onlineCount || 0) + (isMember ? 1 : 0)} online</span>
                    </span>
                  </div>

                  {/* Join Button */}
                  <button
                    onClick={(e) => handleJoinLeave(e, gang)}
                    className={`text-[10px] font-bold py-1 px-3.5 rounded-full border transition duration-150 ${
                      isMember
                        ? "bg-bg-secondary text-txt-secondary border-border-tertiary hover:border-red-500 hover:text-red-500 hover:bg-red-500/5"
                        : "bg-brand-orange hover:bg-brand-orangeHover text-white border-transparent shadow-sm"
                    }`}
                  >
                    {isMember ? "leave" : "join"}
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* CREATE GANG DIALOG MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form 
            onSubmit={handleCreateGangSubmit} 
            className="w-full max-w-md rounded-xl border border-border-tertiary bg-bg-primary shadow-2xl p-6 text-left max-h-[90vh] overflow-y-auto"
          >
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 border-b border-border-tertiary pb-2.5">
              <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5">
                <Users size={16} className="text-brand-orange" />
                Initialize a New Gang
              </h3>
              <button 
                type="button"
                onClick={() => setModalOpen(false)}
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

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                  Gang Name
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Agritech disruptors, Learning DSA"
                  value={gangName}
                  onChange={(e) => setGangName(e.target.value)}
                  className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-xs font-semibold outline-none focus:border-txt-secondary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                  Gang Description
                </label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Describe your target members and what topics are welcome here..."
                  value={gangDesc}
                  onChange={(e) => setGangDesc(e.target.value)}
                  className="w-full px-3 py-2 border.5 border-border-tertiary bg-bg-secondary text-txt-primary rounded-md text-xs outline-none focus:border-txt-secondary transition resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-txt-secondary mb-2">
                  Dot Dot Color Accent
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className="w-6.5 h-6.5 rounded-full border border-black/10 flex items-center justify-center transition hover:scale-110 active:scale-95 shrink-0"
                      style={{ backgroundColor: color }}
                      aria-label={`Select accent color ${color}`}
                    >
                      {selectedColor === color && (
                        <Check size={11} className="text-white drop-shadow stroke-[3.5px]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex gap-2 justify-end mt-6 pt-3 border-t border-border-tertiary/50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs font-semibold px-3 py-2 text-txt-secondary hover:bg-bg-secondary rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-xs font-semibold px-4.5 py-2 bg-brand-orange hover:bg-brand-orangeHover text-white rounded-md shadow-md disabled:opacity-50 transition"
              >
                {submitting ? "Creating..." : "Initialize Gang"}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
