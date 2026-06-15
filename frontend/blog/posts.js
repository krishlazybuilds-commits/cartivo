export const posts = [
  {
    slug: "welcome-to-cartivo",
    title: "Welcome to Cartivo — Your New Favorite Shop",
    date: "2026-06-01",
    author: "The Cartivo Team",
    excerpt:
      "We're thrilled to announce the launch of Cartivo, a modern e-commerce platform built with care and attention to detail. Discover a shopping experience that puts you first.",
    tags: ["announcement"],
    content: `## Hello and welcome!

After months of hard work, we're proud to open the doors to **Cartivo** — a fresh, modern shopping experience designed with you in mind.

### What makes Cartivo different?

We believe shopping should be **simple**, **fast**, and even **enjoyable**. Here's what sets us apart:

- **Curated collections** — Every product is hand-picked for quality and style.
- **Fair pricing** — No hidden markups, no surprise fees at checkout.
- **Lightning-fast checkout** — Save your details and check out in seconds.
- **Real support** — Reach a human, not a chatbot, when you need help.

### Built for today's web

Cartivo is built with modern technology to deliver a blazing-fast experience:

- **Server-side rendering** for instant page loads
- **JWT-based authentication** with secure httpOnly cookies
- **Optimised images** served via next-gen formats
- **Responsive design** that works beautifully on every screen

### What's next?

We're just getting started. Over the coming weeks we'll be adding:

- Detailed product categories and advanced filtering
- A loyalty rewards programme
- International shipping options
- A mobile app

### Start exploring

Head over to the [shop](/products) to see what's available. If you have questions or feedback, [get in touch](/contact) — we'd love to hear from you.

Happy shopping! 🛍️`,
  },
  {
    slug: "style-guide-creating-the-perfect-capsule-wardrobe",
    title: "Style Guide: Creating the Perfect Capsule Wardrobe",
    date: "2026-06-08",
    author: "The Cartivo Team",
    excerpt:
      "A capsule wardrobe is the secret to effortless style. Learn how to build a versatile collection of timeless pieces that work together seamlessly.",
    tags: ["style", "guides"],
    content: `## Less clutter, more style

A capsule wardrobe is a curated collection of versatile, timeless pieces that you love to wear. The idea is simple: own fewer items, but make every one count.

### Step 1: Start with the essentials

Every capsule needs a foundation. These are the pieces that form the backbone of your wardrobe:

- A well-fitted white shirt
- Dark jeans that fit perfectly
- A classic blazer or jacket
- Neutral knitwear (crew or V-neck)
- Quality leather shoes or trainers

> "Have nothing in your houses that you do not know to be useful, or believe to be beautiful." — William Morris

### Step 2: Choose a colour palette

Stick to a cohesive palette of 3–4 neutral tones (navy, black, grey, cream) and add 1–2 accent colours (mustard, olive, burgundy). This ensures everything in your wardrobe coordinates.

### Step 3: Prioritise quality over quantity

Invest in pieces that are:

1. **Well-made** — Check stitching, fabric weight, and finishing.
2. **Versatile** — Can you wear it at least three different ways?
3. **Timeless** — Will it still look good in five years?
4. **Comfortable** — If it doesn't feel good, you won't wear it.

### The 30-wear rule

Before buying any new item, ask yourself: *Will I wear this at least 30 times?* If the answer is no, leave it on the rack.

### Building your capsule

A 30-piece capsule might include:

| Category | Pieces |
|---|---|
| Tops | 8 |
| Bottoms | 5 |
| Dresses / jumpsuits | 3 |
| Outerwear | 3 |
| Shoes | 5 |
| Accessories | 6 |

### Care tips

Make your clothes last longer with proper care:

- Wash on cold and air-dry when possible
- Store knitwear folded, not hung
- Use a fabric shaver to remove pilling
- Rotate your shoes to let them rest

Building a capsule wardrobe takes time, but the result is a closet that brings you joy every single day.`,
  },
  {
    slug: "sustainable-shopping-how-to-make-eco-friendly-choices",
    title: "Sustainable Shopping: How to Make Eco-Friendly Choices",
    date: "2026-06-12",
    author: "The Cartivo Team",
    excerpt:
      "Small changes in how we shop can make a big difference for the planet. Here are practical tips for more sustainable consumption.",
    tags: ["sustainability", "guides"],
    content: `## Shop with purpose

Every purchase is a vote for the kind of world we want to live in. By making conscious choices, we can reduce waste, support ethical practices, and protect our planet.

### Buy less, choose well

The most sustainable item is the one you already own. Before buying something new:

1. Do I really need this?
2. Will I use it regularly?
3. Do I already own something similar?
4. Can I borrow, rent, or buy second-hand instead?

### Look for sustainable materials

When you do buy new, check the materials:

| Material | Why it's better |
|---|---|
| Organic cotton | Uses less water, no pesticides |
| Linen | Biodegradable, requires minimal water |
| Hemp | Fast-growing, enriches soil |
| Tencel / Lyocell | Closed-loop production, wood pulp sourced from sustainable forests |
| Recycled polyester | Keeps plastic out of landfills |

### Support transparent brands

Look for brands that share:

- Where and how their products are made
- Their supply chain and labour practices
- Their environmental impact and goals
- Certifications like B Corp, Fair Trade, or GOTS

### Care for what you own

Extending the life of your belongings by just nine months reduces their carbon, water, and waste footprint by **20–30%**.

Simple care tips:

- Repair before replacing — learn basic stitching
- Follow care labels properly
- Use eco-friendly detergents
- Sell or donate items you no longer use

### The bigger picture

Sustainable shopping isn't about being perfect. It's about making *better* choices, one purchase at a time. Start small, stay consistent, and don't let perfection be the enemy of progress.

Together, our choices add up. 🌍`,
  },
];

export function getAllSlugs() {
  return posts.map((p) => p.slug);
}

export function getPostBySlug(slug) {
  return posts.find((p) => p.slug === slug) || null;
}
