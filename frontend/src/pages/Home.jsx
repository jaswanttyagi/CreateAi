import React, { useContext, useEffect, useRef, useState } from 'react'
import { UserDataContext } from '../ContextApi/Usercontext';
import { useNavigate } from "react-router-dom"
import axios from "axios"

const normalizeSpeechText = (value = "") =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

const escapeRegExp = (value = "") =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const splitSpeechWords = (value = "") =>
    normalizeSpeechText(value)
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean);

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

const WAKE_WORD_PREFIXES = new Set(["hey", "hi", "hello", "yo", "ok", "okay", "please"]);
const COMMAND_PREFIX_PATTERN = /^(?:please|can you|could you|would you|will you)\s+/i;

const stripWakeWordPrefixes = (words = []) => {
    const remainingWords = Array.isArray(words) ? [...words] : [];

    while (remainingWords.length && WAKE_WORD_PREFIXES.has(remainingWords[0])) {
        remainingWords.shift();
    }

    return remainingWords;
};

const tokensRoughlyMatch = (source = "", target = "") => {
    if (!source || !target) {
        return false;
    }

    if (source === target) {
        return true;
    }

    const distance = getEditDistance(source, target);
    if (source.length <= 4 || target.length <= 4) {
        return distance <= 1;
    }

    return distance <= 2;
};

const phrasesRoughlyMatch = (sourceWords = [], targetWords = []) => {
    if (!sourceWords.length || sourceWords.length !== targetWords.length) {
        return false;
    }

    const joinedSource = sourceWords.join(" ");
    const joinedTarget = targetWords.join(" ");

    if (joinedSource === joinedTarget) {
        return true;
    }

    const distance = getEditDistance(joinedSource, joinedTarget);
    const maxDistance = joinedTarget.length <= 6 ? 1 : joinedTarget.length <= 14 ? 2 : 3;
    if (distance <= maxDistance) {
        return true;
    }

    const matchedWordCount = sourceWords.filter((word, index) =>
        tokensRoughlyMatch(word, targetWords[index])
    ).length;

    return matchedWordCount >= Math.max(1, targetWords.length - 1);
};

const cleanAssistantCommand = (value = "") =>
    String(value)
        .replace(COMMAND_PREFIX_PATTERN, "")
        .trim();

const getPreferredRecognitionLanguage = () => {
    if (typeof navigator === "undefined") {
        return "en-US";
    }

    const availableLanguages = Array.isArray(navigator.languages)
        ? navigator.languages.filter(Boolean)
        : [];
    const browserLanguage = navigator.language || "";
    const candidateLanguages = [...availableLanguages, browserLanguage]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

    const preferredEnglishLanguage = candidateLanguages.find((value) => /^en\b/i.test(value));
    if (preferredEnglishLanguage) {
        return preferredEnglishLanguage;
    }

    const hasIndicLanguagePreference = candidateLanguages.some((value) =>
        /^(hi|bn|gu|kn|ml|mr|pa|ta|te|ur)\b/i.test(value)
    );

    return hasIndicLanguagePreference ? "en-IN" : "en-US";
};

const isMobileBrowser = () => {
    if (typeof navigator === "undefined") {
        return false;
    }

    if (typeof navigator.userAgentData?.mobile === "boolean") {
        return navigator.userAgentData.mobile;
    }

    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
};

const getSpeechRecognitionConfig = () => {
    const mobile = isMobileBrowser();

    return {
        isMobile: mobile,
        continuous: !mobile,
        interimResults: !mobile,
        restartDelayMs: mobile ? 550 : 250,
    };
};

