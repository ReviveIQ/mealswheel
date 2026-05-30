const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'mealswheel-secret-change-in-production';

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://reviveiq.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ]
}));

// Raw body for Stripe webhooks
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ─── DATABASE CONNECTION ─────────────────────────────────────────────────────
let db;

async function connectDB() {
  // First connect without a database to create it if needed
  const tempPool = await mysql.createPool({
    host: process.env.TIDB_HOST,
    port: parseInt(process.env.TIDB_PORT) || 4000,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    ssl: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
    waitForConnections: true,
    connectionLimit: 1,
    connectTimeout: 30000
  });
  await tempPool.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.TIDB_DATABASE}`);
  await tempPool.end();

  // Now connect with the database
  db = await mysql.createPool({
    host: process.env.TIDB_HOST,
    port: parseInt(process.env.TIDB_PORT) || 4000,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    ssl: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 30000
  });
  console.log('Connected to TiDB — database:', process.env.TIDB_DATABASE);
}

// ─── CREATE TABLES ───────────────────────────────────────────────────────────
async function createTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      stripe_customer_id VARCHAR(255),
      stripe_subscription_id VARCHAR(255),
      plan ENUM('free', 'home_chef', 'family') DEFAULT 'free',
      status ENUM('active', 'cancelled', 'past_due', 'trialing') DEFAULT 'active',
      current_period_end TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNIQUE NOT NULL,
      daily_calorie_goal INT DEFAULT 2000,
      servings INT DEFAULT 2,
      dietary_preferences JSON,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_pantry (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      ingredient_name VARCHAR(255) NOT NULL,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_ingredient (user_id, ingredient_name),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS recipe_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      recipe_name VARCHAR(255) NOT NULL,
      emoji VARCHAR(10),
      cook_time VARCHAR(50),
      difficulty VARCHAR(50),
      style VARCHAR(100),
      calories_per_serving INT,
      protein_g INT,
      carbs_g INT,
      fat_g INT,
      ingredients JSON,
      steps JSON,
      saved BOOLEAN DEFAULT FALSE,
      spun_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS favorite_recipes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      recipe_id INT NOT NULL,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (recipe_id) REFERENCES recipe_history(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      week_start_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS meal_plan_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meal_plan_id INT NOT NULL,
      day ENUM('monday','tuesday','wednesday','thursday','friday') NOT NULL,
      recipe_id INT NOT NULL,
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id),
      FOREIGN KEY (recipe_id) REFERENCES recipe_history(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS spin_counts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      month VARCHAR(7) NOT NULL,
      count INT DEFAULT 0,
      last_spin_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_month (user_id, month),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS family_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      owner_user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      calorie_goal INT DEFAULT 2000,
      servings INT DEFAULT 2,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    )
  `);

  console.log('All tables created');
}

// ─── USDA NUTRITION LOOKUP ───────────────────────────────────────────────────

// Common ingredient portion sizes in grams
const PORTION_SIZES = {
  // Proteins
  'ground beef': 150, 'beef sirloin': 170, 'beef chuck': 170, 'chicken breast': 170,
  'chicken thighs': 150, 'pork chops': 150, 'pork tenderloin': 150, 'salmon': 150,
  'shrimp': 120, 'tuna': 140, 'cod': 150, 'tilapia': 150, 'bacon': 30,
  'italian sausage': 100, 'chorizo': 80, 'turkey': 150, 'eggs': 50, 'ham': 80,
  // Grains & Pasta
  'pasta': 85, 'spaghetti': 85, 'penne': 85, 'rigatoni': 85, 'rice': 90,
  'jasmine rice': 90, 'basmati rice': 90, 'quinoa': 85, 'bread': 30, 'naan': 90,
  'tortillas': 45, 'couscous': 80, 'farro': 85, 'polenta': 80,
  // Vegetables
  'potatoes': 150, 'sweet potatoes': 130, 'carrots': 80, 'broccoli': 90,
  'spinach': 30, 'kale': 30, 'zucchini': 100, 'squash': 120, 'bell peppers': 90,
  'onions': 80, 'garlic': 10, 'tomatoes': 90, 'mushrooms': 80, 'asparagus': 90,
  'eggplant': 100, 'corn': 80, 'avocado': 75, 'cucumber': 100, 'celery': 50,
  'cauliflower': 90, 'brussels sprouts': 90, 'green beans': 80,
  // Dairy
  'butter': 14, 'heavy cream': 30, 'milk': 120, 'cheese': 30, 'cheddar': 30,
  'parmesan': 20, 'mozzarella': 40, 'feta': 30, 'cream cheese': 30,
  'sour cream': 30, 'greek yogurt': 80, 'ricotta': 60,
  // Pantry
  'olive oil': 14, 'soy sauce': 15, 'honey': 20, 'tomato paste': 30,
  'canned tomatoes': 100, 'coconut milk': 60, 'peanut butter': 32,
  'flour': 30, 'breadcrumbs': 30, 'panko': 30,
  // Default
  'default': 60
};

