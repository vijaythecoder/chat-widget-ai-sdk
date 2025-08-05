import { tool } from 'ai';
import { z } from 'zod';

export const createTools = () => ({
  searchElements: tool({
    description: 'Search for DOM elements by text content, tag name, or attributes. Use this to find elements before modifying them.',
    inputSchema: z.object({
      searchType: z.enum(['text', 'tag', 'attribute', 'class', 'id', 'all']).describe('Type of search to perform'),
      searchValue: z.string().describe('Value to search for'),
      tag: z.string().optional().describe('Optional tag name to filter results'),
      limit: z.number().default(10).describe('Maximum number of results to return'),
    }),
    execute: async ({ searchType, searchValue, tag, limit }) => {
      console.group('🔍 DOM Element Search');
      console.log('Search Type:', searchType);
      console.log('Search Value:', searchValue);
      console.log('Tag Filter:', tag || 'any');
      
      try {
        const results: Array<{
          selector: string;
          tagName: string;
          id?: string;
          classes?: string[];
          text: string;
          attributes?: Record<string, string>;
        }> = [];

        let elements: Element[] = [];

        switch (searchType) {
          case 'all':
            // Search all elements when looking for general items
            if (searchValue.toLowerCase() === 'list' || searchValue.toLowerCase().includes('list items')) {
              elements = Array.from(document.querySelectorAll('li'));
            } else {
              elements = Array.from(document.querySelectorAll('*')).filter(el => {
                if (el.closest('.chat-widget-container')) return false;
                const text = el.textContent?.toLowerCase() || '';
                return text.includes(searchValue.toLowerCase());
              });
            }
            break;
            
          case 'text':
            // Search by text content
            const allElements = document.querySelectorAll(tag || '*');
            elements = Array.from(allElements).filter(el => {
              // Skip chat widget elements
              if (el.closest('.chat-widget-container')) return false;
              
              // For list items, check direct text content
              if (el.tagName.toLowerCase() === 'li') {
                const directText = Array.from(el.childNodes)
                  .filter(node => node.nodeType === Node.TEXT_NODE)
                  .map(node => node.textContent?.trim())
                  .filter(text => text)
                  .join(' ');
                  
                const fullText = el.textContent?.toLowerCase() || '';
                return searchValue.toLowerCase() === 'li' || 
                       directText.toLowerCase().includes(searchValue.toLowerCase()) ||
                       fullText.includes(searchValue.toLowerCase());
              }
              
              const text = el.textContent?.toLowerCase() || '';
              return text.includes(searchValue.toLowerCase());
            });
            break;

          case 'tag':
            elements = Array.from(document.querySelectorAll(searchValue))
              .filter(el => !el.closest('.chat-widget-container'));
            break;

          case 'attribute':
            elements = Array.from(document.querySelectorAll(`[${searchValue}]`));
            break;

          case 'class':
            elements = Array.from(document.querySelectorAll(`.${searchValue}`));
            break;

          case 'id':
            const element = document.getElementById(searchValue);
            if (element) elements = [element];
            break;
        }

        // Filter out chat widget elements and limit results
        elements = elements
          .filter(el => !el.closest('.chat-widget-container'))
          .slice(0, limit);

        // Build results
        elements.forEach((el) => {
          // For list items, get the direct text content
          let textContent = '';
          if (el.tagName.toLowerCase() === 'li') {
            // Get direct text nodes only
            const directText = Array.from(el.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent?.trim())
              .filter(text => text)
              .join(' ');
            
            // If has marker class, include that info
            const markerEl = el.querySelector('::marker');
            const marker = window.getComputedStyle(el, '::before').content;
            
            textContent = directText || el.textContent?.trim() || '';
          } else {
            textContent = el.textContent?.trim() || '';
          }
          
          const result: any = {
            tagName: el.tagName.toLowerCase(),
            text: textContent.substring(0, 100),
          };

          // Build selector
          if (el.id) {
            result.id = el.id;
            result.selector = `#${el.id}`;
          } else if (el.className) {
            result.classes = Array.from(el.classList).filter(c => !c.startsWith('chat-widget'));
            if (result.classes.length > 0) {
              result.selector = `.${result.classes[0]}`;
            } else {
              // Use nth-child selector
              const parent = el.parentElement;
              if (parent) {
                const index = Array.from(parent.children).indexOf(el) + 1;
                result.selector = `${parent.tagName.toLowerCase()} > ${el.tagName.toLowerCase()}:nth-child(${index})`;
              }
            }
          }

          // Get key attributes
          const attrs: Record<string, string> = {};
          ['href', 'src', 'type', 'name', 'value', 'placeholder'].forEach(attr => {
            if (el.hasAttribute(attr)) {
              attrs[attr] = el.getAttribute(attr) || '';
            }
          });
          if (Object.keys(attrs).length > 0) {
            result.attributes = attrs;
          }

          results.push(result);
        });

        console.log(`Found ${results.length} element(s)`);
        console.log('Results:', results);
        console.groupEnd();
        
        return {
          success: true,
          message: `Found ${results.length} element(s) matching your search`,
          results,
          totalFound: results.length,
        };
      } catch (error) {
        console.error('Error searching elements:', error);
        console.groupEnd();
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : String(error)}`,
          results: [],
        };
      }
    },
  }),

  modifyElement: tool({
    description: 'Modify the content, style, or attributes of DOM elements on the page',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector to target elements (e.g., "#id", ".class", "tag")'),
      action: z.enum(['text', 'style', 'attribute', 'addClass', 'removeClass', 'remove']).describe('Type of modification to perform'),
      value: z.string().optional().describe('The value to apply (text content, style properties, attribute value, or class name)'),
      attribute: z.string().optional().describe('Attribute name when action is "attribute"'),
    }),
    execute: async ({ selector, action, value, attribute }) => {
      console.group('🎯 DOM Element Modification');
      console.log('Selector:', selector);
      console.log('Action:', action);
      console.log('Value:', value);
      
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) {
          console.warn('No elements found with selector:', selector);
          return {
            success: false,
            message: `No elements found with selector: ${selector}`,
            elementsModified: 0,
          };
        }

        elements.forEach((element: Element) => {
          switch (action) {
            case 'text':
              if (element instanceof HTMLElement) {
                element.textContent = value || '';
              }
              break;
            case 'style':
              if (element instanceof HTMLElement && value) {
                // Parse style string like "color: red; font-size: 20px"
                const styles = value.split(';').map(s => s.trim()).filter(s => s);
                styles.forEach(style => {
                  const [prop, val] = style.split(':').map(s => s.trim());
                  if (prop && val) {
                    (element.style as any)[prop] = val;
                  }
                });
              }
              break;
            case 'attribute':
              if (attribute && value !== undefined) {
                element.setAttribute(attribute, value);
              }
              break;
            case 'addClass':
              if (value) {
                element.classList.add(...value.split(' '));
              }
              break;
            case 'removeClass':
              if (value) {
                element.classList.remove(...value.split(' '));
              }
              break;
            case 'remove':
              element.remove();
              break;
          }
        });

        console.log(`Modified ${elements.length} element(s)`);
        console.groupEnd();
        
        return {
          success: true,
          message: `Successfully modified ${elements.length} element(s) with selector "${selector}"`,
          elementsModified: elements.length,
          action,
        };
      } catch (error) {
        console.error('Error modifying elements:', error);
        console.groupEnd();
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : String(error)}`,
          elementsModified: 0,
        };
      }
    },
  }),

  createElement: tool({
    description: 'Create and insert new DOM elements into the page',
    inputSchema: z.object({
      tagName: z.string().describe('HTML tag name (e.g., "div", "p", "button")'),
      content: z.string().optional().describe('Text content for the element'),
      attributes: z.record(z.string()).optional().describe('Object of attributes to set on the element'),
      styles: z.record(z.string()).optional().describe('Object of CSS styles to apply'),
      parentSelector: z.string().describe('CSS selector for the parent element where this should be inserted'),
      position: z.enum(['append', 'prepend', 'before', 'after']).default('append').describe('Where to insert relative to parent'),
    }),
    execute: async ({ tagName, content, attributes, styles, parentSelector, position }) => {
      console.group('✨ DOM Element Creation');
      console.log('Creating:', tagName);
      console.log('Parent:', parentSelector);
      console.log('Position:', position);
      
      try {
        const parent = document.querySelector(parentSelector);
        if (!parent) {
          console.warn('Parent element not found:', parentSelector);
          return {
            success: false,
            message: `Parent element not found: ${parentSelector}`,
          };
        }

        const element = document.createElement(tagName);
        
        if (content) {
          element.textContent = content;
        }
        
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
          });
        }
        
        if (styles) {
          Object.entries(styles).forEach(([prop, value]) => {
            (element.style as any)[prop] = value;
          });
        }

        switch (position) {
          case 'append':
            parent.appendChild(element);
            break;
          case 'prepend':
            parent.prepend(element);
            break;
          case 'before':
            parent.parentElement?.insertBefore(element, parent);
            break;
          case 'after':
            parent.parentElement?.insertBefore(element, parent.nextSibling);
            break;
        }

        console.log('Element created successfully');
        console.groupEnd();
        
        return {
          success: true,
          message: `Created ${tagName} element and inserted it ${position} ${parentSelector}`,
          element: {
            tagName,
            content,
            attributes,
            styles,
          },
        };
      } catch (error) {
        console.error('Error creating element:', error);
        console.groupEnd();
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  }),

  highlightElements: tool({
    description: 'Highlight or animate DOM elements to draw attention to them',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector for elements to highlight'),
      effect: z.enum(['border', 'background', 'pulse', 'shake', 'glow']).describe('Type of highlight effect'),
      color: z.string().default('#ff0000').describe('Color for the highlight effect'),
      duration: z.number().default(2000).describe('Duration of the effect in milliseconds'),
    }),
    execute: async ({ selector, effect, color, duration }) => {
      console.group('🔍 Element Highlighting');
      console.log('Selector:', selector);
      console.log('Effect:', effect);
      console.log('Color:', color);
      console.log('Duration:', duration + 'ms');
      
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) {
          console.warn('No elements found with selector:', selector);
          return {
            success: false,
            message: `No elements found with selector: ${selector}`,
            elementsHighlighted: 0,
          };
        }

        // Create style element for animations if needed
        if (!document.getElementById('chat-widget-animations')) {
          const styleEl = document.createElement('style');
          styleEl.id = 'chat-widget-animations';
          styleEl.textContent = `
            @keyframes pulse-effect {
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.05); opacity: 0.8; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes shake-effect {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-10px); }
              75% { transform: translateX(10px); }
            }
            @keyframes glow-effect {
              0%, 100% { box-shadow: 0 0 5px currentColor; }
              50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
            }
          `;
          document.head.appendChild(styleEl);
        }

        elements.forEach((element: Element) => {
          if (!(element instanceof HTMLElement)) return;
          
          // Store original styles
          const originalStyles = {
            border: element.style.border,
            backgroundColor: element.style.backgroundColor,
            animation: element.style.animation,
            boxShadow: element.style.boxShadow,
            transition: element.style.transition,
          };

          // Apply effect
          element.style.transition = 'all 0.3s ease';
          
          switch (effect) {
            case 'border':
              element.style.border = `3px solid ${color}`;
              break;
            case 'background':
              element.style.backgroundColor = color + '30'; // Add transparency
              break;
            case 'pulse':
              element.style.animation = `pulse-effect ${duration}ms ease-in-out infinite`;
              break;
            case 'shake':
              element.style.animation = `shake-effect ${duration}ms ease-in-out`;
              break;
            case 'glow':
              element.style.animation = `glow-effect ${duration}ms ease-in-out infinite`;
              element.style.color = color; // Set color for currentColor to work
              break;
          }

          // Remove effect after duration
          setTimeout(() => {
            Object.entries(originalStyles).forEach(([prop, value]) => {
              (element.style as any)[prop] = value || '';
            });
          }, duration);
        });

        console.log(`Highlighted ${elements.length} element(s)`);
        console.groupEnd();
        
        return {
          success: true,
          message: `Highlighted ${elements.length} element(s) with ${effect} effect`,
          elementsHighlighted: elements.length,
          effect,
          duration,
        };
      } catch (error) {
        console.error('Error highlighting elements:', error);
        console.groupEnd();
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : String(error)}`,
          elementsHighlighted: 0,
        };
      }
    },
  }),
});