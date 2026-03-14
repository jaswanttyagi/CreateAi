const axios = require("axios");
require("./config/env");

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3-flash-preview";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);
const PLACEHOLDER_RESPONSES = new Set([
  "here is the json",
  "here is the",
  "json",
  "here is your json",
  "here is the response"
]);
const getGeminiApiKey = () =>
  String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildUrl = (model) => `${API_BASE_URL}/${model}:generateContent`;

const formatMemoryContext = (memories = []) => {
  const safeMemories = Array.isArray(memories) ? memories.filter(Boolean).slice(-12) : [];

  if (!safeMemories.length) {
    return "";
  }

  return safeMemories
    .map((memory, index) => `${index + 1}. ${memory.label || memory.key}: ${memory.value}`)
    .join("\n");
};

const formatConversationContext = (conversationHistory = []) => {
  const safeHistory = Array.isArray(conversationHistory)
    ? conversationHistory.filter(Boolean).slice(-10)
    : [];

  if (!safeHistory.length) {
    return "";
  }

  return safeHistory
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${entry.text}`)
    .join("\n");
};

const buildContextBlock = (context = {}) => {
  const sections = [];
  const memoriesSection = formatMemoryContext(context.memories);
  const conversationSection = formatConversationContext(context.conversationHistory);
  const replyMode = typeof context.replyMode === "string" ? context.replyMode.trim() : "";

  if (replyMode) {
    sections.push(`Preferred reply mode: ${replyMode}`);
  }

  if (memoriesSection) {
    sections.push(`Saved user memories:\n${memoriesSection}`);
  }

  if (conversationSection) {
    sections.push(`Recent conversation history:\n${conversationSection}`);
  }

  if (!sections.length) {
    return "";
  }

  return `Relevant context:\n${sections.join("\n\n")}\n\n`;
};

const buildAssistantPrompt = (userPrompt, assistantName, userName, context = {}) => `
You are a virtual assistant named ${assistantName} created by ${userName}.
You are not Google. You behave like a voice-enabled assistant.

Respond with exactly one JSON object using this schema:
{
  "type": "general" | "google_search" | "youtube_search" | "youtube_play" | "get_time" | "get_date" | "get_day" | "get_month" | "calculator_open" | "instagram_open" | "facebook_open" | "weather_show" | "gmail_open" | "github_open" | "linkedin_open" | "maps_search" | "go_back" | "go_forward" | "refresh_page",
  "userInput": "<original user input>",
  "response": "<short voice-friendly response>"
}

Rules:
- Use "general" for factual or informational questions.
- Use "${assistantName}" if the user asks who you are.
- Use "${userName}" if the user asks who created you.
- Use the saved memories and recent conversation when they are relevant.
- If the current user message conflicts with saved context, trust the current user message.
- The "response" field must contain the actual answer, not placeholders like "Here is the JSON" or "Here is the response".
- Do not repeat the user's question unless needed for clarity.
- Only return valid JSON with no markdown, no code fences, and no extra text.

${buildContextBlock(context)}User input: ${userPrompt}
`.trim();

const buildGeneralAnswerPrompt = (userPrompt, assistantName, userName, context = {}) => `
You are ${assistantName}, a voice assistant created by ${userName}.
Answer the user's question directly in plain English.

Rules:
- Give the actual answer in 1 to 3 short sentences.
- Use the saved memories and recent conversation when they are relevant.
- If the current user message conflicts with saved context, trust the current user message.
- No JSON.
- No markdown.
- No prefaces like "Here is the answer".
- Do not say "Here is the JSON" or similar placeholders.

${buildContextBlock(context)}User question: ${userPrompt}
`.trim();

const extractTextFromResponse = (data) => {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const normalizeModelText = (text) =>
  String(text || "")
    .replace(/```json|```/gi, "")
    .trim();

const isPlaceholderText = (text) => {
  const normalized = normalizeModelText(text).toLowerCase();

  if (!normalized) {
    return true;
  }

  if (PLACEHOLDER_RESPONSES.has(normalized)) {
    return true;
  }

  return normalized.startsWith("here is the json");
};

const isWeakStructuredResponse = (text) => {
  const normalized = normalizeModelText(text);

  if (isPlaceholderText(normalized)) {
    return true;
  }

  const responseFieldMatch = normalized.match(/"response"\s*:\s*"([^"]*)"/i);
  return isPlaceholderText(responseFieldMatch?.[1] || "");
};

const generateWithModel = async (model, prompt, { jsonMode = true } = {}) => {
  const response = await axios.post(
    buildUrl(model),
    {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 160,
        responseMimeType: jsonMode ? "application/json" : "text/plain"
      }
    },
    {
      headers: {
        "x-goog-api-key": getGeminiApiKey(),
        "Content-Type": "application/json"
      },
      timeout: 30000
    }
  );

  return extractTextFromResponse(response.data);
};

const buildModelOrder = () => {
  const models = [...new Set([PRIMARY_MODEL, FALLBACK_MODEL].filter(Boolean))];

  return models.sort((left, right) => {
    const leftPreviewPenalty = /preview/i.test(left) ? 1 : 0;
    const rightPreviewPenalty = /preview/i.test(right) ? 1 : 0;
    return leftPreviewPenalty - rightPreviewPenalty;
  });
};

const geminiResponse = async (
  userPrompt,
  assistantName = "Assistant",
  userName = "Unknown",
  context = {}
) => {
  if (!userPrompt || !String(userPrompt).trim()) {
    throw new Error("Prompt is required");
  }

  if (!getGeminiApiKey()) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const finalPrompt = buildAssistantPrompt(String(userPrompt).trim(), assistantName, userName, context);
  const modelsToTry = buildModelOrder();
  let lastError;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const text = await generateWithModel(model, finalPrompt, { jsonMode: true });

        if (isWeakStructuredResponse(text)) {
          lastError = new Error(`Gemini returned unusable structured output for model=${model}`);
          continue;
        }

        return normalizeModelText(text);
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;
        const shouldRetry = RETRYABLE_STATUS_CODES.has(statusCode) && attempt < 3;

        console.error(
          `Gemini request failed for model=${model} attempt=${attempt}:`,
          error.response?.data || error.message
        );

        if (shouldRetry) {
          await delay(attempt * 1000);
          continue;
        }

        if (!RETRYABLE_STATUS_CODES.has(statusCode)) {
          throw error;
        }

        break;
      }
    }
  }

  throw lastError;
};

const geminiTextResponse = async (
  userPrompt,
  assistantName = "Assistant",
  userName = "Unknown",
  context = {}
) => {
  const finalPrompt = buildGeneralAnswerPrompt(String(userPrompt).trim(), assistantName, userName, context);
  const modelsToTry = buildModelOrder();
  let lastError;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const text = await generateWithModel(model, finalPrompt, { jsonMode: false });
        const normalizedText = normalizeModelText(text);

        if (isPlaceholderText(normalizedText)) {
          lastError = new Error(`Gemini returned unusable plain-text output for model=${model}`);
          continue;
        }

        return normalizedText;
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;
        const shouldRetry = RETRYABLE_STATUS_CODES.has(statusCode) && attempt < 2;

        console.error(
          `Gemini plain-text request failed for model=${model} attempt=${attempt}:`,
          error.response?.data || error.message
        );

        if (shouldRetry) {
          await delay(attempt * 1000);
          continue;
        }

        if (!RETRYABLE_STATUS_CODES.has(statusCode)) {
          throw error;
        }

        break;
      }
    }
  }

  throw lastError;
};

exports.default = geminiResponse;
exports.geminiTextResponse = geminiTextResponse;