function getPortionSize(ingredientName) {
  const lower = ingredientName.toLowerCase();
  for (const [key, size] of Object.entries(PORTION_SIZES)) {
    if (lower.includes(key)) return size;
  }
  return PORTION_SIZES.default;
}

async function lookupNutrition(ingredientName) {
  if (!process.env.USDA_API_KEY) return null;
  try {
    const query = encodeURIComponent(ingredientName.replace(/organic|fresh|frozen|dried|canned/gi, '').trim());
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${query}&dataType=Foundation,SR%20Legacy&pageSize=1&api_key=${process.env.USDA_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const food = data.foods?.[0];
    if (!food) return null;

    const getNutrient = (id) => {
      const n = food.foodNutrients?.find(n => n.nutrientId === id);
      return n?.value || 0;
    };

    // USDA nutrient IDs: 1008=calories, 1003=protein, 1005=carbs, 1004=fat, 1079=fiber, 1093=sodium
    return {
      name: food.description,
      calories_per_100g: getNutrient(1008),
      protein_per_100g: getNutrient(1003),
      carbs_per_100g: getNutrient(1005),
      fat_per_100g: getNutrient(1004),
      fiber_per_100g: getNutrient(1079),
      sodium_per_100g: getNutrient(1093)
    };
  } catch (err) {
    console.error('USDA lookup failed for', ingredientName, err.message);
    return null;
  }
}

async function calculateVerifiedMacros(ingredients, servings = 2) {
  let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0, totalFiber = 0, totalSodium = 0;
  let lookedUp = 0;

  // Run lookups in parallel for speed
  const results = await Promise.all(
    ingredients.map(async (ing) => {
      const nutrition = await lookupNutrition(ing.name);
      if (!nutrition) return null;
      const portion = getPortionSize(ing.name);
      const factor = portion / 100;
      return {
        ingredient: ing.name,
        portion_g: portion,
        usda_name: nutrition.name,
        calories: Math.round(nutrition.calories_per_100g * factor),
        protein_g: Math.round(nutrition.protein_per_100g * factor * 10) / 10,
        carbs_g: Math.round(nutrition.carbs_per_100g * factor * 10) / 10,
        fat_g: Math.round(nutrition.fat_per_100g * factor * 10) / 10,
        fiber_g: Math.round(nutrition.fiber_per_100g * factor * 10) / 10,
        sodium_mg: Math.round(nutrition.sodium_per_100g * factor)
      };
    })
  );

  const nutritionBreakdown = results.filter(Boolean);
  lookedUp = nutritionBreakdown.length;

  nutritionBreakdown.forEach(n => {
    totalCal += n.calories;
    totalPro += n.protein_g;
    totalCarb += n.carbs_g;
    totalFat += n.fat_g;
    totalFiber += n.fiber_g;
    totalSodium += n.sodium_mg;
  });

  if (lookedUp === 0) return null;

  return {
    calories_per_serving: Math.round(totalCal / servings),
    protein_g: Math.round(totalPro / servings * 10) / 10,
    carbs_g: Math.round(totalCarb / servings * 10) / 10,
    fat_g: Math.round(totalFat / servings * 10) / 10,
    fiber_g: Math.round(totalFiber / servings * 10) / 10,
    sodium_mg: Math.round(totalSodium / servings),
    ingredients_breakdown: nutritionBreakdown,
    source: 'USDA FoodData Central',
    ingredients_verified: lookedUp,
    ingredients_total: ingredients.length
  };
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
async function getUserPlan(userId) {
  const [rows] = await db.execute(
    'SELECT plan, status FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (!rows.length) return 'free';
  if (rows[0].status !== 'active' && rows[0].status !== 'trialing') return 'free';
  return rows[0].plan;
}

async function getSpinCount(userId) {
  const month = new Date().toISOString().slice(0, 7);
  const [rows] = await db.execute(
    'SELECT count FROM spin_counts WHERE user_id = ? AND month = ?',
    [userId, month]
  );
  return rows.length ? rows[0].count : 0;
}

async function incrementSpinCount(userId) {
  const month = new Date().toISOString().slice(0, 7);
  await db.execute(
    `INSERT INTO spin_counts (user_id, month, count) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE count = count + 1`,
    [userId, month]
  );
}

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'MealsWheel API running 🍽️' });
});

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email.toLowerCase(), hash]
    );
    const userId = result.insertId;

    // Create free subscription and default preferences
    await db.execute('INSERT INTO subscriptions (user_id, plan, status) VALUES (?, "free", "active")', [userId]);
    await db.execute('INSERT INTO user_preferences (user_id) VALUES (?)', [userId]);

    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, email, plan: 'free' } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const plan = await getUserPlan(user.id);
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, plan } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, email, created_at FROM users WHERE id = ?', [req.user.userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const plan = await getUserPlan(req.user.userId);
    const spinCount = await getSpinCount(req.user.userId);
    res.json({ user: { ...rows[0], plan, spinCount } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ─── PREFERENCES ─────────────────────────────────────────────────────────────
app.get('/preferences', authMiddleware, async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM user_preferences WHERE user_id = ?', [req.user.userId]);
  res.json(rows[0] || {});
});

app.put('/preferences', authMiddleware, async (req, res) => {
  const { daily_calorie_goal, servings, dietary_preferences } = req.body;
  await db.execute(
    `INSERT INTO user_preferences (user_id, daily_calorie_goal, servings, dietary_preferences)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE daily_calorie_goal = ?, servings = ?, dietary_preferences = ?`,
    [req.user.userId, daily_calorie_goal, servings, JSON.stringify(dietary_preferences),
     daily_calorie_goal, servings, JSON.stringify(dietary_preferences)]
  );
  res.json({ success: true });
});

// ─── PANTRY ──────────────────────────────────────────────────────────────────
app.get('/pantry', authMiddleware, async (req, res) => {
  const [rows] = await db.execute(
    'SELECT ingredient_name FROM user_pantry WHERE user_id = ? ORDER BY ingredient_name',
    [req.user.userId]
  );
  res.json(rows.map(r => r.ingredient_name));
});

app.post('/pantry', authMiddleware, async (req, res) => {
  const { ingredients } = req.body;
  if (!ingredients?.length) return res.status(400).json({ error: 'No ingredients provided' });

  // Replace all pantry items
  await db.execute('DELETE FROM user_pantry WHERE user_id = ?', [req.user.userId]);
  for (const ing of ingredients) {
    await db.execute(
      'INSERT IGNORE INTO user_pantry (user_id, ingredient_name) VALUES (?, ?)',
      [req.user.userId, ing]
    );
  }
  res.json({ success: true });
});

// ─── RECIPE GENERATION ───────────────────────────────────────────────────────
app.post('/generate', authMiddleware, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  // Check spin limit for free users
  const plan = await getUserPlan(req.user.userId);
  if (plan === 'free') {
    const spinCount = await getSpinCount(req.user.userId);
    if (spinCount >= 5) {
      return res.status(403).json({
        error: 'spin_limit_reached',
        message: 'You have used all 5 free spins this month. Upgrade to Home Chef for unlimited spins.',
        spinCount,
        limit: 5
      });
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });

    // Increment spin count
    await incrementSpinCount(req.user.userId);

    // Parse recipes, verify macros with USDA, save to history
    try {
      const raw = data.content.map(b => b.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const recipes = parsed.recipes || [];

      // Extract servings from prompt if available
      const servingsMatch = req.body.prompt?.match(/servings?:\s*(\d+)/i);
      const servings = servingsMatch ? parseInt(servingsMatch[1]) : 2;

      // Look up verified nutrition for each recipe in parallel
      const verifiedRecipes = await Promise.all(recipes.map(async (r) => {
        // Only look up non-buy ingredients (ones user already has or are key ingredients)
        const keyIngredients = (r.ingredients || []).filter(i => !i.buy || i.organic);
        const verified = await calculateVerifiedMacros(keyIngredients, servings);

        if (verified) {
          // Replace AI estimates with USDA verified data
          r.calories_per_serving = verified.calories_per_serving;
          r.protein_g = verified.protein_g;
          r.carbs_g = verified.carbs_g;
          r.fat_g = verified.fat_g;
          r.fiber_g = verified.fiber_g;
          r.sodium_mg = verified.sodium_mg;
          r.nutrition_source = 'USDA FoodData Central';
          r.ingredients_verified = verified.ingredients_verified;
          r.nutrition_breakdown = verified.ingredients_breakdown;
          console.log(`USDA verified macros for "${r.name}": ${r.calories_per_serving} kcal, ${r.protein_g}g protein`);
        } else {
          r.nutrition_source = 'AI estimate';
        }

        return r;
      }));

      // Save to recipe history with verified macros
      for (const r of verifiedRecipes) {
        await db.execute(
          `INSERT INTO recipe_history
           (user_id, recipe_name, emoji, cook_time, difficulty, style,
            calories_per_serving, protein_g, carbs_g, fat_g, ingredients, steps)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.user.userId, r.name, r.emoji, r.time, r.difficulty, r.style,
           r.calories_per_serving, r.protein_g, r.carbs_g, r.fat_g,
           JSON.stringify(r.ingredients), JSON.stringify(r.steps)]
        );
      }

      // Return modified response with verified macros
      const modifiedContent = [{ type: 'text', text: JSON.stringify({ recipes: verifiedRecipes }) }];
      return res.json({ ...data, content: modifiedContent });

    } catch (parseErr) {
      console.error('Could not verify/save recipe:', parseErr.message);
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Recipe generation failed' });
  }
});

// ─── RECIPE HISTORY ──────────────────────────────────────────────────────────
app.get('/history', authMiddleware, async (req, res) => {
  const plan = await getUserPlan(req.user.userId);
  const limit = plan === 'free' ? 5 : 1000;
  const [rows] = await db.execute(
    'SELECT * FROM recipe_history WHERE user_id = ? ORDER BY spun_at DESC LIMIT ?',
    [req.user.userId, limit]
  );
  res.json(rows.map(r => ({
    ...r,
    ingredients: JSON.parse(r.ingredients || '[]'),
    steps: JSON.parse(r.steps || '[]')
  })));
});

app.put('/history/:id/save', authMiddleware, async (req, res) => {
  await db.execute(
    'UPDATE recipe_history SET saved = TRUE WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.userId]
  );
  res.json({ success: true });
});

// ─── FAVORITES ───────────────────────────────────────────────────────────────
app.get('/favorites', authMiddleware, async (req, res) => {
  const [rows] = await db.execute(
    `SELECT rh.* FROM recipe_history rh
     JOIN favorite_recipes fr ON rh.id = fr.recipe_id
     WHERE fr.user_id = ? ORDER BY fr.saved_at DESC`,
    [req.user.userId]
  );
  res.json(rows.map(r => ({
    ...r,
    ingredients: JSON.parse(r.ingredients || '[]'),
    steps: JSON.parse(r.steps || '[]')
  })));
});

app.post('/favorites/:recipeId', authMiddleware, async (req, res) => {
  try {
    await db.execute(
      'INSERT INTO favorite_recipes (user_id, recipe_id) VALUES (?, ?)',
      [req.user.userId, req.params.recipeId]
    );
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Already favorited' });
  }
});

app.delete('/favorites/:recipeId', authMiddleware, async (req, res) => {
  await db.execute(
    'DELETE FROM favorite_recipes WHERE user_id = ? AND recipe_id = ?',
    [req.user.userId, req.params.recipeId]
  );
  res.json({ success: true });
});

// ─── MEAL PLANS ──────────────────────────────────────────────────────────────
app.get('/mealplans', authMiddleware, async (req, res) => {
  const [plans] = await db.execute(
    'SELECT * FROM meal_plans WHERE user_id = ? ORDER BY week_start_date DESC LIMIT 10',
    [req.user.userId]
  );
  for (const plan of plans) {
    const [items] = await db.execute(
      `SELECT mpi.day, rh.* FROM meal_plan_items mpi
       JOIN recipe_history rh ON mpi.recipe_id = rh.id
       WHERE mpi.meal_plan_id = ? ORDER BY FIELD(mpi.day,'monday','tuesday','wednesday','thursday','friday')`,
      [plan.id]
    );
    plan.items = items.map(r => ({
      ...r,
      ingredients: JSON.parse(r.ingredients || '[]'),
      steps: JSON.parse(r.steps || '[]')
    }));
  }
  res.json(plans);
});

app.post('/mealplans', authMiddleware, async (req, res) => {
  const { week_start_date, items } = req.body;
  const [result] = await db.execute(
    'INSERT INTO meal_plans (user_id, week_start_date) VALUES (?, ?)',
    [req.user.userId, week_start_date]
  );
  const planId = result.insertId;
  for (const item of items) {
    await db.execute(
      'INSERT INTO meal_plan_items (meal_plan_id, day, recipe_id) VALUES (?, ?, ?)',
      [planId, item.day, item.recipe_id]
    );
  }
  res.json({ success: true, planId });
});

// ─── FAMILY PROFILES ─────────────────────────────────────────────────────────
app.get('/profiles', authMiddleware, async (req, res) => {
  const plan = await getUserPlan(req.user.userId);
  if (plan !== 'family') return res.status(403).json({ error: 'Family plan required' });
  const [rows] = await db.execute(
    'SELECT * FROM family_profiles WHERE owner_user_id = ?',
    [req.user.userId]
  );
  res.json(rows);
});

app.post('/profiles', authMiddleware, async (req, res) => {
  const plan = await getUserPlan(req.user.userId);
  if (plan !== 'family') return res.status(403).json({ error: 'Family plan required' });
  const [existing] = await db.execute(
    'SELECT COUNT(*) as count FROM family_profiles WHERE owner_user_id = ?',
    [req.user.userId]
  );
  if (existing[0].count >= 4) return res.status(400).json({ error: 'Maximum 4 profiles on Family plan' });
  const { name, calorie_goal, servings } = req.body;
  const [result] = await db.execute(
    'INSERT INTO family_profiles (owner_user_id, name, calorie_goal, servings) VALUES (?, ?, ?, ?)',
    [req.user.userId, name, calorie_goal || 2000, servings || 2]
  );
  res.json({ success: true, id: result.insertId });
});

// ─── STRIPE PAYMENTS ─────────────────────────────────────────────────────────
app.post('/subscribe', authMiddleware, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payments not configured yet' });
  const { plan } = req.body;
  const prices = {
    home_chef: process.env.STRIPE_HOME_CHEF_PRICE_ID || null,
    family: process.env.STRIPE_FAMILY_PRICE_ID || null
  };
  if (!prices[plan]) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const [users] = await db.execute('SELECT email FROM users WHERE id = ?', [req.user.userId]);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: users[0].email,
      line_items: [{ price: prices[plan], quantity: 1 }],
      metadata: { userId: req.user.userId, plan },
      success_url: 'https://reviveiq.github.io/mealswheel?subscribed=true',
      cancel_url: 'https://reviveiq.github.io/mealswheel?cancelled=true'
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: 'Webhook signature failed' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId || null;
    const plan = session.metadata?.plan || 'free';
    const customer = session.customer || null;
    const subscription = session.subscription || null;
    if (userId) {
      await db.execute(
        `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
         VALUES (?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE plan = ?, status = 'active', stripe_subscription_id = ?`,
        [userId, customer, subscription, plan, plan, subscription]
      );
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await db.execute(
      'UPDATE subscriptions SET status = "cancelled" WHERE stripe_subscription_id = ?',
      [sub.id]
    );
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    await db.execute(
      'UPDATE subscriptions SET status = "past_due" WHERE stripe_subscription_id = ?',
      [invoice.subscription]
    );
  }

  res.json({ received: true });
});

// ─── START ───────────────────────────────────────────────────────────────────
connectDB()
  .then(createTables)
  .then(() => {
    app.listen(PORT, () => console.log(`MealsWheel API running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
