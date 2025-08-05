import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatWidget } from './components/ChatWidget';
import type { ChatWidgetProps } from './types';

// Export the React component
export { ChatWidget };
export type { ChatWidgetProps, Message, ToolInvocation } from './types';

// Vanilla JS initialization API
interface InitOptions extends ChatWidgetProps {
  containerId?: string;
}

class ChatWidgetSDK {
  private root: ReactDOM.Root | null = null;
  private container: HTMLElement | null = null;

  init(options: InitOptions): void {
    const { containerId = 'chat-widget-root', ...props } = options;
    
    // Create or find container
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    // Create React root and render
    this.root = ReactDOM.createRoot(this.container);
    this.root.render(React.createElement(ChatWidget, props));
  }

  destroy(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }

  update(options: Partial<InitOptions>): void {
    if (this.root && this.container) {
      const currentProps = this.container.dataset.props 
        ? JSON.parse(this.container.dataset.props) 
        : {};
      const newProps = { ...currentProps, ...options };
      this.container.dataset.props = JSON.stringify(newProps);
      this.root.render(React.createElement(ChatWidget, newProps));
    }
  }
}

// Create singleton instance
const chatWidgetSDK = new ChatWidgetSDK();

// Export for UMD build
if (typeof window !== 'undefined') {
  (window as any).ChatWidget = {
    init: (options: InitOptions) => chatWidgetSDK.init(options),
    destroy: () => chatWidgetSDK.destroy(),
    update: (options: Partial<InitOptions>) => chatWidgetSDK.update(options),
    Component: ChatWidget,
  };
}

// Default export
export default {
  init: (options: InitOptions) => chatWidgetSDK.init(options),
  destroy: () => chatWidgetSDK.destroy(),
  update: (options: Partial<InitOptions>) => chatWidgetSDK.update(options),
  Component: ChatWidget,
};