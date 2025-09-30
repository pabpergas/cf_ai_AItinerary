import React from 'react';
import { Avatar } from '@/components/avatar/Avatar';

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  lastSeen: number;
}

interface UserPresenceProps {
  collaborators: Collaborator[];
  currentUser: Collaborator | null;
  isConnected: boolean;
}

export function UserPresence({ collaborators, currentUser, isConnected }: UserPresenceProps) {
  const allUsers = currentUser ? [currentUser, ...collaborators] : collaborators;
  const activeUsers = allUsers.filter(user => 
    Date.now() - user.lastSeen < 30000 // Active within last 30 seconds
  );

  if (!isConnected || activeUsers.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-sm text-gray-600 whitespace-nowrap">
          {activeUsers.length} {activeUsers.length === 1 ? 'person' : 'people'} editing
        </span>
      </div>
      
      <div className="flex -space-x-2">
        {activeUsers.slice(0, 5).map((user, index) => (
          <div
            key={user.id}
            className="relative"
            style={{ zIndex: activeUsers.length - index }}
          >
            <Avatar
              className="w-8 h-8 border-2 border-white shadow-sm"
              style={{ backgroundColor: user.color }}
            >
              <span className="text-xs font-medium text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </Avatar>
            
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
          </div>
        ))}
        
        {activeUsers.length > 5 && (
          <div className="w-8 h-8 bg-gray-300 border-2 border-white rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-gray-600">
              +{activeUsers.length - 5}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
