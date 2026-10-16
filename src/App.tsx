import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  Square, 
  BookOpen, 
  GraduationCap, 
  MessageSquare, 
  Globe, 
  Search, 
  User, 
  Sparkles, 
  ChevronRight, 
  Play, 
  ArrowUpRight, 
  CheckCircle,
  Settings,
  HelpCircle,
  Volume1,
  RotateCcw,
  Smartphone,
  Sun,
  Moon,
  Share2,
  Copy,
  Check,
  WifiOff
} from "lucide-react";
import { ChatMessage, PresetVerse, Lesson, LessonItem, Proverb, GlossaryItem } from "./types";

function float32ToInt16PCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export default function App() {
  // Theme state & options
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(typeof window !== "undefined" ? window.navigator.onLine : true);
  const APP_VERSION = "v4.5.1 (Live Option)";

  // Application Modes
  const [activeTab, setActiveTab] = useState<"chat" | "tutor" | "bible" | "live">("chat");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore"); // Kore (female), Zephyr (male)
  const [autoPlayback, setAutoPlayback] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(0.85); // Speed multiplier 0.5x to 2.0x

  // Database / Preset State
  const [presetVerses, setPresetVerses] = useState<PresetVerse[]>([]);
  const [presetLessons, setPresetLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [dailyProverb, setDailyProverb] = useState<Proverb | null>(null);
  const [proverbLoading, setProverbLoading] = useState<boolean>(false);
  const [proverbTtsLoading, setProverbTtsLoading] = useState<boolean>(false);

  // Ezza Glossary State
  const [glossaryList, setGlossaryList] = useState<GlossaryItem[]>([]);
  const [glossarySearchQuery, setGlossarySearchQuery] = useState<string>("");
  const [glossaryFilterCategory, setGlossaryFilterCategory] = useState<string>("All");
  const [glossaryLoading, setGlossaryLoading] = useState<boolean>(false);

  // Interactive Ezza Vocabulary Quiz State
  const [quizTab, setQuizTab] = useState<"browse" | "quiz">("browse");
  const [quizCurrentQuestion, setQuizCurrentQuestion] = useState<GlossaryItem | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizAnswerType, setQuizAnswerType] = useState<"ezza-to-english" | "english-to-ezza">("ezza-to-english");
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState<string | null>(null);
  const [quizIsCorrect, setQuizIsCorrect] = useState<boolean | null>(null);
  const [quizScoreboard, setQuizScoreboard] = useState<{
    solved: number;
    correct: number;
    streak: number;
    maxStreak: number;
  }>(() => {
    try {
      const stored = localStorage.getItem("ezza_quiz_scoreboard");
      return stored ? JSON.parse(stored) : { solved: 0, correct: 0, streak: 0, maxStreak: 0 };
    } catch {
      return { solved: 0, correct: 0, streak: 0, maxStreak: 0 };
    }
  });

  // Recently Practiced List State
  const [recentlyPracticed, setRecentlyPracticed] = useState<GlossaryItem[]>(() => {
    try {
      const stored = localStorage.getItem("ezza_recently_practiced");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addToRecentlyPracticed = (item: GlossaryItem) => {
    setRecentlyPracticed((prev) => {
      const filtered = prev.filter((x) => x.id !== item.id);
      return [item, ...filtered].slice(0, 6);
    });
  };

  // Synchronize recently practiced to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ezza_recently_practiced", JSON.stringify(recentlyPracticed));
    } catch (e) {
      console.warn("Could not save recently practiced to localStorage", e);
    }
  }, [recentlyPracticed]);

  // Sharing Tool State
  const [sharingContent, setSharingContent] = useState<{
    title: string;
    text: string;
    url: string;
    category?: string;
  } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Interactive Assistant Chat Log
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDur, setRecordingDur] = useState<number>(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Output State
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [playbackNode, setPlaybackNode] = useState<AudioBufferSourceNode | null>(null);
  const [playbackCtx, setPlaybackCtx] = useState<AudioContext | null>(null);

  // Live Voice Mode State
  const [liveWs, setLiveWs] = useState<WebSocket | null>(null);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [showMobileSetup, setShowMobileSetup] = useState<boolean>(false);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const liveInputCtxRef = useRef<AudioContext | null>(null);
  const liveOutputCtxRef = useRef<AudioContext | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveNextPlayTimeRef = useRef<number>(0);

  const cleanupLiveVoiceResources = () => {
    if (liveProcessorRef.current) {
      try {
        liveProcessorRef.current.disconnect();
      } catch (e) {}
      liveProcessorRef.current = null;
    }
    if (liveStreamRef.current) {
      try {
        liveStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      liveStreamRef.current = null;
    }
    if (liveInputCtxRef.current) {
      try {
        liveInputCtxRef.current.close();
      } catch (e) {}
      liveInputCtxRef.current = null;
    }
    if (liveOutputCtxRef.current) {
      try {
        liveOutputCtxRef.current.close();
      } catch (e) {}
      liveOutputCtxRef.current = null;
    }
  };

  const stopLiveVoiceStream = () => {
    if (liveWs) {
      try {
        liveWs.close();
      } catch (e) {}
    }
    cleanupLiveVoiceResources();
    setIsLiveActive(false);
    setLiveWs(null);
  };

  const playLivePCMChunk = (base64Str: string) => {
    const ctx = liveOutputCtxRef.current;
    if (!ctx) return;

    try {
      const binaryString = atob(base64Str);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const dataView = new DataView(bytes.buffer);
      const numSamples = bytes.length / 2;
      const floatData = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const intSample = dataView.getInt16(i * 2, true);
        floatData[i] = intSample / 32768.0;
      }

      const buffer = ctx.createBuffer(1, numSamples, 24000);
      buffer.getChannelData(0).set(floatData);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      let startTime = liveNextPlayTimeRef.current;

      if (startTime < currentTime) {
        startTime = currentTime + 0.05;
      }

      source.start(startTime);
      liveNextPlayTimeRef.current = startTime + buffer.duration;

    } catch (err) {
      console.error("PCM realtime chunk play failed", err);
    }
  };

  const clearLiveAudioTimeline = () => {
    liveNextPlayTimeRef.current = 0;
  };

  const startLiveVoiceStream = async () => {
    stopCurrentPlayback();
    setLiveLog(prev => [...prev, "Initializing Live connection..."]);
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/api/live-voice`;
      const ws = new WebSocket(url);
      
      ws.onopen = async () => {
        setLiveLog(prev => [...prev, "Connected to Live proxy server! Ready to converse..."]);
        setIsLiveActive(true);
        liveNextPlayTimeRef.current = 0;

        try {
          const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          
          liveInputCtxRef.current = inputCtx;
          liveOutputCtxRef.current = outputCtx;

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          liveStreamRef.current = stream;

          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(2048, 1, 1);
          
          source.connect(processor);
          processor.connect(inputCtx.destination);
          liveProcessorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const inputChannel = e.inputBuffer.getChannelData(0);
              const buffer = float32ToInt16PCM(inputChannel);
              const b64 = arrayBufferToBase64(buffer);
              ws.send(JSON.stringify({ audio: b64 }));
            }
          };
        } catch (mediaErr: any) {
          console.error("Failed to set up real-time mic streaming:", mediaErr);
          setLiveLog(prev => [...prev, `🎤 Microphones failed: ${mediaErr.message || mediaErr}`]);
          ws.close();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setLiveLog(prev => [...prev, `⚠️ Error: ${msg.error}`]);
          }
          if (msg.audio) {
            playLivePCMChunk(msg.audio);
          }
          if (msg.interrupted) {
            setLiveLog(prev => [...prev, "⚡ Interrupted (AI was talking but paused for you)"]);
            clearLiveAudioTimeline();
          }
        } catch (e) {
          console.error("Error reading socket frames:", e);
        }
      };

      ws.onclose = () => {
        setLiveLog(prev => [...prev, "Session ended."]);
        setIsLiveActive(false);
        setLiveWs(null);
        cleanupLiveVoiceResources();
      };

      setLiveWs(ws);
    } catch (wsErr: any) {
      console.error("WebSocket setup failed:", wsErr);
      setLiveLog(prev => [...prev, `Connection failed: ${wsErr.message || wsErr}`]);
    }
  };

  // Pronunciation Rehearsal Target (from Language Tutor Academy)
  const [practiceWord, setPracticeWord] = useState<LessonItem | null>(null);
  const [wordTtsLoading, setWordTtsLoading] = useState<string | null>(null);

  // Bible search term
  const [bibleSearchQuery, setBibleSearchQuery] = useState<string>("");

  // Load Presets on Mount
  useEffect(() => {
    fetchPresets();
    fetchDailyProverb(false);
    fetchGlossary();
    // Welcome message from Ezza AI
    const welcomeId = "welcome-msg";
    setChatLog([
      {
        id: welcomeId,
        sender: "ai",
        mode: "chat",
        spokenEzza: "Ẹka bẹka! Ọbu iwhẹ ọma tẹ l'ayi dụ whọ ta bẹta. Mu bụ Ezza AI.",
        phonetics: "Eh-ka beh-ka! Oh-boo ee-weh oh-mah teh lah-yee doo who tah beh-tah. Moo boo Ezza AI.",
        englishTranslation: "Welcome! It is a beautiful thing that we are gathered here. I am Ezza AI.",
        lessonNotes: "This is a classical greeting in Ebonyi State Ezza clans, conveying deep honor to the listener.",
        timestamp: new Date()
      }
    ]);
  }, []);

  // Monitor network connectivity in real-time
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync Timer for Mic Record
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupLiveVoiceResources();
    };
  }, []);

  const fetchPresets = async () => {
    try {
      const vRes = await fetch("/api/preset/verses");
      const vData = await vRes.json();
      setPresetVerses(vData);

      const lRes = await fetch("/api/preset/lessons");
      const lData = await lRes.json();
      setPresetLessons(lData);
      if (lData.length > 0) {
        setSelectedLesson(lData[0]);
      }
    } catch (err) {
      console.error("Preservation fetch fail", err);
    }
  };

  const fetchDailyProverb = async (forceRandom = false) => {
    setProverbLoading(true);
    try {
      const url = `/api/daily-proverb${forceRandom ? "?random=true" : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setDailyProverb(data);
    } catch (err) {
      console.error("Failed to fetch daily proverb:", err);
    } finally {
      setProverbLoading(false);
    }
  };

  const speakProverb = async (text: string) => {
    if (proverbTtsLoading) return;
    setProverbTtsLoading(true);
    try {
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: selectedVoice }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        playPCMBase64(data.audioBase64, `proverb-${text}`);
      } else if (data.quotaExceeded) {
        console.warn("TTS limit exceeded. Falling back to local SpeechSynthesis.");
        playWebSpeechSynthesis(text);
      } else {
        playWebSpeechSynthesis(text);
      }
    } catch (err) {
      console.error("Proverb TTS error", err);
      playWebSpeechSynthesis(text);
    } finally {
      setProverbTtsLoading(false);
    }
  };

  const fetchGlossary = async () => {
    setGlossaryLoading(true);
    try {
      const res = await fetch("/api/glossary");
      const data = await res.json();
      setGlossaryList(data);
      generateNewQuizQuestion(data);
    } catch (err) {
      console.error("Failed to fetch glossary items:", err);
    } finally {
      setGlossaryLoading(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem("ezza_quiz_scoreboard", JSON.stringify(quizScoreboard));
    } catch (e) {
      console.warn("Could not save stats to localStorage", e);
    }
  }, [quizScoreboard]);

  const generateNewQuizQuestion = (customList: GlossaryItem[] = []) => {
    const listToUse = customList.length > 0 ? customList : glossaryList;
    if (listToUse.length === 0) return;

    const randomIndex = Math.floor(Math.random() * listToUse.length);
    const questionItem = listToUse[randomIndex];
    setQuizCurrentQuestion(questionItem);

    const type = Math.random() > 0.5 ? "ezza-to-english" : "english-to-ezza";
    setQuizAnswerType(type);

    const correctAnswer = type === "ezza-to-english" ? questionItem.englishTranslation : questionItem.word;

    const optionsSet = new Set<string>();
    optionsSet.add(correctAnswer);

    const maxAttempts = 100;
    let attempts = 0;
    while (optionsSet.size < Math.min(4, listToUse.length) && attempts < maxAttempts) {
      attempts++;
      const distractorIndex = Math.floor(Math.random() * listToUse.length);
      const distractorItem = listToUse[distractorIndex];
      const distractorValue = type === "ezza-to-english" ? distractorItem.englishTranslation : distractorItem.word;
      if (distractorValue && distractorValue.trim() !== "") {
        optionsSet.add(distractorValue);
      }
    }

    const shuffledOptions = Array.from(optionsSet).sort(() => Math.random() - 0.5);
    setQuizOptions(shuffledOptions);
    setQuizSelectedAnswer(null);
    setQuizIsCorrect(null);
  };

  const handleAnswerSubmit = (selectedOption: string) => {
    if (!quizCurrentQuestion || quizSelectedAnswer) return;
    addToRecentlyPracticed(quizCurrentQuestion);
    setQuizSelectedAnswer(selectedOption);

    const correctAnswer = quizAnswerType === "ezza-to-english" 
      ? quizCurrentQuestion.englishTranslation 
      : quizCurrentQuestion.word;

    const correct = selectedOption === correctAnswer;
    setQuizIsCorrect(correct);

    setQuizScoreboard((prev) => {
      const nextStreak = correct ? prev.streak + 1 : 0;
      return {
        solved: prev.solved + 1,
        correct: prev.correct + (correct ? 1 : 0),
        streak: nextStreak,
        maxStreak: Math.max(prev.maxStreak, nextStreak),
      };
    });
  };

  const resetQuizScoreboard = () => {
    setQuizScoreboard({
      solved: 0,
      correct: 0,
      streak: 0,
      maxStreak: 0,
    });
  };

  const speakGlossaryWord = async (item: GlossaryItem) => {
    addToRecentlyPracticed(item);
    if (currentlyPlayingId === item.id) {
      stopCurrentPlayback();
      return;
    }
    setCurrentlyPlayingId(`loading-${item.id}`);
    try {
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.word, voiceName: selectedVoice }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        playPCMBase64(data.audioBase64, item.id);
      } else {
        if (data.quotaExceeded) {
          console.warn("TTS limit exceeded. Falling back to local SpeechSynthesis.");
          playWebSpeechSynthesis(item.word);
        } else {
          playWebSpeechSynthesis(item.word);
        }
        setCurrentlyPlayingId(null);
      }
    } catch (err) {
      console.error("Glossary word TTS error:", err);
      playWebSpeechSynthesis(item.word);
      setCurrentlyPlayingId(null);
    }
  };

  const handleShareProverb = (proverb: Proverb) => {
    const text = `💡 Daily Ezza Wisdom (Ilu) on Ezza Companion:\n\n"${proverb.ezza}"\n\nPhonetics: /${proverb.phonetics}/\nTranslation: ${proverb.englishTranslation}\n\nAncestral Significance: ${proverb.culturalSignificance}\n\nExplore Ezza language and wisdom!`;
    setSharingContent({
      title: "Daily Ezza Wisdom",
      text,
      url: window.location.href,
      category: proverb.category
    });
  };

  const handleShareGlossary = (item: GlossaryItem) => {
    const text = `📚 Ezza Language (Ọbá Okwu) glossary on Ezza Companion:\n\nWord: ${item.word}\nPhonetics: /${item.phonetics}/\nMeaning: ${item.englishTranslation}\n\nDefinition: ${item.definition}\n\nDiscover the rich heritage of Ebonyi/Benue clans!`;
    setSharingContent({
      title: "Ezza Glossary Insight",
      text,
      url: window.location.href,
      category: item.category
    });
  };

  const handleCopyToClipboard = () => {
    if (!sharingContent) return;
    navigator.clipboard.writeText(`${sharingContent.text}\n\nLink: ${sharingContent.url}`);
    setCopiedNotification(true);
    setTimeout(() => {
      setCopiedNotification(false);
    }, 2000);
  };

  const handleSystemShare = async () => {
    if (!sharingContent) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: sharingContent.title,
          text: sharingContent.text,
          url: sharingContent.url,
        });
      } catch (err) {
        console.error("System share failed:", err);
      }
    } else {
      handleCopyToClipboard();
    }
  };

  const playWebSpeechSynthesis = (text: string) => {
    stopCurrentPlayback();
    if (!window.speechSynthesis) {
      console.warn("Speech synthesis not supported in this browser");
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    // Prioritize Igbo (ig or ig-NG) voices, fallback to standard clean English voices
    let voiceToUse = voices.find(v => v.lang.toLowerCase().startsWith("ig"));
    if (!voiceToUse) {
      voiceToUse = voices.find(v => v.lang.toLowerCase().startsWith("en-gb")) ||
                   voices.find(v => v.lang.toLowerCase().startsWith("en-us")) ||
                   voices.find(v => v.lang.toLowerCase().startsWith("en")) ||
                   voices[0];
    }

    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }
    utterance.rate = playbackRate;
    utterance.volume = 1.0;

    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  // Convert raw 16-bit PCM buffer to Float32 and play
  const playPCMBase64 = (base64Str: string, messageId: string) => {
    stopCurrentPlayback();

    try {
      const binaryString = atob(base64Str);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const dataView = new DataView(bytes.buffer);
      const numSamples = bytes.length / 2;
      const floatData = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const intSample = dataView.getInt16(i * 2, true);
        floatData[i] = intSample / 32768.0;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = audioCtx.createBuffer(1, numSamples, 24000); // 24kHz output of Gemini tts
      buffer.getChannelData(0).set(floatData);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      source.connect(audioCtx.destination);

      source.onended = () => {
        setCurrentlyPlayingId(null);
        setPlaybackNode(null);
      };

      source.start(0);
      setCurrentlyPlayingId(messageId);
      setPlaybackNode(source);
      setPlaybackCtx(audioCtx);
    } catch (err) {
      console.error("PCM synthesis failed", err);
    }
  };

  const stopCurrentPlayback = () => {
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // Safe skip
      }
    }
    if (playbackNode) {
      try {
        playbackNode.stop();
      } catch (e) {
        // Safe skip
      }
      setPlaybackNode(null);
    }
    if (playbackCtx) {
      try {
        playbackCtx.close();
      } catch (e) {
        // Safe skip
      }
      setPlaybackCtx(null);
    }
    setCurrentlyPlayingId(null);
  };

  const togglePlayback = (msg: ChatMessage) => {
    if (currentlyPlayingId === msg.id) {
      stopCurrentPlayback();
    } else if (msg.audioBase64) {
      playPCMBase64(msg.audioBase64, msg.id);
    } else {
      // Re-trigger TTS from server if we don't have it
      requestStandaloneTts(msg.spokenEzza || "", msg.id);
    }
  };

  const requestStandaloneTts = async (text: string, id: string) => {
    setCurrentlyPlayingId(`loading-${id}`);
    try {
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: selectedVoice }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        // Update chat list if it matches a message so it's cached
        setChatLog(prev => prev.map(m => m.id === id ? { ...m, audioBase64: data.audioBase64 } : m));
        playPCMBase64(data.audioBase64, id);
      } else {
        if (data.quotaExceeded) {
          console.warn("TTS limit exceeded. Falling back to local SpeechSynthesis.");
          playWebSpeechSynthesis(text);
        } else {
          playWebSpeechSynthesis(text);
        }
        setCurrentlyPlayingId(null);
      }
    } catch (err) {
      console.error("TTS generation err", err);
      playWebSpeechSynthesis(text);
      setCurrentlyPlayingId(null);
    }
  };

  const speakPresetTerm = async (item: LessonItem) => {
    if (wordTtsLoading) return;
    setWordTtsLoading(item.ezza);
    try {
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.ezza, voiceName: selectedVoice }),
      });
      const data = await res.json();
      if (data.audioBase64) {
        playPCMBase64(data.audioBase64, `word-${item.ezza}`);
      } else {
        if (data.quotaExceeded) {
          console.warn("TTS limit exceeded. Falling back to local SpeechSynthesis.");
          playWebSpeechSynthesis(item.ezza);
        } else {
          playWebSpeechSynthesis(item.ezza);
        }
      }
    } catch (err) {
      console.error("Preset TTS error", err);
      playWebSpeechSynthesis(item.ezza);
    } finally {
      setWordTtsLoading(null);
    }
  };

  // Recording triggers
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ""; // rely on system default
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          const cleanBase64 = base64Data.split(",")[1];
          const finalMime = mimeType || "audio/webm";
          // Submit recorded vocal file directly
          submitChatFlow(null, cleanBase64, finalMime);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDur(0);
      timerRef.current = setInterval(() => {
        setRecordingDur(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic record permission or init failed", err);
      alert("Could not start microphone. Ensure frame permissions allow microphone.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Submit flow (can be text, voice, or custom preset trigger)
  const submitChatFlow = async (textOverride: string | null, voiceBase64: string | null = null, voiceMime: string | null = null) => {
    const finalMsgText = textOverride !== null ? textOverride : inputText;
    // Clear unless it's a voice chunk submission
    if (textOverride === null && !voiceBase64) {
      setInputText("");
    }

    if (!finalMsgText && !voiceBase64) return;

    stopCurrentPlayback();
    setIsAiLoading(true);

    const userMessageId = `user-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMessageId,
      sender: "user",
      text: voiceBase64 ? "🎙️ [Vocal Spoken Input]" : finalMsgText || "",
      timestamp: new Date()
    };
    setChatLog(prev => [...prev, newMsg]);

    try {
      const chatArgs = {
        message: finalMsgText || "Ezza language guidance and practice",
        mode: activeTab,
        voiceName: selectedVoice,
        audioData: voiceBase64,
        audioMime: voiceMime
      };

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatArgs),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed communication with Ezza AI");
      }

      const aiMessageId = `ai-${Date.now()}`;
      const aiResponse: ChatMessage = {
        id: aiMessageId,
        sender: "ai",
        mode: activeTab,
        transcription: data.transcription,
        voiceFeedback: data.voiceFeedback,
        spokenEzza: data.spokenEzza,
        phonetics: data.phonetics,
        englishTranslation: data.englishTranslation,
        lessonNotes: data.lessonNotes,
        audioBase64: data.audioBase64,
        timestamp: new Date()
      };

      setChatLog(prev => [...prev, aiResponse]);

      // If autoplay is configured and audio exists, play instantly
      if (autoPlayback) {
        if (data.audioBase64) {
          playPCMBase64(data.audioBase64, aiMessageId);
        } else if (data.audioQuotaExceeded || data.spokenEzza) {
          console.warn("Autoplay TTS limit exceeded. Falling back to local SpeechSynthesis.");
          playWebSpeechSynthesis(data.spokenEzza);
        }
      }

      // If we are currently practicing in tutoring arena, populate speech feedback card
      if (activeTab === "tutor" && data.voiceFeedback && practiceWord) {
        // Highlight correct response or guide user. Keep target active.
      }
    } catch (err: any) {
      console.error(err);
      setChatLog(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          spokenEzza: "Ekwhẹru mbọkọ t'ẹgudebe tọ.",
          englishTranslation: "Error occurred while contacting Ezza AI.",
          lessonNotes: err.message || "Please make sure your GEMINI_API_KEY is configured under Settings.",
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Look up scripture dynamically
  const handleScriptureSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bibleSearchQuery.trim()) return;
    submitChatFlow(`Please give me the Ezza translation and cultural depth for Scripture: ${bibleSearchQuery}`);
    setBibleSearchQuery("");
  };

  const triggerPresetScripture = (verse: PresetVerse) => {
    // Add custom message reflecting selection
    stopCurrentPlayback();
    setChatLog(prev => [...prev, {
      id: `ref-${Date.now()}`,
      sender: "user",
      text: `📖 Looked up: ${verse.ref}`,
      timestamp: new Date()
    }]);

    const inlineAiId = `ai-v-${Date.now()}`;
    // Fetch TTS for preset instantly
    requestStandaloneTts(verse.spokenEzza, inlineAiId);

    setChatLog(prev => [...prev, {
      id: inlineAiId,
      sender: "ai",
      mode: "bible",
      spokenEzza: verse.spokenEzza,
      phonetics: verse.phonetics,
      englishTranslation: verse.englishTranslation,
      lessonNotes: verse.lessonNotes,
      timestamp: new Date()
    }]);
  };

  const handleLessonItemSelect = (item: LessonItem) => {
    setPracticeWord(item);
    speakPresetTerm(item);
  };

  const glossaryCategories = ["All", ...Array.from(new Set(glossaryList.map(item => item.category)))];

  const filteredGlossary = glossaryList.filter(item => {
    const matchesSearch = glossarySearchQuery.trim() === "" ||
      item.word.toLowerCase().includes(glossarySearchQuery.toLowerCase()) ||
      item.englishTranslation.toLowerCase().includes(glossarySearchQuery.toLowerCase()) ||
      item.definition.toLowerCase().includes(glossarySearchQuery.toLowerCase());
    
    const matchesCategory = glossaryFilterCategory === "All" || item.category === glossaryFilterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 relative overflow-hidden selection:bg-[#D4AF37] selection:text-black ${
      isDarkMode 
        ? "bg-[#0F0D0B] text-[#E8E2D9]" 
        : "bg-[#FAF7F2] text-[#2C2723]"
    }`}>
      
      {/* Background Atmospheric Elements */}
      <div className={`absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#D4AF37] ${isDarkMode ? 'opacity-10' : 'opacity-[0.05]'} rounded-full blur-[100px] pointer-events-none`}></div>
      <div className={`absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#4A5D23] ${isDarkMode ? 'opacity-10' : 'opacity-[0.05]'} rounded-full blur-[120px] pointer-events-none`}></div>
      <div className="texture-overlay" style={{ opacity: isDarkMode ? 0.035 : 0.012 }}></div>

      {/* Dynamic Top Navigation / Status Bar */}
      <header className={`border-b transition-colors duration-300 ${isDarkMode ? "border-white/[0.06] bg-[#0F0D0B]/60" : "border-black/[0.06] bg-[#FAF7F2]/60"} backdrop-blur-md sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 border-2 ${isDarkMode ? 'border-[#D4AF37]' : 'border-[#4A5D23]'} rounded-full flex items-center justify-center relative overflow-hidden bg-black/40`}>
              <div className="w-5 h-5 bg-[#D4AF37] rounded-full animate-pulse"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-serif text-2xl font-bold tracking-wider uppercase transition-colors ${isDarkMode ? 'text-[#E8E2D9]' : 'text-gray-900'}`}>Ẹzza AI</span>
                <span className={`text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                  isDarkMode 
                    ? "bg-[#4A5D23] text-[#D4AF37] border-[#D4AF37]/20" 
                    : "bg-[#D4AF37]/20 text-[#4A5D23] border-[#4A5D23]/20"
                }`}>
                  {APP_VERSION}
                </span>
                {!isOnline && (
                  <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold animate-pulse">
                    <WifiOff className="w-2.5 h-2.5" />
                    Offline Cache Active
                  </span>
                )}
              </div>
              <p className={`text-[10px] font-sans tracking-wide transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Language Tutor, Culture &amp; Bible Companion</p>
            </div>
          </div>

          {/* Quick Voice Settings Panel */}
          <div className={`flex flex-wrap items-center gap-4 border backdrop-blur-md px-4 py-2 rounded-full text-xs transition-all ${
            isDarkMode 
              ? 'bg-white/[0.03] border-white/[0.08]' 
              : 'bg-black/[0.02] border-black/[0.12]'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>Voice:</span>
              <select 
                value={selectedVoice} 
                onChange={(e) => {
                  setSelectedVoice(e.target.value);
                  stopCurrentPlayback();
                }}
                className={`bg-transparent font-serif font-bold border-none rounded-full px-3 py-1 focus:outline-none cursor-pointer appearance-none hover:bg-white/5 transition-colors ${
                  isDarkMode 
                    ? 'text-[#D4AF37] [color-scheme:dark]' 
                    : 'text-[#4A5D23] [color-scheme:light]'
                }`}
              >
                <option value="Kore">Kore (Vibrant Female)</option>
                <option value="Puck">Puck (Gentle Female)</option>
                <option value="Zephyr">Zephyr (Calm Male)</option>
                <option value="Charon">Charon (Deep Male)</option>
              </select>
            </div>
            
            <div className={`h-4 w-[1px] ${isDarkMode ? 'bg-white/[0.08]' : 'bg-black/[0.12]'}`} />

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={autoPlayback}
                onChange={(e) => setAutoPlayback(e.target.checked)}
                className="accent-[#D4AF37] rounded border-white/20 bg-black cursor-pointer w-3.5 h-3.5"
              />
              <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-[11px] tracking-wide transition-colors`}>Autoplay Reply</span>
            </label>

            <div className={`h-4 w-[1px] ${isDarkMode ? 'bg-white/[0.08]' : 'bg-black/[0.12]'}`} />

            {/* Playback speed slider */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-[11px] tracking-wide transition-colors`}>
                Speed: <span className={`font-mono font-bold ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>{playbackRate.toFixed(2)}x</span>
              </span>
              <input 
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={playbackRate}
                onChange={(e) => {
                  setPlaybackRate(parseFloat(e.target.value));
                }}
                className={`w-14 sm:w-16 md:w-20 cursor-pointer h-1 rounded-lg accent-[#D4AF37] bg-black/10 dark:bg-white/10`}
                title="Slow down or speed up voice synthesis playback"
              />
            </div>

            <div className={`h-4 w-[1px] ${isDarkMode ? 'bg-white/[0.08]' : 'bg-black/[0.12]'}`} />

            {/* Dark & Light Theme selection option switch */}
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-1 rounded-full hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1 font-semibold ${
                isDarkMode 
                  ? 'text-gray-300 hover:text-amber-400 hover:bg-white/5' 
                  : 'text-gray-700 hover:text-[#4A5D23] hover:bg-black/5'
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] uppercase font-mono tracking-wider">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-800" />
                  <span className="text-[10px] uppercase font-mono tracking-wider">Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main split work-desk */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
        
        {/* Left column: Central dialogue & vocal stream */}
        <div className={`lg:col-span-7 flex flex-col backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden relative min-h-[550px] border transition-all ${
          isDarkMode 
            ? 'bg-white/[0.03] border-white/[0.08]' 
            : 'bg-white border-black/[0.12] shadow-md shadow-black/[0.02]/5'
        }`}>
          
          {/* Dynamic Mode Bar Indicator (Gold Lines & Labels) */}
          <div className={`py-4 flex items-center justify-center space-x-3 border-b transition-colors ${
            isDarkMode ? 'bg-white/[0.01] border-white/[0.06]' : 'bg-black/[0.01] border-black/[0.06]'
          }`}>
            <span className="h-[1px] w-6 bg-[#D4AF37]/50"></span>
            <span className="text-[#D4AF37] uppercase tracking-[0.25em] text-[11px] font-bold italic">
              {activeTab === "chat" ? "Natural Conversation Mode" : activeTab === "tutor" ? "Language Academy Arena" : "Ezza Scripture companion"}
            </span>
            <span className="h-[1px] w-6 bg-[#D4AF37]/50"></span>
          </div>

          {/* Dialog Container */}
          <div id="dialog-panel" className="flex-1 overflow-y-auto p-5 space-y-5 max-h-[500px]">
            {chatLog.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Globe className={`w-12 h-12 mb-3 transition-colors ${isDarkMode ? 'text-[#D4AF37]/20' : 'text-[#4A5D23]/30'}`} />
                <h3 className={`font-serif text-lg font-bold transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>Converse in the Ezza Dialect</h3>
                <p className={`text-xs max-w-md mt-1 leading-relaxed transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Type a greeting, look up a Bible chapter or use the microphone to practice speaking natively with the Ebonyi/Benue clan Ezza pronunciation.
                </p>
              </div>
            ) : (
              chatLog.map((message) => {
                const isAi = message.sender === "ai";
                return (
                  <div 
                    key={message.id} 
                    className={`flex ${isAi ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[90%] rounded-2xl py-3.5 px-4.5 border transition-colors ${
                      isAi 
                        ? (isDarkMode ? "bg-[#141210]/95 border-white/[0.06] rounded-tl-none shadow-xl" : "bg-[#FAF7F2] border-black/[0.1] rounded-tl-none shadow-md")
                        : (isDarkMode ? "bg-[#25201A] border-[#D4AF37]/30 rounded-tr-none text-[#E8E2D9]" : "bg-[#E3DDD1] border-[#4A5D23]/40 rounded-tr-none text-gray-900")
                    }`}>
                      {/* Sender details and time */}
                      <div className={`flex items-center gap-2 text-[9px] uppercase tracking-widest mb-2 transition-colors ${isDarkMode ? 'text-[#E8E2D9]/40' : 'text-gray-500'}`}>
                        <span className={isAi ? "text-[#D4AF37] font-bold" : "text-[#D4AF37]/80"}>
                          {isAi ? "Ẹzza AI" : "You (Spoken / Text)"}
                        </span>
                        <span>•</span>
                        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {/* Literal Text block */}
                      {message.text && (
                        <p className={`text-sm font-sans mb-2.5 whitespace-pre-wrap leading-relaxed transition-colors ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{message.text}</p>
                      )}

                      {/* AI Structured Presentation in premium design */}
                      {isAi && (message.spokenEzza || message.englishTranslation) && (
                        <div className="space-y-3.5">
                          {/* Beautiful Spoken Ezza Display Box */}
                          {message.spokenEzza && (
                            <div className={`p-3.5 rounded-xl relative transition-all shadow-inner border lg:max-w-xl ${
                              isDarkMode ? 'bg-[#0F0D0B] border-white/[0.06]' : 'bg-[#EADECC]/70 border-black/[0.06]'
                            }`}>
                              <span className={`text-[9px] uppercase tracking-widest block mb-1.5 font-mono ${isDarkMode ? 'text-[#D4AF37]/50' : 'text-[#4A5D23]/70'}`}>🔊 Spoken Ezza Dialect</span>
                              
                              <p className={`font-serif text-[17px] pr-12 font-bold leading-relaxed italic transition-colors ${
                                isDarkMode ? 'text-[#E8E2D9]' : 'text-gray-900'
                              }`}>
                                "{message.spokenEzza}"
                              </p>
                              
                              {/* Syllable guide */}
                              {message.phonetics && (
                                <p className={`text-[11px] font-mono mt-2 italic p-1 px-2.5 rounded-full inline-block border transition-colors ${
                                  isDarkMode 
                                    ? 'bg-white/[0.04] border-white/[0.05] text-[#D4AF37]/80' 
                                    : 'bg-black/[0.04] border-black/[0.05] text-[#4A5D23]'
                                }`}>
                                  /{message.phonetics}/
                                </p>
                              )}

                              {/* Glowing/pulsative Play Button */}
                              <button
                                onClick={() => togglePlayback(message)}
                                className={`absolute right-3 top-3.5 w-9 h-9 rounded-full ${
                                  currentlyPlayingId === message.id 
                                    ? "bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
                                    : (isDarkMode ? "bg-white/[0.05] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border border-[#D4AF37]/20" : "bg-[#4A5D23]/10 hover:bg-[#4A5D23] hover:text-white text-[#4A5D23] border border-[#4A5D23]/25")
                                } flex items-center justify-center transition-all`}
                                title="Play Voice Audio"
                              >
                                {currentlyPlayingId === message.id ? (
                                  <VolumeX className="w-4 h-4" />
                                ) : currentlyPlayingId === `loading-${message.id}` ? (
                                  <div className="w-4 h-4 border-2 border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                                ) : (
                                  <Volume2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          )}

                          {/* Speech critiquing container */}
                          {message.voiceFeedback && (
                            <div className={`p-3 rounded-xl text-xs border transition-all ${
                              isDarkMode 
                                ? 'bg-orange-500/10 border-orange-500/20 text-orange-200' 
                                : 'bg-orange-500/5 border-orange-500/30 text-orange-950 font-medium'
                            }`}>
                              <span className="font-bold uppercase tracking-widest text-[9px] block text-[#D4AF37] mb-1">🗣️ Accent &amp; Tonal critique</span>
                              <p className="leading-relaxed">{message.voiceFeedback}</p>
                            </div>
                          )}

                          {/* Corresponding translation */}
                          {message.englishTranslation && (
                            <div className={`text-sm leading-relaxed font-sans border-l-2 border-[#4A5D23] pl-3 py-0.5 transition-colors ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-800'
                            }`}>
                              {message.englishTranslation}
                            </div>
                          )}

                          {/* Historical context / lesson commentary */}
                          {message.lessonNotes && (
                            <div className={`pt-2.5 border-t text-[11.5px] transition-colors ${
                              isDarkMode ? 'border-white/[0.06] text-gray-400' : 'border-black/[0.08] text-[#3c3631]'
                            }`}>
                              <span className={`font-semibold italic block mb-0.5 ${isDarkMode ? 'text-[#D4AF37]/90' : 'text-[#4A5D23]/90'}`}>📖 Cultural Custodian note:</span>
                              <p className="leading-relaxed whitespace-pre-wrap">{message.lessonNotes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isAiLoading && (
              <div className="flex justify-start">
                <div className={`border rounded-2xl p-4 max-w-[85%] rounded-tl-none transition-all ${
                  isDarkMode ? 'bg-[#141210]/95 border-white/[0.06]' : 'bg-[#FAF7F2] border-black/[0.1] shadow-sm'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" />
                    <span className={`text-[11px] font-mono ml-1 transition-colors ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>Ẹzza AI is generating voice stream...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Mic Stream & Input Panel */}
          <div className={`p-4 border-t backdrop-blur-md transition-colors ${
            isDarkMode ? 'border-white/[0.08] bg-[#12100E]/90' : 'border-black/[0.1] bg-[#FAF7F2]/95'
          }`}>
            {isRecording ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all ${
                  isDarkMode ? 'bg-[#1B120E] border-orange-500/30' : 'bg-[#E3DDD1] border-orange-500/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                  <span className="text-xs font-mono uppercase tracking-[0.15em] text-[#D4AF37] font-bold">
                    Now Recording spoken Ezza audio ({recordingDur}s)
                  </span>
                </div>

                {/* Live sound ripples */}
                <div className="flex items-end justify-center h-10 my-3">
                  <div className="wave-bar h-6" />
                  <div className="wave-bar h-10" />
                  <div className="wave-bar h-4" />
                  <div className="wave-bar h-8" />
                  <div className="wave-bar h-11" />
                  <div className="wave-bar h-5" />
                  <div className="wave-bar h-9" />
                  <div className="wave-bar h-6" />
                </div>

                <button 
                  onClick={handleStopRecording}
                  className="mt-3 px-6 py-2 bg-[#D4AF37] hover:bg-[#bfa035] text-black font-semibold text-xs rounded-full flex items-center gap-2 tracking-wider transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                >
                  <Square className="w-3.5 h-3.5 fill-black" />
                  <span>STOP & SENT TO VOICE TUTOR</span>
                </button>
              </motion.div>
            ) : (
              <form 
                onSubmit={(e) => { e.preventDefault(); submitChatFlow(null); }}
                className="flex items-center gap-3"
              >
                {/* Voice-First Quick Record trigger resembling the pulsing vocal circle */}
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#D4AF37] to-[#4A5D23] hover:brightness-110 flex items-center justify-center shrink-0 shadow-lg text-black hover:scale-105 active:scale-95 transition-all group border border-white/10"
                  title="Speak to Ezza AI"
                >
                  <Mic className="w-5.5 h-5.5 group-hover:scale-110 transition-transform" />
                </button>

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      activeTab === "bible"
                        ? "Search Ezza Bible (e.g. John 3:16, Psalm 23)"
                        : activeTab === "tutor"
                        ? "Say list words for greeting, or ask Ezza words"
                        : "Write in Ezza or ask cultural questions..."
                    }
                    className={`w-full text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/60 rounded-2xl px-4.5 py-3.5 border transition-all ${
                      isDarkMode 
                        ? 'bg-white/[0.03] text-gray-100 border-white/[0.08] placeholder-gray-500' 
                        : 'bg-black/[0.03] text-gray-900 border-black/[0.12] placeholder-gray-500'
                    }`}
                  />
                  
                  {inputText.trim() && (
                    <button
                      type="submit"
                      className="absolute right-2 top-2.5 px-3.5 py-1.5 bg-[#D4AF37] hover:bg-white text-black font-bold text-xs rounded-xl transition-all shadow-sm"
                    >
                      SEND
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setChatLog([])}
                  className={`p-3 border rounded-2xl transition-all ${
                    isDarkMode 
                      ? 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-gray-400 hover:text-white' 
                      : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.12] text-gray-500 hover:text-black'
                  }`}
                  title="Clear dialog history"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right column: Interactive Mode Materials (Tutor presets, Bible lookups) */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Majestic Voice Orb Block centerpiece representing Ezza Custodian state */}
          <div className={`rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-xl min-h-[220px] border transition-all ${
            isDarkMode 
              ? 'bg-white/[0.02] border-white/[0.06]' 
              : 'bg-white border-black/[0.1] shadow-md shadow-black/[0.01]'
          }`}>
            <div className="absolute top-2 left-3 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-ping" />
              <span className={`text-[9px] uppercase tracking-widest font-bold font-mono transition-colors ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>vocal focus</span>
            </div>

            {/* Glowing Interactive Pulsing Orb */}
            <div 
              className="relative my-4 cursor-pointer" 
              onClick={
                activeTab === "live"
                  ? (isLiveActive ? stopLiveVoiceStream : startLiveVoiceStream)
                  : (isRecording ? handleStopRecording : handleStartRecording)
              }
            >
              <div className={`w-36 h-36 rounded-full bg-gradient-to-tr ${isLiveActive ? "from-emerald-400 to-[#4A5D23]" : "from-[#D4AF37] to-[#4A5D23]"} flex items-center justify-center ${isLiveActive ? "animate-[pulse_1.5s_infinite]" : "animate-pulse"} shadow-[0_0_60px_rgba(212,175,55,0.2)] hover:scale-105 transition-transform duration-500`}>
                <div className={`w-[110px] h-[110px] rounded-full flex items-center justify-center relative border transition-colors ${
                  isDarkMode ? 'bg-[#0F0D0B] border-white/[0.05]' : 'bg-white border-transparent'
                }`}>
                  {activeTab === "live" ? (
                    isLiveActive ? (
                      <div className="flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-8 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-12 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-8 bg-emerald-500 rounded-full animate-bounce" />
                      </div>
                    ) : (
                      <Mic className="w-8 h-8 text-[#D4AF37]" />
                    )
                  ) : isRecording ? (
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-6 bg-red-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-10 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-6 bg-[#4A5D23] rounded-full animate-bounce" />
                    </div>
                  ) : currentlyPlayingId ? (
                    <div className="flex items-end justify-center gap-1.5">
                      <div className="wave-bar w-1 h-8 animate-bounce" />
                      <div className="wave-bar w-1 h-12 animate-bounce [animation-delay:-0.15s]" />
                      <div className="wave-bar w-1 h-6 animate-bounce [animation-delay:-0.3s]" />
                    </div>
                  ) : (
                    <svg className="w-8 h-8 text-[#D4AF37] relative z-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            <div className="text-center mt-2">
              <p className="text-xs font-semibold text-gray-300">
                {activeTab === "live"
                  ? (isLiveActive ? "Streaming Voice (Speak now)..." : "Tap Orb to Start Live Stream")
                  : (isRecording ? "Listening to your voice..." : currentlyPlayingId ? "Speaking..." : "Tap Orb to Record and Converse")}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">Ezza dialect features distinct high and low relative vowel pitches</p>
            </div>
          </div>
          
          {/* Preset Arena Wrapper */}
          <AnimatePresence mode="wait">
            {activeTab === "tutor" && (
              <motion.div 
                key="tab-tutor"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`backdrop-blur-xl border rounded-3xl p-4 flex flex-col h-full space-y-4 shadow-xl transition-all ${
                  isDarkMode ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-black/[0.1] shadow-md shadow-black/[0.01]'
                }`}
              >
                <div className={`flex items-center gap-2 pb-2 border-b ${isDarkMode ? 'border-white/[0.06]' : 'border-black/[0.08]'}`}>
                  <GraduationCap className={`w-5 h-5 ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`} />
                  <div>
                    <h3 className={`font-serif font-bold transition-colors ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>Ezza Language Academy</h3>
                    <p className={`text-[11px] transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Master the phonetics and local expressions of Ezza dialect</p>
                  </div>
                </div>

                {/* Lesson Category select lists */}
                <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
                  {presetLessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => {
                        setSelectedLesson(lesson);
                        setPracticeWord(null);
                      }}
                      className={`text-[10px] font-semibold px-3 py-1.5 rounded-full border shrink-0 transition-all ${
                        selectedLesson?.id === lesson.id 
                          ? (isDarkMode ? "bg-[#D4AF37] text-[#0F0D0B] border-[#D4AF37] font-bold" : "bg-[#4A5D23] text-white border-[#4A5D23] font-bold") 
                          : (isDarkMode ? "bg-white/[0.03] text-gray-300 border-white/[0.06] hover:bg-white/[0.08]" : "bg-black/[0.03] text-gray-700 border-black/[0.08] hover:bg-black/[0.06]")
                      }`}
                    >
                      {lesson.title}
                    </button>
                  ))}
                </div>

                {/* Category lessons items list */}
                <div className="flex-1 overflow-y-auto max-h-[220px] space-y-2.5 pr-1">
                  {selectedLesson?.items.map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleLessonItemSelect(item)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        practiceWord?.ezza === item.ezza
                          ? (isDarkMode ? "bg-[#1C1814] border-[#D4AF37] shadow-lg shadow-[#D4AF37]/5" : "bg-[#EADECC]/45 border-[#D4AF37] shadow-sm")
                          : (isDarkMode ? "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.15]" : "bg-black/[0.01] border-black/[0.06] hover:border-black/[0.12]")
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1">
                          <span className={`text-[9px] border px-1.5 py-0.5 rounded font-mono uppercase font-bold mr-2 ${
                            isDarkMode 
                              ? "text-[#D4AF37] bg-[#4A5D23]/25 border-[#D4AF37]/20" 
                              : "text-[#4A5D23] bg-[#4A5D23]/10 border-[#4A5D23]/25"
                          }`}>
                            {selectedLesson.category}
                          </span>
                          <span className={`text-xs transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.english}</span>
                          <h4 className={`font-serif text-base font-bold mt-1 transition-colors ${isDarkMode ? 'text-[#E8E2D9]' : 'text-gray-900'}`}>{item.ezza}</h4>
                        </div>

                        {/* Speaker trigger button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speakPresetTerm(item);
                          }}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 border ${
                            isDarkMode 
                              ? 'bg-white/[0.05] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border-white/[0.05]' 
                              : 'bg-black/[0.04] hover:bg-[#4A5D23] hover:text-white text-[#4A5D23] border-black/[0.05]'
                          }`}
                          title="Speak Audio"
                        >
                          {wordTtsLoading === item.ezza ? (
                            <div className="w-3.5 h-3.5 border-2 border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                          ) : (
                            <Volume1 className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <p className={`text-[11px] font-mono mt-2 transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Phonetics: <span className={`italic font-semibold ${isDarkMode ? 'text-[#D4AF37]' : 'text-emerald-800'}`}>/{item.pronunciation}/</span>
                      </p>
                      
                      <p className={`text-[11px] mt-1 lines-clamp-2 pt-1.5 border-t transition-colors ${
                        isDarkMode ? 'text-gray-400 border-white/[0.05]' : 'text-gray-700 border-black/[0.06]'
                      }`}>
                        {item.explanation}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Pronunciation Practice Rehearsal Arena */}
                <div className={`p-3.5 rounded-2xl space-y-2 shrink-0 border transition-colors ${
                  isDarkMode ? 'bg-[#1B120E] border-orange-500/20' : 'bg-[#EADECC]/40 border-orange-500/30'
                }`}>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDarkMode ? 'text-[#D4AF37]' : 'text-amber-800'}`}>
                    <Sparkles className="w-4 h-4" />
                    <span>Pronunciation Arena</span>
                  </div>
                  
                  {practiceWord ? (
                    <div className="space-y-2">
                      <p className={`text-[11px] transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                        Practice saying <span className={`font-bold ${isDarkMode ? 'text-[#D4AF37]' : 'text-amber-800'}`}>"{practiceWord.ezza}"</span> properly. Click below to start voice grading program.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitChatFlow(`Pronunciation practice evaluation request: Let me practice saying out loud: "${practiceWord.ezza}" in Ezza.`)}
                          className={`flex-1 py-1 px-3 text-black text-[11px] font-bold rounded-lg transition-all text-center cursor-pointer shadow-sm ${
                            isDarkMode ? 'bg-[#D4AF37] hover:bg-white' : 'bg-[#D4AF37] hover:bg-[#4A5D23] hover:text-white'
                          }`}
                        >
                          Evaluate Pronunciation Aloud
                        </button>
                        <button
                          onClick={() => setPracticeWord(null)}
                          className={`px-2 py-1 text-[10px] rounded-lg cursor-pointer transition-colors ${
                            isDarkMode ? 'bg-white/[0.05] hover:bg-white/[0.1] text-gray-400' : 'bg-black/[0.05] hover:bg-black/[0.1] text-gray-700'
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-[11px] italic leading-relaxed transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Select any vocabulary card above, review its custom syllable formatting, then try rehearsing it out loud!
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "bible" && (
              <motion.div 
                key="tab-bible"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`backdrop-blur-xl border rounded-3xl p-4 flex flex-col h-full space-y-4 shadow-xl transition-all ${
                  isDarkMode ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-black/[0.1] shadow-md shadow-black/[0.01]'
                }`}
              >
                <div className={`flex items-center justify-between pb-2 border-b ${isDarkMode ? 'border-white/[0.06]' : 'border-black/[0.08]'}`}>
                  <div className="flex items-center gap-2">
                    <BookOpen className={`w-5 h-5 ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`} />
                    <div>
                      <h3 className={`font-serif font-bold transition-colors ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>Ẹzza Holy Scriptures</h3>
                      <p className={`text-[11px] transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Biblical citations natively compiled in the Ezza dialect</p>
                    </div>
                  </div>
                </div>

                {/* Preset Verse Gallery */}
                <div>
                  <h4 className={`text-[10px] uppercase tracking-widest font-bold mb-2 transition-colors ${isDarkMode ? 'text-[#D4AF37]/80' : 'text-[#4A5D23]'}`}>Preset Scriptures</h4>
                  <div className="space-y-2 overflow-y-auto max-h-[180px] pr-1">
                    {presetVerses.map((v, i) => (
                      <div 
                        key={i}
                        onClick={() => triggerPresetScripture(v)}
                        className={`p-3 border rounded-xl cursor-pointer group transition-all ${
                          isDarkMode 
                            ? 'bg-white/[0.02] hover:bg-[#1C1814] border-white/[0.05]' 
                            : 'bg-black/[0.01] hover:bg-[#EADECC]/40 border-black/[0.08]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className={`font-semibold ${isDarkMode ? 'text-[#D4AF37]' : 'text-emerald-800'}`}>{v.ref}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 group-hover:bg-[#D4AF37] group-hover:text-black transition-colors ${
                            isDarkMode ? 'bg-white/[0.05] text-[#D4AF37]' : 'bg-[#4A5D23]/10 text-[#4A5D23]'
                          }`}>
                            <Play className="w-2.5 h-2.5 fill-current" /> Read
                          </span>
                        </div>
                        <p className={`font-serif text-sm mt-1 lines-clamp-2 truncate transition-colors ${isDarkMode ? 'text-gray-200' : 'text-gray-905'}`}>{v.spokenEzza}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Book Search Lookup */}
                <div className={`pt-2 border-t ${isDarkMode ? 'border-white/[0.06]' : 'border-black/[0.08]'}`}>
                  <h4 className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 transition-colors ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>Generate Any Given Scriptures</h4>
                  <p className={`text-[11px] mb-2 leading-relaxed transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Ẹzza Companion parses scriptures relative to classical Izi-Ezaa-Ikwo-Mgbo linguistics. Input details below to translate on the fly.
                  </p>
                  
                  <form onSubmit={handleScriptureSearch} className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="e.g. Genesis 1:3, Isaiah 40:31..."
                      value={bibleSearchQuery}
                      onChange={(e) => setBibleSearchQuery(e.target.value)}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/60 placeholder-gray-500 transition-all ${
                        isDarkMode 
                          ? 'bg-[#161412] border border-white/[0.08] text-gray-100' 
                          : 'bg-black/[0.03] border border-black/[0.12] text-gray-900'
                      }`}
                    />
                    <button
                      type="submit"
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer ${
                        isDarkMode ? 'bg-[#D4AF37] hover:bg-white hover:text-black text-black' : 'bg-[#4A5D23] hover:bg-[#D4AF37] hover:text-black text-white'
                      }`}
                    >
                      Lookup
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {activeTab === "chat" && (
              <motion.div 
                key="tab-chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`backdrop-blur-xl border rounded-3xl p-4 flex flex-col h-full space-y-4 shadow-xl transition-all ${
                  isDarkMode ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-black/[0.1] shadow-md shadow-black/[0.01]'
                }`}
              >
                <div className={`flex items-center gap-2 pb-2 border-b ${isDarkMode ? 'border-white/[0.06]' : 'border-black/[0.08]'}`}>
                  <HelpCircle className={`w-5 h-5 ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`} />
                  <div>
                    <h3 className={`font-serif font-bold transition-colors ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>Ezza Cultural Custodian</h3>
                    <p className={`text-[11px] transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Discover and practice historical expressions and traditional values</p>
                  </div>
                </div>

                <div className="text-xs space-y-3 overflow-y-auto max-h-[480px] pr-1 scrollbar-thin">
                  <p className={`leading-relaxed transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    The Ẹzza (Ezza) people form one of the largest clans of the Ebonyi and Benue region. Language is noted for its beautiful vowel systems and distinct cultural greetings.
                  </p>
                  
                  {/* Daily Ezza Wisdom Card */}
                  <div className={`p-3.5 rounded-2xl border transition-all space-y-2.5 relative ${
                    isDarkMode 
                      ? 'bg-amber-500/[0.03] border-amber-500/15 shadow-sm' 
                      : 'bg-[#EADECC]/30 border-black/[0.08] shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between border-b pb-1.5 border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className={`w-3.5 h-3.5 ${isDarkMode ? "text-[#D4AF37]" : "text-amber-800"}`} />
                        <span className={`text-[10px] uppercase tracking-wider font-bold ${
                          isDarkMode ? "text-[#D4AF37]" : "text-amber-900"
                        }`}>Daily Ezza Wisdom (Ilu)</span>
                      </div>
                      
                      <button 
                        onClick={() => fetchDailyProverb(true)}
                        disabled={proverbLoading}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          isDarkMode ? 'hover:bg-white/[0.05] text-[#D4AF37]/70 hover:text-[#D4AF37]' : 'hover:bg-black/[0.05] text-[#4A5D23]/80 hover:text-[#4A5D23]'
                        }`}
                        title="Get another random proverb"
                      >
                        <RotateCcw className={`w-3 h-3 ${proverbLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {proverbLoading ? (
                      <div className="py-4 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                      </div>
                    ) : dailyProverb ? (
                      <div className="space-y-2">
                        <div className="relative pr-8">
                          <p className={`font-serif text-[14px] font-bold leading-relaxed italic ${
                            isDarkMode ? "text-[#E8E2D9]" : "text-gray-950"
                          }`}>
                            "{dailyProverb.ezza}"
                          </p>

                          <button
                            onClick={() => speakProverb(dailyProverb.ezza)}
                            disabled={proverbTtsLoading}
                            className={`absolute right-0 top-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all border shrink-0 cursor-pointer ${
                              isDarkMode 
                                ? 'bg-white/[0.04] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border-white/[0.05]' 
                                : 'bg-black/[0.03] hover:bg-[#4A5D23] hover:text-white text-[#4A5D23] border-black/[0.05]'
                            }`}
                            title="Hear spoken pronunciation"
                          >
                            {proverbTtsLoading ? (
                              <div className="w-3.5 h-3.5 border-2 border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                            ) : (
                              <Volume1 className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {dailyProverb.phonetics && (
                          <span className={`text-[10px] font-mono italic px-2.5 py-0.5 rounded-full inline-block border ${
                            isDarkMode 
                              ? 'bg-white/[0.03] border-white/[0.05] text-[#D4AF37]/80' 
                              : 'bg-black/[0.03] border-black/[0.05] text-[#4A5D23]'
                          }`}>
                            /{dailyProverb.phonetics}/
                          </span>
                        )}

                        <div className={`text-xs pl-2 border-l-2 leading-relaxed ${
                          isDarkMode ? "border-[#D4AF37]/50 text-gray-300" : "border-[#4A5D23]/50 text-gray-800"
                        }`}>
                          <span className="font-semibold block text-[10px] uppercase tracking-wide opacity-75">Translation</span>
                          {dailyProverb.englishTranslation}
                        </div>

                        <div className={`p-2.5 rounded-xl text-[10.5px] leading-relaxed border transition-all ${
                          isDarkMode 
                            ? 'bg-black/20 border-white/[0.04] text-gray-400' 
                            : 'bg-white border-black/[0.04] text-gray-700 shadow-sm'
                        }`}>
                          <span className={`font-semibold block mb-0.5 text-[9px] uppercase tracking-wide ${
                            isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'
                          }`}>Ancestral Significance</span>
                          {dailyProverb.culturalSignificance}
                        </div>

                        {/* Share wisdom button */}
                        <div className="flex items-center justify-end pt-1">
                          <button
                            onClick={() => handleShareProverb(dailyProverb)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                              isDarkMode 
                                ? 'bg-amber-500/[0.06] border-amber-500/15 text-[#D4AF37] hover:bg-[#D4AF37]/20' 
                                : 'bg-[#4A5D23]/5 border-black/10 text-[#4A5D23] hover:bg-[#4A5D23]/10'
                            }`}
                            title="Share this proverb insight"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Kwubara (Share Wisdom)</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-center text-gray-500 italic">No proverb loaded</p>
                    )}
                  </div>
                  
                  {/* Searchable Ezza Glossary Component with Sub-Tabs for Browse vs Interactive Quiz */}
                  <div className={`p-4 rounded-3xl border transition-all space-y-3.5 ${
                    isDarkMode 
                      ? 'bg-white/[0.02] border-white/[0.08] shadow-sm' 
                      : 'bg-white border-black/[0.1] shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between border-b pb-2 border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className={`w-3.5 h-3.5 ${isDarkMode ? "text-[#D4AF37]" : "text-[#4A5D23]"}`} />
                        <span className={`text-[10px] uppercase tracking-wider font-bold ${
                          isDarkMode ? "text-gray-200" : "text-gray-950"
                        }`}>Ezza Glossary (Ọbá Okwu)</span>
                      </div>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${
                        isDarkMode ? "bg-white/[0.04] text-[#D4AF37]" : "bg-black/[0.03] text-[#4A5D23]"
                      }`}>
                        {quizTab === "browse" ? `${filteredGlossary.length} terms` : `${quizScoreboard.solved} challenged`}
                      </span>
                    </div>

                    {/* Compact Custom Sub-Tabs */}
                    <div className="flex p-0.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.04]">
                      <button
                        onClick={() => setQuizTab("browse")}
                        className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-bold tracking-wide uppercase transition-all cursor-pointer ${
                          quizTab === "browse"
                            ? (isDarkMode ? "bg-white/10 text-[#D4AF37] font-extrabold" : "bg-white text-[#4A5D23] shadow-sm font-extrabold")
                            : "text-gray-500 hover:text-gray-400"
                        }`}
                      >
                        📖 Browse Terms
                      </button>
                      <button
                        onClick={() => {
                          setQuizTab("quiz");
                          if (!quizCurrentQuestion) {
                            generateNewQuizQuestion();
                          }
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-bold tracking-wide uppercase transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          quizTab === "quiz"
                            ? (isDarkMode ? "bg-[#D4AF37] text-black shadow-sm font-extrabold" : "bg-[#4A5D23] text-white shadow-sm font-extrabold")
                            : "text-gray-500 hover:text-gray-400"
                        }`}
                      >
                        🎯 Practice Quiz
                      </button>
                    </div>

                    {quizTab === "browse" ? (
                      <>
                        {/* Search & Filter Controls */}
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={glossarySearchQuery}
                              onChange={(e) => setGlossarySearchQuery(e.target.value)}
                              placeholder="Search words, categories, meanings..."
                              className={`w-full text-xs rounded-xl pl-8.5 pr-8 py-2 border transition-all focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/60 ${
                                isDarkMode 
                                  ? 'bg-black/30 border-white/[0.05] text-gray-200 placeholder-gray-500' 
                                  : 'bg-black/[0.02] border-black/[0.08] text-gray-900 placeholder-gray-400'
                              }`}
                            />
                            {glossarySearchQuery && (
                              <button 
                                onClick={() => setGlossarySearchQuery("")}
                                className={`absolute right-2.5 top-1.5 w-5 h-5 flex items-center justify-center rounded-full text-sm font-bold cursor-pointer transition-colors ${
                                  isDarkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-black'
                                }`}
                              >
                                ×
                              </button>
                            )}
                          </div>

                          {/* Horizontal Category quick scrolls */}
                          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-amber-500">
                            {glossaryCategories.map((cat) => (
                              <button
                                key={cat}
                                onClick={() => setGlossaryFilterCategory(cat)}
                                className={`text-[8.5px] font-semibold px-2 py-0.5 rounded-full border transition-all shrink-0 cursor-pointer ${
                                  glossaryFilterCategory === cat 
                                    ? (isDarkMode ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-[#4A5D23] text-white border-[#4A5D23]") 
                                    : (isDarkMode ? "bg-white/[0.03] text-gray-400 border-white/[0.05] hover:bg-white/[0.06]" : "bg-black/[0.02] text-gray-600 border-black/[0.05] hover:bg-black/[0.04]")
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Glossary List Drawer */}
                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                          {glossaryLoading ? (
                            <div className="py-6 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                            </div>
                          ) : filteredGlossary.length === 0 ? (
                            <p className="text-[11px] text-center text-gray-500 italic py-4">No matching terms found</p>
                          ) : (
                            filteredGlossary.map((item) => {
                              const isPlaying = currentlyPlayingId === item.id;
                              const isLoading = currentlyPlayingId === `loading-${item.id}`;
                              return (
                                <div 
                                  key={item.id}
                                  className={`p-2.5 rounded-xl border text-left transition-all relative group ${
                                    isDarkMode 
                                      ? 'bg-[#181512]/60 hover:bg-[#181512] border-white/[0.03]' 
                                      : 'bg-black/[0.01] hover:bg-black/[0.02] border-black/[0.04]'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2 pr-18">
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`font-serif text-[13px] font-bold ${
                                          isDarkMode ? 'text-[#E8E2D9]' : 'text-gray-950'
                                        }`}>{item.word}</span>
                                        <span className="text-[8px] px-1.5 py-0.2 rounded bg-[#D4AF37]/10 dark:bg-[#D4AF37]/5 text-[#D4AF37] font-sans uppercase font-bold tracking-wider">{item.category}</span>
                                      </div>
                                      
                                      {item.phonetics && (
                                        <span className={`text-[9px] font-mono italic block text-gray-550 mt-0.5`}>
                                          /{item.phonetics}/
                                        </span>
                                      )}
                                    </div>

                                    <div className="absolute right-2 top-2 flex gap-1 items-center">
                                      <button
                                        onClick={() => speakGlossaryWord(item)}
                                        disabled={isLoading}
                                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                                          isPlaying 
                                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-sm'
                                            : (isDarkMode ? 'bg-white/[0.03] text-[#D4AF37]/80 border-white/[0.05] hover:bg-[#D4AF37] hover:text-black' : 'bg-black/[0.03] text-[#4A5D23]/80 border-black/[0.05] hover:bg-[#4A5D23] hover:text-white')
                                        }`}
                                        title="Listen to pronunciation"
                                      >
                                        {isLoading ? (
                                          <div className="w-3.5 h-3.5 border-2 border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                                        ) : isPlaying ? (
                                          <VolumeX className="w-3.5 h-3.5" />
                                        ) : (
                                          <Volume2 className="w-3.5 h-3.5" />
                                        )}
                                      </button>

                                      <button
                                        onClick={() => handleShareGlossary(item)}
                                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                                          isDarkMode 
                                            ? 'bg-white/[0.03] text-gray-400 border-white/[0.05] hover:bg-[#D4AF37] hover:text-black' 
                                            : 'bg-black/[0.03] text-gray-550 border-black/[0.05] hover:bg-[#4A5D23] hover:text-white'
                                        }`}
                                        title="Share word insight"
                                      >
                                        <Share2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className={`mt-1.5 text-[11px] leading-relaxed ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-800'
                                  }`}>
                                    <p className="font-semibold">{item.englishTranslation}</p>
                                    <p className={`text-[10px] text-gray-400 dark:text-gray-500 leading-normal mt-0.5`}>{item.definition}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : (
                      /* Interactive Vocabulary Quiz Mode */
                      <div className="space-y-3">
                        {/* Persistent Slate Scoreboard stats panel */}
                        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl text-center bg-black/5 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.04]">
                          <div>
                            <span className="block text-[8px] text-gray-400 uppercase tracking-widest font-mono">Accuracy</span>
                            <span className={`text-[12px] font-sans font-bold ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>
                              {quizScoreboard.solved > 0 
                                ? `${Math.round((quizScoreboard.correct / quizScoreboard.solved) * 100)}%` 
                                : "0%"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-gray-400 uppercase tracking-widest font-mono">Streak</span>
                            <span className="text-[12px] font-sans font-bold text-amber-500">
                              🔥 {quizScoreboard.streak}
                            </span>
                          </div>
                          <div className="relative group">
                            <span className="block text-[8px] text-gray-400 uppercase tracking-widest font-mono">Max Streak</span>
                            <span className="text-[12px] font-sans font-bold text-emerald-500">
                              🏆 {quizScoreboard.maxStreak}
                            </span>
                            
                            {/* Score reset link */}
                            <button 
                              onClick={resetQuizScoreboard}
                              title="Reset Scoreboard Stats"
                              className="absolute right-0 top-0 text-gray-400 hover:text-red-500 transition-colors p-0.5 cursor-pointer"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {quizCurrentQuestion ? (
                          <div className="space-y-3 pt-1">
                            {/* Dynamic Question Presentation */}
                            <div className={`p-3 rounded-2xl border text-center space-y-1.5 relative ${
                              isDarkMode ? 'bg-[#181512] border-white/[0.04]' : 'bg-black/[0.01] border-black/[0.04]'
                            }`}>
                              <span className="text-[8px] uppercase tracking-wider font-mono text-[#D4AF37] block font-bold">
                                {quizAnswerType === "ezza-to-english" 
                                  ? "Translate this Ezza word to English" 
                                  : "Translate this English term to Ezza"}
                              </span>
                              <h4 className={`font-serif text-[17px] font-extrabold tracking-tight ${
                                isDarkMode ? 'text-[#E8E2D9]' : 'text-gray-950'
                              }`}>
                                {quizAnswerType === "ezza-to-english" 
                                  ? `"${quizCurrentQuestion.word}"` 
                                  : `"${quizCurrentQuestion.englishTranslation}"`}
                              </h4>
                              
                              {/* Hear pronunciation for Ezza word */}
                              {quizAnswerType === "ezza-to-english" && (
                                <div className="flex justify-center">
                                  <button
                                    onClick={() => playWebSpeechSynthesis(quizCurrentQuestion.word)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[8.5px] font-mono border transition-all cursor-pointer ${
                                      isDarkMode 
                                        ? 'bg-white/[0.03] text-[#D4AF37] border-white/[0.06] hover:bg-[#D4AF37] hover:text-black' 
                                        : 'bg-black/[0.02] text-[#4A5D23] border-black/[0.06] hover:bg-[#4A5D23] hover:text-white'
                                    }`}
                                  >
                                    <Volume2 className="w-2.5 h-2.5" />
                                    <span>Hear Pronunciation</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Multiple choice options */}
                            <div className="grid grid-cols-1 gap-1.5 text-left">
                              {quizOptions.map((opt, i) => {
                                const isSelected = quizSelectedAnswer === opt;
                                const correctAnswerValue = quizAnswerType === "ezza-to-english" 
                                  ? quizCurrentQuestion.englishTranslation 
                                  : quizCurrentQuestion.word;
                                const isThisCorrect = opt === correctAnswerValue;

                                let btnClass = isDarkMode 
                                  ? "bg-white/[0.02] border-white/[0.05] text-gray-305 hover:bg-white/[0.04] hover:border-white/10" 
                                  : "bg-white border-black/[0.08] text-gray-800 hover:bg-black/[0.01] hover:border-black/[0.12]";

                                if (quizSelectedAnswer) {
                                  if (isThisCorrect) {
                                    btnClass = isDarkMode 
                                      ? "bg-emerald-500/10 border-emerald-500/60 text-emerald-400 font-bold" 
                                      : "bg-emerald-100 border-emerald-500 text-emerald-800 font-bold";
                                  } else if (isSelected) {
                                    btnClass = isDarkMode 
                                      ? "bg-rose-500/10 border-rose-500/60 text-rose-400 font-bold" 
                                      : "bg-rose-100 border-rose-500 text-rose-800 font-bold";
                                  } else {
                                    btnClass = "opacity-40 cursor-not-allowed";
                                  }
                                }

                                return (
                                  <button
                                    key={i}
                                    disabled={!!quizSelectedAnswer}
                                    onClick={() => handleAnswerSubmit(opt)}
                                    className={`w-full p-2 rounded-xl border text-xs leading-tight transition-all flex items-center justify-between cursor-pointer ${btnClass}`}
                                  >
                                    <span className="flex-1 pr-2">{opt}</span>
                                    {quizSelectedAnswer && isThisCorrect && (
                                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    )}
                                    {quizSelectedAnswer && isSelected && !isThisCorrect && (
                                      <span className="text-rose-500 font-extrabold text-xs shrink-0 px-0.5">×</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Detailed Explanation / Definition of correct word */}
                            {quizSelectedAnswer && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-2 pt-1"
                              >
                                <div className={`p-3 rounded-xl border text-[10.5px] leading-relaxed ${
                                  quizIsCorrect 
                                    ? (isDarkMode ? 'bg-emerald-500/[0.02] border-emerald-500/20 text-gray-300' : 'bg-emerald-50/40 border-emerald-150 text-gray-700') 
                                    : (isDarkMode ? 'bg-amber-500/[0.02] border-amber-500/20 text-gray-300' : 'bg-amber-50/40 border-amber-150 text-gray-700')
                                }`}>
                                  <span className={`block font-serif font-extrabold uppercase tracking-wider text-[8.5px] mb-1 ${
                                    quizIsCorrect ? 'text-emerald-500' : 'text-amber-500'
                                  }`}>
                                    {quizIsCorrect ? "🎉 Excellent Work!" : "💡 Vocabulary Study Note"}
                                  </span>
                                  <p>
                                    <span className="font-bold">"{quizCurrentQuestion.word}"</span> means <span className="font-bold">"{quizCurrentQuestion.englishTranslation}"</span>.
                                  </p>
                                  {quizCurrentQuestion.definition && (
                                    <p className="mt-1 text-gray-400 dark:text-gray-500 select-none">
                                      {quizCurrentQuestion.definition}
                                    </p>
                                  )}
                                </div>

                                <button
                                  onClick={() => generateNewQuizQuestion()}
                                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm ${
                                    isDarkMode 
                                      ? 'bg-[#D4AF37] hover:bg-white text-black font-extrabold' 
                                      : 'bg-[#4A5D23] hover:bg-[#D4AF37] hover:text-black text-white font-extrabold'
                                  }`}
                                >
                                  <span>Kpatụ Ọzọ (Next Card)</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            )}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-xs text-gray-500 italic">
                            No glossary words available yet. Loading vocabulary database...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Recently Practiced List for vocabulary items */}
                  <div className={`p-4 rounded-3xl border transition-all space-y-3 ${
                    isDarkMode 
                      ? 'bg-white/[0.01] border-white/[0.06] shadow-sm' 
                      : 'bg-white border-black/[0.08] shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">🕒</span>
                        <h3 className={`text-[11px] font-sans font-bold tracking-tight uppercase ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-800'
                        }`}>
                          Recently Practiced
                        </h3>
                      </div>
                      {recentlyPracticed.length > 0 && (
                        <button 
                          onClick={() => setRecentlyPracticed([])}
                          className="text-[9px] font-semibold text-red-500 hover:text-red-400 transition-colors uppercase cursor-pointer"
                        >
                          Clear List
                        </button>
                      )}
                    </div>

                    {recentlyPracticed.length === 0 ? (
                      <p className="text-[10px] text-center text-gray-550 italic leading-relaxed py-1.5">
                        No recently practiced words yet. Listen to a pronunciation or challenge yourself in the practice quiz!
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-0.5 scrollbar-thin">
                        {recentlyPracticed.map((item) => {
                          const isPlaying = currentlyPlayingId === item.id;
                          const isLoading = currentlyPlayingId === `loading-${item.id}`;
                          return (
                            <div
                              key={`rec-${item.id}`}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-1.5 text-left transition-all relative ${
                                isDarkMode 
                                  ? 'bg-[#181512]/40 hover:bg-[#181512]/90 border-white/[0.03]' 
                                  : 'bg-black/[0.01] hover:bg-black/[0.03] border-black/[0.04]'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className={`font-serif text-[11px] font-bold truncate ${
                                    isDarkMode ? 'text-gray-200' : 'text-gray-900'
                                  }`}>
                                    {item.word}
                                  </span>
                                  <span className="text-[7.5px] px-1 py-0.2 rounded bg-amber-500/10 dark:bg-[#D4AF37]/5 text-amber-500 dark:text-[#D4AF37] font-semibold uppercase tracking-wider shrink-0 scale-90 origin-left">
                                    {item.category}
                                  </span>
                                </div>
                                <p className="text-[9.5px] text-gray-400 dark:text-gray-500 truncate leading-tight mt-0.5">
                                  {item.englishTranslation}
                                </p>
                              </div>

                              <button
                                onClick={() => speakGlossaryWord(item)}
                                disabled={isLoading}
                                className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                                  isPlaying 
                                    ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-sm'
                                    : (isDarkMode ? 'bg-white/[0.02] text-[#D4AF37]/80 border-white/[0.04] hover:bg-[#D4AF37] hover:text-black' : 'bg-black/[0.02] text-[#4A5D23]/80 border-black/[0.04] hover:bg-[#4A5D23] hover:text-white')
                                }`}
                                title="Hear pronunciation again"
                              >
                                {isLoading ? (
                                  <div className="w-2.5 h-2.5 border border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                                ) : isPlaying ? (
                                  <VolumeX className="w-3 h-3" />
                                ) : (
                                  <Volume2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className={`p-3 rounded-xl border transition-colors ${
                    isDarkMode ? 'bg-[#1C1814] border-white/[0.05]' : 'bg-[#EADECC]/45 border-black/[0.06]'
                  }`}>
                    <span className={`font-semibold block mb-1 transition-colors ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>💡 Suggested requests:</span>
                    <ul className={`space-y-1.5 pl-3 list-disc text-[11px] transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                      <li className="cursor-pointer hover:text-[#D4AF37] transition-colors" onClick={() => submitChatFlow("Teach me basic Ezza greetings showing high respect.")}>"Teach me basic Ezza greetings showing high respect."</li>
                      <li className="cursor-pointer hover:text-[#D4AF37] transition-colors" onClick={() => submitChatFlow("Translate 'Peace in our home' into Ezza dialect.")}>"Translate 'Peace in our home' into Ezza dialect."</li>
                      <li className="cursor-pointer hover:text-[#D4AF37] transition-colors" onClick={() => submitChatFlow("Explain the meaning and pronunciation of Chisoke.")}>"Explain the meaning and pronunciation of Chisoke."</li>
                    </ul>
                  </div>

                  <div className="flex flex-col gap-2 pt-1 font-sans">
                    <button
                      onClick={() => {
                        setActiveTab("tutor");
                        if (presetLessons.length > 0) setSelectedLesson(presetLessons[0]);
                      }}
                      className={`w-full text-center py-2.5 text-black rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                        isDarkMode ? 'bg-[#D4AF37] hover:bg-white' : 'bg-[#D4AF37] hover:bg-[#4A5D23] hover:text-white'
                      }`}
                    >
                      Begin Structured Lesson Academy
                    </button>
                    
                    <button
                      onClick={() => setActiveTab("bible")}
                      className={`w-full text-center py-2.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isDarkMode 
                          ? 'bg-white/[0.04] hover:bg-white/[0.08] border-[#D4AF37]/20 text-[#D4AF37]' 
                          : 'bg-black/[0.03] hover:bg-black/[0.06] border-[#4A5D23]/25 text-[#4A5D23]'
                      }`}
                    >
                      Open Ezza Bible Translations
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "live" && (
              <motion.div 
                key="tab-live"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`backdrop-blur-xl border rounded-3xl p-4 flex flex-col h-full space-y-4 shadow-xl transition-all ${
                  isDarkMode ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-black/[0.1] shadow-md shadow-black/[0.01]'
                }`}
              >
                <div className={`flex items-center gap-2 pb-2 border-b ${isDarkMode ? 'border-white/[0.06]' : 'border-[#4a5d23]/20'}`}>
                  <Globe className={`w-5 h-5 ${isLiveActive ? "text-emerald-400 animate-pulse" : (isDarkMode ? "text-gray-400" : "text-[#4A5D23]")}`} />
                  <div>
                    <h3 className={`font-serif font-bold transition-colors ${isDarkMode ? 'text-emerald-400' : 'text-emerald-850'}`}>Uru-Okwu Live</h3>
                    <p className={`text-[11px] transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Gemini 3.1 Live low-latency bidirectional voice stream</p>
                  </div>
                </div>

                <div className="text-xs space-y-3 flex-1 flex flex-col">
                  <p className={`leading-relaxed transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Connect to the real-time voice synthesis and comprehension array. Speak naturally; the AI stream continuously listens and directly responds with Ezza speech metrics.
                  </p>
                  
                  {/* Streaming Status Logs */}
                  <div className={`flex-1 min-h-[120px] max-h-[160px] overflow-y-auto p-3 rounded-2xl font-mono text-[10px] space-y-1.5 border transition-all ${
                    isDarkMode 
                      ? 'bg-black/40 border-white/[0.05] text-gray-400' 
                      : 'bg-[#FAF8F5] border-black/[0.12] text-gray-700 shadow-inner'
                  }`}>
                    <span className={`opacity-60 block border-b pb-1 mb-1 font-bold ${isDarkMode ? 'text-[#D4AF37] border-white/[0.05]' : 'text-[#4A5D23] border-black/[0.08]'}`}>=== CONSOLE LOGGER ===</span>
                    {liveLog.length === 0 ? (
                      <span className="text-gray-500 italic block">Stream offline. Tap start to connect array...</span>
                    ) : (
                      liveLog.map((log, idx) => (
                        <div key={idx} className="leading-relaxed select-text">
                          <span className="text-gray-500 mr-1.5">&gt;</span>
                          <span>{log}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isLiveActive ? (
                      <button
                        onClick={stopLiveVoiceStream}
                        className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-red-500/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        Disconnect Stream
                      </button>
                    ) : (
                      <button
                        onClick={startLiveVoiceStream}
                        className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-[#0F0D0B] rounded-2xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4 text-black" />
                        Go Live with Ezza AI
                      </button>
                    )}
                  </div>

                  <div className={`pt-2 border-t ${isDarkMode ? 'border-white/[0.05]' : 'border-black/[0.08]'}`}>
                    <button
                      type="button"
                      onClick={() => setShowMobileSetup(!showMobileSetup)}
                      className={`w-full py-2 rounded-xl text-[11px] font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                        isDarkMode 
                          ? 'bg-white/5 hover:bg-white/10 border-white/[0.05] text-gray-300' 
                          : 'bg-black/5 hover:bg-black/10 border-black/[0.08] text-gray-705'
                      }`}
                    >
                      <Smartphone className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`} />
                      {showMobileSetup ? "Hide Flutter Mobile Guide" : "Show Flutter Mobile Guide"}
                    </button>
                  </div>

                  {showMobileSetup && (
                    <div className={`p-3 rounded-2xl space-y-3 max-h-[300px] overflow-y-auto text-left scrollbar-thin border transition-all ${
                      isDarkMode 
                        ? 'bg-black/60 border-white/[0.05]' 
                        : 'bg-[#FAF8F5] border-black/[0.12] shadow-inner'
                    }`}>
                      <div className={`flex items-center gap-1.5 border-b pb-1.5 ${isDarkMode ? 'border-white/[0.05]' : 'border-black/[0.08]'}`}>
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <h4 className={`font-serif font-bold text-xs ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Flutter SDK Native Integration</h4>
                      </div>
                      
                      <div className={`space-y-2 text-[11px] leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <p>
                          To bridge Ezza AI to a native Android/iOS Flutter app, implement bidirectional PCM streaming using these coordinates:
                        </p>
                        
                        <div className={`space-y-1 p-2 rounded-lg border transition-all ${
                          isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-[#EADECC]/45 border-black/[0.06]'
                        }`}>
                          <div className={`font-bold text-[10px] uppercase ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>1. Hardware Setup (Capturing 16kHz PCM)</div>
                          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Configure the <code className={`px-1 py-0.5 rounded ${isDarkMode ? 'text-emerald-300 bg-black/60' : 'text-emerald-800 bg-black/5'}`}>record</code> package dependency to stream raw PCM buffers at a rate of 16kHz, 16-bit depth, mono-channel.
                          </p>
                        </div>

                        <div className={`space-y-1 p-2 rounded-lg border transition-all ${
                          isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-[#EADECC]/45 border-black/[0.06]'
                        }`}>
                          <div className={`font-bold text-[10px] uppercase ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>2. Persistent WebSocket Channel</div>
                          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Initiate connectivity using <code className={`px-1 py-0.5 rounded ${isDarkMode ? 'text-emerald-300 bg-black/60' : 'text-emerald-800 bg-black/5'}`}>web_socket_channel</code> pointing to the custom gateway at <code className={`px-1 py-0.5 rounded ${isDarkMode ? 'text-emerald-300 bg-black/60' : 'text-emerald-800 bg-black/5'}`}>ws://$host/api/live-voice</code>.
                          </p>
                        </div>

                        <div className={`space-y-1 p-2 rounded-lg border transition-all ${
                          isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-[#EADECC]/45 border-black/[0.06]'
                        }`}>
                          <div className={`font-bold text-[10px] uppercase ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>3. Real-Time Base64 Upstream</div>
                          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Stream incoming record buffer lists as they arrive, map them to a JSON array containing Base64 stringified chunks, and push to the proxy.
                          </p>
                        </div>

                        <div className={`space-y-1 p-2 rounded-lg border transition-all ${
                          isDarkMode ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-[#EADECC]/45 border-black/[0.06]'
                        }`}>
                          <div className={`font-bold text-[10px] uppercase ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#4A5D23]'}`}>4. Downstream Resampled 24kHz Speakers</div>
                          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Push incoming audio chunks returning from the server directly to a streaming PCM raw track player (e.g. using <code className={`px-1 py-0.5 rounded ${isDarkMode ? 'text-emerald-300 bg-black/60' : 'text-emerald-800 bg-black/5'}`}>flutter_sound</code> or similar) resampled at 24kHz.
                          </p>
                        </div>

                        <div className="space-y-1 pt-1.5">
                          <div className={`text-[10px] uppercase tracking-wider font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Example Flutter Integration Dart Code:</div>
                          <pre className={`p-2.5 rounded-lg border overflow-x-auto text-[10px] font-mono leading-normal select-all whitespace-pre ${
                            isDarkMode 
                              ? 'bg-black border-white/[0.08] text-emerald-400' 
                              : 'bg-black text-emerald-300 border-black'
                          }`}>
{`import 'dart:convert';
import 'package:record/record.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:flutter_sound/flutter_sound.dart';

class EzzaLiveVoiceService {
  final _record = AudioRecorder();
  WebSocketChannel? _channel;
  final FlutterSoundPlayer _player = FlutterSoundPlayer();

  Future<void> connectAndStream() async {
    // 1. Establish WSS Connection
    final uri = Uri.parse("wss://\${YOUR_SERVER_HOST}/api/live-voice");
    _channel = WebSocketChannel.connect(uri);

    // 2. Open Flutter Sound Player for 24kHz Output
    await _player.openPlayer();
    await _player.startPlayerFromStream(
      codec: Codec.pcm16,
      numChannels: 1,
      sampleRate: 24000,
    );

    // 3. Listen to Downstream Responses
    _channel!.stream.listen((message) async {
      final data = jsonDecode(message);
      if (data['audio'] != null) {
        final bytes = base64Decode(data['audio']);
        await _player.foodSink!.add(FoodData(bytes));
      }
    });

    // 4. Capture & Stream Upstream 16kHz audio chunks
    if (await _record.hasPermission()) {
      final config = RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: 16000,
        numChannels: 1,
      );
      final stream = await _record.startStream(config);
      
      stream.listen((audioChunk) {
        if (_channel != null) {
          final b64 = base64Encode(audioChunk);
          _channel!.sink.add(jsonEncode({'audio': b64}));
        }
      });
    }
  }

  Future<void> dispose() async {
    await _record.dispose();
    await _player.closePlayer();
    _channel?.sink.close();
  }
}`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Elegant Bottom Mode Selector Bar Capsule matches Immersive design perfectly */}
      <footer className={`w-full px-4 md:px-10 py-6 flex flex-col items-center gap-4 z-10 transition-colors ${
        isDarkMode ? 'bg-gradient-to-t from-black via-black/85 to-transparent' : 'bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/90 to-transparent'
      }`}>
        <div className={`flex space-x-1.5 p-1.5 rounded-full border shadow-xl max-w-full overflow-x-auto transition-all ${
          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/[0.1]'
        }`}>
          <button 
            onClick={() => { setActiveTab("chat"); stopCurrentPlayback(); stopLiveVoiceStream(); }}
            className={`px-6 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all shrink-0 cursor-pointer ${
              activeTab === "chat"
                ? "bg-[#D4AF37] text-black shadow-lg"
                : (isDarkMode ? "bg-transparent text-white/50 hover:text-white" : "bg-transparent text-black/55 hover:text-black")
            }`}
          >
            Kparu Ụka (Chat)
          </button>
          
          <button 
            onClick={() => { setActiveTab("bible"); stopCurrentPlayback(); stopLiveVoiceStream(); }}
            className={`px-6 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all shrink-0 cursor-pointer ${
              activeTab === "bible"
                ? "bg-[#D4AF37] text-black shadow-lg"
                : (isDarkMode ? "bg-transparent text-white/50 hover:text-white" : "bg-transparent text-black/55 hover:text-black")
            }`}
          >
            Baịbul (Bible)
          </button>
          
          <button 
            onClick={() => { setActiveTab("tutor"); stopCurrentPlayback(); stopLiveVoiceStream(); }}
            className={`px-6 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all shrink-0 cursor-pointer ${
              activeTab === "tutor"
                ? "bg-[#D4AF37] text-black shadow-lg"
                : (isDarkMode ? "bg-transparent text-white/50 hover:text-white" : "bg-transparent text-black/55 hover:text-black")
            }`}
          >
            Mụta Ezụ (Lessons)
          </button>

          <button 
            onClick={() => { setActiveTab("live"); stopCurrentPlayback(); }}
            className={`px-6 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all shrink-0 cursor-pointer ${
              activeTab === "live"
                ? "bg-emerald-500 text-[#0F0D0B] shadow-lg shadow-emerald-500/20"
                : (isDarkMode ? "bg-transparent text-white/50 hover:text-white" : "bg-transparent text-black/55 hover:text-black")
            }`}
          >
            ⚡ Live Voice
          </button>
        </div>

        <div className={`text-center text-[10px] font-mono tracking-wider transition-colors ${
          isDarkMode ? 'text-gray-500' : 'text-gray-600'
        }`}>
          <p>© 2026 Ẹzza AI project • Custody of Ebonyi and Benue traditions</p>
          <p className={`mt-0.5 transition-colors ${isDarkMode ? 'text-gray-650' : 'text-gray-500'}`}>Powered by server-side Gemini 3.1 &amp; 3.5 voice synthesis and translation engine arrays</p>
        </div>
      </footer>

      {/* Sharing Overlay Modal */}
      <AnimatePresence>
        {sharingContent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`w-full max-w-md rounded-3xl border p-5 space-y-4 shadow-2xl relative ${
                isDarkMode 
                  ? 'bg-[#181512] border-white/10 text-gray-200' 
                  : 'bg-[#FAF8F5] border-black/10 text-[#0F0D0B]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Share2 className={`w-4 h-4 ${isDarkMode ? "text-[#D4AF37]" : "text-[#4A5D23]"}`} />
                  <h3 className="font-serif font-bold text-sm">Kpara Ekeresimọ (Share Insight)</h3>
                </div>
                <button
                  onClick={() => setSharingContent(null)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer text-sm font-bold ${
                    isDarkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-black'
                  }`}
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <span className={`text-[9px] font-mono uppercase px-2.5 py-0.5 rounded-full inline-block font-bold tracking-wider ${
                  isDarkMode ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-[#4A5D23]/10 text-[#4A5D23]'
                }`}>
                  {sharingContent.title} {sharingContent.category ? `• ${sharingContent.category}` : ''}
                </span>

                <div className={`p-3 rounded-2xl border text-xs max-h-[160px] overflow-y-auto font-sans leading-relaxed select-all whitespace-pre-wrap ${
                  isDarkMode ? 'bg-[#0F0D0B] border-white/[0.05] text-gray-300' : 'bg-black/[0.02] border-black/[0.06] text-gray-700'
                }`}>
                  {sharingContent.text}
                </div>
              </div>

              {/* Action Options */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={handleCopyToClipboard}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer relative overflow-hidden ${
                    isDarkMode 
                      ? 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] text-gray-250' 
                      : 'bg-black/[0.02] border-black/[0.08] hover:bg-black/[0.04] text-gray-950'
                  }`}
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-bold">Ikwasaa Okike! (Copied)</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Cultural Insight</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleSystemShare}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isDarkMode 
                      ? 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] text-gray-250' 
                      : 'bg-black/[0.02] border-black/[0.08] hover:bg-black/[0.04] text-gray-950'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>System Share API</span>
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${sharingContent.text}\n\nJoin the study circle: ${sharingContent.url}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#25D366] hover:bg-[#20BA5A] text-white col-span-1"
                >
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    sharingContent.text.length > 200 
                      ? `${sharingContent.text.slice(0, 180)}... Join the Ezza study circle!` 
                      : sharingContent.text
                  )}&url=${encodeURIComponent(sharingContent.url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#1DA1F2] hover:bg-[#1a91da] text-white col-span-1"
                >
                  <span>Twitter / X</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
