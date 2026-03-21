import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/chatWidget';
import './index.css'; // This ensures Tailwind CSS is bundled with the widget

// 1. Create a container div for the widget
const containerId = 'sapybase-widget-container';
let containerEl = document.getElementById(containerId);

// 2. If it doesn't exist on the client's site, inject it into the body
if (!containerEl) {
  containerEl = document.createElement('div');
  containerEl.id = containerId;
  document.body.appendChild(containerEl);
}

// 3. Render only the ChatWidget into that container
const root = ReactDOM.createRoot(containerEl);
root.render(<ChatWidget />);