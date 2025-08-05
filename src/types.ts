export interface ChatWidgetProps {
  apiKey: string;
  provider?: 'openai' | 'anthropic' | 'custom';
  position?: 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark';
  tools?: boolean;
  placeholder?: string;
  welcomeMessage?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolInvocations?: ToolInvocation[];
  timestamp: Date;
}

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  result?: any;
}