const findWakeWordMatch = (alternatives = [], assistantName = "") => {
    const assistantWords = splitSpeechWords(assistantName);
    if (!assistantWords.length) {
        return null;
    }

    for (const alternative of alternatives) {
        const rawTranscriptWords = splitSpeechWords(alternative);
        const strippedTranscriptWords = stripWakeWordPrefixes(rawTranscriptWords);
        const candidateWordGroups = [rawTranscriptWords];

        if (strippedTranscriptWords.join(" ") !== rawTranscriptWords.join(" ")) {
            candidateWordGroups.push(strippedTranscriptWords);
        }

        for (const transcriptWords of candidateWordGroups) {
            if (transcriptWords.length < assistantWords.length) {
                continue;
            }

            for (let startIndex = 0; startIndex <= transcriptWords.length - assistantWords.length; startIndex += 1) {
                const candidateWords = transcriptWords.slice(startIndex, startIndex + assistantWords.length);
                if (!phrasesRoughlyMatch(candidateWords, assistantWords)) {
                    continue;
                }

                return {
                    transcript: String(alternative || "").trim(),
                    command: cleanAssistantCommand(
                        transcriptWords.slice(startIndex + assistantWords.length).join(" ")
                    ),
                };
            }
        }
    }

    return null;
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
    const [isAssistantActive, setIsAssistantActive] = useState(false);
    const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(false);
    const [listeningState, setListeningState] = useState("Tap Start Microphone to enable voice control.");
    const [lastHeardText, setLastHeardText] = useState("");
    const recognitionRef = useRef(null);
    const assistantActiveRef = useRef(false);
    const isHandlingCommandRef = useRef(false);
    const isAssistantSpeakingRef = useRef(false);
    const recognitionRunningRef = useRef(false);
    const recognitionStopExpectedRef = useRef(false);
    const recognitionRestartTimeoutRef = useRef(null);
    const assistantActionWindowRef = useRef(null);
    const customAudioRef = useRef(null);
    const hasMicPermissionRef = useRef(false);
    const shouldAutoRestartRef = useRef(false);
    const speechRecognitionConfigRef = useRef(getSpeechRecognitionConfig());
    const assistantNameRef = useRef(normalizeSpeechText(userData?.assistantName || ""));
    const assistantNameLabelRef = useRef(String(userData?.assistantName || "").trim());
    const assistantDisplayName = userData?.assistantName || "Assistant";
    const assistantImage = userData?.assistantImage;

    const updateAssistantActiveState = (isActive) => {
        assistantActiveRef.current = isActive;
        setIsAssistantActive(isActive);
    };

    const ensureMicrophoneAccess = async () => {
        if (hasMicPermissionRef.current) {
            return true;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setListeningState("This browser cannot access your microphone.");
            return false;
        }

        try {
            setListeningState("Waiting for microphone permission...");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            stream.getTracks().forEach((track) => track.stop());
            hasMicPermissionRef.current = true;
            return true;
        } catch (error) {
            console.log("microphone access failed:", error.message);
            setIsMicEnabled(false);
            setListeningState("Microphone permission was denied or no input device is available.");
            return false;
        }
    };

    const startRecognitionSafely = async () => {
        if (
            !recognitionRef.current ||
            recognitionRunningRef.current ||
            isAssistantSpeakingRef.current ||
            !shouldAutoRestartRef.current
        ) {
            return;
        }

        try {
            const hasMicrophoneAccess = await ensureMicrophoneAccess();
            if (!hasMicrophoneAccess) {
                return;
            }

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
            void startRecognitionSafely();
        }, speechRecognitionConfigRef.current.restartDelayMs);
    };

    const stopRecognition = () => {
        shouldAutoRestartRef.current = false;
        setIsMicEnabled(false);
        setListeningState("Microphone paused");
        window.clearTimeout(recognitionRestartTimeoutRef.current);
        recognitionRunningRef.current = false;
        recognitionStopExpectedRef.current = true;
        recognitionRef.current?.stop();
    };

    const enableRecognition = () => {
        shouldAutoRestartRef.current = true;
        setIsMicEnabled(true);
        void startRecognitionSafely();
    };

    const executeAssistantAction = (data) => {
        if (!data || typeof data === "string") {
            return;
        }

        const activeActionWindow =
            assistantActionWindowRef.current === window
                ? window
                : assistantActionWindowRef.current && !assistantActionWindowRef.current.closed
                    ? assistantActionWindowRef.current
                    : null;

        if (data.type === "go_back") {
            if (activeActionWindow) {
                activeActionWindow.history.back();
            } else {
                setAssistantReply("There is no assistant tab open to go back.");
            }
            return;
        }

        if (data.type === "go_forward") {
            if (activeActionWindow) {
                activeActionWindow.history.forward();
            } else {
                setAssistantReply("There is no assistant tab open to go forward.");
            }
            return;
        }

        if (data.type === "refresh_page") {
            if (activeActionWindow) {
                activeActionWindow.location.reload();
            } else {
                setAssistantReply("There is no assistant tab open to refresh.");
            }
            return;
        }

        const targetUrl = buildExternalUrl(data.type, data.userInput);
        if (!targetUrl) {
            return;
        }

        if (activeActionWindow && activeActionWindow !== window) {
            activeActionWindow.location.href = targetUrl;
            activeActionWindow.focus?.();
            return;
        }

        const openedWindow = window.open(targetUrl, "assistant-action-tab");
        if (!openedWindow) {
            assistantActionWindowRef.current = window;
            window.location.assign(targetUrl);
            return;
        }

        openedWindow.opener = null;
        openedWindow.focus?.();
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
            recognitionStopExpectedRef.current = true;
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
            recognitionStopExpectedRef.current = true;
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
        const normalizedCommand = String(command || "").trim();
        if (!normalizedCommand || isHandlingCommandRef.current) {
            return;
        }

        isHandlingCommandRef.current = true;
        setListeningState("Processing your request...");

        try {
            const data = await geminiResponse(normalizedCommand);
            console.log("gemini response:", data);
            handleCommand(data);
        } finally {
            isHandlingCommandRef.current = false;
        }
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
        updateAssistantActiveState(false);
        setAssistantReply("Started a new session.");
        setListeningState(
            assistantNameLabelRef.current
                ? `Listening for ${assistantNameLabelRef.current}`
                : "Listening..."
        );
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
        recognition.continuous = speechRecognitionConfigRef.current.continuous;
        recognition.interimResults = speechRecognitionConfigRef.current.interimResults;
        recognition.maxAlternatives = 5;
        recognition.lang = getPreferredRecognitionLanguage();

        recognition.onaudiostart = () => {
            console.log("speech recognition audio started");
            setListeningState("Microphone is live. Listening for your voice...");
        };

        recognition.onsoundstart = () => {
            console.log("speech recognition detected sound");
            setListeningState("Sound detected...");
        };

        recognition.onspeechstart = () => {
            console.log("speech recognition detected speech");
            setListeningState("Speech detected...");
        };

        recognition.onspeechend = () => {
            console.log("speech recognition speech ended");
        };

        recognition.onaudioend = () => {
            console.log("speech recognition audio ended");
        };

        recognition.onnomatch = () => {
            console.log("speech recognition could not match what it heard");
            setListeningState("I heard something, but I could not understand it clearly.");
        };

        recognition.onstart = () => {
            recognitionStopExpectedRef.current = false;
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
            if (!lastResult.isFinal || isAssistantSpeakingRef.current || isHandlingCommandRef.current) {
                return;
            }

            console.log("heard : " + transcript);
            const normalizedTranscript = normalizeSpeechText(transcript);

            if (AUDIO_TRIGGER_CONFIG.triggerWords.some((word) => normalizedTranscript.includes(word))) {
                playTriggeredAudio();
                return;
            }

            const assistantName = assistantNameRef.current;
            const heardAlternatives = Array.from(lastResult)
                .map((item) => item.transcript.trim())
                .filter(Boolean);
            const wakeWordMatch = findWakeWordMatch(
                heardAlternatives.length ? heardAlternatives : [transcript],
                assistantName
            );

            if (normalizedTranscript.includes("stop listening")) {
                updateAssistantActiveState(false);
                setAssistantReply("Back on standby. Say the assistant name when you want me again.");
                setListeningState(
                    assistantNameLabelRef.current
                        ? `Listening for ${assistantNameLabelRef.current}`
                        : "Listening..."
                );
                console.log("assistant stopped listening");
                return;
            }

            if (wakeWordMatch) {
                updateAssistantActiveState(true);
                const assistantNamePattern = assistantNameLabelRef.current
                    ? new RegExp(escapeRegExp(assistantNameLabelRef.current), "ig")
                    : null;
                const cleanedCommand = cleanAssistantCommand(
                    wakeWordMatch.command ||
                    wakeWordMatch.transcript.replace(assistantNamePattern || /$^/, "").trim()
                );

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
                setListeningState("Processing your request...");
                await handleAssistantResponse(transcript);
            }
        }

        recognition.onerror = (event) => {
            console.log("speech error:", event.error);

            if (event.error === "aborted" && recognitionStopExpectedRef.current) {
                return;
            }

            if (event.error === "no-speech") {
                setListeningState("No speech detected. Try speaking a little louder or closer to the mic.");
                return;
            }

            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                shouldAutoRestartRef.current = false;
                setIsMicEnabled(false);
                hasMicPermissionRef.current = false;
                setListeningState("Microphone permission is blocked. Please allow microphone access in the browser.");
                return;
            }

            if (event.error === "audio-capture") {
                hasMicPermissionRef.current = false;
                setListeningState("No microphone input was found. Check your browser microphone device.");
                return;
            }

            setListeningState(`Microphone error: ${event.error}`);
        };

        recognition.onend = () => {
            const shouldIgnoreAbort = recognitionStopExpectedRef.current;
            recognitionStopExpectedRef.current = false;
            recognitionRunningRef.current = false;

            if (shouldIgnoreAbort && !shouldAutoRestartRef.current) {
                setListeningState("Microphone paused");
                return;
            }

            if (!isAssistantSpeakingRef.current && shouldAutoRestartRef.current) {
                setListeningState("Reconnecting microphone...");
                scheduleRecognitionRestart();
                return;
            }

            setListeningState("Microphone paused");
        };

        if (!shouldAutoRestartRef.current) {
            setListeningState("Tap Start Microphone to enable voice control.");
        }

        return () => {
            recognition.onend = null;
            shouldAutoRestartRef.current = false;
            updateAssistantActiveState(false);
            isHandlingCommandRef.current = false;
            recognitionRunningRef.current = false;
            recognitionStopExpectedRef.current = true;
            window.clearTimeout(recognitionRestartTimeoutRef.current);
            recognition.stop();
            hasMicPermissionRef.current = false;
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
        <div className='scene-shell px-4 py-5 sm:px-6 sm:py-6 lg:px-8'>
            <div className={`assistant-aura ${isAssistantSpeaking ? "assistant-aura-active" : ""}`} />

            <div className='relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6'>
                <header className='grid gap-5 xl:grid-cols-[1.18fr_0.82fr]'>
                    <section className='cinema-panel cinema-panel-strong p-5 sm:p-7'>
                        <div className='flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between'>
                            <div className='space-y-4'>
                                <p className='cinema-kicker'>Mission Control // Voice Deck</p>
                                <h1 className='cinema-heading max-w-3xl'>
                                    Meet <span className='text-cyan-300'>{assistantDisplayName}</span>, your cinematic assistant core.
                                </h1>
                                <p className='cinema-copy max-w-2xl'>
                                    Wake it by name, watch the chamber light up, and keep the conversation flowing like a real on-screen sidekick built just for you.
                                </p>
                            </div>

                            <button
                                className={`${isMicEnabled ? "holo-button" : "holo-button-secondary"} w-full text-sm sm:w-auto sm:min-w-[13rem] sm:text-base`}
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

                        <div className='mt-5 flex flex-wrap gap-3'>
                            <span className={`status-pill ${isMicEnabled ? "status-pill-cyan" : "status-pill-rose"}`}>
                                {isMicEnabled ? "Microphone armed" : "Microphone paused"}
                            </span>
                            <span className={`status-pill ${isAssistantActive ? "status-pill-blue" : "status-pill-amber"}`}>
                                {isAssistantActive ? "Assistant focused" : "Wake-word standby"}
                            </span>
                            <span className={`status-pill ${isAssistantSpeaking ? "status-pill-cyan" : "status-pill-blue"}`}>
                                {isAssistantSpeaking ? "Voice output live" : "Awaiting command"}
                            </span>
                        </div>
                    </section>

                    <aside className='grid gap-3 sm:grid-cols-2 xl:grid-cols-2'>
                        <button
                            className='holo-button-secondary text-sm sm:text-base'
                            onClick={() =>
                                navigate("/customize", {
                                    state: { allowAssistantCustomization: true },
                                })
                            }
                        >
                            Customize Assistant
                        </button>

                        <button
                            className='holo-button-warn text-sm sm:text-base'
                            onClick={handleNewSession}
                        >
                            New Session
                        </button>

                        <button
                            className='holo-button-secondary text-sm sm:text-base'
                            onClick={() => Logout()}
                        >
                            Log out
                        </button>

                        <button
                            disabled={deleteLoading}
                            className='holo-button-danger text-sm disabled:cursor-not-allowed disabled:opacity-70 sm:text-base'
                            onClick={handleDeleteAccount}
                        >
                            {deleteLoading ? "Deleting..." : "Delete Account"}
                        </button>
                    </aside>
                </header>

                <main className='grid gap-5 lg:grid-cols-[0.9fr_1.2fr_0.9fr] lg:items-start'>
                    <section className='order-2 flex flex-col gap-5 lg:order-1'>
                        <div className='cinema-panel cinema-panel-tilt p-5 sm:p-6'>
                            <p className='cinema-kicker'>Live Telemetry</p>
                            <div className='mt-4 space-y-3'>
                                <p className='rounded-[1.4rem] border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/88 sm:text-base'>
                                    {listeningState}
                                </p>
                                <div className='rounded-[1.4rem] border border-cyan-400/20 bg-cyan-400/10 px-4 py-4'>
                                    <p className='text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/70'>
                                        Heard
                                    </p>
                                    <p className='mt-2 text-base text-cyan-50 sm:text-lg'>
                                        {lastHeardText || "Waiting for your voice..."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className='cinema-panel cinema-panel-tilt p-5 sm:p-6'>
                            <p className='cinema-kicker'>Wake Protocol</p>
                            <div className='mt-4 space-y-3 text-sm text-white/72 sm:text-base'>
                                <p>Tap <span className='font-semibold text-white'>Start Microphone</span> once to arm voice control on mobile and desktop browsers.</p>
                                <p>Say <span className='font-semibold text-white'>{assistantDisplayName}</span> to activate the assistant.</p>
                                <p>When it wakes, it replies: <span className='font-semibold text-cyan-100'>{ACTIVATION_RESPONSE}</span></p>
                                <p>Say <span className='font-semibold text-white'>stop listening</span> to drop back into standby mode.</p>
                            </div>
                        </div>
                    </section>

                    <section className='order-1 lg:order-2'>
                        <div className='assistant-stage px-5 py-8 sm:px-7 sm:py-10'>
                            <div className='assistant-orbit' />
                            <div className='assistant-orbit-secondary' />
                            <div className='assistant-orbit-tertiary' />

                            <div className={`assistant-portrait ${isAssistantSpeaking ? "assistant-portrait-active" : ""}`}>
                                {assistantImage ? (
                                    <img src={assistantImage} alt={assistantDisplayName} />
                                ) : (
                                    <div className='flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.16),_transparent_44%),linear-gradient(180deg,_rgba(10,18,34,0.96),_rgba(4,8,18,0.92))] p-8 text-center'>
                                        <span className='text-xl font-semibold text-white/80'>No assistant image yet</span>
                                    </div>
                                )}
                            </div>

                            <div className='relative z-10 mx-auto mt-6 max-w-2xl text-center'>
                                <p className='cinema-kicker justify-center'>Assistant Core</p>
                                <h2 className='mt-4 text-3xl font-semibold text-white sm:text-4xl lg:text-5xl'>
                                    {assistantDisplayName}
                                </h2>
                                <p className='mx-auto mt-4 max-w-2xl text-sm text-white/80 sm:text-base lg:text-lg'>
                                    {assistantReply || "Say the assistant name once to activate it, then ask anything you want."}
                                </p>
                            </div>

                            <div className='floating-glow' />
                        </div>
                    </section>

                    <section className='order-3 flex flex-col gap-5'>
                        <div className='cinema-panel cinema-panel-tilt p-5 sm:p-6'>
                            <p className='cinema-kicker'>Reply Channel</p>
                            <p className='mt-4 text-2xl font-semibold text-white sm:text-3xl'>
                                {assistantReply ? "Response delivered" : "Ready for the next line"}
                            </p>
                            <p className='mt-3 text-sm text-white/72 sm:text-base'>
                                {assistantReply || "The chamber stays on standby until you speak the wake-word or trigger a command."}
                            </p>
                        </div>

                        <div className='cinema-panel cinema-panel-tilt p-5 sm:p-6'>
                            <p className='cinema-kicker'>Scene Notes</p>
                            <div className='mt-4 grid gap-3'>
                                <div className='rounded-[1.3rem] border border-white/10 bg-black/25 px-4 py-4'>
                                    <p className='text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70'>Session Memory</p>
                                    <p className='mt-2 text-base text-white'>A fresh session keeps the conversation sharp and cinematic.</p>
                                </div>
                                <div className='rounded-[1.3rem] border border-white/10 bg-black/25 px-4 py-4'>
                                    <p className='text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70'>Popup Actions</p>
                                    <p className='mt-2 text-base text-white'>Allow popups if you want the assistant to open search, maps, or media actions in new tabs.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    )
}

export default Home
