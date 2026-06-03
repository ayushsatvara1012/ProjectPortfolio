import type { BlogPost } from '../types';

export const post: BlogPost = {
  slug: 'measure-chatbot-roi',
  title: 'How to Measure Chatbot ROI: Support Savings, Leads, and Answer Quality',
  description:
    'Stop guessing whether your AI chatbot is worth it. Here are the three metrics that actually prove ROI — support cost avoided, leads captured, and answer quality — and how to track each.',
  keywords: [
    'chatbot ROI tracking',
    'customer support analytics',
    'AI support insights',
    'conversation analytics',
    'chatbot lead capture',
  ],
  datePublished: '2026-06-01',
  dateModified: '2026-06-02',
  author: 'Ayush Satvara',
  readingTimeMinutes: 7,
  body: `An AI chatbot is easy to launch and hard to justify — unless you measure it. "It feels helpful" doesn't survive a budget review. This guide breaks ROI into three concrete numbers you can actually track, and shows where each one comes from.

## 1. Support cost avoided

Every question your bot answers correctly is a ticket your team didn't have to handle. To turn that into money:

\`\`\`
support savings = answered questions × cost per handled ticket
\`\`\`

The "cost per handled ticket" is yours to set — it captures agent time, tooling, and overhead. Sapybase tracks the count of answered questions automatically, so you multiply by your own benchmark and you have a defensible savings figure for the period.

The key word is **answered**. A bot that deflects a question by guessing isn't saving you anything — it's creating a second, angrier ticket. Which is why answer *quality* is its own metric (see below).

## 2. Leads captured (and their quality)

Support and sales aren't separate jobs for a chatbot. When a visitor asks about pricing, a demo, or how to get started, that's buying intent — and a good bot captures their email right there in the conversation.

\`\`\`
pipeline value = leads captured × average value per lead
\`\`\`

But raw lead count is a vanity metric. Ten tire-kickers aren't worth one ready-to-buy prospect. That's why each captured lead is **scored** from signals in the conversation — buying-intent language, whether they used a business email, how engaged they were — and bucketed into **Hot / Warm / Cold**. The score travels with the lead into your CRM via webhook, so your team works the hot ones first.

## 3. Answer quality (the metric most teams skip)

Here's the uncomfortable truth: a chatbot can have great usage numbers and still be quietly damaging trust. The fix is to measure *how well-grounded* its answers are.

Sapybase scores each answer's **confidence** — how strongly the response was supported by your actual content — with no extra cost. That gives you two views that turn quality into action:

- **Unanswered questions** — where the bot honestly fell back because it had no relevant content.
- **Low-confidence answers** — where it answered, but the grounding was weak.

Together these form a **"fixes needed" worklist**: the exact questions your bot is failing on, deduplicated and ranked by how often they're asked. Each one links straight to training, so closing a gap is one click. This is the loop that compounds: every fix raises future answer quality, which raises real support savings.

## Putting it together

A simple monthly ROI statement comes down to three lines:

- **Support savings** — answered questions × your cost per ticket. This is the tickets your team never had to touch.
- **Pipeline value** — leads captured × your average value per lead. These are the new sales conversations the bot started.
- **Quality trend** — confidence scores and the number of fixes you closed. This is your leading indicator.

Add the first two, subtract your subscription cost, and you have net ROI. The third doesn't show up as a dollar figure directly — but it's the leading indicator for whether the first two keep climbing.

## Start measuring

If you haven't launched yet, [our 10-minute setup guide](/blog/add-ai-chatbot-website-10-minutes) gets you to a live bot fast. Once it's running, the analytics, lead scoring, and fixes-needed worklist are all in the dashboard — no spreadsheets required.`,
};
