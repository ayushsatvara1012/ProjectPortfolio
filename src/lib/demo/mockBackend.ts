const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const INITIAL_DEMO_LEADS = [
    { id: '1', email: 'amelia@northstar.io', name: 'Amelia Wong', score: 92, band: 'HOT', status: 'new', value_usd: null, context: 'Ready to buy — asked for a demo this week and pricing for 12 seats.', created_at: hoursAgo(2) },
    { id: '2', email: 'sarah@brightwell.co', name: 'Sarah Johnson', score: 88, band: 'HOT', status: 'new', value_usd: null, context: 'Asked about enterprise pricing and onboarding timeline.', created_at: hoursAgo(5) },
    { id: '3', email: 'marcus@techcorp.io', name: 'Marcus Chen', score: 76, band: 'WARM', status: 'contacted', value_usd: null, context: 'Wanted to confirm it integrates with Shopify before committing.', created_at: hoursAgo(26) },
    { id: '4', email: 'priya@launchpad.co', name: 'Priya Patel', score: 71, band: 'WARM', status: 'won', value_usd: 1200, context: 'Compared Pro vs Business and upgraded the same day.', created_at: hoursAgo(50) },
    { id: '5', email: 'diego@menloretail.com', name: 'Diego Alvarez', score: 44, band: 'COLD', status: 'new', value_usd: null, context: 'General question about the return policy.', created_at: hoursAgo(8) },
    { id: '6', email: 'tom@harborgoods.com', name: 'Tom Becker', score: 38, band: 'COLD', status: 'lost', value_usd: null, context: 'Asked about free-trial length, never replied to follow-up.', created_at: hoursAgo(72) },
];

export const INITIAL_DEMO_FIXES = [
    { query: 'Do you offer a free trial?', ask_count: 9, last_asked: hoursAgo(3), confidence: null, category: 'unanswered' },
    { query: 'What is your refund policy?', ask_count: 6, last_asked: hoursAgo(20), confidence: null, category: 'unanswered' },
    { query: 'Can I export my leads to CSV?', ask_count: 4, last_asked: hoursAgo(28), confidence: 0.42, category: 'low_confidence' },
    { query: 'Do you support multiple languages?', ask_count: 3, last_asked: hoursAgo(40), confidence: 0.55, category: 'low_confidence' },
    { query: 'Is there a discount for nonprofits?', ask_count: 2, last_asked: hoursAgo(60), confidence: null, category: 'unanswered' },
];

export const INITIAL_DEMO_SESSIONS = [
    {
        session_id: 's1', last_active: hoursAgo(1), message_count: 4, has_unanswered: false,
        messages: [
            { user_query: 'What are the pricing plans?', bot_response: 'We offer Starter, Pro, and Business plans starting at $29/month — you can upgrade or downgrade anytime.', is_unanswered: false, timestamp: hoursAgo(1) },
            { user_query: 'Can I upgrade anytime?', bot_response: 'Yes — change your plan at any time from account settings, and changes are prorated automatically.', is_unanswered: false, timestamp: hoursAgo(1) },
        ],
    },
    {
        session_id: 's2', last_active: hoursAgo(24), message_count: 2, has_unanswered: true,
        messages: [
            { user_query: 'Do you offer a free trial?', bot_response: "I'm sorry, I don't have information about free trials at the moment.", is_unanswered: true, timestamp: hoursAgo(24) },
            { user_query: 'What is your refund policy?', bot_response: "I'm sorry, I don't have details on the refund policy.", is_unanswered: true, timestamp: hoursAgo(24) },
        ],
    },
    {
        session_id: 's3', last_active: hoursAgo(48), message_count: 2, has_unanswered: false,
        messages: [
            { user_query: 'How do I integrate the widget on my website?', bot_response: 'Add a single script tag to your HTML — we provide step-by-step docs for Shopify, WordPress, Webflow and more.', is_unanswered: false, timestamp: hoursAgo(48) },
        ],
    },
];

