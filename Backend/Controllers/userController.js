const { uploadToCloudinary } = require("../config/cloudinary.js");
const User  = require("../models/usermodel.js");
const geminiResponse = require("../gemini.js").default;
const { geminiTextResponse } = require("../gemini.js");
const moment = require("moment");

const MAX_CONVERSATION_HISTORY = 12;
const MAX_LEGACY_HISTORY = 20;
const MAX_MEMORIES = 25;
const MAX_SESSION_CONTEXT_MESSAGES = 10;
const DEFAULT_REPLY_MODE = "funny";
const VALID_REPLY_MODES = new Set(["fact", "funny", "savage"]);
const MEMORY_STOPWORDS = new Set([
    "a", "an", "and", "are", "about", "as", "at", "be", "can", "do", "for",
    "from", "have", "he", "her", "him", "i", "if", "in", "is", "it", "ki",
    "ko", "ka", "ke", "lo", "me", "my", "note", "of", "on", "or", "please", "remember",
    "she", "so", "tell", "that", "the", "their", "them", "they", "this",
    "to", "what", "who", "you", "your", "hai", "ho", "hu", "ise", "isko"
]);
const ROAST_TRIGGER_KEYWORDS = [
    "lapet lo",
    "roast",
    "roast karo",
    "baja do",
    "mzaak uda do",
    "mazak uda do",
    "troll",
    "maro"
];

const parseAssistantJson = (result) => {
    const jsonMatch = String(result).match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
        return null;
    }

    try {
        return JSON.parse(jsonMatch[0]);
    } catch {
        return null;
    }
};

const sanitizeAssistantText = (result) => {
    const normalizedText = String(result || "")
        .replace(/```json|```/gi, "")
        .trim();

    return normalizedText;
};

const cleanRecognizedText = (value = "") =>
    String(value)
        .trim()
        .replace(/\b(and|or|but)\s*$/i, "")
        .replace(/[.?!]+$/, "")
        .trim();

const sanitizeSessionMessages = (sessionMessages = []) =>
    (Array.isArray(sessionMessages) ? sessionMessages : [])
        .filter((message) =>
            message &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.text === "string" &&
            message.text.trim()
        )
        .map((message) => ({
            role: message.role,
            text: String(message.text).trim(),
        }))
        .slice(-MAX_SESSION_CONTEXT_MESSAGES);

const buildPromptContext = (user, sessionMessages = []) => ({
    memories: Array.isArray(user?.memories) ? user.memories.slice(-MAX_MEMORIES) : [],
    conversationHistory: sanitizeSessionMessages(sessionMessages),
    replyMode: VALID_REPLY_MODES.has(user?.replyMode) ? user.replyMode : DEFAULT_REPLY_MODE
});

const getReplyMode = (user) =>
    VALID_REPLY_MODES.has(user?.replyMode) ? user.replyMode : DEFAULT_REPLY_MODE;

const normalizeMemoryDescriptor = (value = "") =>
    String(value)
        .toLowerCase()
        .replace(/\bfavourite\b/g, "favorite")
        .replace(/\bcolour\b/g, "color")
        .replace(/\bcolours\b/g, "colors")
        .replace(/\borganise\b/g, "organize")
        .replace(/\borganisation\b/g, "organization")
        .replace(/\bcentre\b/g, "center")
        .replace(/\s+/g, " ")
        .trim();

const toMemoryKey = (value = "") =>
    normalizeMemoryDescriptor(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);

const simplifyTokenForMatch = (value = "") =>
    normalizeMemoryDescriptor(value)
        .replace(/[aeiouh]/g, "")
        .replace(/(.)\1+/g, "$1");

const getEditDistance = (source = "", target = "") => {
    const rows = source.length + 1;
    const cols = target.length + 1;
    const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let row = 0; row < rows; row += 1) {
        dp[row][0] = row;
    }

    for (let col = 0; col < cols; col += 1) {
        dp[0][col] = col;
    }

    for (let row = 1; row < rows; row += 1) {
        for (let col = 1; col < cols; col += 1) {
            const cost = source[row - 1] === target[col - 1] ? 0 : 1;
            dp[row][col] = Math.min(
                dp[row - 1][col] + 1,
                dp[row][col - 1] + 1,
                dp[row - 1][col - 1] + cost
            );
        }
    }

    return dp[source.length][target.length];
};

const extractKeywords = (value = "") => {
    const normalizedText = normalizeMemoryDescriptor(value).replace(/[^a-z0-9\s]/g, " ");
    const tokens = normalizedText
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 1 && !MEMORY_STOPWORDS.has(token));

    return [...new Set(tokens)];
};

const getMemoryKeywords = (memory = {}) => {
    const storedKeywords = Array.isArray(memory.keywords)
        ? memory.keywords.filter(Boolean).map((keyword) => normalizeMemoryDescriptor(keyword))
        : [];

    if (storedKeywords.length) {
        return [...new Set(storedKeywords)];
    }

    return extractKeywords(`${memory.label || ""} ${memory.value || ""}`);
};

