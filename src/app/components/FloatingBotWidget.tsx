'use client';

import ChatWidget from './ChatWidget';

const FloatingBotWidget = () => (
  <ChatWidget apiKey={process.env.NEXT_PUBLIC_Sapybase_API_KEY ?? ''} />
);

export default FloatingBotWidget;
