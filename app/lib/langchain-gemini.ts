import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import { PromptTemplate } from "@langchain/core/prompts";

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "gemini-1.5-flash",
  temperature: 0.7,
});

// Language detection function
function detectLanguage(text: string): string {
  // Simple language detection based on common patterns
  const germanWords = /\b(ich|du|er|sie|es|wir|ihr|sie|der|die|das|ein|eine|und|oder|aber|mit|von|zu|in|auf|für|ist|sind|war|waren|haben|hat|hatte|hatten|werden|wird|wurde|wurden|können|kann|konnte|konnten|müssen|muss|musste|mussten|sollen|soll|sollte|sollten|wollen|will|wollte|wollten|dürfen|darf|durfte|durften)\b/gi;
  const englishWords = /\b(i|you|he|she|it|we|they|the|a|an|and|or|but|with|from|to|in|on|for|is|are|was|were|have|has|had|will|would|can|could|should|shall|must|may|might|do|does|did|get|got|go|went|come|came|see|saw|know|knew|think|thought|take|took|give|gave|make|made)\b/gi;
  
  const germanMatches = (text.match(germanWords) || []).length;
  const englishMatches = (text.match(englishWords) || []).length;
  
  // If unclear, check for specific German characters
  const hasGermanChars = /[äöüßÄÖÜ]/.test(text);
  
  if (hasGermanChars || germanMatches > englishMatches) {
    return 'de';
  } else if (englishMatches > 0) {
    return 'en';
  }
  
  // Default to German if uncertain (since this is primarily for German learning)
  return 'de';
}

const promptTemplate = PromptTemplate.fromTemplate(`
You are a friendly, patient conversation partner who helps with language learning. 
You automatically detect the language the user is speaking and respond in the same language.

IMPORTANT INSTRUCTIONS:
- If the user speaks German, respond in German like a native speaker
- If the user speaks English, respond in English naturally
- Maintain the same conversational tone regardless of language
- Be encouraging and helpful with language learning
- Ask follow-up questions to keep conversations flowing
- Gently correct mistakes when appropriate
- Adapt to the user's language level

Previous conversation:
{history}

User said: {input}

Response:`);

const memory = new BufferMemory({
  memoryKey: "history",
  inputKey: "input",
});

const conversationChain = new ConversationChain({
  llm: model,
  prompt: promptTemplate,
  memory,
});

export async function getLanguageResponse(userInput: string): Promise<{text: string, language: string, detectedLanguage: string}> {
  try {
    const detectedLanguage = detectLanguage(userInput);
    const response = await conversationChain.predict({ input: userInput });
    
    // Clean up the response
    const cleanResponse = response.trim();
    
    return {
      text: cleanResponse,
      language: detectedLanguage,
      detectedLanguage: detectedLanguage
    };
  } catch (error) {
    console.error("Error getting response from Gemini:", error);
    
    // Fallback responses based on detected language
    const detectedLanguage = detectLanguage(userInput);
    const fallbackText = detectedLanguage === 'en' 
      ? "Sorry, I had a small problem. Could you say that again?"
      : "Entschuldigung, ich hatte ein kleines Problem. Können Sie das noch einmal sagen?";
    
    return {
      text: fallbackText,
      language: detectedLanguage,
      detectedLanguage: detectedLanguage
    };
  }
}