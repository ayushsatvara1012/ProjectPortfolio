---
description: Build the widget and push to production (GitHub) in one go.
---

This workflow automates the entire process of building the chat widget and syncing your code with the deployment branch.

// turbo-all
1. **Sync All Changes to Production**  
   `npm run build:widget`
   `git add .`
   `git commit -m "sync: production-ready widget and subscription fixes"`
   `git push origin deploy/render-vercel`

> [!TIP]
> Just type `/sync-deploy` once to handle all your GitHub and build steps!
