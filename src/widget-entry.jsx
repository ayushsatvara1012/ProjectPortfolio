import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/chatWidget';

const containerId = 'sapybase-widget-container';
let containerEl = document.getElementById(containerId);

if (!containerEl) {
  // 1. Create the Host Element
  containerEl = document.createElement('div');
  containerEl.id = containerId;
  
  // Protect the host element and ensure it spans the whole screen so it doesn't clip the chat!
  containerEl.style.position = 'fixed'; 
  containerEl.style.inset = '0';
  containerEl.style.zIndex = '2147483647'; 
  containerEl.style.pointerEvents = 'none'; 
  document.body.appendChild(containerEl);

  // 2. Attach the Shadow DOM (The "Force Field")
  // mode: 'open' allows us to move styles inside!
  const shadowRoot = containerEl.attachShadow({ mode: 'open' });

  // 4. THE STYLING FIX: Move Vite-injected CSS into the Shadow DOM
  // vite-plugin-css-injected-by-js usually puts styles in the <head>.
  // We need to move them inside the shadowRoot so the widget can see them!
  const moveStyles = () => {
    const styleTags = document.querySelectorAll('style');
    styleTags.forEach(tag => {
      // Look for the tag containing our Tailwind/Widget styles
      if (tag.textContent.includes('sapybase-widget-container') || tag.textContent.includes('tailwind')) {
        const shadowStyle = tag.cloneNode(true);
        shadowRoot.appendChild(shadowStyle);
      }
    });
  };
  
  // 3. Extract the API key and Move Styles
  const scriptTag = document.querySelector('script[src*="widget.js"]');
  let passedApiKey = null;

  if (scriptTag) {
    passedApiKey = scriptTag.getAttribute('data-api-key');
    // Run the style migration!
    moveStyles();
  }

  // 4. Create a React Mount Point
  const reactRootEl = document.createElement('div');
  reactRootEl.style.pointerEvents = 'auto'; // Re-enable clicks for the actual widget
  shadowRoot.appendChild(reactRootEl);

  // 5. Render the Widget and PASS IN THE KEY!
  const root = ReactDOM.createRoot(reactRootEl);
  root.render(<ChatWidget apiKey={passedApiKey} />);
}