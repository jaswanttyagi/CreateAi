import React, { useContext, useEffect, useRef, useState } from 'react'
import { UserDataContext } from '../ContextApi/Usercontext';
import { useNavigate } from "react-router-dom"
import axios from "axios"

const normalizeSpeechText = (value = "") =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

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

const buildExternalUrl = (type, userInput = "") => {
    const encodedInput = encodeURIComponent(userInput);

    switch (type) {
        case "youtube_search":
        case "youtube_play":
            return userInput
                ? `https://www.youtube.com/results?search_query=${encodedInput}`
                : "https://www.youtube.com";
        case "google_search":
            return userInput
                ? `https://www.google.com/search?q=${encodedInput}`
                : "https://www.google.com";
        case "weather_show":
            return `https://www.google.com/search?q=${encodeURIComponent(`weather ${userInput}`.trim())}`;
        case "calculator_open":
            return "https://www.google.com/search?q=calculator";
        case "instagram_open":
            return "https://www.instagram.com";
        case "facebook_open":
            return "https://www.facebook.com";
        case "gmail_open":
            return "https://mail.google.com";
        case "github_open":
            return "https://github.com";
        case "linkedin_open":
            return "https://www.linkedin.com";
        case "maps_search":
            return userInput
                ? `https://www.google.com/maps/search/${encodedInput}`
                : "https://www.google.com/maps";
        default:
            return "";
    }
};

const AUDIO_TRIGGER_CONFIG = {
    audioPath: "/audio/Babbal.mp3",
    triggerWords: ["bubble", "babbal"],
};

const normalizeCommandType = (type = "") =>
    String(type).trim().toLowerCase().replace(/-/g, "_");