const tokensRoughlyMatch = (left = "", right = "") => {
    if (!left || !right) {
        return false;
    }

    if (left === right) {
        return true;
    }

    const simplifiedLeft = simplifyTokenForMatch(left);
    const simplifiedRight = simplifyTokenForMatch(right);

    if (simplifiedLeft && simplifiedLeft === simplifiedRight) {
        return true;
    }

    const distance = getEditDistance(left, right);
    return distance <= 1 || (left.length > 5 && right.length > 5 && distance <= 2);
};

const scoreMemoryMatch = (promptKeywords = [], memory = {}) => {
    const memoryKeywords = getMemoryKeywords(memory);

    if (!promptKeywords.length || !memoryKeywords.length) {
        return 0;
    }

    let score = 0;

    for (const promptKeyword of promptKeywords) {
        for (const memoryKeyword of memoryKeywords) {
            if (promptKeyword === memoryKeyword) {
                score += 3;
                continue;
            }

            if (tokensRoughlyMatch(promptKeyword, memoryKeyword)) {
                score += 2;
            }
        }
    }

    return score;
};

const formatMemoryResponse = (memory = {}) => {
    if (!memory?.value) {
        return "I do not have anything stored for that yet.";
    }

    if (memory.kind === "entity_fact") {
        return `${memory.label} is ${memory.value}.`;
    }

    if (memory.kind === "user_property") {
        return `Your ${memory.label} is ${memory.value}.`;
    }

    if (memory.label === "note") {
        return `I remember: ${memory.value}.`;
    }

    if (memory.label === "likes") {
        return `You like ${memory.value}.`;
    }

    if (memory.label === "identity") {
        return `You are ${memory.value}.`;
    }

    return `Your ${memory.label} is ${memory.value}.`;
};

const parseReplyModeCommand = (prompt = "") => {
    const normalizedPrompt = normalizeMemoryDescriptor(prompt);
    const setModeMatch =
        normalizedPrompt.match(/^set(?: my)? reply mode to (fact|funny|savage)$/i) ||
        normalizedPrompt.match(/^reply mode (fact|funny|savage)$/i) ||
        normalizedPrompt.match(/^switch to (fact|funny|savage) mode$/i) ||
        normalizedPrompt.match(/^change reply mode to (fact|funny|savage)$/i);

    if (setModeMatch) {
        return { action: "set", mode: setModeMatch[1].toLowerCase() };
    }

    if (
        normalizedPrompt === "what is my reply mode" ||
        normalizedPrompt === "whats my reply mode" ||
        normalizedPrompt === "tell me my reply mode" ||
        normalizedPrompt === "current reply mode"
    ) {
        return { action: "get" };
    }

    return null;
};

const buildReplyModeConfirmation = (mode = DEFAULT_REPLY_MODE) => {
    switch (mode) {
        case "fact":
            return "Reply mode set to fact. I will answer in a direct style.";
        case "savage":
            return "Reply mode set to savage. I will keep it sharper.";
        default:
            return "Reply mode set to funny. I will keep it playful.";
    }
};

const buildPromptAwareMemoryResponse = (memory = {}, prompt = "", replyMode = DEFAULT_REPLY_MODE) => {
    const normalizedPrompt = normalizeMemoryDescriptor(prompt);

    if (isRoastStylePrompt(prompt)) {
        return buildRoastMemoryResponse(memory, prompt, replyMode);
    }

    if (
        normalizedPrompt.startsWith("who ") ||
        normalizedPrompt.startsWith("what ") ||
        normalizedPrompt.startsWith("tell me ") ||
        normalizedPrompt.startsWith("do you remember ")
    ) {
        if (replyMode === "savage" && memory.kind === "entity_fact") {
            return `${memory.label}? Simple answer: ${memory.value}, and the confidence level is somehow still high.`;
        }

        if (replyMode === "funny" && memory.kind === "entity_fact") {
            return `${memory.label}? Bas itna yaad rakho: ${memory.value}.`;
        }

        return formatMemoryResponse(memory);
    }

    if (
        normalizedPrompt.includes("about") ||
        normalizedPrompt.includes("scene") ||
        normalizedPrompt.includes("kaisa") ||
        normalizedPrompt.includes("kaisi")
    ) {
        if (memory.kind === "entity_fact") {
            if (replyMode === "savage") {
                return `${memory.label} ka scene seedha hai: ${memory.value}, aur koi PR team isko bachane nahi aa rahi.`;
            }

            if (replyMode === "funny") {
                return `${memory.label} ka scene simple hai: ${memory.value}.`;
            }

            return `${memory.label} ka scene simple hai: ${memory.value}.`;
        }

        return `Mujhe yaad hai ${formatMemoryResponse(memory).toLowerCase()}`;
    }

    if (memory.kind === "entity_fact") {
        if (replyMode === "savage") {
            return `${memory.label} ke baare mein stored update yeh hai: ${memory.value}, aur kaafi loud version mein yaad hai.`;
        }

        if (replyMode === "funny") {
            return `${memory.label} ke baare mein jo yaad hai woh yeh hai: ${memory.value}.`;
        }

        return `${memory.label} ke baare mein jo yaad hai woh yeh hai: ${memory.value}.`;
    }

    return formatMemoryResponse(memory);
};

