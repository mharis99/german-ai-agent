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
    // Import the conversation function
    const { getLanguageResponse } = await import("~/lib/langchain-gemini");
    
    // Get AI response with language detection
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

async function generateSpeech(text: string) {
  // This is handled by Web Speech API in the frontend
  return { audioUrl: null };
}

export default function Index() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<Array<{text: string, isUser: boolean, language?: string}>>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>('de-DE');
  
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
      
      // Update current language if detected
      if (fetcher.data.detectedLanguage) {
        setCurrentLanguage(fetcher.data.detectedLanguage === 'en' ? 'en-US' : 'de-DE');
      }
      
      // Play AI response using Web Speech API with correct language
      const utterance = new SpeechSynthesisUtterance(fetcher.data.text);
      utterance.lang = fetcher.data.language === 'en' ? 'en-US' : 'de-DE';
      utterance.rate = 0.9; // Slightly slower for language learning
      utterance.pitch = 1.0;
      
      // Wait a moment before speaking to ensure smooth experience
      setTimeout(() => {
        speechSynthesis.speak(utterance);
      }, 100);
      
      setIsProcessing(false);
    }
  }, [fetcher.data]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        sendAudioToServer(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const sendAudioToServer = (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    
    fetcher.submit(formData, {
      method: "POST",
      encType: "multipart/form-data",
    });
  };

  // Enhanced speech recognition with language detection
  const startSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Set up recognition for both languages
      recognition.lang = currentLanguage;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        setIsRecording(true);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        console.log(`Recognized: "${transcript}" (confidence: ${confidence})`);
        
        setConversation(prev => [...prev, { 
          text: transcript, 
          isUser: true,
          language: currentLanguage
        }]);
        
        // Send transcript to AI
        const formData = new FormData();
        formData.append('transcript', transcript);
        fetcher.submit(formData, { method: "POST" });
        
        setIsRecording(false);
        setIsProcessing(true);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        
        // Try alternative language if recognition failed
        if (event.error === 'no-speech' || event.error === 'not-allowed') {
          // Don't retry automatically, let user try again
        }
      };
      
      recognition.start();
    } else {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
    }
  };

  // Language toggle function
  const toggleLanguage = () => {
    const newLang = currentLanguage === 'de-DE' ? 'en-US' : 'de-DE';
    setCurrentLanguage(newLang);
  };

return (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6">
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-gray-800">
        Multilingual AI Partner 🌍
      </h1>

      {/* Language Toggle */}
      <div className="text-center mb-4">
        <button
          onClick={toggleLanguage}
          className="bg-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md text-sm font-medium text-gray-700 w-full sm:w-auto"
        >
          {`Currently listening in: ${currentLanguage === 'de-DE' ? '🇩🇪 Deutsch' : '🇺🇸 English'}`}
          <div className="text-xs text-gray-500">Tap to switch</div>
        </button>
      </div>

      {/* Conversation Box */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 h-[60vh] overflow-y-auto space-y-3">
        <h2 className="text-md font-semibold text-gray-700 mb-2">Conversation</h2>

        {conversation.length === 0 && (
          <p className="text-gray-500 italic text-center text-sm">
            {currentLanguage === 'de-DE'
              ? "Klicken Sie auf das Mikrofon, um ein Gespräch zu beginnen..."
              : "Click the microphone to start a conversation..."}
          </p>
        )}

        {conversation.map((message, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg text-sm ${
              message.isUser ? 'bg-blue-100 ml-10 text-right' : 'bg-gray-100 mr-10 text-left'
            }`}
          >
            <div className="flex items-center justify-between mb-1 text-gray-600">
              <span className="font-medium">{message.isUser ? 'You' : 'AI Partner'}</span>
              <span className="text-xs">{message.language === 'en' ? '🇺🇸' : '🇩🇪'}</span>
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
              <div className="text-xs">{currentLanguage === 'de-DE' ? 'Denkt...' : 'Thinking...'}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-xl sm:text-2xl mb-1">🎤</div>
              <div className="text-xs">{currentLanguage === 'de-DE' ? 'Sprechen' : 'Speak'}</div>
            </div>
          )}
        </button>

        <p className="mt-3 text-sm text-gray-600">
          {isRecording
            ? currentLanguage === 'de-DE' ? "Sprechen Sie jetzt..." : "Speak now..."
            : isProcessing
            ? currentLanguage === 'de-DE' ? "Verarbeitung läuft..." : "Processing..."
            : currentLanguage === 'de-DE'
            ? "Tippen Sie auf das Mikrofon, um zu sprechen"
            : "Tap the microphone to speak"}
        </p>
      </div>

      {/* Tips Section */}
      <div className="mt-6 bg-white rounded-lg shadow p-4 text-sm">
        <h3 className="font-semibold text-gray-700 mb-2">
          {currentLanguage === 'de-DE' ? 'Tipps für bessere Gespräche:' : 'Tips for better conversations:'}
        </h3>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          {currentLanguage === 'de-DE' ? (
            <>
              <li>Sprechen Sie deutlich und in normalem Tempo</li>
              <li>Stellen Sie Fragen, um das Gespräch am Laufen zu halten</li>
              <li>Keine Angst vor Fehlern – sie gehören zum Lernen!</li>
              <li>Verwenden Sie alltägliche Themen wie Wetter, Hobbys, Pläne</li>
              <li>Die KI erkennt automatisch die Sprache und antwortet entsprechend</li>
            </>
          ) : (
            <>
              <li>Speak clearly and at a normal pace</li>
              <li>Ask questions to keep the conversation going</li>
              <li>Don’t worry about mistakes – they’re part of learning!</li>
              <li>Use everyday topics like weather, hobbies, or plans</li>
              <li>The AI automatically detects language and responds accordingly</li>
            </>
          )}
        </ul>
      </div>
    </div>
  </div>
);
}