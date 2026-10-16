import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import { createServer } from "http";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload sizes for recorded audio data
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy initializer for GoogleGenAI to prevent crashing if key is missing
let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    // Fallback safe init
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Global state or presets (e.g. well-known verses in Ezza dialect)
const EZZA_VERSES = [
  {
    ref: "Dshẹnẹsisi (Genesis) 1:1",
    spokenEzza: "L'ovumbọ, l'iphe Chisoke mgbọkọ-ẹto whụ-ẹka kpata mgbọko dọko kpa mgbọko whụ-ẹwhu mgbọko t'ẹdu.",
    phonetics: "L'oh-vum-bo, l'ee-p-he Chee-so-keh m-g-bo-ko eh-toe woo eh-ka k-pa-ta m-g-bo-ko doh-ko k-pa m-g-bo-ko woo eh-woo m-g-bo-ko teh-doo.",
    englishTranslation: "In the beginning God created the heaven and the earth.",
    lessonNotes: "The Ezza name for the Creator is 'Chisoke' (composed of Chi-So-Kẹ: God who is all sufficient, creator). Rather than standard Igbo 'Chukwu', which is a composite of Chi-ukwu (Big God), Ezza people localized God with full sovereignty as Chisoke or Oshiri-ka."
  },
  {
    ref: "Dshọnu (John) 3:16",
    spokenEzza: "No-phe kpa Chisoke whụ́ mgbọko kpahu mgbọko ọ-mẹ wharụ Nwa-ye ovumbọ ye yẹ t'onye ọku-bọ-ọma iwhẹ iwhẹ j'ẹwhuru iwhẹ tọ-ẹka tọ.",
    phonetics: "Noh-p-heh k-pah Chee-so-keh woo m-g-bo-ko k-pah-hoo m-g-bo-ko oh-meh wah-roo N-wah-yeh o-vum-bo yeh yeh teh-on-yeh oh-koo bah oh-mah ee-weh ee-weh jeh-woo-roo ee-weh toh-eh-ka toe.",
    englishTranslation: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    lessonNotes: "Notice the word 'Nwa-ye ovumbọ' denoting 'only or first child/son'. Grace in Ezza is often expressed under 'Iwhẹ-ọma-Chisoke' (favor of God) or 'Uru-ọma'."
  },
  {
    ref: "Dshọnu (John) 1:1",
    spokenEzza: "L'ovumbọ l'iwho-mẹ wharụ Oku kpa l'iwho-mẹ Oku dụ whụ-ẹka kpata Chisoke mgbọkọ kpahu Chisoke bẹ bụ Oku kpahu.",
    phonetics: "L'oh-vum-bo l'ee-who-meh wah-roo Oh-koo k-pah l'ee-who-meh Oh-koo doo woo-eh-ka k-pa-ta Chee-so-keh m-g-bo-ko k-pah-hoo Chee-so-keh beh boo Oh-koo k-pah-hoo.",
    englishTranslation: "In the beginning was the Word, and the Word was with God, and the Word was God.",
    lessonNotes: "The 'Word' is translated as 'Oku' (which literally means speech, word, or fire, depending on tone, but in this biblical context signifies the spoken truth/revelation)."
  },
  {
    ref: "Abụ-Ọma (Psalm) 23:1",
    spokenEzza: "Onye-nkwo-ata n'achiri n'iwho mu bụ Chisoke mu iwhẹ iwhẹ g'atọ mu n'ata tọ.",
    phonetics: "On-yeh n-k-woh ah-tah nah-chee-ree nee-who moo boo Chee-so-keh moo ee-weh ee-weh gah-toe moo nah-tah toe.",
    englishTranslation: "The Lord is my shepherd; I shall not want.",
    lessonNotes: "The shepherd metaphor is localized as 'Onye-nkwo-ata'—the one who guides livestock to green pastures. It conveys safety, grazing, and constant provision."
  },
  {
    ref: "Áturụ-ọma (Proverbs) 3:5",
    spokenEzza: "Mgbavụ ọku-bọ-ọma dshị l'ogbe-obu l'iwho Chisoke; t'unwu ọru l'ivwẹ-eka ogu l'onye nwẹ-mẹ.",
    phonetics: "M-g-bah-voo oh-koo bah oh-mah jee loh-g-beh oh-boo lee-who Chee-so-keh; teh-oon-woo oh-roo lee-v-weh eh-ka oh-goo lohn-yeh n-weh-m-eh.",
    englishTranslation: "Trust in the Lord with all thine heart; and lean not unto thine own understanding.",
    lessonNotes: "'Mgbavụ' or 'ọku-bọ-ọma' represent deep trust or faith. 'Ogbe-obu' is literally 'box of heart' meaning the deep core of your devotion."
  }
];

