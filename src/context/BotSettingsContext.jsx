import React, { createContext, useContext, useState } from 'react';

const BotSettingsContext = createContext();

export const BotSettingsProvider = ({ children }) => {
    const [botSettings, setBotSettings] = useState({
        name: 'SaPyBase AI',
        primaryColor: '#5730F5',
        greeting: 'Hi! How can I help you today?',
    });
    const [previewOpen, setPreviewOpen] = useState(false);

    const updateSetting = (key, value) =>
        setBotSettings(prev => ({ ...prev, [key]: value }));

    return (
        <BotSettingsContext.Provider value={{ botSettings, updateSetting, previewOpen, setPreviewOpen }}>
            {children}
        </BotSettingsContext.Provider>
    );
};

export const useBotSettings = () => {
    const ctx = useContext(BotSettingsContext);
    if (!ctx) throw new Error('useBotSettings must be used within BotSettingsProvider');
    return ctx;
};
