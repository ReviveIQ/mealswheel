# 🍽️ Dinner Roulette V4

**Spin it. Cook it. Love it.**

An AI-powered dinner planning app for families who are tired of asking "what's for dinner?" Built for organic, whole-food cooking with Bobby Flay-level flavor and technique.

---

## What It Does

Dinner Roulette spins a roulette wheel and uses the Claude AI to generate a **custom dinner recipe on the spot** — built from the exact ingredients you have at home. Every spin is unique. You'll never get the same recipe twice.

---

## How to Use It

1. **Open** `dinner_roulette_v4.html` in any modern browser (Chrome, Safari, Firefox, Edge)
2. **Set your calorie goal** and number of servings at the top
3. **Pick your mode** — fridge mode or week planning mode
4. **Select your ingredients** from 200+ options across 11 categories
5. **Hit Spin** — the wheel animates and AI generates your recipe
6. **Cook dinner** — follow the step-by-step instructions

No installation. No internet required for the UI. API call fires when you spin.

---

## Two Modes

### 🧊 Use What I Have (Fridge Mode)
Select the ingredients you already have at home. Spin the wheel and get **3 AI-generated dinner options** matched to your pantry. Each card shows full ingredients, macro breakdown, and cooking steps.

### 📅 Plan Next Week (Week Mode)
Spin **5 times** to fill Monday–Friday. Each spin generates a unique recipe and avoids repeating what you've already picked. After 5 spins you get:
- All 5 recipe cards with full instructions
- A weekly calorie overview grid (Mon–Fri)
- A **complete grocery list** organized by category, ready to copy

---

## The Ingredient Database

**200+ ingredients across 11 categories:**

| Category | Count |
|---|---|
| Beef & Pork | 25 cuts |
| Poultry | 11 options |
| Seafood | 21 options |
| Vegetables | 50+ items |
| Aromatics | 13 items |
| Grains & Pasta | 40+ items |
| Canned & Pantry | 60+ items |
| Dairy & Eggs | 18 items |
| Fresh Herbs | 13 herbs |
| Spices & Dry | 35+ spices |
| Specialty & International | 30+ items |

Use the **search bar** to find any ingredient instantly, or browse by **category filter buttons**. No selection limit — select as many as you want. More ingredients = better AI recipes.

---

## Calorie & Nutrition Tracking

Set your **daily calorie goal** (default: 2,000 kcal) and **number of servings** (1–6 people). After each spin:

- Per-recipe **macro badges** — calories, protein, carbs, fat — all scaled by serving count
- **Progress bar** showing dinner calories as a % of your daily goal
- Color-coded status: 🟢 on target · 🔵 under · 🔴 over
- **Weekly calorie grid** (in Week Mode) showing each night at a glance
- Running **stats panel**: dinner kcal, % of goal, calories remaining, weekly average

---

## The Grocery List

Generated automatically after all 5 spins in Week Mode. Pulls every ingredient you need to buy from all 5 recipes, deduplicates across dishes, and organizes into 5 categories:

- **Proteins — choose organic**
- **Produce — organic priority**
- **Pantry & dry goods**
- **Dairy & refrigerated**
- **Spices & sauces**

Tap any item to cross it off. Hit **Copy list** to paste into Notes, Messages, or any shopping app.

---

## Why Organic?

🌿 items are flagged throughout the app as highest-priority organic swaps. The recommendation is grounded in research:

- **USDA Certified Organic** produce contains no synthetic pesticides or GMOs
- **Harvard T.H. Chan School of Public Health** research links organic diets to measurably lower pesticide exposure, particularly important for children
- **Organic livestock** must have outdoor access and cannot receive antibiotics or growth hormones
- The **WHO** identifies routine antibiotic use in livestock as a primary driver of global antibiotic resistance

Highest-priority organic items: all meats, eggs, spinach, kale, bell peppers, potatoes, sweet potatoes, carrots, cherry tomatoes.

---

## The Wheel Labels

Each segment sets the *style* of recipe the AI will generate:

| Label | What You Get |
|---|---|
| Tonight's Pick | A solid, satisfying weeknight dinner |
| Family Fave | Crowd-pleasing comfort food |
| Chef's Special | Elevated, technique-forward — Bobby Flay energy |
| Something New | Creative, unexpected flavor combinations |
| Quick Meal | Under 30 minutes, no shortcuts on flavor |
| Weekend Cook | Slow-cooked, BBQ, or a worthy weekend project |
| Comfort Food | Warming, cozy, stick-to-your-ribs |
| Seasonal Dish | Produce-forward, fresh, vegetable-led |

---

## Technical Details

| Property | Value |
|---|---|
| Format | Single self-contained `.html` file |
| Dependencies | None — zero frameworks, zero CDN calls |
| Backend | None — runs entirely in the browser |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Wheel | HTML5 Canvas with `requestAnimationFrame` physics |
| Easing | Quartic ease-out for realistic deceleration |
| Styling | Inline CSS with CSS custom properties |
| Storage | None — stateless, resets on refresh |

---

## Version History

| Version | Key Features |
|---|---|
| V1 | Core roulette wheel, pantry selector, 3 dinner options, bonus budget pick |
| V2 | 27+ hardcoded recipes, dual mode (fridge/week), grocery list generator |
| V3 | Calorie goal input, servings selector, macro badges, weekly calorie grid |
| **V4** | **AI-generated recipes, 200+ ingredient database, infinite variety** |

---

## Files

```
dinner_roulette_v4.html   — The full application (open this in your browser)
README.md                 — This file
dinner_roulette_handoff.docx  — Full technical handoff document
```

---

## Culinary Philosophy

Recipes are generated in the style of **Bobby Flay** — technique-driven, flavor-forward, and never boring. Real steps, real methods, real food. The app emphasizes:

- Whole foods over processed
- Organic proteins and thin-skin produce as a priority
- Grilling, searing, roasting, and braising done right
- Flavors built in layers, not shortcuts

---

*Built with Claude · Anthropic · May 2026*
