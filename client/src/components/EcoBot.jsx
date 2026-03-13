/**
 * EcoBot.jsx
 * Floating chatbot component for AI-powered environmental coaching
 * Features: AI chat responses, conversation history controls, mobile-responsive
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import api from '../utils/api';

const EcoBot = ({ user }) => {
  const { t, i18n } = useTranslation();
  const reduxUser = useSelector((state) => state.auth.user);
  const activeUser = reduxUser || user;
  const grade = activeUser?.profile?.grade || activeUser?.grade || '6';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Send message to EcoBot
   */
  const sendMessage = async (text = input) => {
    if (!text.trim() || isStreaming) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      const normalizedLanguage = (i18n.language || 'en').split('-')[0];
      const response = await api.post(
        '/v1/ai/chat',
        { message: text, language: normalizedLanguage, grade },
        { timeout: 35000 }
      );
      const reply = response?.data?.reply;
      const isFallback = response?.data?.fallback || false;

      if (!reply) {
        throw new Error('EcoBot did not return a response');
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
        fallback: isFallback
      }]);

      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }

    } catch (error) {
      console.error('[EcoBot] Send message error:', error);
      
      // Silent fallback: Add helpful eco-tip to chat instead of showing error toast
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: "🌱 Let me think... Try: Save water by turning off taps while brushing teeth!",
        timestamp: new Date(),
        fallback: true
      }]);

      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Quick chip selection
   */
  const handleChipClick = (chipText) => {
    setInput(chipText);
    // Trigger send after a brief delay to allow UI update
    setTimeout(() => {
      sendMessage(chipText);
    }, 0);
  };

  /**
   * Clear chat history
   */
  const handleClearHistory = async () => {
    if (!window.confirm('Clear all chat history?')) return;

    try {
      await api.delete('/v1/ai/chat/history');
      setMessages([]);
    } catch (error) {
      // Silent failure - history cleared locally anyway
      setMessages([]);
    }
  };

  // Quick chips (shown only when no messages)
  const quickChips = [
    '💧 Water tips',
    '🌳 Tree facts',
    '♻️ Recycling',
    '🌡️ Climate'
  ];

  return (
    <>
      {/* Floating Button / Chat Window */}
      <AnimatePresence mode="wait">
        {!isOpen ? (
          // Closed state: Floating button
          <motion.button
            key="closed"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => {
              setIsOpen(true);
              setUnreadCount(0);
            }}
            className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg flex items-center justify-center text-2xl transition-all duration-300 hover:scale-110"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Pulse ring animation for unread */}
            {unreadCount > 0 && (
              <>
                <span className="absolute inset-0 rounded-full bg-green-600 animate-pulse opacity-75"></span>
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </>
            )}

            <span className="relative z-10">🌱</span>
          </motion.button>
        ) : (
          // Open state: Chat window
          <motion.div
            key="open"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-24 right-4 z-50 w-[min(24rem,calc(100vw-1rem))] h-[520px] max-h-[70vh] rounded-2xl shadow-2xl bg-white border border-green-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-green-700 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌱</span>
                <div>
                  <h3 className="font-bold text-sm">{t('ecobot.title', { defaultValue: 'EcoBot' })}</h3>
                  <p className="text-xs opacity-90">{t('ecobot.subtitle', { defaultValue: 'Your eco-coach' })}</p>
                  <div className="mt-1 inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700">
                    🎓 Grade {grade} Mode
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Streak badge */}
                {activeUser?.gamification?.streak?.current > 0 && (
                  <span className="bg-green-600 px-2 py-1 rounded-full text-xs font-semibold">
                    🔥 {activeUser.gamification.streak.current}
                  </span>
                )}

                {/* Minimize button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-green-600 p-1 rounded transition-colors"
                  title="Minimize"
                >
                  −
                </button>

                {/* Close button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-red-600 p-1 rounded transition-colors"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-3 py-2 space-y-3 bg-gray-50"
            >
              {messages.length === 0 ? (
                // Empty state with quick chips
                <div className="flex flex-col items-center justify-center h-full py-4">
                  <p className="text-2xl mb-2">🌿</p>
                  <p className="text-sm text-gray-600 text-center mb-4">
                    {t('ecobot.greeting', { defaultValue: "Hi! I'm EcoBot. Ask me anything about the environment!" })}
                  </p>

                  {/* Quick chips */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickChips.map((chip, idx) => (
                      <motion.button
                        key={idx}
                        onClick={() => handleChipClick(chip)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white border border-green-200 text-green-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-green-50 transition-colors"
                      >
                        {chip}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-green-600 text-white rounded-br-sm'
                          : 'bg-gray-100 border border-gray-200 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className={`text-xs ${msg.role === 'user' ? 'text-green-100' : 'text-gray-400'}`}>
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {msg.role === 'assistant' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            msg.fallback
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {msg.fallback ? '💡 Tip' : '🤖 AI'}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}

              {/* Typing indicator */}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">EcoBot is thinking... 🌱</span>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -8, 0] }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              delay: i * 0.1
                            }}
                            className="w-2 h-2 bg-gray-400 rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t px-3 py-2 flex gap-2 shrink-0 bg-white">
              <input
                type="text"
                placeholder={t('ecobot.placeholder', { defaultValue: 'Ask EcoBot anything...' })}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 500))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isStreaming) {
                    sendMessage();
                  }
                }}
                disabled={isStreaming}
                maxLength={500}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 text-gray-800 text-sm"
              />

              <button
                onClick={() => sendMessage()}
                disabled={isStreaming || !input.trim()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                📤
              </button>

              {/* Clear history button (small) */}
              <button
                onClick={handleClearHistory}
                className="text-gray-400 hover:text-gray-600 px-2 py-2 text-xs"
                title="Clear history"
              >
                🗑️
              </button>
            </div>

            {/* Character counter */}
            {input.length > 400 && (
              <div className="text-xs text-gray-500 px-3 py-1 text-right">
                {input.length}/500
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EcoBot;