const isRoastStylePrompt = (prompt = "") => {
    const normalizedPrompt = normalizeMemoryDescriptor(prompt);
    return ROAST_TRIGGER_KEYWORDS.some((keyword) => normalizedPrompt.includes(keyword));
};

const buildRoastMemoryResponse = (memory = {}, prompt = "", replyMode = DEFAULT_REPLY_MODE) => {
    const subject = String(memory.label || "That person").trim();
    const trait = String(memory.value || "full comedy mode").trim();
    const templatesByMode = {
        fact: [
            `${subject} ke baare mein stored fact hai: ${trait}.`,
            `${subject} ka saved update hai: ${trait}.`,
        ],
        funny: [
            `${subject}? Full ${trait} mode chal raha hai.`,
            `${subject} aaj pure ${trait} energy mein hai.`,
            `${subject} ka scene simple hai: ${trait}.`,
            `${subject} ko dekho, bilkul ${trait} vibes aa rahi hain.`,
            `${subject} ka current update: ${trait}.`,
        ],
        savage: [
            `${subject}? ${trait}, aur us par bhi attitude premium.`,
            `${subject} ka latest patch note: ${trait}, bugs abhi bhi active hain.`,
            `${subject} itna ${trait} hai ki explanation bhi resign kar de.`,
            `${subject} ka vibe check fail hai: ${trait}.`,
            `${subject} ke naam ka summary bas itna hai: ${trait}, zero filter.`,
        ]
    };
    const templates = templatesByMode[replyMode] || templatesByMode[DEFAULT_REPLY_MODE];

    const seed = `${subject}:${trait}:${prompt}`
        .split("")
        .reduce((total, character) => total + character.charCodeAt(0), 0);

    return templates[seed % templates.length];
};

const summarizeMemory = (memory = {}) => {
    const label = String(memory.label || memory.key || "note").trim();
    const value = String(memory.value || "").trim();

    if (!value) {
        return "";
    }

    if (label === "likes") {
        return `you like ${value}`;
    }

    if (label === "identity") {
        return `you are ${value}`;
    }

    if (label === "note") {
        return value;
    }

    return `your ${label} is ${value}`;
};

const buildMemoryRecallReply = (prompt, memories = []) => {
    const normalizedPrompt = String(prompt || "").toLowerCase().trim();
    const isMemoryRecallPrompt =
        normalizedPrompt.includes("what do you remember about me") ||
        normalizedPrompt.includes("what do you know about me") ||
        normalizedPrompt.includes("what have you learned about me") ||
        normalizedPrompt.includes("what do you remember") ||
        normalizedPrompt.includes("what do you know about me so far");

    if (!isMemoryRecallPrompt) {
        return null;
    }

    if (!memories.length) {
        return {
            type: "general",
            userInput: prompt,
            response: "I do not have any saved memories about you yet. You can say remember that followed by a fact you want me to keep."
        };
    }

    const memorySummary = memories
        .slice(-5)
        .map(summarizeMemory)
        .filter(Boolean)
        .join("; ");

    return {
        type: "general",
        userInput: prompt,
        response: `I remember that ${memorySummary}.`
    };
};

const findMatchingMemory = (memories = [], descriptor = "") => {
    const normalizedDescriptor = normalizeMemoryDescriptor(descriptor);
    const descriptorKey = toMemoryKey(normalizedDescriptor);

    return memories.find((memory) => {
        const memoryKey = toMemoryKey(memory?.key || "");
        const memoryLabel = normalizeMemoryDescriptor(memory?.label || "");

        return (
            memoryKey === descriptorKey ||
            memoryLabel === normalizedDescriptor ||
            memoryLabel.includes(normalizedDescriptor) ||
            normalizedDescriptor.includes(memoryLabel)
        );
    }) || null;
};

const findMatchingMemoryByDescriptors = (memories = [], descriptors = []) => {
    for (const descriptor of descriptors) {
        const matchingMemory = findMatchingMemory(memories, descriptor);

        if (matchingMemory) {
            return matchingMemory;
        }
    }

    return null;
};