// Presets for Bite-Sized Lessons
const EZZA_LESSONS = [
  {
    id: "greetings",
    title: "Greetings & Respect",
    category: "Greetings",
    items: [
      {
        english: "Welcome / Hello (to one)",
        ezza: "Ẹka bẹka",
        pronunciation: "Eh-ka beh-ka",
        explanation: "The standard Ezza greeting to show respect. Translates roughly to 'You are doing well'."
      },
      {
        english: "Welcome / Hello (to many)",
        ezza: "Unu a-boshia",
        pronunciation: "Oo-noo ah-bo-shee-ah",
        explanation: "Plural greeting or collective acknowledgment of work or presence."
      },
      {
        english: "Have people of your house woken up?",
        ezza: "Iphe unwu ẹka nwẹnu ahoolapa sọ?",
        pronunciation: "Ee-p-heh oon-woo eh-ka n-weh-noo ah-hoh-lah-pa soh?",
        explanation: "Traditional polite inquiry about relatives' health in the morning."
      },
      {
        english: "Good night",
        ezza: "Kpa-ẹnya t'ẹbọshi",
        pronunciation: "K-pah eh-nyah teh-bo-shee",
        explanation: "Literally 'Till the morning dawns' or 'Till daylight comes'."
      }
    ]
  },
  {
    id: "numbers",
    title: "Numbers 1 to 10",
    category: "Counting",
    items: [
      { english: "One", ezza: "Nanụ", pronunciation: "Nah-noo", explanation: "Basic cardinal number 1." },
      { english: "Two", ezza: "Ẹbọ", pronunciation: "Eh-bo", explanation: "Basic cardinal number 2." },
      { english: "Three", ezza: "Ẹto", pronunciation: "Eh-toe", explanation: "Basic cardinal number 3." },
      { english: "Four", ezza: "Ẹno", pronunciation: "Eh-no", explanation: "Basic cardinal number 4." },
      { english: "Five", ezza: "Ẹsa", pronunciation: "Eh-sah", explanation: "Basic cardinal number 5." },
      { english: "Six", ezza: "Isinu", pronunciation: "Ee-see-noo", explanation: "Basic cardinal number 6." },
      { english: "Seven", ezza: "Ẹsa-nanụ (or Ẹsaa)", pronunciation: "Eh-sah-nah-noo", explanation: "Basic cardinal number 7." },
      { english: "Eight", ezza: "Ẹsato", pronunciation: "Eh-sah-toe", explanation: "Basic cardinal number 8." },
      { english: "Nine", ezza: "Tolu", pronunciation: "To-loo", explanation: "Basic cardinal number 9." },
      { english: "Ten", ezza: "Iri", pronunciation: "Ee-ree", explanation: "Basic cardinal number 10." }
    ]
  },
  {
    id: "family",
    title: "Family & Relations",
    category: "Family",
    items: [
      { english: "Father / Dad", ezza: "Nna / Nna-mu", pronunciation: "N-nah / N-nah-moo", explanation: "'Nna-mu' means 'my father'. A term of high respect." },
      { english: "Mother / Mom", ezza: "Nne / Nne-mu", pronunciation: "N-neh / N-neh-moo", explanation: "'Nne-mu' means 'my mother'. Central pillar of the family." },
      { english: "Brother / Husband", ezza: "Nwanne-nwoke / Ji-mu", pronunciation: "N-wan-neh n-woh-keh / Jee-moo", explanation: "'Ji-mu' translates literally to 'my husband' or 'my holder'." },
      { english: "Sister / Wife", ezza: "Nwanne-nwanyị / Nyee-mu", pronunciation: "N-wan-neh n-wan-yee / Nyee-moo", explanation: "'Nyee-mu' translates to 'my companion/wife'." },
      { english: "Child / Son / Daughter", ezza: "Nwa / Nwata", pronunciation: "N-wah / N-wah-tah", explanation: "General word for offspring or toddler children." }
    ]
  }
];

