const KEYS = {
    BOT: 'demo_bot_config',
    KNOWLEDGE: 'demo_knowledge_chunks',
    TRAINED: 'demo_trained',
    MESSAGES: 'demo_chat_messages',
};

// ── Bot Config ────────────────────────────────────────────────────────────────
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
    try {
        const raw = sessionStorage.getItem(KEYS.BOT);
        return raw ? { ...DEFAULT_BOT, ...JSON.parse(raw) } : { ...DEFAULT_BOT };
    } catch { return { ...DEFAULT_BOT }; }
}

export function saveBotConfig(partial) {
    try {
        const current = getBotConfig();
        sessionStorage.setItem(KEYS.BOT, JSON.stringify({ ...current, ...partial }));
    } catch { /* quota exceeded — silently ignore */ }
}

// ── Knowledge Chunks ──────────────────────────────────────────────────────────
export function getKnowledge() {
    try {
        const raw = sessionStorage.getItem(KEYS.KNOWLEDGE);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveKnowledge(chunks) {
    try {
        sessionStorage.setItem(KEYS.KNOWLEDGE, JSON.stringify(chunks));
        sessionStorage.setItem(KEYS.TRAINED, 'true');
    } catch { /* silently ignore */ }
}

export function clearKnowledge() {
    sessionStorage.removeItem(KEYS.KNOWLEDGE);
    sessionStorage.removeItem(KEYS.TRAINED);
}

export function isTrained() {
    return sessionStorage.getItem(KEYS.TRAINED) === 'true' && getKnowledge().length > 0;
}

// ── Chat Messages ─────────────────────────────────────────────────────────────
export function getChatMessages() {
    try {
        const raw = sessionStorage.getItem(KEYS.MESSAGES);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveChatMessages(messages) {
    try {
        sessionStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
    } catch { /* silently ignore */ }
}

export function clearChatMessages() {
    sessionStorage.removeItem(KEYS.MESSAGES);
}

// ── Full Reset ────────────────────────────────────────────────────────────────
export function resetDemo() {
    Object.values(KEYS).forEach(k => sessionStorage.removeItem(k));
}
