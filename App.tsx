import React, { useState, useRef } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';

const AGENT_ID = "projects/patient-support-451116/locations/global/agents/146c6358-9456-4f3d-bd69-9eb76795eb9b";
const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Language options with Dialogflow and TTS voice codes
const LANGUAGES = [
  { code: 'en-US', label: 'English', ttsVoice: 'en-US-Chirp3-HD-Erinome', dialogflow: 'en' },
  { code: 'de-DE', label: 'Deutsch', ttsVoice: 'de-DE-Chirp3-HD-Erinome', dialogflow: 'de' },
  { code: 'fr-FR', label: 'Français', ttsVoice: 'fr-FR-Chirp3-HD-Erinome', dialogflow: 'fr' },
  { code: 'es-ES', label: 'Español', ttsVoice: 'es-ES-Chirp3-HD-Erinome', dialogflow: 'es' },
  { code: 'pt-BR', label: 'Português (Brasil)', ttsVoice: 'pt-BR-Chirp3-HD-Erinome', dialogflow: 'pt-BR' },
  { code: 'cmn-CN', label: '中文 (简体)', ttsVoice: 'cmn-CN-Chirp3-HD-Erinome', dialogflow: 'zh-CN' },
];

// Utility to clean text for TTS (removes emojis and symbols)
function cleanTextForTTS(text: string) {
  return text
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
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

const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState('en-US');

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef(getOrCreateSessionId());

  // Find the selected language/voice
  const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // Google Cloud TTS function with language/voice selection
  const speakWithGoogleTTS = async (text: string) => {
    if (!accessToken) return;
    try {
      const cleanedText = cleanTextForTTS(text);
      const markup = cleanedText.replace(/\.\s*/g, '. [pause] ');
      const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { markup },
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
        { sender: 'agent', text: "Hello! I'm your Patient Support Cloud Agent. How can I assist you today?" }
      ]);
      speakWithGoogleTTS("Hello! I'm your Patient Support Cloud Agent. How can I assist you today?");
    },
    onError: () => setError("Google Sign-In failed. Please try again."),
    flow: 'implicit',
  });

  // Send message to agent and speak reply
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
        `https://dialogflow.googleapis.com/v3/${AGENT_ID}/sessions/${sessionId}:detectIntent`,
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
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      const data = await response.json();
      const agentReply = data.queryResult?.responseMessages?.[0]?.text?.text?.[0] || "Sorry, I didn't understand that.";
      setMessages(prev => [...prev, { sender: 'agent', text: agentReply }]);
      speakWithGoogleTTS(agentReply);
    } catch (err: any) {
      setMessages(prev => [...prev, { sender: 'agent', text: "Error contacting agent." }]);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Speech Recognition Logic
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
    recognition.lang = selectedLang.code; // Use the selected language for recognition
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
          <h1 className="text-3xl font-bold text-sky-400 mb-6">Patient Support Agent</h1>
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
        <h1 className="text-xl font-bold text-sky-400">Patient Support Agent</h1>
        <button
          onClick={() => { googleLogout(); setAccessToken(null); setMessages([]); }}
          className="text-slate-300 hover:text-red-400"
        >
          Log out
        </button>
      </div>
      <div className="p-4">
        <label htmlFor="lang" className="mr-2 font-semibold">Language:</label>
        <select
          id="lang"
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className="p-2 rounded text-black"
        >
          {LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-xl mx-auto p-3 rounded-lg ${msg.sender === 'user' ? 'bg-sky-600 text-white text-right' : 'bg-slate-700 text-slate-100 text-left'}`}
          >
            <span>{msg.text}</span>
          </div>
        ))}
        {loading && (
          <div className="max-w-xl mx-auto p-3 rounded-lg bg-slate-700 text-slate-100 text-left">
            Agent is typing...
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