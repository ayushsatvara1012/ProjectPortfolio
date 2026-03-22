---
description: How to build and push the SaPyBase Chat Widget to GitHub
---

Follow these steps to ensure all your latest dynamic configuration and backend changes are uploaded to your GitHub repository.

1. **Build the Widget Production Assets**  
   Before pushing, ensure the `widget.js` and `style.css` are updated with your latest React changes:  
   `// turbo`
   ```bash
   npm run build:widget
   ```

2. **Stage and Commit All Changes**  
   Add both the frontend and backend files:  
   `// turbo`
   ```bash
   git add src/components/chatWidget.jsx sapybase_ai_engine/main.py sapybase_ai_engine/migrate_v2.py index.html package.json vercel.json dist-widget/ public/
   ```

3. **Commit with a Descriptive Message**  
   ```bash
   git commit -m "feat: complete multi-tenant dynamization and layout fixes"
   ```

4. **Push to the ai-integration Branch**  
   `// turbo`
   ```bash
   git push origin ai-integration
   ```

5. **Merge to Main (Optional but Recommended)**  
   If you are satisfied and want to deploy to production:  
   ```bash
   git checkout main
   git merge ai-integration
   git push origin main
   ```

> [!TIP]
> Always verify your `.env` and `venv/` are ignored by checking your `.gitignore` to prevent leaking secrets.