export const DEMO_FUNNEL_RAW = {
    stages: [
        { key: 'conversations', label: 'Conversations', count: 420, pct_of_top: 100, pct_of_prev: 100, dropoff_pct: 0 },
        { key: 'leads', label: 'Leads captured', count: 64, pct_of_top: 15, pct_of_prev: 15, dropoff_pct: 85 },
        { key: 'contacted', label: 'Contacted', count: 28, pct_of_top: 7, pct_of_prev: 44, dropoff_pct: 56 },
        { key: 'won', label: 'Won', count: 11, pct_of_top: 3, pct_of_prev: 39, dropoff_pct: 61 },
    ],
    overall: 2.6,
    wonValue: 8400,
    quality: {
        total_scored: 64,
        bands: [
            { band: 'hot', count: 18, pct: 28 },
            { band: 'warm', count: 27, pct: 42 },
            { band: 'cold', count: 19, pct: 30 },
        ],
    },
    sources: {
        total_leads: 64,
        items: [
            { source: 'Chat widget', leads: 41, won: 8, won_value: 5200 },
            { source: 'Pricing page', leads: 14, won: 2, won_value: 2100 },
            { source: 'Docs', leads: 9, won: 1, won_value: 1100 },
        ],
    },
};

function buildCalendarData() {
    const today = new Date();
    const seed = [0, 5, 0, 0, 8, 0, 3, 0, 0, 12, 0, 0, 6, 0, 9, 0, 0, 4, 0, 0, 7, 0, 11, 0, 2, 0, 0, 8, 0, 5];
    return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (29 - i));
        const q = seed[i] ?? 0;
        return {
            date: d.toISOString().split('T')[0],
            total_questions: q,
            interacted_users: q > 0 ? Math.ceil(q * 0.7) : 0,
            answered_questions: q > 0 ? Math.ceil(q * 0.82) : 0,
            unanswered_questions: q > 0 ? Math.floor(q * 0.18) : 0,
            top_questions: q > 0 ? ['What are the pricing plans?', 'How do I get started?'] : [],
            top_unanswered: q > 0 && Math.floor(q * 0.18) > 0 ? ['Do you offer a free trial?'] : [],
        };
    });
}

export function buildDemoReport(botName: string) {
    return {
        roi_metrics: { support_savings: '$312.50', potential_revenue: '$1,250.00' },
        top_trends: [
            'Users frequently ask about product pricing and available tiers.',
            'Questions about integration and setup process are common.',
            'Support inquiries focus on account management and billing.',
            'Feature requests appear regularly in conversations.',
        ],
        high_value_gaps: ['What is your refund policy?', 'Do you offer a free trial?', 'Can I export my data?'],
        actionable_advice: `Train ${botName} on more detailed FAQs to reduce unanswered queries. Focus on pricing tiers, refund policies, and free-trial availability to convert more visitors into leads.`,
        peak_activity_blocks: buildCalendarData(),
        recent_conversations: [
            { query: 'What are the pricing plans?', unanswered: false, timestamp: hoursAgo(1) },
            { query: 'Do you offer a free trial?', unanswered: true, timestamp: hoursAgo(2) },
            { query: 'How do I integrate the widget?', unanswered: false, timestamp: hoursAgo(3) },
            { query: 'What is your refund policy?', unanswered: true, timestamp: hoursAgo(4) },
            { query: 'Can I customize the bot appearance?', unanswered: false, timestamp: hoursAgo(5) },
        ],
    };
}

class MockBackendStore {
    leads = [...INITIAL_DEMO_LEADS];
    sessions = [...INITIAL_DEMO_SESSIONS];
    roiStats = {
        benchmarks: { avg_human_cost_per_ticket: 5, avg_lead_value: 50 },
        stats: { total_queries_30d: 420, answered_queries_30d: 344, leads_30d: 64 },
        roi: { realized_revenue: 8400, won_deals: 11 }
    };

    updateLeadOutcome(leadId: string, status: string, value_usd?: number | null) {
        const idx = this.leads.findIndex(l => l.id === leadId);
        if (idx !== -1) {
            this.leads[idx] = { ...this.leads[idx], status, value_usd: value_usd ?? null };
        }
    }

