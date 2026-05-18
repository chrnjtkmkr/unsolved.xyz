"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { dbService, NotificationItem } from "@/lib/firebase";
import { getAvatarColor } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  MessageSquare, 
  Hand, 
  UserPlus, 
  Users, 
  Check, 
  Lock, 
  ArrowRight,
  Circle 
} from "lucide-react";

export default function NotificationsPage() {
  const { user, profile, setShowLoginModal } = useAuth();
  const router = useRouter();

  // Data states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync real-time notifications
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsubscribe = dbService.listenNotifications(user.uid, (list) => {
      setNotifications(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
        <Lock size={32} className="text-txt-tertiary mb-3 animate-pulse" />
        <h3 className="text-sm font-bold text-txt-primary">Notifications</h3>
        <p className="text-xs text-txt-secondary mt-1 mb-6 leading-relaxed">
          Sign in to view notifications. Track peer replies, &ldquo;same problem&rdquo; validations, and community gang invites.
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

  const handleNotificationClick = async (notif: NotificationItem) => {
    try {
      // Mark as read in DB
      await dbService.markNotificationRead(user.uid, notif.id);
      
      // Redirect based on type
      if (notif.postId) {
        router.push(`/post/${notif.postId}`);
      } else if (notif.gangId) {
        router.push(`/gangs/${notif.gangId}`);
      }
    } catch (e) {
      console.error("Failed to process notification click:", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifs.map(n => dbService.markNotificationRead(user.uid, n.id))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="w-full flex flex-col gap-4 animate-fade-in text-left pb-10">
      
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border-tertiary pb-3">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-txt-primary flex items-center gap-2">
            <Bell size={18} className="text-brand-orange" />
            Activity Log
          </h2>
          <p className="text-xs text-txt-secondary">Stay updated on your discussions, peer reviews, and gangs.</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-orange bg-brand-orange/5 border border-brand-orange/15 rounded py-1 px-3.5 hover:bg-brand-orange hover:text-white transition duration-150"
          >
            <Check size={11} /> Mark all read
          </button>
        )}
      </div>

      {/* Notifications Streams */}
      {loading ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-bg-secondary/40 border border-border-tertiary rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        // Empty State
        <div className="py-20 text-center border border-dashed border-border-tertiary rounded-xl bg-bg-secondary/15 max-w-lg mx-auto w-full mt-4">
          <Bell size={36} className="text-txt-tertiary mx-auto mb-3" />
          <h4 className="text-xs font-bold text-txt-primary">You are all caught up!</h4>
          <p className="text-[11px] text-txt-secondary max-w-xs mx-auto leading-relaxed mt-1">
            When other developers reply to your problems, validate your post, or invite you to active gangs, they will pop up here in real time!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notifications.map((notif) => {
            const avatarStyle = getAvatarColor(notif.fromUser.uid);
            const initials = notif.fromUser.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
            
            // Map types to descriptive icon & color
            let NotifIcon = Bell;
            let iconColor = "text-txt-tertiary";
            let notifText = "";

            if (notif.type === "reply") {
              NotifIcon = MessageSquare;
              iconColor = "text-blue-500";
              notifText = `replied to your thread: "${notif.postTitle || "..."}"`;
            } else if (notif.type === "same_problem") {
              NotifIcon = Hand;
              iconColor = "text-brand-orange";
              notifText = `validated "same problem" on your post: "${notif.postTitle || "..."}"`;
            } else if (notif.type === "gang_invite") {
              NotifIcon = UserPlus;
              iconColor = "text-purple-500";
              notifText = `invited you to join community g/${notif.gangName || "..."}`;
            } else if (notif.type === "gang_join") {
              NotifIcon = Users;
              iconColor = "text-green-500";
              notifText = `joined your community g/${notif.gangName || "..."}`;
            }

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`group border rounded-xl p-4 flex items-start gap-3.5 cursor-pointer shadow-sm transition duration-150 ${
                  !notif.read
                    ? "bg-brand-orange/[0.03] border-brand-orange/20 hover:border-brand-orange/40"
                    : "bg-bg-primary border-border-tertiary hover:border-txt-secondary hover:bg-bg-secondary/20"
                }`}
              >
                {/* Visual Avatar */}
                <div 
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border border-border-tertiary"
                  style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}
                >
                  {initials}
                </div>

                {/* Notif Body */}
                <div className="flex-1 min-w-0 flex flex-col text-left justify-center">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-txt-primary">
                      {notif.fromUser.displayName}
                    </span>
                    <span className="text-[10px] text-txt-secondary">
                      @{notif.fromUser.username}
                    </span>
                    <span className="text-txt-tertiary text-[10px]">•</span>
                    <span className="text-[9px] text-txt-tertiary font-semibold">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-txt-secondary leading-relaxed mt-1 font-medium">
                    {notifText}
                  </p>

                  <span className="text-[10px] font-bold text-brand-orange inline-flex items-center gap-0.5 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    View discussion thread <ArrowRight size={10} />
                  </span>
                </div>

                {/* Unread indicators */}
                <div className="flex flex-col items-center justify-center shrink-0 self-center gap-1.5">
                  <NotifIcon size={14} className={iconColor} />
                  {!notif.read && (
                    <Circle size={8} className="text-[#E24B4A] fill-current animate-pulse" />
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
