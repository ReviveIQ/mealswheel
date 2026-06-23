# 🍽️ MealWheelIQ

**Spin it. Cook it. Love it.**

An AI-powered family dinner planning app that eliminates the nightly "what's for dinner?" argument. Spin the wheel, get 3 chef-quality recipes built from your actual pantry — no extra shopping required.

---

## Live URLs

| | URL |
|---|---|
| **Landing page** | https://mealwheeliq.com |
| **Sign in / Sign up** | https://mealwheeliq.com/login.html |
| **App** | https://mealwheeliq.com/app.html |
| **API** | https://api.mealwheeliq.com |
| **API health check** | https://api.mealwheeliq.com/ |

---

## What It Does

1. **Sign up** — free trial, weekly, monthly, or family plan
2. **Name your chef** — personalized AI chef for your kitchen
3. **Stock your pantry** — add what you have (fridge, pantry, freezer)
4. **Spin the wheel** — AI generates 3 recipes from your ingredients
5. **Cook dinner** — professional cookbook-style step-by-step instructions
6. **Save favorites** — star recipes, rate them, build your collection

Every recipe is unique, generated fresh on each spin using your actual pantry. The app enforces a 40% buy-ingredient cap in pantry mode — recipes use what you have.

---

## Pricing

| Plan | Price | Spins | History | Profiles |
|---|---|---|---|---|
| Free Trial | $0 | 5 lifetime | Last 5 | — |
| Weekly Trial | $4.99/week | Unlimited | Full | — |
| Home Chef | $9.99/mo | Unlimited | Full | — |
| Family | $19.99/mo | Unlimited | Full | Up to 4 |

---

## How It Works

### 🎰 Spin Mode
Select pantry items → spin wheel → get 3 AI-generated recipes with macros, ingredients, and step-by-step instructions. Each wheel segment sets the recipe style (Tonight's Pick, Family Fave, Chef's Special, Quick Meal, etc.)

### 📅 Week Planning Mode
Spin 5 times to plan Monday–Friday. Each spin avoids repeating previous recipes. After 5 spins:
- Full recipe cards for the week
- Weekly calorie overview grid
- Smart grocery list organized by category

### 🛒 Pantry System
Add ingredients from 200+ options across 7 categories (Proteins, Produce, Dairy, Grains, Pantry Staples, Herbs & Spices, Frozen) or type any custom ingredient. Add "tonight's extras" for session-only additions that don't save to your pantry.

---

## Recipe Quality

Recipes follow professional cookbook standards (America's Test Kitchen / Bon Appétit style):
- Every step leads with an action verb
- Timing and visual cues on every step ("cook until golden, about 4 minutes")
- 5–7 steps maximum — no micro-steps
- Ingredients grouped by when they're added
- Final step always seasons and serves

---

## Tech Stack

| Layer | Service |
|---|---|
| Frontend | GitHub Pages (mealwheeliq.com) |
| Backend | Railway (api.mealwheeliq.com) |
| Database | TiDB Cloud Serverless (mealwheeliq schema) |
| AI | Anthropic claude-sonnet-4-6 |
| Nutrition | USDA FoodData Central API |
| Payments | Stripe (live mode) |
| Email | Mailchimp |
| Auth | JWT + bcrypt |

---

## Repository Structure

```
mealwheeliq/          ← This repo (GitHub Pages frontend)
  index.html          ← Landing page + pricing + Mailchimp waitlist
  login.html          ← Sign in / Create account + plan picker
  app.html            ← Full authenticated app
  README.md           ← This file

mealswheel-api/       ← Backend repo (Railway auto-deploy)
  server.js           ← Express API — auth, recipes, Stripe, TiDB
  package.json        ← Node.js dependencies
  railway.toml        ← Railway deployment config
```

---

## Key Features

- ✅ Personalized chef name (set on first login, saved to account)
- ✅ Pantry-based recipe generation — uses what you have
- ✅ 40% buy-ingredient cap in pantry mode
- ✅ USDA-verified macros (with AI estimate fallback)
- ✅ Dietary filters — vegetarian, vegan, gluten-free, dairy-free, low-carb, high-protein
- ✅ Recipe favorites + 5-star ratings
- ✅ Top-rated recipes surfaced to landing page
- ✅ Week planning + grocery list
- ✅ Family profiles (Family plan)
- ✅ Shareable recipe links

---

## Wheel Segments

| Segment | Style |
|---|---|
| Tonight's Pick | Satisfying weeknight dinner |
| Family Fave | Crowd-pleasing comfort food |
| Chef's Special | Elevated, technique-forward |
| Something New | Creative, unexpected combinations |
| Quick Meal | Under 30 minutes |
| Weekend Cook | Slow-cooked or BBQ project |
| Comfort Food | Warming, cozy classics |
| Seasonal Dish | Produce-forward, fresh |

---

## Why Organic?

🌿 items are flagged as highest-priority organic swaps:
- **USDA Organic** = no synthetic pesticides, no GMOs
- **Harvard research** links organic diets to lower pesticide exposure — especially important for children
- **Organic livestock** = no antibiotics or growth hormones
- **WHO** flags routine livestock antibiotics as a key driver of antibiotic resistance

Priority organic items: all meats, eggs, spinach, kale, bell peppers, potatoes, sweet potatoes, carrots, cherry tomatoes.

---

*Built by Bryan Michael Greer · ReviveIQ · 2026*
*Powered by Anthropic Claude · Spin it. Cook it. Love it.*
