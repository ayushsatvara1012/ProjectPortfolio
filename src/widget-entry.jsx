import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/chatWidget';

// 1. Automatically inject the CSS file
const scriptTag = document.querySelector('script[src*="widget.js"]');
if (scriptTag) {
  const widgetUrl = new URL(scriptTag.src);
  const cssUrl = `${widgetUrl.origin}/style.css`; 
  
  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = cssUrl;
  document.head.appendChild(linkEl);
}

// 2. Create a container div for the widget
const containerId = 'sapybase-widget-container';
let containerEl = document.getElementById(containerId);

if (!containerEl) {
  containerEl = document.createElement('div');
  containerEl.id = containerId;
  containerEl.style.position = 'relative';
  containerEl.style.zIndex = '2147483647'; // Forces it above Gyanesha's loader!
  document.body.appendChild(containerEl);
}

// 3. Render the widget
const root = ReactDOM.createRoot(containerEl);
root.render(<ChatWidget />);