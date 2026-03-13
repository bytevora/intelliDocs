"use client";

import { useEffect, useState } from "react";
import { SocketIOProvider } from "@/lib/collaboration/socket-io-provider";

interface AwarenessUser {
  name: string;
  color: string;
  id: string;
}

interface OnlineUsersProps {
  provider: SocketIOProvider;
  currentUserId: string;
}

export function OnlineUsers({ provider, currentUserId }: OnlineUsersProps) {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    const updateUsers = () => {
      const states = provider.awareness.getStates();
      const onlineUsers: AwarenessUser[] = [];
      states.forEach((state, clientId) => {
        if (
          state.user &&
          clientId !== provider.doc.clientID &&
          state.user.id !== currentUserId
        ) {
          // Deduplicate by user id
          if (!onlineUsers.some((u) => u.id === state.user.id)) {
            onlineUsers.push(state.user);
          }
        }
      });
      setUsers(onlineUsers);
    };

    updateUsers();
    provider.awareness.on("change", updateUsers);
    return () => {
      provider.awareness.off("change", updateUsers);
    };
  }, [provider, currentUserId]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {users.map((user) => (
        <div
          key={user.id}
          className="relative group"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white cursor-default"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border">
            {user.name}
          </div>
        </div>
      ))}
    </div>
  );
}
