import React, { useContext, useEffect, useRef, useState } from 'react'
import { UserDataContext } from '../ContextApi/Usercontext';
import { useNavigate } from "react-router-dom"
import axios from "axios"

const normalizeSpeechText = (value = "") =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

const escapeRegExp = (value = "") =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
const ACTIVATION_RESPONSE = "I am activated. Ask me anything.";

const normalizeCommandType = (type = "") =>
    String(type).trim().toLowerCase().replace(/-/g, "_");

const Home = () => {
    const { userData, serverUrl, setUserData, geminiResponse, resetConversationSession } = useContext(UserDataContext);
    const navigate = useNavigate();
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [assistantReply, setAssistantReply] = useState("");
    const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [listeningState, setListeningState] = useState("Starting microphone...");
    const [lastHeardText, setLastHeardText] = useState("");
    const recognitionRef = useRef(null);
    const assistantActiveRef = useRef(false);
    const isAssistantSpeakingRef = useRef(false);
    const recognitionRunningRef = useRef(false);
    const recognitionRestartTimeoutRef = useRef(null);
    const assistantActionWindowRef = useRef(null);
    const customAudioRef = useRef(null);
    const shouldAutoRestartRef = useRef(true);
    const assistantNameRef = useRef(normalizeSpeechText(userData?.assistantName || ""));
    const assistantNameLabelRef = useRef(String(userData?.assistantName || "").trim());

    const startRecognitionSafely = () => {
        if (
            !recognitionRef.current ||
            recognitionRunningRef.current ||
            isAssistantSpeakingRef.current ||
            !shouldAutoRestartRef.current
        ) {
            return;
        }

        try {
            setListeningState("Requesting microphone access...");
            recognitionRef.current.start();
        } catch (error) {
            if (error.name !== "InvalidStateError") {
                console.log("speech error:", error.message);
                setListeningState(`Microphone error: ${error.message}`);
            }
        }
    };

    const scheduleRecognitionRestart = () => {
        if (!shouldAutoRestartRef.current) {
            return;
        }

        window.clearTimeout(recognitionRestartTimeoutRef.current);
        recognitionRestartTimeoutRef.current = window.setTimeout(() => {
            startRecognitionSafely();
        }, 250);
    };

    const stopRecognition = () => {
        shouldAutoRestartRef.current = false;
        setIsMicEnabled(false);
        setListeningState("Microphone paused");
        window.clearTimeout(recognitionRestartTimeoutRef.current);
        recognitionRunningRef.current = false;
        recognitionRef.current?.stop();
    };

    const enableRecognition = () => {
        shouldAutoRestartRef.current = true;
        setIsMicEnabled(true);
        startRecognitionSafely();
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
        assistantNameRef.current = normalizeSpeechText(userData?.assistantName || "");
        assistantNameLabelRef.current = String(userData?.assistantName || "").trim();
    }, [userData?.assistantName]);


    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.log("Speech recognition is not supported in this browser");
            setListeningState("Speech recognition is not supported in this browser.");
            setIsMicEnabled(false);
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
            setIsMicEnabled(true);
            setListeningState(
                assistantNameLabelRef.current
                    ? `Listening for ${assistantNameLabelRef.current}`
                    : "Listening..."
            );
            console.log("speech recognition started");
        };

        recognition.onresult = async (e) => {
            const lastResult = e.results[e.results.length - 1];
            const transcript = lastResult[0].transcript.trim();
            setLastHeardText(transcript);
            if (!lastResult.isFinal || isAssistantSpeakingRef.current) {
                return;
            }

            console.log("heard : " + transcript);
            const normalizedTranscript = normalizeSpeechText(transcript);

            if (AUDIO_TRIGGER_CONFIG.triggerWords.some((word) => normalizedTranscript.includes(word))) {
                playTriggeredAudio();
                return;
            }

            const assistantName = assistantNameRef.current;
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
                const assistantNamePattern = assistantNameLabelRef.current
                    ? new RegExp(escapeRegExp(assistantNameLabelRef.current), "ig")
                    : null;
                const cleanedCommand = wakeTranscript
                    .replace(assistantNamePattern || /$^/, "")
                    .trim();

                if (!cleanedCommand) {
                    console.log("assistant activated");
                    setAssistantReply(ACTIVATION_RESPONSE);
                    speakAssistantResponse(ACTIVATION_RESPONSE);
                    setListeningState("Assistant activated. Waiting for your command...");
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
                setListeningState(`Microphone error: ${event.error}`);
                return;
            }

            setListeningState(
                assistantNameLabelRef.current
                    ? `Listening for ${assistantNameLabelRef.current}`
                    : "Listening..."
            );
        };

        recognition.onend = () => {
            recognitionRunningRef.current = false;
            if (!isAssistantSpeakingRef.current && shouldAutoRestartRef.current) {
                setListeningState("Reconnecting microphone...");
                scheduleRecognitionRestart();
                return;
            }

            setListeningState("Microphone paused");
        };

        startRecognitionSafely();

        return () => {
            recognition.onend = null;
            shouldAutoRestartRef.current = false;
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
    }, [serverUrl])
    return (
        <div className='relative w-full min-h-screen overflow-hidden bg-gradient-to-t from-[black] to-[#09094d] px-4 py-5 sm:px-6 sm:py-6 lg:px-8'>
            <div className={`assistant-aura ${isAssistantSpeaking ? "assistant-aura-active" : ""}`} />

            <div className='relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8'>
                <div className='flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'>
                    <div className='w-full max-w-xl rounded-[1.75rem] border border-white/15 bg-black/35 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-sm sm:p-5'>
                        <div className='flex flex-col gap-3'>
                            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                <div>
                                    <p className='text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70'>Voice Control</p>
                                    <h2 className='text-lg font-semibold text-white sm:text-xl'>
                                        {userData?.assistantName || "Assistant microphone"}
                                    </h2>
                                </div>
                                <button
                                    className='rounded-full border border-white/25 bg-white/90 px-5 py-3 text-sm font-semibold text-black transition hover:bg-blue-100'
                                    onClick={() => {
                                        if (isMicEnabled) {
                                            stopRecognition();
                                            return;
                                        }

                                        enableRecognition();
                                    }}
                                >
                                    {isMicEnabled ? "Pause Microphone" : "Start Microphone"}
                                </button>
                            </div>

                            <p className='rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-sm text-white/90 backdrop-blur-sm sm:text-base'>
                                {listeningState}
                            </p>

                            {lastHeardText && (
                                <p className='rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 backdrop-blur-sm sm:text-base'>
                                    Heard: {lastHeardText}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-1'>
                        <button
                            className='min-h-12 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-blue-100 sm:text-base'
                            onClick={() => Logout()}
                        >
                            Log out
                        </button>

                        <button
                            className='min-h-12 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-blue-100 sm:text-base'
                            onClick={() =>
                                navigate("/customize", {
                                    state: { allowAssistantCustomization: true },
                                })
                            }
                        >
                            Customize
                        </button>

                        <button
                            disabled={deleteLoading}
                            className='min-h-12 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base'
                            onClick={handleDeleteAccount}
                        >
                            {deleteLoading ? "Deleting..." : "Delete Account"}
                        </button>

                        <button
                            className='min-h-12 rounded-full bg-yellow-300 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-200 sm:text-base'
                            onClick={handleNewSession}
                        >
                            New Session
                        </button>
                    </div>
                </div>

                <div className='flex flex-1 flex-col items-center justify-center gap-4 pb-4 pt-2 sm:gap-5 sm:pt-4 lg:pt-6'>
                    <div className={`relative z-10 aspect-[3/4] w-full max-w-[18rem] overflow-hidden rounded-[2rem] shadow-lg transition-all duration-300 sm:max-w-[20rem] ${isAssistantSpeaking ? "shadow-cyan-400/60 scale-[1.02]" : ""}`}>
                        <img src={userData?.assistantImage} alt={userData?.assistantName || "Assistant"} className='h-full w-full object-cover' />
                    </div>

                    <h1 className='text-center text-2xl text-white sm:text-3xl lg:text-4xl'>
                        I&apos;m {userData?.assistantName}
                    </h1>

                    <p className='relative z-10 max-w-2xl text-center text-sm text-white/80 sm:text-base lg:text-lg'>
                        {assistantReply || "Say the assistant name once to activate it."}
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Home
