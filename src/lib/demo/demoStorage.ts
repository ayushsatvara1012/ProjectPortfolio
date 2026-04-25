const KEYS = {
    BOT: 'demo_bot_config',
    KNOWLEDGE: 'demo_knowledge_chunks',
    TRAINED: 'demo_trained',
    MESSAGES: 'demo_chat_messages',
};

const DEFAULT_BOT = {
    name: 'Demo Bot',
    greeting: 'Hi! Ask me anything about the document you uploaded.',
    primaryColor: '#5730F5',
    companyTone: ['Professional'],
    logoShape: 'circle',
    avatarBgStyle: 'none',
    customLogoUrl: '',
    quickQuestions: [],
    systemPrompt: '',
    companyName: 'Demo Company',
    allowedOrigin: 'https://demo.sapybase.com',
    themeColor: '#5730F5',
    companyTone_str: 'Professional and helpful',
};

export function getBotConfig() {
    if (typeof window === 'undefined') return DEFAULT_BOT;
    try {
        const raw = sessionStorage.getItem(KEYS.BOT);
        return raw ? { ...DEFAULT_BOT, ...JSON.parse(raw) } : { ...DEFAULT_BOT };
    } catch { return { ...DEFAULT_BOT }; }
}

export function saveBotConfig(partial: any) {
    if (typeof window === 'undefined') return;
    try {
        const current = getBotConfig();
        sessionStorage.setItem(KEYS.BOT, JSON.stringify({ ...current, ...partial }));
    } catch { /* quota exceeded */ }
}

export function getKnowledge() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = sessionStorage.getItem(KEYS.KNOWLEDGE);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveKnowledge(chunks: any[]) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(KEYS.KNOWLEDGE, JSON.stringify(chunks));
        sessionStorage.setItem(KEYS.TRAINED, 'true');
    } catch { /* silently ignore */ }
}

export function clearKnowledge() {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(KEYS.KNOWLEDGE);
    sessionStorage.removeItem(KEYS.TRAINED);
}

export function isTrained() {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(KEYS.TRAINED) === 'true' && getKnowledge().length > 0;
}

export function getChatMessages() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = sessionStorage.getItem(KEYS.MESSAGES);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveChatMessages(messages: any[]) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
    } catch { /* silently ignore */ }
}

export function clearChatMessages() {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(KEYS.MESSAGES);
}

export function resetDemo() {
    if (typeof window === 'undefined') return;
    Object.values(KEYS).forEach(k => sessionStorage.removeItem(k));
}
