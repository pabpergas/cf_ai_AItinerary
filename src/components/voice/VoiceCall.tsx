/**
 * Voice Call Component for AI Travel Assistant
 * Uses OpenAI Realtime API with native WebRTC
 */

import { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Minimize2 } from "lucide-react";
import AIOrb from "@/components/ui/AIOrb";

interface VoiceCallProps {
  isOpen: boolean;
  onClose: () => void;
  userToken?: string;
  conversationId?: string;
  onToolCall?: (toolName: string, args: any, result: any) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
}

export function VoiceCall({ isOpen, onClose, userToken, conversationId, onToolCall, onTranscript }: VoiceCallProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [toolsConfigured, setToolsConfigured] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const callStartRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);

  // Save transcript to database and add to chat
  const saveTranscript = async (role: 'user' | 'assistant', content: string) => {
    if (!userToken || !conversationId) return;

    try {
      // Save to database
      await fetch('/api/voice/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          conversationId,
          role,
          content,
        }),
      });
      console.log(`Saved ${role} transcript to DB`);

      // Add to chat UI immediately
      if (onTranscript) {
        onTranscript(role, content);
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
    }
  };

  // Execute a tool and return the result
  const executeTool = async (toolName: string, args: any): Promise<any> => {
    try {
      console.log(`Executing tool: ${toolName}`, args);
      
      // Call our server endpoint to execute the tool
      const response = await fetch('/api/voice/execute-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userToken && { Authorization: `Bearer ${userToken}` }),
        },
        body: JSON.stringify({ toolName, args }),
      });

      if (!response.ok) {
        throw new Error(`Tool execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Tool ${toolName} result:`, result);
      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return { error: `Failed to execute ${toolName}` };
    }
  };

  // Create audio element for playback
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioElementRef.current) {
      const el = document.createElement('audio');
      el.autoplay = true;
      el.style.display = 'none';
      document.body.appendChild(el);
      audioElementRef.current = el;
    }

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.remove();
        audioElementRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCall();
    } else {
      // Only call endCall when modal closes
      endCall();
    }
  }, [isOpen]);

  const startCall = async () => {
    try {
      console.log('Starting voice call with WebRTC...');

      // Get ephemeral token from our server
      const tokenResponse = await fetch("/api/realtime/token", {
        headers: {
          ...(userToken && { Authorization: `Bearer ${userToken}` }),
        },
      });
      const data = await tokenResponse.json() as { value?: string };
      const EPHEMERAL_KEY = data.value;

      if (!EPHEMERAL_KEY) {
        throw new Error('Failed to get ephemeral token');
      }

      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up to play remote audio from the model
      pc.ontrack = (e) => {
        console.log('Received audio track from OpenAI');
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = e.streams[0];
        }
      };

      // Add local audio track for microphone input
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = ms;
      pc.addTrack(ms.getTracks()[0]);

      // Set up data channel for sending and receiving events
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('Data channel opened');
        setIsConnected(true);
        
        // Start call timer
        callStartRef.current = Date.now();
        durationIntervalRef.current = window.setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
        }, 1000);
      };

      dc.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received event:', message.type, message);

          // Handle different event types
          switch (message.type) {
            case 'session.created':
              // Session is ready, now configure tools
              if (!toolsConfigured) {
                console.log('Configuring tools after session.created');
                const sessionUpdateEvent = {
                  type: 'session.update',
                  session: {
                    turn_detection: {
                      type: 'server_vad',
                      threshold: 0.5,
                      prefix_padding_ms: 300,
                      silence_duration_ms: 500
                    },
                    input_audio_transcription: {
                      model: 'whisper-1'
                    },
                    tools: [
                      {
                        type: 'function',
                        name: 'generateCompleteItinerary',
                        description: 'Generate a complete travel itinerary with all days and activities',
                        parameters: {
                          type: 'object',
                          properties: {
                            destination: { type: 'string' },
                            arrivalDate: { type: 'string' },
                            departureDate: { type: 'string' },
                            travelers: { type: 'number' },
                            budget: { type: 'number' },
                            interests: { 
                              type: 'array',
                              items: { type: 'string' }
                            }
                          },
                          required: ['destination', 'arrivalDate', 'departureDate', 'travelers']
                        }
                      },
                      {
                        type: 'function',
                        name: 'searchBooking',
                        description: 'Search for hotels on Booking.com',
                        parameters: {
                          type: 'object',
                          properties: {
                            destination: { type: 'string' },
                            checkIn: { type: 'string' },
                            checkOut: { type: 'string' },
                            guests: { type: 'number' }
                          },
                          required: ['destination', 'checkIn', 'checkOut']
                        }
                      }
                    ],
                    tool_choice: 'auto'
                  }
                };
                
                dc.send(JSON.stringify(sessionUpdateEvent));
                setToolsConfigured(true);
              }
              break;

            case 'conversation.item.input_audio_transcription.completed':
              // User speech transcribed
              if (message.transcript) {
                console.log('User transcript:', message.transcript);
                await saveTranscript('user', message.transcript);
              }
              break;

            case 'response.audio_transcript.delta':
              // AI is speaking - we get text chunks
              setIsAISpeaking(true);
              break;

            case 'response.audio_transcript.done':
              // AI finished speaking a segment
              if (message.transcript) {
                console.log('AI transcript:', message.transcript);
                await saveTranscript('assistant', message.transcript);
              }
              break;
            
            case 'response.audio.delta':
              setIsAISpeaking(true);
              break;
            
            case 'response.audio.done':
              setIsAISpeaking(false);
              break;
            
            case 'response.done':
              // Check if there are function calls in the response
              if (message.response?.output) {
                for (const output of message.response.output) {
                  if (output.type === 'function_call') {
                    console.log(`Function call detected: ${output.name}`, output);
                    const args = JSON.parse(output.arguments);
                    
                    // Execute the function
                    const result = await executeTool(output.name, args);
                    
                    // Notify parent component
                    if (onToolCall) {
                      onToolCall(output.name, args, result);
                    }
                    
                    // Send result back to AI
                    dc.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: output.call_id,
                        output: JSON.stringify(result),
                      },
                    }));
                    
                    // Request AI to continue with the function result
                    dc.send(JSON.stringify({ type: 'response.create' }));
                  }
                }
              }
              break;
          }
        } catch (error) {
          console.error('Error parsing data channel message:', error);
        }
      };

      dc.onerror = (error) => {
        console.error('Data channel error:', error);
      };

      dc.onclose = () => {
        console.log('Data channel closed');
        setIsConnected(false);
      };

      // Start the session using the Session Description Protocol (SDP)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('Sending SDP offer directly to OpenAI...');
      
      // Send SDP directly to OpenAI with ephemeral token
      const baseUrl = "https://api.openai.com/v1/realtime/calls";
      const model = "gpt-realtime";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error('SDP exchange error:', errorText);
        throw new Error(`Failed to establish connection: ${errorText}`);
      }

      const answerSdp = await sdpResponse.text();
      console.log('Received SDP answer from OpenAI');

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: answerSdp,
      };

      await pc.setRemoteDescription(answer);
      console.log('WebRTC connection established');

    } catch (error) {
      console.error('Error starting call:', error);
      
      // Clean up on error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      
      alert('Could not start voice call. Please check your microphone permissions and try again.');
      onClose();
    }
  };

  const endCall = () => {
    console.log('Ending voice call...');
    
    // Clear timer first
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Close data channel
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (e) {
        console.warn('Error closing data channel:', e);
      }
      dataChannelRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn('Error closing peer connection:', e);
      }
      peerConnectionRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error stopping media stream:', e);
      }
      mediaStreamRef.current = null;
    }

    // Reset state
    setCallDuration(0);
    setIsConnected(false);
    setIsAISpeaking(false);
    setIsMuted(false);
    setIsSpeakerMuted(false);
    setToolsConfigured(false);
  };

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    if (audioElementRef.current) {
      audioElementRef.current.muted = !isSpeakerMuted;
      setIsSpeakerMuted(!isSpeakerMuted);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed ${isMinimized ? 'bottom-4 right-4' : 'bottom-4 right-4'} z-50 transition-all duration-300`}>
      <div className={`bg-white rounded-2xl shadow-2xl border border-gray-200 ${isMinimized ? 'w-20 h-20' : 'w-80'} transition-all duration-300`}>
        {isMinimized ? (
          // Minimized view - just the AIOrb
          <button
            onClick={() => setIsMinimized(false)}
            className="w-full h-full flex items-center justify-center relative"
          >
            <div className={`transform ${isConnected && !isMuted ? 'scale-100' : 'scale-75'} transition-transform duration-300`}>
              <AIOrb 
                size="48px" 
                animationDuration={isConnected && !isMuted && isAISpeaking ? 5 : 20}
              />
            </div>
            {isConnected && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </button>
        ) : (
          // Expanded view
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`transform ${isConnected && !isMuted ? 'scale-100' : 'scale-75'} transition-transform duration-300`}>
                    <AIOrb 
                      size="40px" 
                      animationDuration={isConnected && !isMuted && isAISpeaking ? 5 : 20}
                    />
                  </div>
                  {isConnected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">AI Travel Assistant</h3>
                  <p className="text-xs text-gray-500">
                    {isConnected ? formatDuration(callDuration) : 'Connecting...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Minimize"
                >
                  <Minimize2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Status */}
            {!isConnected && (
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-50 border-b border-yellow-100">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <p className="text-xs text-yellow-700">Establishing connection...</p>
              </div>
            )}

            {/* AI Speaking Indicator */}
            {isAISpeaking && (
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-100">
                <Volume2 className="w-4 h-4 text-blue-600 animate-pulse" />
                <p className="text-xs text-blue-700">AI is speaking...</p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-around p-4 gap-2">
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                disabled={!isConnected}
                className={`p-3 rounded-xl transition-all ${
                  isMuted 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>

              {/* End Call Button */}
              <button
                onClick={() => {
                  endCall();
                  onClose();
                }}
                className="p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all shadow-md hover:shadow-lg"
                title="End Call"
              >
                <PhoneOff className="w-5 h-5" />
              </button>

              {/* Speaker Button */}
              <button
                onClick={toggleSpeaker}
                disabled={!isConnected}
                className={`p-3 rounded-xl transition-all ${
                  isSpeakerMuted 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
              >
                {isSpeakerMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Status Footer */}
            <div className="px-4 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-200">
              <p className="text-xs text-center text-gray-600">
                {!isConnected 
                  ? 'Connecting to voice assistant...' 
                  : isMuted 
                    ? 'Microphone muted' 
                    : 'Listening...'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}