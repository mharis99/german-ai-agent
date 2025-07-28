import { useState, useRef, useEffect } from "react";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const transcript = formData.get("transcript") as string;
  
  if (!transcript) {
    return json({ error: "No transcript provided" }, { status: 400 });
  }

  try {
    const { getLanguageResponse } = await import("~/lib/langchain-gemini");
    const aiResponse = await getLanguageResponse(transcript);
    
    return json({ 
      text: aiResponse.text,
      language: aiResponse.language,
      detectedLanguage: aiResponse.detectedLanguage
    });
  } catch (error) {
    console.error("Error processing transcript:", error);
    return json({ error: "Processing failed" }, { status: 500 });
  }
};

export default function Index() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<Array<{text: string, isUser: boolean, language?: string}>>([]);
  const [currentLanguage] = useState<string>('de-DE');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.data && !fetcher.data.error) {
      setConversation(prev => [...prev, { 
        text: fetcher.data.text, 
        isUser: false,
        language: fetcher.data.language 
      }]);

      const utterance = new SpeechSynthesisUtterance(fetcher.data.text);
      utterance.lang = 'de-DE';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      setTimeout(() => {
        speechSynthesis.speak(utterance);
      }, 100);

      setIsProcessing(false);
    }
  }, [fetcher.data]);

  const startSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = 'de-DE';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsRecording(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;

        setConversation(prev => [...prev, { 
          text: transcript, 
          isUser: true,
          language: 'de' 
        }]);

        const formData = new FormData();
        formData.append('transcript', transcript);
        fetcher.submit(formData, { method: "POST" });

        setIsRecording(false);
        setIsProcessing(true);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.start();
    } else {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl sm:text-3xl font-bold text-center mb-5 text-gray-800">
          Deutscher KI Partner
        </h1>

        {/* Conversation Box */}
        <div className="bg-white rounded-xl shadow p-4 mb-6 h-[65vh] overflow-y-auto space-y-3">
          <h2 className="text-md font-semibold text-gray-700 mb-2">Gespräch</h2>

          {conversation.length === 0 && (
            <p className="text-gray-500 italic text-center text-sm">
              Klicken Sie auf das Mikrofon, um zu starten...
            </p>
          )}

          {conversation.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg text-sm leading-relaxed ${
                message.isUser
                  ? 'bg-blue-100 ml-10 text-right'
                  : 'bg-gray-100 mr-10 text-left'
              }`}
            >
              <div className="flex items-center justify-between mb-1 text-gray-600 text-xs font-medium">
                <span>{message.isUser ? 'Du' : 'KI Partner'}</span>
              </div>
              <div className="text-gray-800">{message.text}</div>
            </div>
          ))}
        </div>

        {/* Microphone Button */}
        <div className="text-center">
          <button
            onClick={startSpeechRecognition}
            disabled={isRecording || isProcessing}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full text-white font-bold shadow-lg transition-all duration-200 focus:outline-none ${
              isRecording
                ? 'bg-red-500 scale-105 animate-pulse'
                : isProcessing
                ? 'bg-yellow-500 animate-spin'
                : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
            }`}
          >
            {isRecording ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full mb-1"></div>
                <div className="text-xs">Hört zu...</div>
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-1"></div>
                <div className="text-xs">Denkt...</div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-xl sm:text-2xl mb-1">🎤</div>
                <div className="text-xs">Sprechen</div>
              </div>
            )}
          </button>

          <p className="mt-4 text-sm text-gray-600">
            {isRecording
              ? "Sprechen Sie jetzt..."
              : isProcessing
              ? "Verarbeitung läuft..."
              : "Tippen Sie auf das Mikrofon, um zu sprechen"}
          </p>
        </div>
      </div>
    </div>
  );
}
