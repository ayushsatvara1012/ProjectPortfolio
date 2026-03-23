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
  const shadowRoot = containerEl.attachShadow({ mode: 'open' });

  // 3. Extract the API key and Inject CSS
  const scriptTag = document.querySelector('script[src*="widget.js"]');
  let passedApiKey = null;

  if (scriptTag) {
    // --- THE FIX: GRAB THE API KEY FROM THE HTML SCRIPT TAG ---
    passedApiKey = scriptTag.getAttribute('data-api-key');

    const widgetUrl = new URL(scriptTag.src);
    const cssUrl = `${widgetUrl.origin}/style.css`; 
    
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = cssUrl;
    shadowRoot.appendChild(linkEl); 
  }

  // 4. Create a React Mount Point
  const reactRootEl = document.createElement('div');
  reactRootEl.style.pointerEvents = 'auto'; // Re-enable clicks for the actual widget
  shadowRoot.appendChild(reactRootEl);

  // 5. Render the Widget and PASS IN THE KEY!
  const root = ReactDOM.createRoot(reactRootEl);
  root.render(<ChatWidget apiKey={passedApiKey} />);
}