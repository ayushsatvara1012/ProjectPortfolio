import type { BlogPost } from '../types';

export const post: BlogPost = {
  slug: 'add-ai-chatbot-website-10-minutes',
  title: 'How to Add an AI Chatbot to Your Website in 10 Minutes (No Code)',
  description:
    'A step-by-step, no-code guide to launching an AI support chatbot that answers questions from your own content — train it on PDFs, URLs, or text and embed it with one snippet.',
  keywords: [
    'no-code AI chatbot',
    'website chatbot no coding',
    'AI chatbot for website',
    'add chatbot to website',
    'AI support agent small business',
  ],
  datePublished: '2026-06-02',
  dateModified: '2026-06-02',
  author: 'Ayush Satvara',
  readingTimeMinutes: 6,
  body: `Most "AI chatbot" tutorials assume you can write code, manage an API key, and wire up a backend. You can't, and you shouldn't have to. This guide walks through launching a working AI support agent on your site — trained on *your* content — without touching a line of code.

## What you're building

A chat widget that sits in the corner of your website and answers visitor questions using only the information you give it: your help docs, product pages, policies, and FAQs. When it doesn't know an answer, it says so instead of guessing — and it can capture the visitor's email so you can follow up.

## Step 1 — Create your bot

Sign up and create a new bot from the dashboard. A bot is just a named workspace that holds everything it's allowed to know. You can run separate bots for, say, sales and support, each with its own knowledge.

## Step 2 — Train it on your content

This is the part that makes the bot *yours*. Instead of generic answers, it learns from sources you upload:

- **PDFs** — product manuals, policy documents, spec sheets.
- **URLs** — point it at your existing help center or product pages.
- **Raw text** — paste an FAQ or a description in your own words.

Sapybase breaks each source into searchable pieces and indexes them. When a visitor asks something, the bot retrieves the most relevant passages from your material and answers from those — not from the open internet.

> Tip: start with your five most common support questions. You can always add more sources later, and the bot picks them up immediately.

## Step 3 — Customize the look

Match the widget to your brand — set the accent color, the bot's name, and a welcome message. On paid plans you can remove third-party branding entirely for a white-label experience.

## Step 4 — Embed the widget

Copy the embed snippet from the dashboard and paste it into your site's HTML, just before the closing \`</body>\` tag. If you use a site builder (Webflow, WordPress, Shopify, Framer, etc.), paste it into the "custom code" or "footer scripts" section. That's the only "code" involved — a copy and paste.

The widget loads asynchronously, so it won't slow your page down.

## Step 5 — Test it like a customer

Open your site, ask the bot a few real questions, and confirm the answers come from your content. Try an edge case you *didn't* train it on — a good bot should admit it doesn't know rather than inventing an answer.

## What happens after launch

Once it's live, the bot works 24/7. From the dashboard you can:

- See every conversation, grouped by session.
- Spot the questions it couldn't answer, so you know exactly what content to add next.
- Capture leads when a visitor shows buying intent.

That last point matters: a support bot that also surfaces sales-ready visitors pays for itself faster. We cover how to measure that in [our guide to chatbot ROI](/blog/measure-chatbot-roi).

## The 10-minute reality check

The setup genuinely takes about ten minutes. Making the bot *great* is an ongoing loop: watch what visitors ask, add the content it was missing, and the answers keep improving. The tooling for that loop is built in — you don't need to be technical to run it.

Ready to try it? [Create your first bot](/sign-up) and paste the snippet — your site can have a knowledgeable AI agent before your coffee gets cold.`,
};