    deleteLead(leadId: string) {
        this.leads = this.leads.filter(l => l.id !== leadId);
    }
}

const store = new MockBackendStore();

export const createMockAuthFetch = (botName: string = 'Vaayu AI') => {
    return async (url: string, options?: any) => {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 400));

        const method = options?.method || 'GET';
        
        // Return structured data for specific endpoints
        if (url.includes('/api/roi-benchmarks')) {
            if (method === 'PUT') {
                const body = JSON.parse(options.body);
                store.roiStats.benchmarks.avg_human_cost_per_ticket = body.avg_human_cost_per_ticket;
                store.roiStats.benchmarks.avg_lead_value = body.avg_lead_value;
                return { success: true };
            }
            return store.roiStats;
        }

        if (url.includes('/action-center')) {
            const queue = store.leads
                .filter(l => l.status === 'new' || l.status === 'contacted')
                .map(l => {
                    const urgency = l.band === 'HOT' ? 'high' : l.band === 'WARM' ? 'medium' : 'low';
                    return { ...l, urgency, reason: `Lead · ${l.band}` };
                });
            const counts = {
                high: queue.filter(q => q.urgency === 'high').length,
                medium: queue.filter(q => q.urgency === 'medium').length,
                low: queue.filter(q => q.urgency === 'low').length,
                total: queue.length
            };
            return { queue, counts };
        }

        if (url.includes('/api/leads')) {
            if (url.includes('/outcome') && method === 'PATCH') {
                const parts = url.split('/');
                const leadId = parts[parts.length - 2];
                const body = JSON.parse(options.body);
                store.updateLeadOutcome(leadId, body.status, body.value_usd);
                return { success: true };
            }
            if (method === 'DELETE') {
                const parts = url.split('/');
                const leadId = parts[parts.length - 1];
                store.deleteLead(leadId);
                return { success: true };
            }
            
            // GET /api/leads
            return {
                leads: store.leads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
                total: store.leads.length,
                page: 1,
                limit: 50
            };
        }

        if (url.includes('/api/conversations')) {
            if (method === 'PATCH' && url.includes('/teach')) {
                // handle teach
                return { success: true };
            }
            return {
                sessions: store.sessions,
                total: store.sessions.length
            };
        }

        if (url.includes('/api/analytics/funnel')) {
            return DEMO_FUNNEL_RAW;
        }

        if (url.includes('/api/analytics/generate-report')) {
            return {
                report: buildDemoReport(botName),
                generated_at: new Date().toISOString()
            };
        }

        // Mock Knowledge Endpoints for SourceBrowser
        if (url.includes('/api/knowledge/sources')) {
            const knowledge = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vaayu_demo_knowledge') || '[]') : [];
            return {
                sources: knowledge.length > 0 ? [{ source: 'demo-knowledge', chunk_count: knowledge.length }] : []
            };
        }

        if (url.includes('/api/knowledge/chunks') && method === 'GET') {
            const knowledge = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vaayu_demo_knowledge') || '[]') : [];
            return {
                chunks: knowledge.map((c: string, i: number) => ({ id: String(i), content: c })),
                total: knowledge.length
            };
        }

        if (url.includes('/api/knowledge/chunks') && method === 'DELETE') {
            const body = JSON.parse(options.body);
            const chunkIdsToDelete = new Set(body.chunk_ids);
            const knowledge = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vaayu_demo_knowledge') || '[]') : [];
            const newKnowledge = knowledge.filter((_: any, i: number) => !chunkIdsToDelete.has(String(i)));
            if (typeof window !== 'undefined') localStorage.setItem('vaayu_demo_knowledge', JSON.stringify(newKnowledge));
            return { success: true, message: 'Chunks deleted.' };
        }

        if (url.includes('/api/knowledge/source') && method === 'DELETE') {
            if (typeof window !== 'undefined') localStorage.removeItem('vaayu_demo_knowledge');
            return { success: true, message: 'Source deleted.' };
        }
        
        // Mock empty return for unhandled endpoints (like catalog in insights page)
        return {};
    };
};
