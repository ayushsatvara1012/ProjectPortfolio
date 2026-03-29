import React from 'react';
import ChatWidget from './chatWidget';

/**
 * FloatingBotWidget — renders the real production ChatWidget as-is.
 * No overrides, no forceOpen — left completely stock.
 */
const FloatingBotWidget = () => (
    <ChatWidget apiKey={import.meta.env.VITE_SAPYBASE_API_KEY} />
);

export default FloatingBotWidget;
