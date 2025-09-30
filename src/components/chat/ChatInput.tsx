import { Textarea } from "@/components/textarea/Textarea";
import { ArrowUp, Stop, Globe, User, Phone } from "@phosphor-icons/react";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  searchEnabled: boolean;
  onToggleSearch: () => void;
  onToggleVoiceCall: () => void;
  onShowAuthModal: () => void;
  pendingConfirmation?: boolean;
  selectedActivity?: { activity: any; itinerary: any } | null;
  onClearActivity?: () => void;
  isVoiceCallActive?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  onStop,
  isAuthenticated,
  isSubmitting,
  searchEnabled,
  onToggleSearch,
  onToggleVoiceCall,
  onShowAuthModal,
  pendingConfirmation = false,
  selectedActivity,
  onClearActivity,
  isVoiceCallActive = false
}: ChatInputProps) {
  return (
    <div className="p-4 bg-white">
      <div className="max-w-3xl mx-auto">
        {selectedActivity && onClearActivity && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-800">
                  Selected activity: {selectedActivity.activity.title}
                </span>
              </div>
              <button
                type="button"
                onClick={onClearActivity}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <div className="relative">
          <form onSubmit={onSubmit}>
            <div className={`relative flex items-end border rounded-3xl shadow-sm transition-all duration-200 ${
              isVoiceCallActive 
                ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                : 'bg-white border-gray-200 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
            }`}>
              {/* Search Toggle Button */}
              <button
                type="button"
                onClick={onToggleSearch}
                className={`absolute left-4 bottom-4 transition-colors ${
                  searchEnabled 
                    ? 'text-blue-600 hover:text-blue-700' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                disabled={!isAuthenticated || isVoiceCallActive}
                title={isVoiceCallActive ? "Voice call in progress" : searchEnabled ? "Web search enabled" : "Enable web search"}
              >
                <Globe size={20} weight={searchEnabled ? "fill" : "regular"} />
              </button>

              {/* Voice Call Button */}
              <button
                type="button"
                onClick={onToggleVoiceCall}
                className={`absolute left-12 bottom-4 transition-colors ${
                  isVoiceCallActive 
                    ? 'text-purple-600' 
                    : 'text-gray-400 hover:text-purple-600'
                }`}
                disabled={!isAuthenticated}
                title={isVoiceCallActive ? "Voice call active" : "Start voice call with AI"}
              >
                <Phone size={20} weight="regular" />
              </button>
              
              <Textarea
                disabled={!isAuthenticated || pendingConfirmation || isVoiceCallActive}
                placeholder={
                  isVoiceCallActive
                    ? "Voice call in progress - input disabled..."
                    : !isAuthenticated
                    ? "Sign in to chat with AItinerary..."
                    : pendingConfirmation
                    ? "Please respond to the previous confirmation..."
                    : searchEnabled
                    ? "Ask AItinerary (with web search enabled)..."
                    : "Ask AItinerary about your next trip..."
                }
                className="flex-1 py-4 bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-gray-900 placeholder-gray-500 text-base leading-relaxed"
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                rows={1}
                style={{ 
                  minHeight: '56px', 
                  maxHeight: '200px',
                  paddingLeft: '80px',
                  paddingRight: '60px'
                }}
              />
              
              {/* Send/Stop Button */}
              <div className="absolute right-3 bottom-2">
                {isSubmitting ? (
                  <button
                    type="button"
                    onClick={onStop}
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <Stop size={18} weight="bold" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!isAuthenticated || !value.trim() || isVoiceCallActive}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isAuthenticated && value.trim() && !isVoiceCallActive
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-105' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUp size={18} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          </form>

          {!isAuthenticated && (
            <div className="absolute inset-0 rounded-3xl bg-white/95 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <User size={24} className="text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">Sign in to get started</p>
                <p className="text-xs text-gray-500 mb-3">Plan amazing trips with artificial intelligence</p>
                <button
                  onClick={onShowAuthModal}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors shadow-md"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
          <div className="flex items-center gap-2">
            <Globe size={12} className={searchEnabled ? 'text-blue-500' : 'text-gray-400'} weight={searchEnabled ? "fill" : "regular"} />
            <span>Web search: {searchEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="text-center">
            AItinerary may make errors. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}
