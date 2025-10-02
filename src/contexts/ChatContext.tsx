import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";

interface User {
  userId: string;
  email: string;
  name: string;
  token: string;
}

interface ChatContextType {
  messages: UIMessage<{ createdAt: string }>[];
  sendMessage: (message: string) => void;
  status: "ready" | "streaming" | "submitted";
  clearHistory: () => void;
  isConnected: boolean;
  user: User;
  conversationId: string | null;
  stop: () => void;
  input: string;
  setInput: (input: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
}

interface ChatProviderProps {
  children: ReactNode;
  user: User;
  conversationId: string | null;
}

export function ChatProvider({ children, user, conversationId }: ChatProviderProps) {
  // Generate a stable agentName only once when the component mounts
  const [agentName] = useState(() =>
    conversationId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Connect to the agent with the stable name
  const agent = useAgent({
    agent: "chat",
    name: agentName,
    query: { token: user.token }
  });

  // Set up the chat interaction using useAgentChat (like in the reference)
  const {
    messages,
    sendMessage: agentSendMessage,
    clearHistory,
    status,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  // Wrapper for sendMessage that accepts a string and converts to UIMessage
  const sendMessage = useCallback((message: string) => {
    agentSendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message }]
      },
      {
        body: {}
      }
    );
  }, [agentSendMessage]);

  const value: ChatContextType = {
    messages: (messages || []) as UIMessage<{ createdAt: string }>[],
    sendMessage,
    status: status || "ready",
    clearHistory: clearHistory || (() => {}),
    isConnected: status !== "ready" || (messages?.length || 0) > 0,
    user,
    conversationId: agentName,
    stop: stop || (() => {}),
    input: "",
    setInput: () => {},
    handleSubmit: () => {}
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
