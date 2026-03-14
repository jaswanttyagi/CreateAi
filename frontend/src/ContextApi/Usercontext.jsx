import React, { createContext, useEffect, useState } from "react";
import axios from "axios";
// import { Command } from "concurrently";

export const UserDataContext = createContext();

const AUTH_STORAGE_KEY = "cerateai-user";
const SESSION_STORAGE_KEY = "cerateai-session";
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_SESSION_MESSAGES = 12;
const SERVER_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

const createSessionId = () =>
  `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getStoredUser = () => {
  const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!savedAuth) {
    return null;
  }

  try {
    const parsedAuth = JSON.parse(savedAuth);

    if (!parsedAuth.expiresAt || parsedAuth.expiresAt < Date.now()) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return parsedAuth.userData ?? null;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

const getStoredSession = () => {
  const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!savedSession) {
    return {
      sessionId: createSessionId(),
      messages: [],
    };
  }

  try {
    const parsedSession = JSON.parse(savedSession);
    return {
      sessionId:
        typeof parsedSession.sessionId === "string" && parsedSession.sessionId.trim()
          ? parsedSession.sessionId
          : createSessionId(),
      messages: Array.isArray(parsedSession.messages) ? parsedSession.messages : [],
    };
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return {
      sessionId: createSessionId(),
      messages: [],
    };
  }
};

function Usercontext({ children }) {
  const serverUrl = SERVER_URL;
  const [userData, setUserData] = useState(() => getStoredUser());
  const [sessionState, setSessionState] = useState(() => getStoredSession());
  const [frontendImage, setFrontendImage] = useState(null);
  const [backendImage, setbackendImage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const persistUser = (nextUserData) => {
    setUserData(nextUserData);

    if (nextUserData) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          userData: nextUserData,
          expiresAt: Date.now() + ONE_DAY_IN_MS,
        })
      );
      return;
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const persistSessionState = (nextSessionState) => {
    setSessionState(nextSessionState);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSessionState));
  };

  const appendSessionExchange = (userText, assistantText) => {
    const normalizedUserText = String(userText || "").trim();
    const normalizedAssistantText = String(assistantText || "").trim();

    if (!normalizedUserText || !normalizedAssistantText) {
      return;
    }

    setSessionState((currentSessionState) => {
      const nextMessages = [
        ...(Array.isArray(currentSessionState.messages)
          ? currentSessionState.messages
          : []),
        { role: "user", text: normalizedUserText },
        { role: "assistant", text: normalizedAssistantText },
      ].slice(-MAX_SESSION_MESSAGES);

      const nextSessionState = {
        sessionId: currentSessionState.sessionId || createSessionId(),
        messages: nextMessages,
      };

      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSessionState));
      return nextSessionState;
    });
  };

  const resetConversationSession = () => {
    persistSessionState({
      sessionId: createSessionId(),
      messages: [],
    });
  };

  const handleCurrentUser = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/user/currentUser`, {
        withCredentials: true,
      });
      persistUser(result.data.user);
    } catch (err) {
      if (err?.response?.status !== 401) {
        console.log(err);
      }
      persistUser(null);
    }
  };

  const geminiResponse = async (command) => {
    try{
      const result = await axios.post(
        `${serverUrl}/api/user/askToassistant`,
        {
          prompt: command,
          sessionId: sessionState.sessionId,
          sessionMessages: sessionState.messages,
        },
        {withCredentials:true}
      );
      const responseText =
        typeof result.data === "string" ? result.data : result.data?.response || "";

      appendSessionExchange(command, responseText);
      return result.data;

    }catch(err){
        console.log("error in getting response from gemini");
        console.log("frontend gemini error status:", err?.response?.status);
        console.log("frontend gemini error data:", err?.response?.data);
        console.log(
          "frontend gemini error details json:",
          JSON.stringify(err?.response?.data?.details, null, 2)
        );
        console.log("frontend gemini error message:", err?.message);
        return "Sorry, I am having trouble responding right now.";
    }
  }

  useEffect(() => {
    handleCurrentUser();
  }, []);

  return (
    <UserDataContext.Provider
      value={{
        serverUrl,
        userData,
        setUserData: persistUser,
        frontendImage,
        setFrontendImage,
        backendImage,
        setbackendImage,
        selectedImage,
        setSelectedImage,
        sessionMessages: sessionState.messages,
        sessionId: sessionState.sessionId,
        resetConversationSession,
        geminiResponse,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}

export default Usercontext;
