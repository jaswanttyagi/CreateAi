require("./env");

const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PORT = 4500;
const DEFAULT_DEV_CLIENT_URLS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const normalizeOrigin = (value = "") => String(value).trim().replace(/\/+$/, "");

const parseBoolean = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["true", "1", "yes"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalizedValue)) {
    return false;
  }

  return undefined;
};

const isProduction = process.env.NODE_ENV === "production";
const configuredClientUrls = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || "").split(","),
]
  .map(normalizeOrigin)
  .filter(Boolean);

const clientUrls = [
  ...new Set([...configuredClientUrls, ...DEFAULT_DEV_CLIENT_URLS]),
];

let secureCookies = parseBoolean(process.env.COOKIE_SECURE);
if (typeof secureCookies !== "boolean") {
  secureCookies = isProduction;
}

let sameSite = String(process.env.COOKIE_SAME_SITE || "").trim().toLowerCase();
if (!sameSite) {
  sameSite = secureCookies ? "none" : "lax";
}

if (sameSite === "none") {
  secureCookies = true;
}

const authCookieOptions = {
  httpOnly: true,
  maxAge: ONE_WEEK_IN_MS,
  sameSite,
  secure: secureCookies,
  path: "/",
};

const authCookieClearOptions = {
  httpOnly: true,
  sameSite,
  secure: secureCookies,
  path: "/",
};

const clearAuthCookie = (res) => {
  res.clearCookie("token", authCookieClearOptions);
};

const corsOptionsDelegate = (req, callback) => {
  const requestOrigin = normalizeOrigin(req.header("origin"));
  const requestHost = normalizeOrigin(`${req.protocol}://${req.get("host")}`);
  const isAllowedOrigin =
    !requestOrigin ||
    requestOrigin === requestHost ||
    clientUrls.includes(requestOrigin);

  callback(
    isAllowedOrigin ? null : new Error(`Origin ${requestOrigin} is not allowed by CORS`),
    {
      origin: isAllowedOrigin,
      credentials: true,
    }
  );
};

const getMissingEnvVars = () => {
  const missingVars = [];

  if (!String(process.env.MONGO_URL || "").trim()) {
    missingVars.push("MONGO_URL");
  }

  if (!String(process.env.JWT_SECRET_KEY || "").trim()) {
    missingVars.push("JWT_SECRET_KEY");
  }

  if (
    !String(process.env.GEMINI_API_KEY || "").trim() &&
    !String(process.env.GOOGLE_API_KEY || "").trim()
  ) {
    missingVars.push("GEMINI_API_KEY or GOOGLE_API_KEY");
  }

  return missingVars;
};

const parsedPort = Number.parseInt(process.env.PORT || `${DEFAULT_PORT}`, 10);
const port = Number.isNaN(parsedPort) ? DEFAULT_PORT : parsedPort;

module.exports = {
  authCookieOptions,
  clearAuthCookie,
  clientUrls,
  corsOptionsDelegate,
  getMissingEnvVars,
  isProduction,
  port,
};
