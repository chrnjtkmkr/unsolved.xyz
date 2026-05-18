"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthContext";
import { dbService, Conversation, Message } from "@/lib/firebase";
import { getAvatarColor, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { 
  Send, 
  MessageSquare, 
  ArrowLeft, 
  Eye, 
  Circle, 
  Ghost,
  Lock
} from "lucide-react";

export default function MessagesPage() {
  const { user, profile, setShowLoginModal } = useAuth();
  
  // Data lists
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chats, setChats] = useState<Message[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  
  // Input message
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load conversations list in real-time
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsubscribe = dbService.listenConversations(user.uid, (list) => {
      setConversations(list);
      setLoading(false);
      
      // If we don't have an active conversation, but we have them, select first by default on desktop
      if (list.length > 0 && !activeConvId && window.innerWidth >= 640) {
        setActiveConvId(list[0].id);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Load chats stream in real-time
  useEffect(() => {
    if (!activeConvId) {
      setChats([]);
      return;
    }

    const unsubscribe = dbService.listenChats(activeConvId, (messages) => {
      setChats(messages);
      
      // Scroll to bottom
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [activeConvId]);

  // Force scroll to bottom on chats change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [chats]);

  if (!user) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
        <Lock size={32} className="text-txt-tertiary mb-3 animate-bounce" />
        <h3 className="text-sm font-bold text-txt-primary">Direct Messages</h3>
        <p className="text-xs text-txt-secondary mt-1 mb-6 leading-relaxed">
          Sign in to text other agritech inventors, network with startup co-founders, or collaborate on solving recursive DSA models.
        </p>
        <button
          onClick={() => setShowLoginModal(true)}
          className="w-full py-2.5 px-4 bg-brand-orange hover:bg-brand-orangeHover text-white text-xs font-semibold rounded-md shadow transition"
        >
          sign in to view chats
        </button>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeConvId || sending) return;

    setSending(true);
    try {
      await dbService.sendMessage(activeConvId, text.trim(), user.uid);
      setText("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const getRecipientInfo = (conv: Conversation) => {
    const otherId = conv.participantIds.find(id => id !== user.uid);
    if (!otherId || !conv.participantsInfo) return { displayName: "Chat User", username: "user", photoURL: "" };
    return conv.participantsInfo[otherId] || { displayName: "Chat User", username: "user", photoURL: "" };
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeRecipient = activeConv ? getRecipientInfo(activeConv) : null;
  const activeRecipientId = activeConv ? activeConv.participantIds.find(id => id !== user.uid) : null;
  const rInitials = activeRecipient?.displayName
    ? activeRecipient.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";
  const rStyle = getAvatarColor(activeRecipientId || "");

  return (
    <div className="w-full border border-border-tertiary rounded-xl bg-bg-primary shadow-sm h-[75vh] flex overflow-hidden -mt-1 sm:mt-0">
      
      {/* 1. LEFT SIDEBAR: INBOX CONVERSATIONS LIST */}
      <div 
        className={`w-full sm:w-80 shrink-0 border-r border-border-tertiary flex flex-col ${
          activeConvId ? "hidden sm:flex" : "flex"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border-tertiary shrink-0 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary flex items-center gap-1.5">
            <MessageSquare size={14} className="text-brand-orange" />
            Inbox Conversations
          </h3>
        </div>

        {/* Sidebar Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-border-tertiary/10 no-scrollbar">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(n => (
                <div key={n} className="flex gap-3 items-center animate-pulse">
                  <div className="w-9 h-9 bg-bg-tertiary rounded-full shrink-0"></div>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-bg-tertiary rounded w-2/3"></div>
                    <div className="h-2.5 bg-bg-tertiary rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-16 text-center px-4">
              <MessageSquare size={26} className="text-txt-tertiary mx-auto mb-2" />
              <h5 className="text-[11px] font-bold text-txt-primary">No messages yet</h5>
              <p className="text-[10px] text-txt-secondary leading-relaxed max-w-[160px] mx-auto mt-1">
                Go to a builder&apos;s profile or post detail page and click build together to chat!
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const info = getRecipientInfo(conv);
              const otherUid = conv.participantIds.find(id => id !== user.uid) || "";
              const initials = info.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
              const avatarStyle = getAvatarColor(otherUid);
              const isActive = conv.id === activeConvId;
              const hasUnread = conv.unreadCount && conv.unreadCount > 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full p-4 flex gap-3 text-left transition ${
                    isActive 
                      ? "bg-bg-secondary" 
                      : "hover:bg-bg-secondary/40"
                  }`}
                >
                  {/* Initials Avatar */}
                  <div 
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border border-border-tertiary"
                    style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}
                  >
                    {initials}
                  </div>

                  {/* Conv details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs truncate ${hasUnread ? "font-bold text-txt-primary" : "font-semibold text-txt-primary"}`}>
                        {info.displayName}
                      </span>
                      <span className="text-[9px] text-txt-tertiary shrink-0 ml-1.5">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-[11px] truncate ${hasUnread ? "font-semibold text-txt-primary" : "text-txt-secondary"}`}>
                        {conv.lastMessage}
                      </p>
                      
                      {/* Unread indicators */}
                      {hasUnread && (
                        <span className="w-2 h-2 bg-[#E24B4A] rounded-full shrink-0 ml-1.5 animate-pulse" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. RIGHT PANEL: DIRECT CHAT LOGS */}
      <div 
        className={`flex-1 flex flex-col bg-bg-secondary/20 relative ${
          !activeConvId ? "hidden sm:flex" : "flex"
        }`}
      >
        {activeConv && activeRecipient ? (
          <>
            {/* Chat header */}
            <div className="h-14 px-4 border-b border-border-tertiary flex items-center gap-3 shrink-0 bg-bg-primary">
              {/* Back to Inbox for mobile viewport */}
              <button 
                onClick={() => setActiveConvId(null)}
                className="sm:hidden p-1 rounded hover:bg-bg-secondary text-txt-secondary"
                aria-label="Back to inbox"
              >
                <ArrowLeft size={16} />
              </button>

              {/* Chat user initials avatar */}
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border border-border-tertiary"
                style={{ backgroundColor: rStyle.bg, color: rStyle.text }}
              >
                {rInitials}
              </div>

              {/* Name Details */}
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-txt-primary">
                  {activeRecipient.displayName}
                </span>
                <span className="text-[9px] text-txt-secondary">
                  @{activeRecipient.username}
                </span>
              </div>

              <div className="ml-auto flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded py-1 px-2.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                <Circle size={8} className="fill-current animate-pulse text-green-500" />
                <span>active now</span>
              </div>
            </div>

            {/* Chats Messages Feed container */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 p-4 overflow-y-auto space-y-3.5 no-scrollbar flex flex-col"
            >
              {chats.length === 0 ? (
                <div className="my-auto text-center py-10 px-4">
                  <Ghost size={26} className="text-txt-tertiary mx-auto mb-2 animate-bounce" />
                  <span className="text-xs text-txt-secondary">This conversation has just started. Say hello!</span>
                </div>
              ) : (
                chats.map((msg) => {
                  const isOwn = msg.senderId === user.uid;
                  return (
                    <div 
                      key={msg.id}
                      className={`max-w-[75%] rounded-2xl py-2.5 px-4 text-xs sm:text-sm leading-relaxed text-left flex flex-col ${
                        isOwn
                          ? "bg-brand-orange text-white rounded-br-none ml-auto"
                          : "bg-bg-primary text-txt-primary rounded-bl-none mr-auto border border-border-tertiary/60"
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span className={`text-[8.5px] mt-1 shrink-0 ${isOwn ? "text-orange-200 text-right" : "text-txt-tertiary text-left"}`}>
                        {formatRelativeTime(msg.createdAt)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat bottom Message Input bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border-tertiary bg-bg-primary shrink-0 flex gap-2">
              <input
                type="text"
                required
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Text ${activeRecipient.displayName.split(" ")[0]}...`}
                className="flex-1 h-9 px-3.5 text-xs bg-bg-secondary text-txt-primary border border-border-tertiary rounded-md focus:outline-none focus:border-txt-secondary transition"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="w-9 h-9 bg-brand-orange hover:bg-brand-orangeHover disabled:opacity-50 text-white rounded-md flex items-center justify-center shadow transition shrink-0"
              >
                <Send size={14} className={sending ? "animate-pulse" : ""} />
              </button>
            </form>
          </>
        ) : (
          <div className="my-auto flex flex-col items-center justify-center text-center p-4">
            <MessageSquare size={36} className="text-txt-tertiary mb-2.5 animate-pulse" />
            <h4 className="text-xs font-bold text-txt-primary">Direct Messages Inbox</h4>
            <p className="text-[11px] text-txt-secondary max-w-xs leading-relaxed mt-1">
              Select an active conversation on the left inbox drawer, or message partners from peer profile tabs to begin real conversation!
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
