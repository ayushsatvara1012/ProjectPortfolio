# Sapybase Illustration Creation Guide
**Step-by-step manual creation for Figma**

---

## Quick Reference: Colors
- **Primary Blue:** #4f46e5
- **Accent Green:** #10b981
- **Red (Error):** #ef4444
- **Light Gray:** #d1d5db
- **Dark Gray:** #374151
- **White:** #ffffff

---

## FRAME 1: Hero (Problem vs Solution)
**Canvas Size:** 600px × 300px

### Left Side (Problem)
1. **Background Rectangle**
   - Size: 280px × 300px
   - Position: (0, 0)
   - Fill: #d1d5db, 30% opacity
   
2. **Generic AI Circle**
   - Create Ellipse: 60px × 60px
   - Position: (50, 60)
   - Fill: #ef4444, 20% opacity
   - Stroke: #ef4444, 2px

3. **Question Marks (Text)**
   - Font: Inter, Bold, 32px
   - Text: "?"
   - Color: #ef4444
   - Position first "?": (120, 65)
   - Position second "?": (160, 70)

4. **X Mark (Wrong Answer)**
   - Font: Inter, Bold, 28px
   - Text: "✕"
   - Color: #ef4444
   - Position: (80, 140)

### Right Side (Solution)
1. **Background Rectangle**
   - Size: 280px × 300px
   - Position: (320, 0)
   - Fill: #ffffff
   - No stroke

2. **Sapybase AI Circle**
   - Create Ellipse: 60px × 60px
   - Position: (370, 60)
   - Fill: #4f46e5, 20% opacity
   - Stroke: #4f46e5, 2px

3. **Checkmark (Correct Answer)**
   - Font: Inter, Bold, 28px
   - Text: "✓"
   - Color: #10b981
   - Position: (400, 140)

4. **Document Icon**
   - Font: System emoji, 24px
   - Text: "📄"
   - Position: (430, 75)

### Center Arrow
- Font: Inter, Bold, 48px
- Text: "→"
- Color: #374151
- Position: (280, 100)

---

## FRAME 2: Speed (Timeline Comparison)
**Canvas Size:** 600px × 250px

### Top Timeline: Sapybase (10 minutes)

1. **Title Text**
   - Font: Inter, Bold, 16px
   - Text: "⚡ Sapybase: 10 minutes"
   - Color: #4f46e5
   - Position: (20, 15)

