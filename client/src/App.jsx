import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar.jsx';
import { ChatWindow } from './components/ChatWindow.jsx';
import { EvaluationModal } from './components/EvaluationModal.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { SystemPromptModal } from './components/SystemPromptModal.jsx';
import { RubricFeedbackModal } from './components/RubricFeedbackModal.jsx';
import { MemoryModal } from './components/MemoryModal.jsx';

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isDegradedVision, setIsDegradedVision] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [memoryCount, setMemoryCount] = useState(0);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are an intelligent, helpful, and concise conversational AI assistant. Maintain context across multi-turn dialogues and deliver accurate, structured responses.'
  );
  const [allowWebSearch, setAllowWebSearch] = useState(() => {
    try {
      const saved = localStorage.getItem('cosmo_allow_web_search');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleWebSearch = (enabled) => {
    setAllowWebSearch(enabled);
    try {
      localStorage.setItem('cosmo_allow_web_search', String(enabled));
    } catch (e) {}
  };

  // Modals
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [rubricTargetMessageId, setRubricTargetMessageId] = useState(null);

  const abortControllerRef = useRef(null);

  // Initialize System Status and Auth
  useEffect(() => {
    fetchSystemStatus();
    fetchMemoryCount();
    if (token) {
      fetchCurrentUser(token);
    }
  }, [token]);

  // Load Sessions
  useEffect(() => {
    fetchSessions();
  }, [token]);

  // When active session changes, load history
  useEffect(() => {
    if (currentSessionId) {
      loadSessionHistory(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch('/api/system/status');
      const data = await res.json();
      setSystemStatus(data);
    } catch (err) {
      console.error('System status error:', err);
    }
  };

  const fetchMemoryCount = async () => {
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/memories', { headers });
      const data = await res.json();
      if (data.memories) {
        setMemoryCount(data.memories.length);
      }
    } catch (err) {
      console.error('Memory count fetch error:', err);
    }
  };

  const fetchCurrentUser = async (authToken) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        localStorage.removeItem('auth_token');
        setToken(null);
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Auth verification error:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/sessions', { headers });
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !currentSessionId) {
          setCurrentSessionId(data.sessions[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch sessions error:', err);
    }
  };

  const loadSessionHistory = async (sessionId) => {
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/history/${sessionId}`, { headers });
      const data = await res.json();
      if (data.messages && Array.isArray(data.messages)) {
        const uniqueMessages = [];
        const seenIds = new Set();
        for (const msg of data.messages) {
          if (!seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            uniqueMessages.push(msg);
          }
        }
        setMessages(uniqueMessages);
      }
    } catch (err) {
      console.error('History load error:', err);
    }
  };

  const handleNewSession = async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'New Conversation',
          providerUsed: 'gemini',
        }),
      });

      const newSess = await res.json();
      if (res.ok) {
        setSessions((prev) => [newSess, ...prev]);
        setCurrentSessionId(newSess.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('New session creation error:', err);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/session/${sessionId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          if (remaining.length > 0) {
            setCurrentSessionId(remaining[0].id);
          } else {
            setCurrentSessionId(null);
            setMessages([]);
          }
        }
      }
    } catch (err) {
      console.error('Delete session error:', err);
    }
  };

  const handleSendMessage = async (text, fileId = null, attachedFilename = null) => {
    if (!text.trim() || isLoading) return;

    let targetSessionId = currentSessionId;

    if (!targetSessionId) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/session', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
            providerUsed: 'gemini',
          }),
        });
        const newSess = await res.json();
        targetSessionId = newSess.id;
        setCurrentSessionId(newSess.id);
        setSessions((prev) => [newSess, ...prev]);
      } catch (err) {
        targetSessionId = 'sess_' + Date.now().toString(36);
        setCurrentSessionId(targetSessionId);
      }
    }

    const tempUserMsg = {
      id: 'msg_temp_user_' + Date.now(),
      sessionId: targetSessionId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      metadata: {
        tokensEstimated: Math.ceil(text.length / 4),
        attachedFileId: fileId || null,
        attachedFilename: attachedFilename || null,
      },
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);
    setStreamingText('');
    setIsDegradedVision(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          sessionId: targetSessionId,
          message: text,
          systemPrompt,
          stream: true,
          fileId: fileId || undefined,
          allowWebSearch,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Chat request failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let currentEvent = 'message';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('event: ')) {
              currentEvent = trimmed.substring(7).trim();
              continue;
            }
            if (trimmed.startsWith('data: ')) {
              let data = null;
              try {
                data = JSON.parse(trimmed.substring(6));
              } catch (e) {
                continue;
              }

              if (!data) continue;

              if (currentEvent === 'meta' || data.type === 'meta' || data.degraded) {
                if (data.degraded) {
                  setIsDegradedVision(true);
                }
              }

              if (data.type === 'chunk') {
                accumulatedText += data.text;
                setStreamingText(accumulatedText);
              } else if (data.type === 'done') {
                if (data.degraded) {
                  setIsDegradedVision(true);
                }
                if (data.assistantMessage) {
                  setMessages((prev) => {
                    const confirmedUserMsg = data.userMessage || tempUserMsg;
                    const confirmedAssistantMsg = data.assistantMessage;
                    const map = new Map();
                    for (const m of prev) {
                      if (m.id !== tempUserMsg.id && m.id !== confirmedUserMsg.id && m.id !== confirmedAssistantMsg.id) {
                        map.set(m.id, m);
                      }
                    }
                    map.set(confirmedUserMsg.id, confirmedUserMsg);
                    map.set(confirmedAssistantMsg.id, confirmedAssistantMsg);
                    return Array.from(map.values());
                  });
                }
                setStreamingText('');
                fetchSessions();
                fetchMemoryCount();
              } else if (data.type === 'error' || currentEvent === 'error') {
                setStreamingText('');
                const errorMsg = {
                  id: 'msg_err_' + Date.now(),
                  sessionId: targetSessionId,
                  role: 'assistant',
                  content: accumulatedText
                    ? `${accumulatedText}\n\n⚠️ **Generation Interrupted:** ${data.message || data.error || 'Connection closed prematurely.'}`
                    : `⚠️ **Generation Notice:** ${data.message || data.error || 'The provider encountered a temporary error or rate limit. Please retry in a few moments.'}`,
                  timestamp: new Date().toISOString(),
                  metadata: {
                    provider: 'gemini',
                    latencyMs: 0,
                    incomplete: true,
                    error: true,
                    errorCode: data.code || 'STREAM_ERROR',
                  },
                };
                setMessages((prev) => [...prev, errorMsg]);
                setIsLoading(false);
                return;
              }
              currentEvent = 'message';
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Chat error:', err);
        const errorMsg = {
          id: 'msg_err_' + Date.now(),
          sessionId: targetSessionId,
          role: 'assistant',
          content: `⚠️ **Generation Error:** ${err.message || 'Unable to connect to LLM provider.'}`,
          timestamp: new Date().toISOString(),
          metadata: {
            provider: 'gemini',
            latencyMs: 0,
            incomplete: true,
            error: true,
          },
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = (failedMessage) => {
    if (isLoading) return;
    const msgIndex = messages.findIndex((m) => m.id === failedMessage?.id);
    let targetUserMsg = null;
    if (msgIndex > 0) {
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          targetUserMsg = messages[i];
          break;
        }
      }
    } else {
      const userMessages = messages.filter((m) => m.role === 'user');
      targetUserMsg = userMessages[userMessages.length - 1] || null;
    }

    if (targetUserMsg && targetUserMsg.content) {
      handleSendMessage(
        targetUserMsg.content,
        targetUserMsg.metadata?.attachedFileId,
        targetUserMsg.metadata?.attachedFilename
      );
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      if (streamingText) {
        const stoppedMsg = {
          id: 'msg_stopped_' + Date.now(),
          sessionId: currentSessionId || 'sess_default',
          role: 'assistant',
          content: streamingText + ' _[generation stopped by user]_',
          timestamp: new Date().toISOString(),
          metadata: {
            provider: 'gemini',
          },
        };
        setMessages((prev) => [...prev, stoppedMsg]);
      }
      setStreamingText('');
    }
  };

  const handleLoginSuccess = (newToken, user) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    fetchSessions();
    fetchMemoryCount();
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        // Suppress network errors on logout
      }
    }
    localStorage.removeItem('auth_token');
    setToken(null);
    setCurrentUser(null);
    fetchSessions();
    fetchMemoryCount();
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FBF9F5] font-sans text-stone-900 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        systemStatus={systemStatus}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenEvalModal={() => setIsEvalModalOpen(true)}
        onOpenSystemPromptModal={() => setIsSystemPromptModalOpen(true)}
        onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
        memoryCount={memoryCount}
      />

      {/* Main Chat Interface */}
      <ChatWindow
        currentSession={currentSession}
        messages={messages}
        isLoading={isLoading}
        streamingText={streamingText}
        isDegradedVision={isDegradedVision}
        allowWebSearch={allowWebSearch}
        onToggleWebSearch={handleToggleWebSearch}
        onSendMessage={handleSendMessage}
        onRegenerate={handleRegenerate}
        onStopStreaming={handleStopStreaming}
        onOpenRubric={(msgId) => setRubricTargetMessageId(msgId)}
        onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
        memoryCount={memoryCount}
        systemPrompt={systemPrompt}
      />

      {/* Modals */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => {
          setIsMemoryModalOpen(false);
          fetchMemoryCount();
        }}
        token={token}
      />

      <EvaluationModal
        isOpen={isEvalModalOpen}
        onClose={() => setIsEvalModalOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <SystemPromptModal
        isOpen={isSystemPromptModalOpen}
        onClose={() => setIsSystemPromptModalOpen(false)}
        systemPrompt={systemPrompt}
        onSaveSystemPrompt={setSystemPrompt}
      />

      <RubricFeedbackModal
        isOpen={Boolean(rubricTargetMessageId)}
        onClose={() => setRubricTargetMessageId(null)}
        messageId={rubricTargetMessageId}
        sessionId={currentSessionId}
      />
    </div>
  );
}