const buildSpecificMemoryReply = (prompt, memories = [], replyMode = DEFAULT_REPLY_MODE) => {
    const normalizedPrompt = normalizeMemoryDescriptor(prompt);
    const fixedDescriptorPatterns = [
        { pattern: /^what am i learning\??$/i, descriptors: ["learning"] },
        { pattern: /^which colou?r do i like\??$/i, descriptors: ["favorite color", "likes"] },
        { pattern: /^what colou?r do i like\??$/i, descriptors: ["favorite color", "likes"] },
        { pattern: /^what do i like\??$/i, descriptors: ["likes"] },
        { pattern: /^who am i\??$/i, descriptors: ["identity"] },
    ];
    const specificMemoryPatterns = [
        /^what(?:'s| is)\s+my\s+(.+?)\??$/i,
        /^who(?:'s| is)\s+my\s+(.+?)\??$/i,
        /^tell me\s+my\s+(.+?)\??$/i,
        /^do you remember\s+my\s+(.+?)\??$/i,
        /^can you remember\s+my\s+(.+?)\??$/i,
    ];

    for (const { pattern, descriptors } of fixedDescriptorPatterns) {
        if (!pattern.test(normalizedPrompt)) {
            continue;
        }

        const matchingMemory = findMatchingMemoryByDescriptors(memories, descriptors);

        if (!matchingMemory) {
            continue;
        }

        return {
            type: "general",
            userInput: prompt,
            response: buildPromptAwareMemoryResponse(matchingMemory, prompt, replyMode)
        };
    }

    for (const pattern of specificMemoryPatterns) {
        const match = normalizedPrompt.match(pattern);

        if (!match) {
            continue;
        }

        const descriptor = String(match[1] || "").trim().replace(/[.?!]+$/, "");
        const matchingMemory = findMatchingMemory(memories, descriptor);

        if (!matchingMemory) {
            return {
                type: "general",
                userInput: prompt,
                response: `I do not remember your ${descriptor} yet. You can say remember that my ${descriptor} is ...`
            };
        }

        return {
            type: "general",
            userInput: prompt,
            response: buildPromptAwareMemoryResponse(matchingMemory, prompt, replyMode)
        };
    }

    return null;
};

const buildFactLikeMemory = (label, value, kind = "user_property") => {
    const normalizedLabel = cleanRecognizedText(label);
    const normalizedValue = cleanRecognizedText(value);

    if (!normalizedLabel || !normalizedValue) {
        return null;
    }

    return {
        key: toMemoryKey(normalizedLabel) || `session_${Date.now()}`,
        label: normalizedLabel,
        kind,
        value: normalizedValue,
        keywords: extractKeywords(`${normalizedLabel} ${normalizedValue}`),
    };
};

const extractSessionFactFromText = (text = "") => {
    const statement = cleanRecognizedText(text);

    if (!statement) {
        return null;
    }

    const myFactMatch = statement.match(/^my\s+(.+?)\s+is\s+(.+)$/i);
    const learningMatch = statement.match(/^i\s+am\s+learning\s+(.+)$/i);
    const likesMatch = statement.match(/^i\s+like\s+(.+)$/i);
    const identityMatch = statement.match(/^i\s+am\s+(.+)$/i);

    if (myFactMatch) {
        return buildFactLikeMemory(myFactMatch[1], myFactMatch[2], "user_property");
    }

    if (learningMatch) {
        return buildFactLikeMemory("learning", learningMatch[1], "user_property");
    }

    if (likesMatch) {
        return buildFactLikeMemory("likes", likesMatch[1], "likes");
    }

    if (identityMatch) {
        return buildFactLikeMemory("identity", identityMatch[1], "identity");
    }

    return null;
};

const buildSessionFacts = (sessionMessages = []) => {
    const sessionFactsMap = new Map();

    for (const message of sanitizeSessionMessages(sessionMessages)) {
        if (message.role !== "user") {
            continue;
        }

        const fact = extractSessionFactFromText(message.text);

        if (fact?.key) {
            sessionFactsMap.set(fact.key, fact);
        }
    }

    return Array.from(sessionFactsMap.values());
};

const buildSessionContextReply = (prompt, sessionMessages = [], replyMode = DEFAULT_REPLY_MODE) => {
    const sessionFacts = buildSessionFacts(sessionMessages);

    if (!sessionFacts.length) {
        return null;
    }

    return (
        buildSpecificMemoryReply(prompt, sessionFacts, replyMode) ||
        buildKeywordMemoryReply(prompt, sessionFacts, replyMode)
    );
};

const buildKeywordMemoryReply = (prompt, memories = [], replyMode = DEFAULT_REPLY_MODE) => {
    const normalizedPrompt = normalizeMemoryDescriptor(prompt);

    if (
        !normalizedPrompt ||
        normalizedPrompt.startsWith("remember ") ||
        normalizedPrompt.includes("what do you remember about me") ||
        normalizedPrompt.includes("what do you know about me")
    ) {
        return null;
    }

    const promptKeywords = extractKeywords(normalizedPrompt);
    if (!promptKeywords.length) {
        return null;
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const memory of memories) {
        const score = scoreMemoryMatch(promptKeywords, memory);

        if (score > bestScore) {
            bestScore = score;
            bestMatch = memory;
        }
    }

    if (!bestMatch || bestScore < 2) {
        return null;
    }

    return {
        type: "general",
        userInput: prompt,
        response: buildPromptAwareMemoryResponse(bestMatch, prompt, replyMode)
    };
};

const extractMemoryFromPrompt = (prompt) => {
    const rememberMatch = String(prompt || "")
        .trim()
        .match(/^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i);

    if (!rememberMatch) {
        return null;
    }

    const rawStatement = cleanRecognizedText(rememberMatch[1]);
    if (!rawStatement) {
        return null;
    }

    let label = "note";
    let kind = "note";
    let key = `note_${toMemoryKey(rawStatement).slice(0, 24) || Date.now()}`;
    let value = rawStatement;
    let response = `Okay, I will remember that ${rawStatement}.`;

    const myFactMatch = rawStatement.match(/^my\s+(.+?)\s+is\s+(.+)$/i);
    const genericFactMatch = rawStatement.match(/^(.+?)\s+is\s+(.+)$/i);
    const identityMatch = rawStatement.match(/^i\s+am\s+(.+)$/i);
    const likesMatch = rawStatement.match(/^i\s+like\s+(.+)$/i);
    const lovesMatch = rawStatement.match(/^i\s+love\s+(.+)$/i);
    const preferMatch = rawStatement.match(/^i\s+prefer\s+(.+)$/i);

    if (myFactMatch) {
        label = myFactMatch[1].trim();
        kind = "user_property";
        value = myFactMatch[2].trim();
        key = toMemoryKey(label) || key;
        response = `Okay, I will remember that your ${label} is ${value}.`;
    } else if (genericFactMatch) {
        label = genericFactMatch[1].trim();
        kind = "entity_fact";
        value = genericFactMatch[2].trim();
        key = toMemoryKey(label) || key;
        response = `Okay, I will remember that ${label} is ${value}.`;
    } else if (identityMatch) {
        label = "identity";
        kind = "identity";
        key = "identity";
        value = identityMatch[1].trim();
        response = `Okay, I will remember that you are ${value}.`;
    } else if (likesMatch) {
        label = "likes";
        kind = "likes";
        key = "likes";
        value = likesMatch[1].trim();
        response = `Okay, I will remember that you like ${value}.`;
    } else if (lovesMatch) {
        label = "likes";
        kind = "likes";
        key = "likes";
        value = lovesMatch[1].trim();
        response = `Okay, I will remember that you love ${value}.`;
    } else if (preferMatch) {
        label = "preference";
        kind = "preference";
        key = "preference";
        value = preferMatch[1].trim();
        response = `Okay, I will remember that you prefer ${value}.`;
    }

    return {
        key,
        label,
        kind,
        value,
        keywords: extractKeywords(`${label} ${value}`),
        source: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        response
    };
};

const upsertUserMemory = (user, memory) => {
    const nextMemories = Array.isArray(user.memories) ? [...user.memories] : [];
    const existingIndex = nextMemories.findIndex((item) => item.key === memory.key);

    if (existingIndex >= 0) {
        nextMemories[existingIndex] = {
            ...nextMemories[existingIndex],
            ...memory,
            createdAt: nextMemories[existingIndex].createdAt || memory.createdAt,
            updatedAt: new Date()
        };
    } else {
        nextMemories.push(memory);
    }

    user.memories = nextMemories.slice(-MAX_MEMORIES);
};

const persistAssistantExchange = async (user, prompt, payload) => {
    const normalizedPrompt = String(prompt || "").trim();
    const normalizedResponse = String(payload?.response || "").trim();

    if (!normalizedPrompt || !normalizedResponse) {
        return;
    }

    const nextConversationHistory = Array.isArray(user.conversationHistory)
        ? [...user.conversationHistory]
        : [];

    nextConversationHistory.push(
        { role: "user", text: normalizedPrompt, createdAt: new Date() },
        { role: "assistant", text: normalizedResponse, createdAt: new Date() }
    );

    user.conversationHistory = nextConversationHistory.slice(-MAX_CONVERSATION_HISTORY);

    const nextLegacyHistory = Array.isArray(user.history)
        ? user.history.filter((item) => typeof item === "string")
        : [];

    nextLegacyHistory.push(`User: ${normalizedPrompt}`, `Assistant: ${normalizedResponse}`);
    user.history = nextLegacyHistory.slice(-MAX_LEGACY_HISTORY);
    await user.save();
};

const sendAssistantResponse = async (res, user, prompt, payload) => {
    try {
        await persistAssistantExchange(user, prompt, payload);
    } catch (error) {
        console.log("could not persist assistant exchange");
        console.log(error.message);
    }

    return res.status(200).json(payload);
};

const buildGeneralTextReply = async (prompt, assistantName, userName, promptContext = {}) => {
    try {
        const plainTextReply = sanitizeAssistantText(
            await geminiTextResponse(prompt, assistantName, userName, promptContext)
        );

        if (plainTextReply && !isWeakAssistantResponse(plainTextReply)) {
            return {
                type: "general",
                userInput: prompt,
                response: plainTextReply
            };
        }
    } catch (error) {
        console.log("could not build plain text Gemini reply");
        console.log(error.response?.data || error.message);
    }

    return null;
};

const buildSearchQuery = (prompt, phrases = []) => {
    let query = String(prompt || "").trim();

    for (const phrase of phrases) {
        query = query.replace(new RegExp(phrase, "ig"), " ");
    }

    return query.replace(/\s+/g, " ").trim();
};

const buildFallbackAssistantReply = (prompt, assistantName, userName, type = "general") => {
    const normalizedPrompt = String(prompt).toLowerCase().trim();
    const isAboutAssistantPrompt =
        normalizedPrompt.includes("who are you") ||
        normalizedPrompt.includes("your name") ||
        normalizedPrompt.includes("about yourself") ||
        normalizedPrompt.includes("introduce yourself") ||
        normalizedPrompt.includes("tell me about yourself");

    if (normalizedPrompt.includes("who created you")) {
        return {
            type: "general",
            userInput: prompt,
            response: `I was created by ${userName}.`
        };
    }

    if (isAboutAssistantPrompt) {
        return {
            type: "general",
            userInput: prompt,
            response: `I am ${assistantName}, your virtual assistant created by ${userName}. I can help with questions, search tasks, and quick actions.`
        };
    }

    if (normalizedPrompt.includes("youtube") || normalizedPrompt.includes("song") || normalizedPrompt.includes("play ")) {
        return {
            type: type === "general" ? "youtube_play" : type,
            userInput: prompt,
            response: `Playing ${prompt} on YouTube.`
        };
    }

    return {
        type,
        userInput: prompt,
        response: `I heard: ${prompt}`
    };
};

const isWeakAssistantResponse = (response) => {
    const normalizedResponse = String(response || "").toLowerCase().trim();

    return (
        !normalizedResponse ||
        normalizedResponse === "here is the json" ||
        normalizedResponse === "here is the" ||
        normalizedResponse === "json" ||
        normalizedResponse.startsWith("here is the json")
    );
};

const resolveLocalAssistantIntent = (prompt, assistantName, userName) => {
    const normalizedPrompt = String(prompt || "").toLowerCase().trim();
    const isAboutAssistantPrompt =
        normalizedPrompt.includes("who are you") ||
        normalizedPrompt.includes("what is your name") ||
        normalizedPrompt.includes("your name") ||
        normalizedPrompt.includes("about yourself") ||
        normalizedPrompt.includes("introduce yourself") ||
        normalizedPrompt.includes("tell me about yourself");

    if (!normalizedPrompt) {
        return null;
    }

    if (normalizedPrompt.includes("who created you")) {
        return {
            type: "general",
            userInput: prompt,
            response: `I was created by ${userName}.`
        };
    }

    if (isAboutAssistantPrompt) {
        return {
            type: "general",
            userInput: prompt,
            response: `I am ${assistantName}, your virtual assistant created by ${userName}. I can answer questions and help with browsing tasks like YouTube, Google, weather, maps, and more.`
        };
    }

    if (normalizedPrompt.includes("time")) {
        return {
            type: "get_time",
            userInput: prompt,
            response: `Current time is ${moment().format("HH:mm:ss")}`
        };
    }

    if (normalizedPrompt.includes("date")) {
        return {
            type: "get_date",
            userInput: prompt,
            response: `Today is ${moment().format("YYYY-MM-DD")}`
        };
    }

    if (normalizedPrompt.includes("day")) {
        return {
            type: "get_day",
            userInput: prompt,
            response: `Today is ${moment().format("dddd")}`
        };
    }

    if (normalizedPrompt.includes("month")) {
        return {
            type: "get_month",
            userInput: prompt,
            response: `Current month is ${moment().format("MMMM")}`
        };
    }

    if (normalizedPrompt.includes("go back")) {
        return {
            type: "go_back",
            userInput: prompt,
            response: "Going back."
        };
    }

    if (normalizedPrompt.includes("go forward")) {
        return {
            type: "go_forward",
            userInput: prompt,
            response: "Going forward."
        };
    }

    if (normalizedPrompt.includes("refresh page") || normalizedPrompt === "refresh" || normalizedPrompt.includes("reload page")) {
        return {
            type: "refresh_page",
            userInput: prompt,
            response: "Refreshing the page."
        };
    }

    if (normalizedPrompt.includes("youtube")) {
        const youtubeQuery = buildSearchQuery(prompt, [
            "play",
            "search",
            "on youtube",
            "youtube",
            "song",
            "video"
        ]);
        return {
            type: normalizedPrompt.includes("play") || normalizedPrompt.includes("song")
                ? "youtube_play"
                : "youtube_search",
            userInput: youtubeQuery || prompt,
            response: `Opening YouTube results for ${youtubeQuery || prompt}.`
        };
    }

    if (normalizedPrompt.includes("weather") || normalizedPrompt.includes("temperature")) {
        const weatherQuery = buildSearchQuery(prompt, [
            "show",
            "tell me",
            "weather",
            "temperature",
            "in"
        ]);
        return {
            type: "weather_show",
            userInput: weatherQuery || prompt,
            response: `Showing the weather ${weatherQuery ? `for ${weatherQuery}` : ""}.`.trim()
        };
    }

    if (normalizedPrompt.includes("google") || normalizedPrompt.includes("search")) {
        const googleQuery = buildSearchQuery(prompt, [
            "search",
            "google",
            "for"
        ]);
        return {
            type: "google_search",
            userInput: googleQuery || prompt,
            response: `Searching Google for ${googleQuery || prompt}.`
        };
    }

    if (normalizedPrompt.includes("instagram")) {
        return {
            type: "instagram_open",
            userInput: prompt,
            response: "Opening Instagram."
        };
    }

    if (normalizedPrompt.includes("facebook")) {
        return {
            type: "facebook_open",
            userInput: prompt,
            response: "Opening Facebook."
        };
    }

    if (normalizedPrompt.includes("gmail") || normalizedPrompt.includes("mail")) {
        return {
            type: "gmail_open",
            userInput: prompt,
            response: "Opening Gmail."
        };
    }

    if (normalizedPrompt.includes("github")) {
        return {
            type: "github_open",
            userInput: prompt,
            response: "Opening GitHub."
        };
    }

    if (normalizedPrompt.includes("linkedin")) {
        return {
            type: "linkedin_open",
            userInput: prompt,
            response: "Opening LinkedIn."
        };
    }

    if (normalizedPrompt.includes("map") || normalizedPrompt.includes("location") || normalizedPrompt.includes("direction")) {
        const mapsQuery = buildSearchQuery(prompt, [
            "open",
            "show",
            "map",
            "maps",
            "location",
            "direction",
            "directions",
            "to"
        ]);
        return {
            type: "maps_search",
            userInput: mapsQuery || prompt,
            response: `Opening maps ${mapsQuery ? `for ${mapsQuery}` : ""}.`.trim()
        };
    }

    if (normalizedPrompt.includes("calculator")) {
        return {
            type: "calculator_open",
            userInput: prompt,
            response: "Opening calculator."
        };
    }

    return null;
};

const getCurrentuser = async(req , res)=>{
    try{
        const userId = req.userId;
        const user = await User.findById(userId).select("-password");
        // this path  => select("-password"); will not return the password field in the response
        if(!user){
            return res.status(404).json({message : "User not found"});
        }
        return res.status(200).json({user});
    }catch(err){
        console.log("could not get user")
        console.log(err);
        return res.status(500).json({message : "Internal server error"});
    }
}

const updateAssistant = async(req , res)=>{
    try{
        const {assistantName , imageUrl} = req.body;
        let assistantImage;
        if(req.file){  // ye  check krega user ne jo image uplaod ki hai assiant ki use cloudinary me uplaod krega
            assistantImage = await uploadToCloudinary(req.file.path);
            
        }
        else{
            assistantImage = imageUrl;  // ye hamarai 7 image jo system me hai hai unka url hoga jo ham user ko de rahe hai taki user apne assistant ke liye use kar sake
        }
        // now we have the assistantImage either from the uploaded file or from the provided imageUrl
        const user = await User.findByIdAndUpdate(req.userId , {
            assistantName : assistantName,
            assistantImage : assistantImage,
        } , {new : true}).select("-password");
        return res.status(200).json({user});
    }catch(err){
        console.log("could not update assistant")
        console.log(err);
        return res.status(500).json({message : "Internal server error"});
    }
}

const deleteAccount = async(req , res)=>{
    try{
        const deletedUser = await User.findByIdAndDelete(req.userId);

        if(!deletedUser){
            return res.status(404).json({message : "User not found"});
        }

        res.clearCookie("token", {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/",
        });

        return res.status(200).json({message : "Account deleted successfully"});
    }catch(err){
        console.log("could not delete account");
        console.log(err);
        return res.status(500).json({message : "Internal server error"});
    }
}

const askToassistant = async(req , res)=>{
    try{
        const user = await User.findById(req.userId);
        if(!user){
            return res.status(404).json({message : "User not found"});
        }

        const prompt = req.body.prompt;
        if(!prompt || !String(prompt).trim()){
            return res.status(400).json({message : "Prompt is required"});
        }

        const userName = user.name;
        const assistantName = user.assistantName || "Your Assistant";
        const sessionMessages = sanitizeSessionMessages(req.body.sessionMessages);
        const replyMode = getReplyMode(user);
        const promptContext = buildPromptContext(user, sessionMessages);
        const replyModeCommand = parseReplyModeCommand(prompt);
        const memoryFromPrompt = extractMemoryFromPrompt(prompt);
        const sessionContextReply = buildSessionContextReply(prompt, sessionMessages, replyMode);
        const memoryRecallReply = buildMemoryRecallReply(prompt, promptContext.memories);
        const specificMemoryReply = buildSpecificMemoryReply(prompt, promptContext.memories, replyMode);
        const keywordMemoryReply = buildKeywordMemoryReply(prompt, promptContext.memories, replyMode);

        if (replyModeCommand?.action === "set" && VALID_REPLY_MODES.has(replyModeCommand.mode)) {
            user.replyMode = replyModeCommand.mode;
            return sendAssistantResponse(res, user, prompt, {
                type: "general",
                userInput: prompt,
                response: buildReplyModeConfirmation(replyModeCommand.mode)
            });
        }

        if (replyModeCommand?.action === "get") {
            return sendAssistantResponse(res, user, prompt, {
                type: "general",
                userInput: prompt,
                response: `Your current reply mode is ${replyMode}.`
            });
        }

        if (memoryFromPrompt) {
            upsertUserMemory(user, memoryFromPrompt);
            return sendAssistantResponse(res, user, prompt, {
                type: "general",
                userInput: prompt,
                response: memoryFromPrompt.response
            });
        }

        if (memoryRecallReply) {
            return sendAssistantResponse(res, user, prompt, memoryRecallReply);
        }

        if (sessionContextReply) {
            return sendAssistantResponse(res, user, prompt, sessionContextReply);
        }

        if (specificMemoryReply) {
            return sendAssistantResponse(res, user, prompt, specificMemoryReply);
        }

        if (keywordMemoryReply) {
            return sendAssistantResponse(res, user, prompt, keywordMemoryReply);
        }

        const localIntentResponse = resolveLocalAssistantIntent(prompt, assistantName, userName);

        if(localIntentResponse){
            return sendAssistantResponse(res, user, prompt, localIntentResponse);
        }

        let result;

        try {
            result = await geminiResponse(prompt , assistantName , userName, promptContext);
        } catch (error) {
            const generalTextReply = await buildGeneralTextReply(prompt, assistantName, userName, promptContext);

            if (generalTextReply) {
                return sendAssistantResponse(res, user, prompt, generalTextReply);
            }

            throw error;
        }

        const plainTextResult = sanitizeAssistantText(result);
        const jsonResponse = parseAssistantJson(result);
        if(!jsonResponse){
            const generalTextReply = await buildGeneralTextReply(prompt, assistantName, userName, promptContext);
            if (generalTextReply) {
                return sendAssistantResponse(res, user, prompt, generalTextReply);
            }

            if (plainTextResult) {
                return sendAssistantResponse(res, user, prompt, {
                    type: "general",
                    userInput: prompt,
                    response: plainTextResult
                });
            }

            return sendAssistantResponse(res, user, prompt,
                buildFallbackAssistantReply(prompt, assistantName, userName)
            );
        }

        const type = jsonResponse.type;
        let safeResponse = jsonResponse;

        if (isWeakAssistantResponse(jsonResponse.response)) {
            const generalTextReply = await buildGeneralTextReply(prompt, assistantName, userName, promptContext);
            safeResponse = generalTextReply || buildFallbackAssistantReply(prompt, assistantName, userName, type);
        }

        switch(type){
            case 'get_date' : 
                return sendAssistantResponse(res, user, prompt, {
                    type,
                    userInput : jsonResponse.userInput,
                    response : `Today is ${moment().format("YYYY-MM-DD")}`
                });

            case 'get_time' :
                return sendAssistantResponse(res, user, prompt, {
                    type,
                    userInput : jsonResponse.userInput,
                    response : `Current time is ${moment().format("HH:mm:ss")}`
                });

            case 'get_day' :
                return sendAssistantResponse(res, user, prompt, {
                    type,
                    userInput : jsonResponse.userInput,
                    response : `Today is ${moment().format("dddd")}`
                });

            case 'get_month' :
                return sendAssistantResponse(res, user, prompt, {
                    type,
                    userInput : jsonResponse.userInput,
                    response : `Current month is ${moment().format("MMMM")}`
                });

            case 'google_search' :
            case 'youtube_search' :
            case 'youtube_play' :
            case 'general' :
            case 'calculator_open' :
            case 'instagram_open' :
            case 'facebook_open' :
            case 'weather_show' :
            case 'gmail_open' :
            case 'github_open' :
            case 'linkedin_open' :
            case 'maps_search' :
            case 'go_back' :
            case 'go_forward' :
            case 'refresh_page' :
                return sendAssistantResponse(res, user, prompt, {
                    type: safeResponse.type || type,
                    userInput : safeResponse.userInput || prompt,
                    response : safeResponse.response
                 });

            default :
                return sendAssistantResponse(res, user, prompt,
                    buildFallbackAssistantReply(prompt, assistantName, userName)
                );
        }
    }catch(err){
        console.log("could not ask to assistant");
        console.log(err);

        if (err.response?.status === 429) {
            return res.status(200).json({
                type: "general",
                userInput: req.body.prompt,
                response: "My Gemini quota is exhausted right now."
            });
        }

        if (
            err.response?.status === 400 &&
            err.response?.data?.error?.details?.some((detail) => detail.reason === "API_KEY_INVALID")
        ) {
            return res.status(500).json({
                message: "Gemini API key is invalid or expired",
                details: err.response?.data
            });
        }

        return res.status(500).json({
            message : err.message === "Invalid response from assistant" ? err.message : "Internal server error",
            details: err.response?.data || err.message
        });
    }
}

module.exports.getCurrentuser = getCurrentuser;
module.exports.updateAssistant = updateAssistant;
module.exports.deleteAccount = deleteAccount;
module.exports.askToassistant = askToassistant;
