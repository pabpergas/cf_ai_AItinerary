// Global window state management outside React lifecycle
declare global {
  interface Window {
    __appState: {
      conversationId: string | null;
      user: {
        userId: string;
        email: string;
        name: string;
        token: string;
      } | null;
    };
    __appStateListeners: Set<() => void>;
    __appStateSnapshot: {
      conversationId: string | null;
      user: {
        userId: string;
        email: string;
        name: string;
        token: string;
      } | null;
    };
  }
}

// Initialize global state
if (typeof window !== 'undefined') {
  window.__appState = window.__appState || {
    conversationId: null,
    user: null,
  };
  window.__appStateListeners = window.__appStateListeners || new Set();
  window.__appStateSnapshot = window.__appStateSnapshot || {
    conversationId: null,
    user: null,
  };
}

function updateSnapshot() {
  window.__appStateSnapshot = {
    conversationId: window.__appState?.conversationId || null,
    user: window.__appState?.user || null,
  };
}

function notifyListeners() {
  updateSnapshot();
  window.__appStateListeners?.forEach(listener => listener());
}

export const windowState = {
  getConversationId: (): string | null => {
    return window.__appState?.conversationId || null;
  },

  setConversationId: (id: string | null) => {
    if (window.__appState && window.__appState.conversationId !== id) {
      window.__appState.conversationId = id;
      notifyListeners();
    }
  },

  getUser: () => {
    return window.__appState?.user || null;
  },

  setUser: (user: { userId: string; email: string; name: string; token: string } | null) => {
    const current = window.__appState?.user;
    const changed = !current !== !user ||
                   current?.userId !== user?.userId ||
                   current?.token !== user?.token;

    if (window.__appState && changed) {
      window.__appState.user = user;
      notifyListeners();
    }
  },

  generateConversationId: (): string => {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  subscribe: (listener: () => void) => {
    window.__appStateListeners?.add(listener);
    return () => {
      window.__appStateListeners?.delete(listener);
    };
  },

  getSnapshot: () => {
    return window.__appStateSnapshot;
  },
};
