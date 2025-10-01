import { useEffect, useState, useCallback, use } from "react";
import { useParams } from "react-router-dom";

// Component imports
import { AuthModal } from "@/components/auth/AuthModal";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatContainer } from "@/components/ChatContainer";

interface User {
  userId: string;
  email: string;
  name: string;
  token: string;
}

export default function AItinerary() {
  const { conversationId } = useParams<{ conversationId?: string }>();

  const [recentChats, setRecentChats] = useState<Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: string;
  }>>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleLogin = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const userData: User = {
          userId: data.userId,
          email: data.email,
          name: data.name,
          token: data.token
        };
        setUser(userData);
        localStorage.setItem('aitinerary-user', JSON.stringify(userData));
        setShowAuthModal(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Connection error. Please try again.');
    }
  }, []);

  const handleRegister = useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (data.success) {
        const userData: User = {
          userId: data.userId,
          email: data.email,
          name: data.name,
          token: data.token
        };
        setUser(userData);
        localStorage.setItem('aitinerary-user', JSON.stringify(userData));
        setShowAuthModal(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Connection error. Please try again.');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      if (user?.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('aitinerary-user');
      setRecentChats([]);
    }
  }, [user?.token]);

  useEffect(() => {
    // Load user from localStorage
    const loadUser = () => {
      const stored = localStorage.getItem('aitinerary-user');
      if (stored) {
        try {
          const userData = JSON.parse(stored);
          setUser(userData);
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    // Load conversations when user is available
    const loadConversations = async () => {
      if (!user?.token) return;

      try {
        const response = await fetch('/api/conversations', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        if (response.ok) {
          const data: any = await response.json();
          setRecentChats(data.conversations || []);
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };

    if (user?.token) {
      loadConversations();
    }
  }, [user?.token]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <HasAIKey />

      {/* Left Sidebar */}
      <Sidebar
        user={user}
        recentChats={recentChats}
        onShowAuthModal={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {/* Chat Container - will re-mount when conversationId changes */}
      <ChatContainer
        key={conversationId || 'new'}
        conversationId={conversationId || null}
        user={user}
        onShowAuthModal={() => setShowAuthModal(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
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
