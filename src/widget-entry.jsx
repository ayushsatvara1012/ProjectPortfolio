import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/chatWidget';
import './index.css'; // This ensures Tailwind CSS is bundled with the widget

// --- AUTOMATIC CSS INJECTION ---
// We find the <script> tag that loaded this file (widget.js)
// and dynamically inject its sibling style.css into the host's <head>.
const script = document.currentScript || document.querySelector('script[src*="widget.js"]');
if (script) {
  const scriptUrl = script.src;
  const baseUrl = scriptUrl.substring(0, scriptUrl.lastIndexOf('/'));
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${baseUrl}/style.css`;
  document.head.appendChild(link);
}

// 1. Create a container div for the widget
const containerId = 'sapybase-widget-container';
let containerEl = document.getElementById(containerId);

// 2. If it doesn't exist on the client's site, inject it into the body
if (!containerEl) {
  containerEl = document.createElement('div');
  containerEl.id = containerId;
  
  // STRICTURE: Ensure the container sits on top of all host elements
  // We use inline styles to guarantee precedence over external stylesheets.
  containerEl.style.position = 'relative';
  containerEl.style.zIndex = '2147483647';
  
  document.body.appendChild(containerEl);
}

// 3. Render only the ChatWidget into that container
const root = ReactDOM.createRoot(containerEl);
root.render(<ChatWidget />);