const Home = () => {
    const { userData, serverUrl, setUserData, geminiResponse, resetConversationSession } = useContext(UserDataContext);
    const navigate = useNavigate();
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [assistantReply, setAssistantReply] = useState("");
    const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
    const recognitionRef = useRef(null);
    const assistantActiveRef = useRef(false);
    const isAssistantSpeakingRef = useRef(false);
    const recognitionRunningRef = useRef(false);
    const recognitionRestartTimeoutRef = useRef(null);
    const assistantActionWindowRef = useRef(null);
    const customAudioRef = useRef(null);

    const startRecognitionSafely = () => {
        if (!recognitionRef.current || recognitionRunningRef.current || isAssistantSpeakingRef.current) {
            return;
        }

        try {
            recognitionRef.current.start();
        } catch (error) {
            if (error.name !== "InvalidStateError") {
                console.log("speech error:", error.message);
            }
        }
    };

    const scheduleRecognitionRestart = () => {
        window.clearTimeout(recognitionRestartTimeoutRef.current);
        recognitionRestartTimeoutRef.current = window.setTimeout(() => {
            startRecognitionSafely();
        }, 250);
    };

    const executeAssistantAction = (data) => {
        if (!data || typeof data === "string") {
            return;
        }

        if (data.type === "go_back") {
            if (assistantActionWindowRef.current && !assistantActionWindowRef.current.closed) {
                assistantActionWindowRef.current.history.back();
            } else {
                setAssistantReply("There is no assistant tab open to go back.");
            }
            return;
        }

        if (data.type === "go_forward") {
            if (assistantActionWindowRef.current && !assistantActionWindowRef.current.closed) {
                assistantActionWindowRef.current.history.forward();
            } else {
                setAssistantReply("There is no assistant tab open to go forward.");
            }
            return;
        }

        if (data.type === "refresh_page") {
            if (assistantActionWindowRef.current && !assistantActionWindowRef.current.closed) {
                assistantActionWindowRef.current.location.reload();
            } else {
                setAssistantReply("There is no assistant tab open to refresh.");
            }
            return;
        }

        const targetUrl = buildExternalUrl(data.type, data.userInput);
        if (!targetUrl) {
            return;
        }

        const openedWindow = window.open("", "assistant-action-tab");
        if (!openedWindow) {
            setAssistantReply("Please allow popups so I can open links in a new tab.");
            return;
        }

        openedWindow.opener = null;
        openedWindow.location.href = targetUrl;
        assistantActionWindowRef.current = openedWindow;
    };

    const speakAssistantResponse = (text) => {
        if (!text || !window.speechSynthesis) {
            return;
        }

        isAssistantSpeakingRef.current = true;
        setIsAssistantSpeaking(true);

        if (recognitionRef.current) {
            recognitionRunningRef.current = false;
            recognitionRef.current.stop();
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.lang = "en-US";

        utterance.onstart = () => {
            window.speechSynthesis.resume();
        };

        utterance.onend = () => {
            isAssistantSpeakingRef.current = false;
            setIsAssistantSpeaking(false);
            scheduleRecognitionRestart();
        };

        utterance.onerror = () => {
            isAssistantSpeakingRef.current = false;
            setIsAssistantSpeaking(false);
            scheduleRecognitionRestart();
        };

        window.speechSynthesis.speak(utterance);
    };

    const playTriggeredAudio = () => {
        const audio = customAudioRef.current;

        if (!audio) {
            return;
        }

        if (recognitionRef.current) {
            recognitionRunningRef.current = false;
            recognitionRef.current.stop();
        }

        window.speechSynthesis?.cancel();
        isAssistantSpeakingRef.current = true;
        setIsAssistantSpeaking(true);
        audio.currentTime = 0;

        const playPromise = audio.play();
        if (playPromise?.catch) {
            playPromise.catch((error) => {
                console.log("audio playback failed:", error.message);
                isAssistantSpeakingRef.current = false;
                setIsAssistantSpeaking(false);
                scheduleRecognitionRestart();
            });
        }
    };

    const handleAssistantResponse = async (command) => {
        const data = await geminiResponse(command);
        console.log("gemini response:", data);
        handleCommand(data);
    };

    const Logout = async () => {
        try {
            await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
            resetConversationSession();
            navigate("/login");
            setUserData(null);

        } catch (err) {
            console.log(err);
        }
    }

    const handleCommand = (data) => {
        if (!data) {
            return;
        }

        if (typeof data === "string") {
            setAssistantReply(data);
            speakAssistantResponse(data);
            return;
        }

        const responseText = data?.response || "I am ready.";
        const normalizedData = {
            ...data,
            type: normalizeCommandType(data?.type),
        };

        setAssistantReply(responseText);
        speakAssistantResponse(responseText);
        executeAssistantAction(normalizedData);
    }

    const handleDeleteAccount = async () => {
        const shouldDelete = window.confirm("Delete your account permanently?");

        if (!shouldDelete) {
            return;
        }

        setDeleteLoading(true);
        try {
            await axios.delete(`${serverUrl}/api/user/deleteAccount`, {
                withCredentials: true,
            });
            resetConversationSession();
            setUserData(null);
            navigate("/signup");
        } catch (err) {
            console.log(err);
        } finally {
            setDeleteLoading(false);
        }
    }

    const handleNewSession = () => {
        assistantActiveRef.current = false;
        setAssistantReply("Started a new session.");
        resetConversationSession();
    };



    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.log("Speech recognition is not supported in this browser");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        customAudioRef.current = new Audio(`${serverUrl}${AUDIO_TRIGGER_CONFIG.audioPath}`);
        customAudioRef.current.preload = "auto";
        customAudioRef.current.onended = () => {
            isAssistantSpeakingRef.current = false;
            setIsAssistantSpeaking(false);
            scheduleRecognitionRestart();
        };
        customAudioRef.current.onerror = () => {
            isAssistantSpeakingRef.current = false;
            setIsAssistantSpeaking(false);
            scheduleRecognitionRestart();
        };
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 5;
        recognition.lang = 'en-US'

        recognition.onstart = () => {
            recognitionRunningRef.current = true;
            console.log("speech recognition started");
        };

        recognition.onresult = async (e) => {
            const lastResult = e.results[e.results.length - 1];
            if (!lastResult.isFinal || isAssistantSpeakingRef.current) {
                return;
            }

            const transcript = lastResult[0].transcript.trim();
            console.log("heard : " + transcript);
            const normalizedTranscript = normalizeSpeechText(transcript);

            if (AUDIO_TRIGGER_CONFIG.triggerWords.some((word) => normalizedTranscript.includes(word))) {
                playTriggeredAudio();
                return;
            }

            const assistantName = normalizeSpeechText(userData?.assistantName);
            const heardAlternatives = Array.from(lastResult).map((item) => item.transcript.trim());
            const matchedWakeWordTranscript = heardAlternatives.find((item) => {
                const normalizedItem = normalizeSpeechText(item);
                const firstWord = normalizedItem.split(/\s+/)[0] || "";

                return (
                    assistantName &&
                    (
                        normalizedItem.includes(assistantName) ||
                        getEditDistance(firstWord, assistantName) <= 2
                    )
                );
            });
            const matchedTranscript = heardAlternatives.find((item) =>
                assistantName && normalizeSpeechText(item).includes(assistantName)
            );
            const hasAssistantName = Boolean(matchedWakeWordTranscript || matchedTranscript);

            if (normalizedTranscript.includes("stop listening")) {
                assistantActiveRef.current = false;
                console.log("assistant stopped listening");
                return;
            }

            if (hasAssistantName) {
                assistantActiveRef.current = true;
                const wakeTranscript = matchedWakeWordTranscript || matchedTranscript || transcript;
                const cleanedCommand = wakeTranscript
                    .replace(new RegExp(userData.assistantName, "ig"), "")
                    .trim();

                if (!cleanedCommand) {
                    console.log("assistant activated");
                    return;
                }

                await handleAssistantResponse(cleanedCommand);
                return;
            }

            if (assistantActiveRef.current) {
                await handleAssistantResponse(transcript);
            }
        }

        recognition.onerror = (event) => {
            if (event.error !== "no-speech") {
                console.log("speech error:", event.error);
            }
        };

        recognition.onend = () => {
            recognitionRunningRef.current = false;
            if (!isAssistantSpeakingRef.current) {
                scheduleRecognitionRestart();
            }
        };

        startRecognitionSafely();

        return () => {
            recognition.onend = null;
            assistantActiveRef.current = false;
            recognitionRunningRef.current = false;
            window.clearTimeout(recognitionRestartTimeoutRef.current);
            recognition.stop();
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            if (customAudioRef.current) {
                customAudioRef.current.pause();
                customAudioRef.current.currentTime = 0;
                customAudioRef.current.onended = null;
                customAudioRef.current.onerror = null;
            }
            isAssistantSpeakingRef.current = false;
            setIsAssistantSpeaking(false);
        };
    }, [])
    return (
        <div className='w-full min-h-[100vh] bg-gradient-to-t from-[black] to-[#09094d] flex justify-center items-center flex-col p-[20px] relative overflow-hidden'>
            <div className={`assistant-aura ${isAssistantSpeaking ? "assistant-aura-active" : ""}`} />

            <button
                className='absolute min-w-[150px] h-[60px] mt-[30px] text-black font-semibold bg-white right-[20px] p-[10px] rounded-full top-[20px] text-[20px] hover:text-blue-200 cursor-pointer'
                onClick={() => Logout()}
            >
                Log out
            </button>

            <button
                className='absolute min-w-[150px] h-[60px] mt-[30px] text-black font-semibold bg-white right-[20px] p-[10px] rounded-full top-[100px] text-[20px] hover:text-blue-200 cursor-pointer'
                onClick={() =>
                    navigate("/customize", {
                        state: { allowAssistantCustomization: true },
                    })
                }
            >
                Customize Your Assistant
            </button>

            <button
                disabled={deleteLoading}
                className='absolute min-w-[150px] h-[60px] mt-[30px] text-white font-semibold bg-red-600 right-[20px] p-[10px] rounded-full top-[180px] text-[20px] hover:bg-red-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70'
                onClick={handleDeleteAccount}
            >
                {deleteLoading ? "Deleting..." : "Delete Account"}
            </button>

            <button
                className='absolute min-w-[150px] h-[60px] mt-[30px] text-black font-semibold bg-yellow-300 right-[20px] p-[10px] rounded-full top-[260px] text-[20px] hover:bg-yellow-200 cursor-pointer'
                onClick={handleNewSession}
            >
                New Session
            </button>

            <div className={`relative z-10 w-[300px] h-[400px] flex justify-center items-center overflow-hidden rounded-3xl shadow-lg transition-all duration-300 ${isAssistantSpeaking ? "shadow-cyan-400/60 scale-[1.02]" : ""}`}>

                <img src={userData?.assistantImage} alt="" className='h-full object-cover' />

            </div>
            <h1 className='text-white text-2xl  mt-4'>I' m {userData?.assistantName}</h1>
            <p className='relative z-10 mt-3 max-w-xl text-center text-sm text-white/80 sm:text-base'>
                {assistantReply || "Say the assistant name once to activate it."}
            </p>
        </div>
    )
}

export default Home
