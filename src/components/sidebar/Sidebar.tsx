import { PencilSimple, ChatCircle, User, SignOut } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

interface SidebarProps {
  user: {
    name: string;
    email: string;
  } | null;
  recentChats: Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: string;
  }>;
  onShowAuthModal: () => void;
  onLogout: () => void;
}

export function Sidebar({
  user,
  recentChats,
  onShowAuthModal,
  onLogout
}: SidebarProps) {
  return (
    <div className="w-64 bg-[#171717] flex flex-col h-full">
      {/* Top Section */}
      <div className="p-3">
        {/* New Chat Button */}
        <Link
          to="/"
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-600 hover:bg-gray-700 text-white transition-colors"
        >
          <PencilSimple size={16} />
          <span className="text-sm">New chat</span>
        </Link>
      </div>

      {/* Chats Section */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="pb-3">
          <div className="text-xs text-gray-500 mb-2 px-3">AItinerary</div>
          <div className="space-y-1">
            {recentChats.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-8 px-3">
                Your recent trips will appear here
              </div>
            ) : (
              recentChats.map((chat) => (
                <Link
                  key={chat.id}
                  to={`/chat/${chat.id}`}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-left"
                >
                  <ChatCircle size={16} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{chat.title}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section - User */}
      <div className="p-3 border-t border-gray-600">
        {user ? (
          <div className="relative group">
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm text-white">{user.name}</div>
                <div className="text-xs text-gray-400">Free</div>
              </div>
            </button>
            
            {/* Dropdown Menu */}
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 rounded-lg shadow-lg border border-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="p-3 border-b border-gray-600">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <SignOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onShowAuthModal}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            <User size={16} />
            <span className="text-sm">Sign in</span>
          </button>
        )}
      </div>
    </div>
  );
}
