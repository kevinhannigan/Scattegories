const OpenAI = require("openai");

let client = null;

function init() {
  if (process.env.OPENAI_API_KEY) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log("OpenAI client initialized — AI features enabled");
  } else {
    console.log("OPENAI_API_KEY not set — AI features disabled, using static fallbacks");
  }
}

function isAvailable() {
  return !!client;
}

const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function generateCategories(playerNames, spicyMode, theme, count = 12) {
  if (!client) return null;

  const modeLabel = spicyMode
    ? "Spicy (PG-13 humor — cheeky, suggestive, and mildly inappropriate is great, but nothing explicit or R-rated)"
    : "Family-friendly (keep it clean and appropriate for all ages)";

  const themeClause = theme
    ? `Game theme: "${theme}". Make 6-8 categories relate to this theme while keeping the rest general.`
    : "No specific theme — use a fun variety of categories.";

  const playerExamples = playerNames.length > 0
    ? [
        `"Words to describe ${playerNames[0]}'s personality"`,
        `"Things ${playerNames[playerNames.length > 1 ? 1 : 0]} would never say"`,
        `"Reasons ${playerNames[0]} would get fired"`,
        `"Things you'd find in ${playerNames[playerNames.length > 1 ? 1 : 0]}'s search history"`,
      ].join(", ")
    : "";

  const playerClause =
    playerNames.length > 0
      ? `Players: ${playerNames.join(", ")}. Create 3-4 categories that reference specific players by name. These make the game personal and funny. Examples: ${playerExamples}.`
      : "";

  const prompt = `Generate exactly ${count} unique Scattergories categories.

${themeClause}
Mode: ${modeLabel}
${playerClause}

Rules:
- Each category must be broad enough that a player can think of a valid answer starting with any common letter.
- Categories should be distinct with minimal overlap.
- ${spicyMode ? "Include 3-4 cheeky or mildly inappropriate PG-13 categories (suggestive humor is fine, explicit content is not)." : "Keep all categories family-friendly."}
- Player-name categories should be fun and lighthearted, never mean-spirited.
- Return ONLY a JSON object: { "categories": [ { "id": 1, "name": "Category Name" }, ... ] }`;

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a creative Scattergories game host. You generate fun, well-balanced categories. Respond ONLY with valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
    max_tokens: 500,
  });

  const result = JSON.parse(response.choices[0].message.content);
  return result.categories;
}

async function judgeAnswers(letter, categories, answersByPlayer, players) {
  if (!client) return null;

  const categoryMap = {};
  for (const cat of categories) {
    categoryMap[String(cat.id)] = cat.name;
  }

  // Group answers by category for better duplicate detection
  const grouped = {};
  for (const [playerId, playerAnswers] of Object.entries(answersByPlayer)) {
    const player = players[playerId];
    if (!player) continue;

    for (const [catId, answerText] of Object.entries(playerAnswers)) {
      const catName = categoryMap[String(catId)];
      if (!catName) continue;

      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push({
        id: `${playerId}_${catId}`,
        player: player.username,
        answer: answerText || "",
      });
    }
  }

  let answersBlock = "";
  for (const [catName, answers] of Object.entries(grouped)) {
    answersBlock += `\nCategory: "${catName}"\n`;
    for (const a of answers) {
      answersBlock += `  - id: "${a.id}", player: "${a.player}", answer: "${a.answer}"\n`;
    }
  }

  const prompt = `The letter for this round is "${letter}".

Judge every answer below. For each answer determine:
1. Does it reasonably fit the category?
2. Does it start with the letter "${letter}"? (Ignore leading articles like "The", "A", "An" — check the first meaningful word.)
3. Is it a duplicate of another player's answer in the SAME category? (Typos, abbreviations, plurals, and near-identical answers count as duplicates. When duplicates exist, REJECT ALL copies — no one gets the point.)
4. Blank or empty answers are always rejected.

Be generous with category fit but strict on the starting letter.
${answersBlock}

Return ONLY a JSON object: { "judgments": [ { "id": "<answerId>", "approved": true/false, "reason": "<1-sentence explanation>" }, ... ] }
Include every answer ID exactly once.`;

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a fair Scattergories judge. Evaluate each answer strictly but fairly. Respond ONLY with valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 2000,
  });

  const result = JSON.parse(response.choices[0].message.content);
  return result.judgments;
}

module.exports = { init, isAvailable, generateCategories, judgeAnswers };
