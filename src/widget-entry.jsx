import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/chatWidget';

const containerId = 'sapybase-widget-container';
let containerEl = document.getElementById(containerId);

if (!containerEl) {
  // 1. Create the Host Element
  containerEl = document.createElement('div');
  containerEl.id = containerId;
  
  // Protect the host element from external layout interference
  containerEl.style.position = 'fixed'; 
  containerEl.style.zIndex = '2147483647'; // Maximum possible z-index
  containerEl.style.pointerEvents = 'none'; // Prevent invisible container from blocking clicks
  document.body.appendChild(containerEl);

  // 2. Attach the Shadow DOM (The "Force Field")
  const shadowRoot = containerEl.attachShadow({ mode: 'open' });

  // 3. Inject Tailwind CSS STRICTLY inside the Shadow DOM
  const scriptTag = document.querySelector('script[src*="widget.js"]');
  if (scriptTag) {
    const widgetUrl = new URL(scriptTag.src);
    const cssUrl = `${widgetUrl.origin}/style.css`; 
    
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = cssUrl;
    // Notice we append to shadowRoot, NOT document.head!
    shadowRoot.appendChild(linkEl); 
  }

  // 4. Create a React Mount Point inside the Shadow DOM
  const reactRootEl = document.createElement('div');
  reactRootEl.style.pointerEvents = 'auto'; // Re-enable clicks for the actual widget
  shadowRoot.appendChild(reactRootEl);

  // 5. Render the Widget inside the protected environment
  const root = ReactDOM.createRoot(reactRootEl);
  root.render(<ChatWidget />);
}