2. **Step 1: Upload (2 min)**
   - Rectangle: 130px × 60px, Position: (40, 50)
   - Fill: #4f46e5, 10% opacity
   - Stroke: #4f46e5, 2px
   - Text inside: "📤 Upload\n2 min" (11px, #4f46e5)

3. **Step 2: Customize (3 min)**
   - Rectangle: 130px × 60px, Position: (190, 50)
   - Fill: #4f46e5, 10% opacity
   - Stroke: #4f46e5, 2px
   - Text inside: "⚙️ Customize\n3 min" (11px, #4f46e5)

4. **Step 3: Deploy (5 min)**
   - Rectangle: 130px × 60px, Position: (340, 50)
   - Fill: #4f46e5, 10% opacity
   - Stroke: #4f46e5, 2px
   - Text inside: "🚀 Deploy\n5 min" (11px, #4f46e5)

5. **Arrows Between Steps**
   - Text: "→" (20px, #10b981)
   - Positions: (175, 70) and (325, 70)

6. **Live Badge**
   - Font: Inter, Bold, 12px
   - Text: "✓ LIVE"
   - Color: #10b981
   - Position: (550, 75)

### Divider Line
- Line from (20, 140) to (580, 140)
- Color: #d1d5db, 1px stroke

### Bottom Timeline: Traditional (2 weeks)

1. **Title Text**
   - Font: Inter, Bold, 16px
   - Text: "📅 Traditional: 2 weeks"
   - Color: #374151
   - Position: (20, 155)

2. **7 Step Boxes** (arrange horizontally starting at x=40, y=185)
   - Each box: 65px × 50px
   - Fill: #d1d5db, 100% opacity
   - Stroke: #374151, 1px
   - Steps: "Setup", "Config", "Meetings", "Testing", "Deploy", "Train", "Live"
   - Text inside each: 9px, #374151
   - Spacing: 72px between each (40 + 65 + 7px gap)

---

## FRAME 3: Customize (Integration Hub)
**Canvas Size:** 500px × 500px

### Center Hub
1. **Center Circle**
   - Create Ellipse: 80px × 80px
   - Position: (210, 210)
   - Fill: #4f46e5, 20% opacity
   - Stroke: #4f46e5, 3px

2. **Sapybase Logo (S)**
   - Font: Inter, Bold, 36px
   - Text: "S"
   - Color: #4f46e5
   - Position: (235, 230)

### Integration Circles (6-point star pattern)
**Center point:** (250, 250) | **Radius:** 140px

Use these positions (precalculated for each integration):

1. **Shopify** (🛍️) — Right (0°)
   - Circle at: (375, 225)
   - Icon at: (363, 213)
   - Line from center: (290, 250) → (375, 225)

2. **WordPress** (📝) — Upper Right (60°)
   - Circle at: (319, 129)
   - Icon at: (307, 117)
   - Line from center: (270, 210) → (319, 129)

3. **Webflow** (🌐) — Upper Left (120°)
   - Circle at: (181, 129)
   - Icon at: (169, 117)
   - Line from center: (230, 210) → (181, 129)

4. **Database** (💾) — Left (180°)
   - Circle at: (125, 225)
   - Icon at: (113, 213)
   - Line from center: (210, 250) → (125, 225)

5. **CRM** (📋) — Lower Left (240°)
   - Circle at: (181, 371)
   - Icon at: (169, 359)
   - Line from center: (230, 290) → (181, 371)

6. **Webhooks** (🔗) — Lower Right (300°)
   - Circle at: (319, 371)
   - Icon at: (307, 359)
   - Line from center: (270, 290) → (319, 371)

### Each Integration Circle Details
- Size: 50px × 50px
- Fill: #ffffff
- Stroke: #10b981, 2px
- Icon: Emoji, 24px, centered
- Connection Line: #10b981, 2px, 70% opacity

---

## FRAME 4: ROI (Before/After)
**Canvas Size:** 600px × 300px

### Left Side: Before (Without Sapybase)

1. **Background Rectangle**
   - Size: 280px × 300px
   - Position: (0, 0)
   - Fill: #ef4444, 8% opacity

2. **Scattered Email Icons**
   - Font: System emoji, 20px
   - Text: "📧"
   - Random scatter pattern (example positions):
     - (30, 40), (120, 60), (180, 80), (90, 150), (200, 180)

3. **Loss Icon**
   - Font: System emoji, 36px
   - Text: "💸"
   - Position: (100, 240)

4. **X Mark (Problem)**
   - Font: Inter, Bold, 28px
   - Text: "✕"
   - Color: #ef4444
   - Position: (200, 245)

### Right Side: After (With Sapybase)

1. **Background Rectangle**
   - Size: 280px × 300px
   - Position: (320, 0)
   - Fill: #10b981, 8% opacity

2. **Three Checkmarks (Vertical Stack)**
   - Font: Inter, Bold, 24px
   - Text: "✓"
   - Color: #10b981
   - Positions: (420, 60), (420, 100), (420, 140)

3. **Savings Icon**
   - Font: System emoji, 36px
   - Text: "💰 ✓"
   - Position: (420, 200)

### Center Arrow
- Font: Inter, Bold, 48px
- Text: "→"
- Color: #374151
- Position: (280, 100)

### Labels

1. **Without Sapybase**
   - Font: Inter, Bold, 12px
   - Text: "Without Sapybase"
   - Color: #374151
   - Position: (20, 275)

2. **With Sapybase**
   - Font: Inter, Bold, 12px
   - Text: "With Sapybase"
   - Color: #374151
   - Position: (360, 275)

---

## Creation Checklist

### Before You Start
- [ ] Open your Figma file: https://www.figma.com/design/1xVZ2FuJJbAaQxEUbizwvp
- [ ] Set up 4 artboards/frames with the sizes listed above
- [ ] Install Inter font in Figma (if not already available)
- [ ] Create a color palette with the 6 colors listed at the top

### Frame 1: Hero
- [ ] Create left side background (gray)
- [ ] Add confused AI circle + question marks (red)
- [ ] Add X mark
- [ ] Create right side background (white)
- [ ] Add smart AI circle + checkmark (blue/green)
- [ ] Add document icon
- [ ] Add center arrow
- [ ] Test that someone understands "Generic AI vs Custom AI" without reading text

### Frame 2: Speed
- [ ] Create top timeline title
- [ ] Add 3 step boxes with icons and time labels
- [ ] Add arrows between steps
- [ ] Add LIVE badge
- [ ] Add divider line
- [ ] Create bottom timeline title
- [ ] Add 7 gray step boxes
- [ ] Test that the visual difference is clear (10 min vs 2 weeks at a glance)

### Frame 3: Customize
- [ ] Create center hub circle with "S" logo
- [ ] Add 6 integration circles in constellation pattern
- [ ] Add connection lines from center to each integration
- [ ] Add icons to each integration circle
- [ ] Test that the hub-and-spoke pattern is clear

### Frame 4: ROI
- [ ] Create left side background
- [ ] Scatter email icons
- [ ] Add loss icon and X mark
- [ ] Create right side background
- [ ] Add 3 checkmarks vertically
- [ ] Add savings icon
- [ ] Add center arrow
- [ ] Add labels at bottom
- [ ] Test that "chaos → organized" and "expensive → saving money" is obvious

### Final QA
- [ ] All frames are 600px wide (except Customize which is 500×500)
- [ ] Colors match the hex codes exactly
- [ ] Text is readable at 50% zoom
- [ ] Works at mobile (300px), tablet (400px), and desktop (600px) sizes
- [ ] Export each as SVG (for web use) and PNG @2x (for Retina)
- [ ] Get feedback: "Can you understand this without reading the label?"

---

## Export Instructions

### For Web Use (SVG)
1. Right-click frame → Copy as → SVG code
2. Paste into your website
3. Name files:
   - `sapybase_hero.svg`
   - `sapybase_speed.svg`
   - `sapybase_customize.svg`
   - `sapybase_roi.svg`

### For Retina Displays (PNG)
1. Right-click frame → Export
2. Scale: 2x (for retina)
3. Format: PNG
4. Name files:
   - `sapybase_hero@2x.png`
   - `sapybase_speed@2x.png`
   - `sapybase_customize@2x.png`
   - `sapybase_roi@2x.png`

---

## Tips for Success

**Keep it minimal:**
- Use max 2-3 colors per frame (plus white/gray)
- Avoid gradients, shadows, and complex shapes
- Stick to simple geometric forms

**Make it self-explanatory:**
- Ask: "If I blur the text, can someone still understand this?"
- Use emoji icons instead of custom illustrations
- Create strong visual contrast (problem = red, solution = green)

**Test at different sizes:**
- Download at 300px, 600px, and 900px
- Make sure it's legible at all sizes
- Adjust stroke weights if needed (2px is good for desktop)

**Get feedback:**
- Share with a colleague who hasn't seen the product
- Ask: "What's your instant takeaway from this illustration?"
- If they get it in 3 seconds, it's good

---

## Next Steps

1. **Create illustrations** using this guide (2-3 hours)
2. **Test with real users** — show to 3-5 customers, ask what they understand
3. **Refine based on feedback** — adjust colors, spacing, or details if needed
4. **Export SVG + PNG** for web integration
5. **Add to homepage** alongside the rewritten copy

Good luck! 🚀
