import React, { useState, useRef, useEffect } from 'react';
import { ChatWidgetProps, Message, ToolInvocation } from '../types';
import { streamText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createTools } from '../tools';
import '../styles/ChatWidget.css';

// Helper function to get DOM context
function getDOMContext(): string {
  const elements: string[] = [];
  
  // Get all elements with IDs
  document.querySelectorAll('[id]').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id;
    // Skip chat widget elements
    if (id.includes('chat-widget') || el.closest('.chat-widget-container')) return;
    
    let content = '';
    if (el instanceof HTMLElement) {
      // For elements with direct text content
      const directText = Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim())
        .filter(text => text)
        .join(' ');
      
      if (directText) {
        content = directText.substring(0, 60);
      } else if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
        content = (el as HTMLInputElement).value || el.textContent?.trim() || '';
      } else {
        content = el.textContent?.trim().substring(0, 60) || '';
      }
    }
    
    elements.push(`- <${tag} id="${id}">: "${content}"`);
  });
  
  // Get common class names
  const classElements = document.querySelectorAll('[class]');
  const classMap = new Map<string, number>();
  
  classElements.forEach((el) => {
    el.classList.forEach((className) => {
      if (className && !className.startsWith('chat-widget')) {
        classMap.set(className, (classMap.get(className) || 0) + 1);
      }
    });
  });
  
  // Add top classes
  const topClasses = Array.from(classMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([className, count]) => `- .${className} (${count} elements)`);
  
  if (topClasses.length > 0) {
    elements.push('\nCommon classes:');
    elements.push(...topClasses);
  }
  
  // Add list items count
  const listItems = document.querySelectorAll('li:not(.chat-widget-container li)');
  if (listItems.length > 0) {
    elements.push(`\nList items found: ${listItems.length} items`);
  }
  
  return elements.join('\n');
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  apiKey,
  provider = 'openai',
  position = 'bottom-right',
  theme = 'light',
  tools = false,
  placeholder = 'Ask me anything...',
  welcomeMessage = 'Hello! How can I help you today?',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      const openai = createOpenAI({
        apiKey: apiKey,
      });
      
      const model = openai('gpt-4o-mini');

      // Get DOM context for the AI
      const domContext = tools ? getDOMContext() : '';
      
      const result = await streamText({
        model,
        system: tools ? `You are a helpful assistant that can search, read, and modify DOM elements on the webpage. 

You have access to these tools:
1. searchElements - Search for elements by text, tag, class, or ID. Returns element details with selectors.
2. modifyElement - Modify element content, styles, or attributes. Returns success/failure status.
3. createElement - Create new elements. Returns details of created element.
4. highlightElements - Highlight elements with visual effects. Returns number of highlighted elements.

IMPORTANT WORKFLOW:
When asked about lists or to summarize list items:
1. Use searchElements with searchType: "tag" and searchValue: "li" to find all list items
2. Or use searchType: "all" with searchValue: "list" for a broader search
3. The tool will return ALL matching elements up to the limit

When asked to modify something:
1. Use searchElements to find the element by its text content
2. Wait for the search results (you'll receive them automatically)
3. Use the selector from the search results to modify the element
4. The tool will return whether it succeeded or failed
5. Confirm to the user what happened based on the tool result

For example, if asked to "summarize the list":
1. Call searchElements with searchType: "tag" and searchValue: "li"
2. You'll receive all list items with their text content
3. Summarize the content based on what you found

Quick reference of some known elements:
${domContext}` : undefined,
        messages: messages.concat(userMessage).map((m) => ({
          role: m.role === 'tool' ? 'assistant' : m.role,
          content: m.content,
        })),
        ...(tools && { tools: createTools() }),
        ...(tools && { stopWhen: stepCountIs(7) }),
      });

      let fullContent = '';
      const toolInvocations: ToolInvocation[] = [];
      let currentToolCall: ToolInvocation | null = null;

      // Use fullStream to get all events including tool results
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            if (part.text) {
              fullContent += part.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: fullContent }
                    : m
                )
              );
            }
            break;

          case 'tool-call':
            currentToolCall = {
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.input, // Changed from part.args to part.input
            };
            toolInvocations.push(currentToolCall);
            
            // Log tool usage
            console.group(`🛠️ Tool Called: ${part.toolName}`);
            console.log('Arguments:', part.input);
            console.log('Tool Call ID:', part.toolCallId);
            break;

          case 'tool-result':
            // Add tool result to the current tool call
            if (currentToolCall && currentToolCall.toolCallId === part.toolCallId) {
              currentToolCall.result = part.output; // Changed from part.result to part.output
              console.log('Tool Result:', part.output);
              console.groupEnd();
              
              // Update the message with tool invocations including results
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, toolInvocations: [...toolInvocations] }
                    : m
                )
              );
            }
            break;

          case 'error':
            console.error('Stream error:', part.error);
            break;
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  return (
    <div className={`chat-widget-container ${position} ${theme}`}>
      {/* Chat Toggle Button */}
      <button
        className="chat-toggle"
        onClick={toggleChat}
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Chat Widget */}
      {isOpen && (
        <div className="chat-widget">
          <div className="chat-header">
            <h3>AI Assistant</h3>
            <button
              className="chat-close"
              onClick={toggleChat}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.role}`}
              >
                <div className="message-wrapper">
                  <div className="message-content">{message.content}</div>
                  {message.toolInvocations && message.toolInvocations.length > 0 && (
                    <div className="tool-invocations">
                      {message.toolInvocations.map((invocation) => (
                        <div key={invocation.toolCallId} className="tool-invocation">
                          <span className="tool-icon">🛠️</span>
                          <span className="tool-name">{invocation.toolName}</span>
                          {invocation.result && (
                            <span className="tool-status">
                              {invocation.result.success ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant loading">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chat-input-form">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={placeholder}
              disabled={isLoading}
              rows={1}
              className="chat-input"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="chat-submit"
              aria-label="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};