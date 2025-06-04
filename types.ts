
export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export enum SpeechRecognitionStatus {
  IDLE = "idle",
  LISTENING = "listening",
  PROCESSING = "processing",
  ERROR = "error"
}
