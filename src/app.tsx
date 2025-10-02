import { useEffect, useState, useCallback, lazy, Suspense, use } from "react";
import { useParams } from "react-router-dom";

// Component imports
import { useSession, signOut } from "@/lib/auth-client";
import { windowState } from "@/lib/window-state";
import { useWindowState } from "@/hooks/useWindowState";

// Dynamic imports for code splitting
const AuthModal = lazy(() => import("@/components/auth/AuthModal").then(m => ({ default: m.AuthModal })));
const Sidebar = lazy(() => import("@/components/sidebar/Sidebar").then(m => ({ default: m.Sidebar })));
const ChatContainer = lazy(() => import("@/components/ChatContainer").then(m => ({ default: m.ChatContainer })));

interface User {
  userId: string;
  email: string;
  name: string;
  token: string;
}

export default function AItinerary() {
  const { conversationId: conversationIdFromUrl } = useParams<{ conversationId?: string }>();
  const { data: session, isPending } = useSession();
  const { conversationId, user } = useWindowState();

  const [recentChats, setRecentChats] = useState<Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: string;
  }>>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Sync conversationId from URL to window state
  useEffect(() => {
    if (conversationIdFromUrl) {
      // URL has conversationId, sync it to window state
      windowState.setConversationId(conversationIdFromUrl);
    } else if (user && !conversationId) {
      // User is logged in but no conversation active - create new one and navigate
      const newId = windowState.generateConversationId();
      windowState.setConversationId(newId);
      // Navigate to the new conversation URL
      window.history.replaceState(null, '', `/chat/${newId}`);
    } else if (!user) {
      // User not logged in, clear conversation
      windowState.setConversationId(null);
    }
  }, [conversationIdFromUrl, user, conversationId]);

  // Sync session to window state (only once per session change)
  useEffect(() => {
    if (session?.user && session?.session?.token) {
      const newUser = {
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        token: session.session.token
      };

      windowState.setUser(newUser);
    } else {
      windowState.setUser(null);
      windowState.setConversationId(null);
    }
  }, [session?.user?.id, session?.session?.token]);

  const handleShowAuthModal = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  const handleCloseAuthModal = useCallback(() => {
    setShowAuthModal(false);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    // Session will be automatically updated by useSession hook
    setShowAuthModal(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    windowState.setUser(null);
    windowState.setConversationId(null);
    setRecentChats([]);
  }, []);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    if (!user?.token) return;

    try {
      const response = await fetch('/api/conversations', {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const data = await response.json();
      if (data.success && data.conversations) {
        console.log('[App] Conversations fetched:', data.conversations);
        setRecentChats(data.conversations);
      }
    } catch (error) {
      console.error('[App] Failed to fetch conversations:', error);
    }
  }, [user?.token]);

  // Fetch conversations on mount and when user changes
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Listen for conversation title updates
  useEffect(() => {
    console.log('[App] Registering event listeners for conversations');

    const handleTitleUpdate = (event: CustomEvent) => {
      console.log('[App] Conversation title updated event received:', event.detail);
      // Refresh conversations list
      fetchConversations();
    };

    const handleConversationCreated = (event: CustomEvent) => {
      console.log('[App] New conversation created event received:', event.detail);
      // Refresh conversations list immediately
      fetchConversations();
    };

    window.addEventListener('conversation-title-updated', handleTitleUpdate as EventListener);
    window.addEventListener('conversation-created', handleConversationCreated as EventListener);

    console.log('[App] Event listeners registered');

    return () => {
      console.log('[App] Removing event listeners');
      window.removeEventListener('conversation-title-updated', handleTitleUpdate as EventListener);
      window.removeEventListener('conversation-created', handleConversationCreated as EventListener);
    };
  }, [fetchConversations]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <HasAIKey />

      {/* Left Sidebar */}
      <Suspense fallback={
        <div className="w-64 bg-[#171717] flex flex-col h-full animate-pulse">
          <div className="p-3">
            <div className="w-full h-12 bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      }>
        <Sidebar
          recentChats={recentChats}
          onShowAuthModal={handleShowAuthModal}
          onLogout={handleLogout}
        />
      </Suspense>

      {/* Chat Container */}
      {user ? (
        <Suspense fallback={
          <div className="flex-1 flex flex-col bg-white h-screen">
            <div className="flex-1 overflow-y-auto max-h-screen">
              <div className="h-full flex items-center justify-center">
                <div className="max-w-2xl mx-auto text-center px-4">
                  <h1 className="text-3xl font-semibold text-gray-900 mb-8">
                    How can I help you today?
                  </h1>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                    <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 text-left">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        Weekend in Tokyo
                      </div>
                      <div className="text-xs text-gray-600">
                        3 days exploring culture, food and points of interest
                      </div>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 text-left">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        European adventure
                      </div>
                      <div className="text-xs text-gray-600">
                        Multi-city trip with transport and schedules
                      </div>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 text-left">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        Budget backpacking
                      </div>
                      <div className="text-xs text-gray-600">
                        Budget adventure trip
                      </div>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 text-left">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        Luxury getaway
                      </div>
                      <div className="text-xs text-gray-600">
                        Premium experiences and accommodations
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }>
          <ChatContainer
            key={conversationId || 'new-chat'}
            user={user}
            conversationId={conversationId}
            onShowAuthModal={handleShowAuthModal}
          />
        </Suspense>
      ) : (
        <div className="flex-1 flex flex-col bg-white h-screen">
          <div className="flex-1 overflow-y-auto max-h-screen">
            <div className="h-full flex items-center justify-center">
              <div className="max-w-2xl mx-auto text-center px-4">
                <h1 className="text-3xl font-semibold text-gray-900 mb-8">
                  How can I help you today?
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                  <button
                    onClick={handleShowAuthModal}
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Weekend in Tokyo
                    </div>
                    <div className="text-xs text-gray-600">
                      3 days exploring culture, food and points of interest
                    </div>
                  </button>

                  <button
                    onClick={handleShowAuthModal}
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      European adventure
                    </div>
                    <div className="text-xs text-gray-600">
                      Multi-city trip with transport and schedules
                    </div>
                  </button>

                  <button
                    onClick={handleShowAuthModal}
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Budget backpacking
                    </div>
                    <div className="text-xs text-gray-600">
                      Budget adventure trip
                    </div>
                  </button>

                  <button
                    onClick={handleShowAuthModal}
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Luxury getaway
                    </div>
                    <div className="text-xs text-gray-600">
                      Premium experiences and accommodations
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={showAuthModal}
            onClose={handleCloseAuthModal}
            onSuccess={handleAuthSuccess}
          />
        </Suspense>
      )}
    </div>
  );
}

const hasAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean; message: string }>()
);

function HasAIKey() {
  const hasAiKey = use(hasAiKeyPromise);

  if (!hasAiKey.success) {
    return (
      <div className="absolute top-0 left-0 right-0 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-medium text-red-800 dark:text-red-200">OpenAI key no configurada</span>
              <span className="text-red-600 dark:text-red-300 ml-2">Configura OPENAI_API_KEY para usar la IA</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
