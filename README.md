# Chat Widget AI SDK

A client-side chat widget library that integrates with Vercel AI SDK to provide streaming AI responses directly in the browser. Features a floating chat interface with placeholder PDF manipulation tools.

## Features

- 🚀 **Client-Side Only** - No backend required, runs entirely in the browser
- 💬 **Streaming Responses** - Real-time AI responses using Vercel AI SDK
- 🛠️ **PDF Tools** - Placeholder tools demonstrating AI tool-calling capabilities
- 🎨 **Customizable** - Light/dark themes, configurable position
- 📦 **Easy Integration** - Works with React or vanilla JavaScript
- 📱 **Mobile Responsive** - Optimized for all screen sizes

## Installation

```bash
npm install chat-widget-ai-sdk
```

## Quick Start

### React

```jsx
import { ChatWidget } from 'chat-widget-ai-sdk';
import 'chat-widget-ai-sdk/dist/chat-widget.css';

function App() {
  return (
    <ChatWidget 
      apiKey="your-openai-api-key"
      position="bottom-right"
      theme="light"
      tools={true}
    />
  );
}
```

### Vanilla JavaScript

```html
<link rel="stylesheet" href="https://unpkg.com/chat-widget-ai-sdk/dist/chat-widget.css">
<script src="https://unpkg.com/chat-widget-ai-sdk/dist/chat-widget.umd.js"></script>

<script>
  ChatWidget.init({
    apiKey: 'your-openai-api-key',
    position: 'bottom-right',
    theme: 'light',
    tools: true
  });
</script>
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | Your OpenAI API key |
| `position` | 'bottom-right' \| 'bottom-left' | 'bottom-right' | Widget position |
| `theme` | 'light' \| 'dark' | 'light' | Color theme |
| `tools` | boolean | false | Enable PDF placeholder tools |
| `placeholder` | string | 'Ask me anything...' | Input placeholder text |
| `welcomeMessage` | string | 'Hello! How can I help you today?' | Initial message |

## PDF Tools (Placeholders)

The widget includes three demonstration tools that log to the console:

1. **modifyContent** - Simulates PDF content modification
2. **signPDF** - Simulates adding signatures to PDFs  
3. **showNameFields** - Simulates detecting form fields

These tools don't actually process PDFs but demonstrate the AI's ability to use tools. Check your browser console to see when they're invoked.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build library
npm run build

# Type check
npm run type-check
```

## Security Considerations

⚠️ **Important**: This widget uses API keys directly in the browser. For production use:
- Use environment variables for API keys
- Consider implementing a proxy endpoint
- Restrict API key usage by domain
- Monitor usage and implement rate limiting

## Examples

Check the `examples/` directory for:
- HTML implementation example
- React integration example

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers

## License

ISC
