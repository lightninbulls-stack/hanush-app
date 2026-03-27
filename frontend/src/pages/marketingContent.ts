export type FactorItem = {
  slug: string;
  name: string;
  shortDescription: string;
  heroSubtitle: string;
  body: string[];
};

export const factors: FactorItem[] = [
  {
    slug: "momentum",
    name: "Momentum",
    shortDescription:
      "Identify stocks demonstrating sustained price leadership and relative market strength.",
    heroSubtitle:
      "Track companies showing durable price strength, improving participation, and market-confirmed leadership.",
    body: [
      "Momentum focuses on stocks that are already outperforming their peers. In real markets, leadership often persists longer than most investors expect as conviction, participation, and trend strength continue to build.",
      "This factor is useful because it shifts attention away from prediction and toward evidence. Instead of guessing which name may move next, momentum helps you focus on the stocks the market is already rewarding.",
      "At Lightnin Bull, Momentum is positioned as a disciplined signal framework for investors who want clearer market leadership, stronger watchlists, and a more structured decision process.",
    ],
  },
  {
    slug: "quality",
    name: "Quality",
    shortDescription:
      "Focus on financially stronger businesses with resilient fundamentals and disciplined operations.",
    heroSubtitle:
      "Evaluate businesses through the lens of profitability, balance-sheet strength, and operating resilience.",
    body: [
      "Quality investing looks beneath price movement and asks whether the business itself is built on strong fundamentals. Companies with better profitability, cleaner balance sheets, and operational discipline often display greater resilience across market cycles.",
      "This factor matters because durable businesses can create stronger long-term foundations for investment decisions. It helps separate temporary excitement from underlying business strength.",
      "At Lightnin Bull, Quality is designed for investors who want more confidence in the company behind the stock, not just the chart in front of them.",
    ],
  },
  {
    slug: "value",
    name: "Value",
    shortDescription:
      "Discover stocks trading at attractive valuations relative to underlying business quality.",
    heroSubtitle:
      "Focus on the relationship between price and underlying worth rather than market excitement alone.",
    body: [
      "Value investing begins with a simple idea: price and worth are not always the same. Markets can overreact, overlook businesses, or temporarily misprice opportunity.",
      "The role of the Value factor is not to find what is merely cheap, but to identify where valuation looks more attractive relative to the business behind the stock.",
      "At Lightnin Bull, Value helps bring discipline into stock selection by keeping valuation in view, especially when sentiment becomes excessive in either direction.",
    ],
  },
  {
    slug: "low-volatility",
    name: "Low Volatility",
    shortDescription:
      "Highlight steadier stocks that may offer a more balanced path through market cycles.",
    heroSubtitle:
      "Prioritize price stability, smoother participation, and stronger downside discipline within equities.",
    body: [
      "Low Volatility focuses on stocks that have historically shown more stable price behavior than the broader market. While these names may not always be the fastest movers, they can help support a steadier investment experience.",
      "This matters because avoiding deep drawdowns can be just as important as capturing upside. Stability often improves investor discipline, long-term consistency, and portfolio resilience.",
      "At Lightnin Bull, Low Volatility is built for users who want a calmer, more risk-aware way to evaluate equity exposure without stepping away from the market entirely.",
    ],
  },
  {
    slug: "regime-upside",
    name: "Regime Upside",
    shortDescription:
      "Spot stocks operating in a technically stronger bullish environment with broader trend support.",
    heroSubtitle:
      "Identify stocks where multiple technical conditions align to support a stronger bullish backdrop.",
    body: [
      "Regime Upside is built around the idea that markets move through phases. A stock may flash one bullish signal, but stronger opportunities usually emerge when the broader technical environment also supports the move.",
      "This factor looks beyond isolated indicators and focuses on overall alignment. That makes it useful in separating random strength from more structured bullish conditions.",
      "At Lightnin Bull, Regime Upside gives investors a clearer framework for understanding whether the market environment itself appears supportive of continued strength.",
    ],
  },
];

export const faqs = [
  {
    question: "What is Lightnin Bull?",
    answer:
      "Lightnin Bull is a factor-based stock intelligence platform designed to help users discover and evaluate stocks through structured market frameworks.",
  },
  {
    question: "Who is the platform built for?",
    answer:
      "It is built for investors who prefer disciplined stock discovery over random tips, noise, and unstructured market chatter.",
  },
  {
    question: "Is Lightnin Bull only for short-term trading?",
    answer:
      "No. The platform is intended to support a more structured stock selection process across different investing styles.",
  },
  {
    question: "Why use factors?",
    answer:
      "Factors provide a clearer and more repeatable process for understanding why a stock stands out, whether through strength, valuation, stability, business quality, or technical alignment.",
  },
];