// Helper to sanitize JSON response from LLM
function parseLLMResponse(text: string) {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse JSON from response:", text, err);
    // Extracted fallback
    return {
      error: true,
      raw: text,
    };
  }
}

// 1. CHAT / TRANSLATE / VOICE PROCESSING ENDPOINT
app.post("/api/gemini/chat", async (req, res) => {
  const { message, mode, voiceName, audioData, audioMime } = req.body;
  const targetVoice = voiceName || "Kore"; // Puck, Kore, Zephyr, Fenrir, Charon
  const ai = getAI();

  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({
      error: "GEMINI_API_KEY is not configured. Please add it to your secrets panel.",
    });
  }

  try {
    let responseText = "";
    let contentsPayload: any[] = [];

    // System Instructions depending on the active operational mode
    let systemInstruction = "";

    if (mode === "bible") {
      systemInstruction = `
You are Ezza AI, acting as an authoritative Bible companion for the Ezza (Ẹzza) people. You speak of Scriptures natively using the Ezza dialect of the Izi-Ezaa-Ikwo-Mgbo cluster of Ebonyi State / Benue Ezza regions.
You possess a profound knowledge of the Christian Bible translated into Ezza.

When the user asks for a scripture or biblical advice/passage:
1. Recite the Ezza Bible verse with high linguistic accuracy.
2. Prefer Ezza-specific traditional and translation designations (e.g. Chisoke, Ume-ọha, Iwhẹ-ọma) rather than standard Central Igbo terms.
3. Formulate the response as JSON using the schema below.

Response Schema:
{
  "transcription": "optional transcription of user voice if any",
  "voiceFeedback": "pronunciation feedback if voice input was provided, otherwise null",
  "spokenEzza": "The Ezza scripture text or bible reading paragraph",
  "phonetics": "A simple guide emphasizing syllable separations for correct pronounciation",
  "englishTranslation": "The corresponding English translation",
  "lessonNotes": "Bible Reference / Historical explanation of Ezza terms (e.g. Chisoke vs. Chukwu, or Ume-ọha) and deep cultural encouragement."
}
Return only the raw JSON. No conversational text outside the JSON.
`;
    } else if (mode === "lesson") {
      systemInstruction = `
You are Ezza AI, an engaging voice-first language tutor teaching Ezza.
Users want bite-sized, supportive tutoring.

When the user requests to learn a phrase or submits voice practicing a word:
1. Deliver lessons containing the exact phrase, phonetic guide, and translation.
2. If voice audio is provided, listen with great precision to transcribe and gently evaluate their accent / pronunciation.
3. Keep the feedback incredibly encouraging and helpful.
4. Formulate the response as JSON using the schema below.

Response Schema:
{
  "transcription": "strictly transcribe what they said",
  "voiceFeedback": "coaching feedback detailing how close they got to the Ezza phonological structure, highlighting tonal or syllable corrections",
  "spokenEzza": "The target Ezza word or phrase the user is practicing/asking about",
  "phonetics": "A detailed syllable-level phonetic break-down indicating pronunciation",
  "englishTranslation": "English definition/translation",
  "lessonNotes": "Grammar context or cultural norms explaining why this term is used."
}
Return only the raw JSON. No conversational text outside the JSON.
`;
    } else {
      // Natural Conversation Mode
      systemInstruction = `
You are Ezza AI, an interactive native companion speaking Ezza.
Conduct warm, short daily conversation in the Ezza dialect (Ebonyi/Benue).
Keep answers perfectly suited for rhythmically natural spoken voice playback.

If user sent direct spoken audio (base64 audio format), listen to it carefully.
Gently review their language skills and then converse about the topics they raised.
Formulate the response as JSON using the schema below.

Response Schema:
{
  "transcription": "transcription of what they said if they sent audio, otherwise null",
  "voiceFeedback": "gentle pronunciation critique if they uploaded voice, otherwise null",
  "spokenEzza": "Your reply in natural, spoken Ezza",
  "phonetics": "pronunciation guide for your reply",
  "englishTranslation": "English translation of your reply",
  "lessonNotes": "Cultural context, interesting idiom, or word breakdowns to enrich the conversational experience."
}
Return only the raw JSON. No conversational text outside the JSON.
`;
    }

    // Include the user's audio file if uploaded
    if (audioData && audioMime) {
      contentsPayload.push({
        inlineData: {
          data: audioData,
          mimeType: audioMime,
        },
      });
      // Add instructional prompt text alongside audio
      contentsPayload.push({
        text: `The user submitted this voice recording. Analyze this files audio, write a transcription, evaluate the pronunciation/meaning if in Ezza or English, and respond accordingly relative to mode: ${mode}. User message context: ${message || "Voice input practicing or chatting"}`,
      });
    } else {
      contentsPayload.push({
        text: message || "Greet me in Ezza and share a local proverb!",
      });
    }

    // Call Gemini to generate the text and structured data
    const geminiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contentsPayload,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const parsedData = parseLLMResponse(geminiResponse.text || "{}");

    // If parsing failed or fallback is needed, create a safe fallback object
    const finalJSON = parsedData.error
      ? {
          transcription: audioData ? "Voice recorded..." : null,
          voiceFeedback: audioData ? "I heard your voice. Keep speaking, you are doing great!" : null,
          spokenEzza: "Ẹka bẹka! Ọbu iwhẹ ọma tẹ l'ayi dụ whọ.",
          phonetics: "Eh-ka beh-ka! Oh-boo ee-weh oh-mah teh lah-yee doo who.",
          englishTranslation: "Hello! It is a good thing that we are here.",
          lessonNotes: geminiResponse.text || "A beautiful traditional Ezza greeting.",
        }
      : parsedData;

    // 2. CONVERT THE SPOKEN EZZA PORTION TO TEXT-TO-SPEECH (TTS) SECURELY
    let base64AudioOut = null;
    let audioQuotaExceeded = false;
    if (finalJSON.spokenEzza) {
      try {
        const ttsPrompt = `Please speak this Ezza sentence naturally and with warm, friendly tone. Do not say anything else besides the exact words: ${finalJSON.spokenEzza}`;
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: ttsPrompt }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: targetVoice },
              },
            },
          },
        });

        base64AudioOut = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (audioErr: any) {
        console.error("TTS generation failed:", audioErr);
        const errStr = String(audioErr.message || audioErr);
        if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("limit") || errStr.includes("exhausted")) {
          audioQuotaExceeded = true;
        }
      }
    }

    res.json({
      ...finalJSON,
      audioBase64: base64AudioOut,
      audioQuotaExceeded
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/chat:", error);
    res.status(500).json({
      error: "Internal server error: " + (error.message || error),
    });
  }
});

