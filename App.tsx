import React, { useState, useRef } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
const AGENT_ID = import.meta.env.VITE_AGENT_ID;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const LANGUAGES = [
  { code: 'en-US', label: 'English', ttsVoice: 'en-US-Chirp3-HD-Leda', dialogflow: 'en' }
];
// Utility to clean text for TTS (removes emojis, symbols, and pause markers)
function cleanTextForTTS(text: string) {
  return text
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\[pause short\]/gi, '')
    .replace(/\[pause\]/gi, '')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\s+([?.!,;:])/g, '$1')
    .trim();
}
// Language-aware, humanizing prompt enhancer (English only)
function makePromptNatural(text: string, lang: string) {
  let t = text.trim();
  t = t.replace(/\bI am\b/g, "I'm")
    .replace(/\bYou are\b/g, "You're")
    .replace(/\bWe are\b/g, "We're")
    .replace(/\bLet us\b/g, "Let's")
    .replace(/\bDo not\b/g, "Don't")
    .replace(/\bCan not\b/g, "Can't")
    .replace(/\bWill not\b/g, "Won't")
    .replace(/\bIt is\b/g, "It's")
    .replace(/\bThat is\b/g, "That's")
    .replace(/\bThere is\b/g, "There's");
  t = t.replace(/([?])(\s|$)/g, '$1 [pause] ');
  t = t.replace(/([!])(\s|$)/g, '$1 [pause short] ');
  t = t.replace(/(hello|hi|hey)[,.!?]?/i, '$1...');
  if (/\?$/.test(t) && Math.random() < 0.15) {
    t = t.replace(/^/, "Um, ");
  }
  t = t.replace(/((?:\S+\s+){20,}\S+[.!?])/g, '$1 [pause]');
  t = t.replace(/[ ]{2,}/g, ' ').replace(/\s+([?.!,;:])/g, '$1').trim();
  return t;
}
// Helper to remove hyperlinks from text
function removeLinks(text: string) {
  return text.replace(/https?:\/\/\S+|www\.\S+/gi, '').replace(/[ ]{2,}/g, ' ').trim();
}
function getOrCreateSessionId() {
  const key = "psa_session_id";
  const expiryKey = "psa_session_expiry";
  const now = Date.now();
  const hours = 72;
  const expiry = now + hours * 60 * 60 * 1000;
  let sessionId = localStorage.getItem(key);
  let sessionExpiry = localStorage.getItem(expiryKey);
  if (!sessionId || !sessionExpiry || now > Number(sessionExpiry)) {
    sessionId = `user-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(key, sessionId);
    localStorage.setItem(expiryKey, expiry.toString());
  }
  return sessionId;
}
const MAX_TTS_LENGTH = 8000;
const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef(getOrCreateSessionId());
  const selectedLang = LANGUAGES[0];
  const speakWithGoogleTTS = async (text: string) => {
    if (!accessToken) return;
    try {
      const noLinks = removeLinks(text);
      const naturalText = makePromptNatural(noLinks, selectedLang.code);
      const cleanedText = cleanTextForTTS(naturalText);
      if (cleanedText.length > MAX_TTS_LENGTH) {
        setError("Sorry, the response is too long to read aloud.");
        return;
      }
      const truncated = cleanedText.slice(0, MAX_TTS_LENGTH);
      const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { text: truncated },
          voice: { languageCode: selectedLang.code, name: selectedLang.ttsVoice },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.9
          }
        })
      });
      const data = await response.json();
      if (data.audioContent) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        const audio = new Audio('data:audio/mp3;base64,' + data.audioContent);
        audioRef.current = audio;
        audio.play();
      }
    } catch (err) {
      setError('Text-to-Speech failed.');
    }
  };
  const login = useGoogleLogin({
    clientId,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    onSuccess: tokenResponse => {
      setAccessToken(tokenResponse.access_token);
      setError(null);
      setMessages([
        { sender: 'agent', text: "Hello! I'm Iris, your Coaching Assistant. How can I support your growth today?" }
      ]);
      speakWithGoogleTTS("Hello! I'm Iris, your Coaching Assistant. How can I support your growth today?");
    },
    onError: () => setError("Google Sign-In failed. Please try again."),
    flow: 'implicit',
  });
  const sendMessage = async (text: string) => {
    setMessages(prev => [...prev, { sender: 'user', text }]);
    setLoading(true);
    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const sessionId = sessionIdRef.current;
    try {
      const response = await fetch(
        `https://europe-west2-dialogflow.googleapis.com/v3/${AGENT_ID}/sessions/${sessionId}:detectIntent`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            queryInput: {
              text: { text },
              languageCode: selectedLang.dialogflow
            }
          })
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Dialogflow error:', errorData);
        throw new Error(`API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      const data = await response.json();
      const agentReply = data.queryResult?.responseMessages?.[0]?.text?.text?.[0] || "Sorry, I didn't understand that.";
      speakWithGoogleTTS(agentReply);
      setMessages(prev => [...prev, { sender: 'agent', text: agentReply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { sender: 'agent', text: "Error contacting Iris." }]);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };
  const handleMicClick = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    setError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang.code;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let finalTranscript = '';
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: any) => {
      finalTranscript = event.results[0][0].transcript;
    };
    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again and speak clearly into your microphone.');
      } else if (event.error === 'audio-capture') {
        setError('No microphone found. Please check your microphone settings.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access in your browser.');
      } else {
        setError('Speech recognition error: ' + event.error);
      }
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      if (finalTranscript.trim()) {
        sendMessage(finalTranscript);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };
  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 p-4">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl text-center">
          <h1 className="text-3xl font-bold text-sky-400 mb-6">Iris: Coaching Assistant</h1>
          <p className="text-slate-300 mb-8">Please sign in with your Google account to continue.</p>
          {error && <p className="text-red-400 mb-4">{error}</p>}
          <button
            onClick={() => login()}
            className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100">
      <div className="flex justify-between items-center p-4 bg-slate-900 shadow">
        <h1 className="text-xl font-bold text-sky-400">Iris: Coaching Assistant</h1>
        <button
          onClick={() => { googleLogout(); setAccessToken(null); setMessages([]); }}
          className="text-slate-300 hover:text-red-400"
        >
          Log out
        </button>
      </div>
      {/* Language dropdown removed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-xl mx-auto p-3 rounded-lg ${msg.sender === 'user' ? 'bg-sky-600 text-white text-right' : 'bg-slate-700 text-slate-100 text-left'}`}
          >
            <span>{msg.sender === 'agent' ? removeLinks(msg.text) : msg.text}</span>
          </div>
        ))}
        {loading && (
          <div className="max-w-xl mx-auto p-3 rounded-lg bg-slate-700 text-slate-100 text-left">
            Iris is typing...
          </div>
        )}
      </div>
      <div className="flex p-4 bg-slate-900 justify-center">
        <button
          type="button"
          onClick={handleMicClick}
          className={`${
            listening
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-sky-500 hover:bg-sky-600'
          } text-white px-8 py-4 rounded-full font-bold text-2xl shadow-lg ${listening ? 'animate-pulse' : ''}`}
          disabled={loading}
          aria-label={listening ? "Stop Listening" : "Speak"}
        >
          {listening ? '🛑 Stop Listening' : '🎤 Tap to Speak'}
        </button>
      </div>
      {error && <div className="text-red-400 text-center p-2">{error}</div>}
    </div>
  );
};
export default App;