// 2. DIRECT STANDALONE TEXT-TO-SPEECH ENDPOINT (For tapping on individual words in lessons)
app.post("/api/gemini/tts", async (req, res) => {
  const { text, voiceName } = req.body;
  const targetVoice = voiceName || "Kore";
  const ai = getAI();

  if (!text) {
    return res.status(400).json({ error: "No text provided for text-to-speech." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({
      error: "GEMINI_API_KEY is not configured.",
    });
  }

  try {
    const ttsPrompt = `Speak this Ezza phrase clearly and slow enough to learn. Speak only this text: ${text}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: targetVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ audioBase64: base64Audio });
    } else {
      res.status(500).json({ error: "No audio was generated by the model." });
    }
  } catch (error: any) {
    console.error("TTS standalone error:", error);
    const errStr = String(error.message || error);
    if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("limit") || errStr.includes("exhausted")) {
      return res.status(200).json({
        error: "QUOTA_EXCEEDED",
        message: "Gemini server-side TTS quota reached. Using high-fidelity local Web Speech Synthesis.",
        quotaExceeded: true
      });
    }
    res.status(500).json({ error: error.message || "Failed to generate text-to-speech." });
  }
});

// Endpoint to fetch static verses or lessons
app.get("/api/preset/verses", (req, res) => {
  res.json(EZZA_VERSES);
});

app.get("/api/preset/lessons", (req, res) => {
  res.json(EZZA_LESSONS);
});

// Pool of authentic cultural Ezza Proverbs
const EZZA_PROVERBS = [
  {
    id: "1",
    ezza: "Onye rụru ọru bẹ j'ẹri iphe ọru.",
    phonetics: "On-yeh roo-roo oh-roo beh jeh-ree ee-p-heh oh-roo",
    englishTranslation: "He who works is the one who will eat the fruits of labor.",
    culturalSignificance: "Deeply embedded in the Ezza agricultural tradition. As master farmers of the Ebonyi basin, Ezza elders use this proverb to discourage laziness and teach children that success in life is earned strictly through persistent labor.",
    category: "Labor & Success"
  },
  {
    id: "2",
    ezza: "A kpaa l'ọkụ bẹ e tude egbe-obu.",
    phonetics: "Ah k-pah loh-koo beh eh too-deh eg-beh oh-boo",
    englishTranslation: "When tested by fire, the chest (heart) is anchored.",
    culturalSignificance: "This proverb reflects the historical warrior legacy and bravery of the Ezza clan. It teaches that true character, resilience, and maturity are forged through facing severe trials and adversity without breaking.",
    category: "Courage & Resilience"
  },
  {
    id: "3",
    ezza: "Aha-mẹ-Chisoke bẹ bụ ike ọha.",
    phonetics: "Ah-ha-meh-Chee-so-keh beh boo ee-keh oh-ha",
    englishTranslation: "The covenant of the Creator is the strength of the community.",
    culturalSignificance: "This highlights the Ezza belief in 'Chisoke' (the God of Creation) and the value of keeping covenants ('Aha-mẹ'). It stresses that a community's survival depends on spiritual integrity, unity, and absolute fairness.",
    category: "Spirituality & Community"
  },
  {
    id: "4",
    ezza: "Nkwụ mgbada rụru bẹ ọ bụ nwuu-nwuu kpa ọ nọdu.",
    phonetics: "N-kwoo m-g-bah-dah roo-roo beh oh boo n-woo-n-woo k-pah oh noh-doo",
    englishTranslation: "A palm tree bent low is where the dwarf antelope will graze.",
    culturalSignificance: "Points to high virtues of hospitality, accessibility, and humility. Ezza leaders ('Ishishi') are expected to remain accessible and down-to-earth so that even the most vulnerable in society can seek refuge and counsel.",
    category: "Humility & Leadership"
  },
  {
    id: "5",
    ezza: "Ọwhu-mgbọ bẹ j'ẹwho iphe a-ka g'ọ dụ.",
    phonetics: "Oh-woo-m-g-bo beh jeh-whoo ee-p-heh ah-ka gah-doo",
    englishTranslation: "Patience discovers what is yet to come.",
    culturalSignificance: "This emphasizes 'Ọwhu-mgbọ' (endurance/patience). In modern times, it counsels the youth against running ahead of their destiny, urging them to build patient foundations for long-term wisdom.",
    category: "Patience & Wisdom"
  },
  {
    id: "6",
    ezza: "Mụta mụta bẹ bụ nne ọwhu-mẹ.",
    phonetics: "Moo-tah moo-tah beh boo n-neh oh-woo-meh",
    englishTranslation: "Learning and learning is the mother of understanding.",
    culturalSignificance: "Highlights the value of intellectual maturity and preservation of oral literature. Parents recite this to inspire children to listen to elder folklore, master linguistic tones, and pursue education.",
    category: "Knowledge & Education"
  },
  {
    id: "7",
    ezza: "Ụkoro bẹ bụ owhoo kparụ nwa-ọbụ.",
    phonetics: "Oo-ko-ro beh boo oh-whoo k-pah-roo n-wah-oh-boo",
    englishTranslation: "The throat is what carries the young chicken/fowl.",
    culturalSignificance: "An Ezza caution against unchecked appetite and greed (both literally and metaphorically). It warns that undisciplined desires or loose talk will inevitably lead one into unexpected traps.",
    category: "Greed & Self-Control"
  },
  {
    id: "8",
    ezza: "Onye t'ẹbụdụ ogu g'a kpọ nna-ya ọgwarị.",
    phonetics: "On-yeh teh-boo-doo oh-goo gah k-po n-nah-yah oh-g-wah-ree",
    englishTranslation: "He who has not experienced war thinks his father is the ultimate hero.",
    culturalSignificance: "Promotes modesty and realistic thinking. It alerts individuals to avoid blind pride or underestimating other people's strength or broader worldiness before they have experienced real tests of life.",
    category: "Perspective & Modesty"
  }
];

// Endpoint to fetch the Daily Ezza Wisdom proverb
app.get("/api/daily-proverb", (req, res) => {
  const { random } = req.query;
  if (random === "true") {
    const randomIndex = Math.floor(Math.random() * EZZA_PROVERBS.length);
    return res.json(EZZA_PROVERBS[randomIndex]);
  }
  // Deterministic daily selection based on day of the month
  const day = new Date().getDate(); // 1 to 31
  const proverb = EZZA_PROVERBS[day % EZZA_PROVERBS.length];
  res.json(proverb);
});

// Pool of common Ezza Glossary words & phrases
const EZZA_GLOSSARY = [
  {
    id: "g1",
    word: "Iwhe dụbua",
    phonetics: "Ee-p-heh doo-bwah",
    englishTranslation: "Hello / Peace / Welcome",
    definition: "Universal, respectful greeting used to welcome people or wish them well when arriving.",
    category: "Greetings"
  },
  {
    id: "g2",
    word: "Ẹhụ-gụ rị rọ?",
    phonetics: "Eh-hoo-goo ree roh",
    englishTranslation: "How are you? (lit. Is your body/health well?)",
    definition: "A core inquiry about a person's well-being and health in daily conversation.",
    category: "Greetings"
  },
  {
    id: "g3",
    word: "Ole bẹ iya dụ?",
    phonetics: "Oh-leh beh ee-yah doo",
    englishTranslation: "How much is it?",
    definition: "Commonly used in Ebonyi/Benue markets for trading, bargaining, and purchasing.",
    category: "Market & Commerce"
  },
  {
    id: "g4",
    word: "Okfụrụ-Ezza",
    phonetics: "Oh-k-foo-roo Ed-zah",
    englishTranslation: "The Ezza original homeland",
    definition: "The sacred ancestral motherland from which the Ezza clan's diaspora historically descended.",
    category: "Cultural Terms"
  },
  {
    id: "g5",
    word: "Chisoke",
    phonetics: "Chee-so-keh",
    englishTranslation: "The God of Creation",
    definition: "The supreme deity/creator in the Ezza language, emphasizing divine creative sovereignty.",
    category: "Spirituality"
  },
  {
    id: "g6",
    word: "Nna-mu",
    phonetics: "N-nah-moo",
    englishTranslation: "My Father",
    definition: "A high term of respect used to address one's biological father or any honored adult elder.",
    category: "Family"
  },
  {
    id: "g7",
    word: "Nne-mu",
    phonetics: "N-neh-moo",
    englishTranslation: "My Mother",
    definition: "An affectionate, highly honored term for a mother, regarded as the primary pillar of life.",
    category: "Family"
  },
  {
    id: "g8",
    word: "Ọwhu-mgbọ",
    phonetics: "Oh-woo m-g-bo",
    englishTranslation: "Patience / Tolerance / Long-suffering",
    definition: "One of the most highly esteemed traditional Ezza virtues, required of leaders and youth.",
    category: "Virtues"
  },
  {
    id: "g9",
    word: "Ẹzza-Inyimbo",
    phonetics: "Ed-zah Een-yeem-boh",
    englishTranslation: "Ancestral unified Ezza clan",
    definition: "The sacred, historical collective term referring to all descended children of the Ezza patriarch.",
    category: "Cultural Terms"
  },
  {
    id: "g10",
    word: "Iwhejioku",
    phonetics: "Ee-p-heh-jee-oh-koo",
    englishTranslation: "The New Yam deity/festival",
    definition: "A supreme agricultural celebration reflecting the harvest of yams, the sovereign Ezza crop.",
    category: "Festivals"
  },
  {
    id: "g11",
    word: "Nanụ",
    phonetics: "Nah-noo",
    englishTranslation: "One (1)",
    definition: "The cardinal number one in the Ezza numeric system.",
    category: "Numbers"
  },
  {
    id: "g12",
    word: "Iri",
    phonetics: "Ee-ree",
    englishTranslation: "Ten (10)",
    definition: "The cardinal number ten in the Ezza numeric system.",
    category: "Numbers"
  },
  {
    id: "g13",
    word: "Ẹka-mgbọ-ọzo",
    phonetics: "Eh-kah m-g-boh oh-zoh",
    englishTranslation: "Goodbye (lit. till another helper/time)",
    definition: "Warmly used when parting, meaning 'until we meet again' or 'next time'.",
    category: "Greetings"
  },
  {
    id: "g14",
    word: "Ome-orụ-ọwhu",
    phonetics: "Oh-meh-oh-roo-oh-woo",
    englishTranslation: "Master farmer / Hard worker",
    definition: "An honorary title given to a dedicated, productive farmer in Ezza's fertile agrarian basins.",
    category: "Agricultural"
  }
];

// Endpoint to fetch whole glossary or search terms
app.get("/api/glossary", (req, res) => {
  const { q } = req.query;
  if (q) {
    const query = String(q).toLowerCase();
    const filtered = EZZA_GLOSSARY.filter(
      item => 
        item.word.toLowerCase().includes(query) || 
        item.englishTranslation.toLowerCase().includes(query) ||
        item.definition.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
    return res.json(filtered);
  }
  res.json(EZZA_GLOSSARY);
});

// Setup Vite development server or static serving
async function initializeServer() {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/api/live-voice" });

  wss.on("connection", async (clientWs) => {
    console.log("New WebSocket client connected for Live Voice sessions.");
    let session: any = null;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        clientWs.send(JSON.stringify({ error: "GEMINI_API_KEY is not configured on the server." }));
        clientWs.close();
        return;
      }

      const ai = getAI();
      // Establish low-latency session via @google/genai SDK
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: {
            parts: [{
              text: "You are Ezza AI, an interactive native companion speaking the Ezza dialect of the Ebonyi and Benue clans. Engage in ultra-low latency, real-time voice conversations. Respond with high speech clarity. Ensure your grammar aligns with classical Ezza phonology (using terms like Chisoke, uphe, etc.). Speak directly and conversationally."
            }]
          },
        },
        callbacks: {
          onmessage: (message: any) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      clientWs.on("message", (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } catch (e) {
          console.error("Error formatting client WebSocket input:", e);
        }
      });

      clientWs.on("close", () => {
        console.log("Client web-socket closed. Closing Ezza Live Voice stream.");
        if (session) {
          try {
            session.close();
          } catch (err) {
            // skip
          }
        }
      });

    } catch (err: any) {
      console.error("Failed to start Live Voice session:", err);
      clientWs.send(JSON.stringify({ error: err.message || "Failed to initialize Live voice stream connection." }));
      clientWs.close();
    }
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Ezza AI Server running with Live Voice stream support on http://localhost:${PORT}`);
  });
}

initializeServer();
