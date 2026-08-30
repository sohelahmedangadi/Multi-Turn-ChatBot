import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';

// Extract Facts Prompt Template
const FACT_EXTRACTION_PROMPT = PromptTemplate.fromTemplate(`
You are an expert AI Memory Extractor and Entity Tracking Engine.
Analyze the user's message and extract durable, persistent facts about the user, their projects, technical stack, preferences, and identity.

Existing Memories for this user:
{existingMemories}

User Message:
"{userMessage}"

Extraction Guidelines:
1. Extract permanent or semi-permanent user facts such as:
   - Name / Identity: (e.g. "My name is Sohail", "Myself Sohail", "Call me Sohail") -> key: "user_name", category: "profile"
   - Project Name & Details: (e.g. "I am building CosmoAI", "My project is ApexBot") -> key: "project_name", category: "project"
   - Tech Stack: (e.g. "I use React 19", "Our backend is in Go") -> key: "tech_stack", category: "tech_stack"
   - User Preferences: (e.g. "I like dark mode", "Prefer TypeScript") -> key: "preferences", category: "preference"
   - Other Profile Info: (e.g. "I am a software engineer") -> key: "role", category: "profile"

2. Action Type:
   - "create": New entity or fact mentioned.
   - "update": Modification or rename of an existing entity (e.g. "I renamed my project to ApexBot", "Actually call me Jordan").
   - "delete": User explicitly asks to forget or remove a fact (e.g. "Forget my tech stack", "Delete my location").

If the user message contains NO personal facts or instructions to remember/forget (e.g. "What is 2+2?", "Explain quantum physics", "Hello", "How are you?"), return an empty array [].

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects. Do not include markdown code blocks, think tags, or commentary.
Each object must have:
- "key": string (snake_case unique identifier, e.g. "user_name", "project_name", "tech_stack")
- "fact": string (concise declarative fact, e.g. "User name is Sohail", "User project is CosmoAI")
- "category": "profile" | "project" | "preference" | "tech_stack" | "other"
- "confidence": number (between 0.0 and 1.0)
- "action": "create" | "update" | "delete"

JSON Output:
`);

/**
 * Fast Rule-Based Fallback Parser
 * Guarantees fact extraction even when remote LLM APIs encounter network/quota restrictions
 */
function fastRuleBasedExtractor(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  const results = [];

  // Forget directives
  const forgetMatch = clean.match(/(?:forget|delete|remove)\s+(?:my\s+)?([a-z0-9_\s]+)/i);
  if (forgetMatch && forgetMatch[1]) {
    const target = forgetMatch[1].trim().toLowerCase();
    let key = 'other';
    if (target.includes('name')) key = 'user_name';
    else if (target.includes('project')) key = 'project_name';
    else if (target.includes('stack') || target.includes('tech')) key = 'tech_stack';
    else if (target.includes('location')) key = 'location';

    if (key !== 'other') {
      return [{ key, fact: `Forget ${key}`, category: 'profile', confidence: 0.99, action: 'delete' }];
    }
  }

  // Name patterns (e.g. "myself sohail", "my name is sohail", "i am sohail", "call me sohail")
  const nameMatch =
    clean.match(/(?:my\s*self\s+is|my\s*self|myself|my\s+name\s+is|my\s+name's|name\s+is|you\s+can\s+call\s+me|call\s+me|this\s+is)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i) ||
    clean.match(/^(?:hi|hello|hey)?[\s,]*i\s+am\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)(?:\.|$|,|\s+and)/i) ||
    clean.match(/^(?:hi|hello|hey)?[\s,]*i'm\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)(?:\.|$|,|\s+and)/i) ||
    clean.match(/^(?:hi|hello|hey)?[\s,]*my\s*self\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)(?:\.|$|,|\s+and)/i);

  const nonNames = new Set(['fine', 'good', 'happy', 'here', 'back', 'ready', 'okay', 'ok', 'tired', 'busy', 'a', 'an', 'the']);
  if (nameMatch && nameMatch[1]) {
    const rawName = nameMatch[1].trim();
    if (!nonNames.has(rawName.toLowerCase()) && rawName.length >= 2) {
      results.push({
        key: 'user_name',
        fact: `User name is "${rawName}".`,
        category: 'profile',
        confidence: 0.98,
        action: 'create',
      });
    }
  }

  // Project patterns (creation & renaming)
  const renameMatch = clean.match(/(?:i\s+)?(?:renamed|changed|updated)\s+(?:my\s+)?project(?:\s+name)?(?:\s+from\s+[\w\s]+)?\s+to\s+([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+){0,3})/i);
  const projMatch =
    clean.match(/(?:my\s+project(?:\s+is|\s+name\s+is|\s+is\s+called|\s+is\s+named)\s+|called\s+|named\s+|building\s+(?:an?\s+[a-z0-9_\s-]+\s+(?:called|named)\s+|a\s+project\s+(?:called|named)\s+|an\s+app\s+(?:called|named)\s+|project\s+)?)([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+){0,3})/i);

  if (renameMatch && renameMatch[1]) {
    results.push({
      key: 'project_name',
      fact: `User project name is "${renameMatch[1].trim()}".`,
      category: 'project',
      confidence: 0.99,
      action: 'update',
    });
  } else if (projMatch && projMatch[1]) {
    const pName = projMatch[1].trim();
    if (!['a', 'an', 'the', 'this', 'that', 'it', 'on', 'in', 'with', 'using', 'react', 'node'].includes(pName.toLowerCase())) {
      results.push({
        key: 'project_name',
        fact: `User is building a project named "${pName}".`,
        category: 'project',
        confidence: 0.95,
        action: 'create',
      });
    }
  }

  // Tech stack patterns
  const techMatch = clean.match(/(?:i\s+am\s+using|my\s+tech\s+stack\s+is|i\s+use|we\s+are\s+using|built\s+with)\s+([A-Za-z0-9\s,\+/#.-]{3,50})/i);
  if (techMatch && techMatch[1]) {
    results.push({
      key: 'tech_stack',
      fact: `User tech stack includes ${techMatch[1].trim()}.`,
      category: 'tech_stack',
      confidence: 0.92,
      action: 'create',
    });
  }

  return results;
}

/**
 * Extract Facts Using LangChain & LLM (with Fast Resilient Fallback)
 */
export async function extractFactsWithLangChain(userMessage, existingMemories = []) {
  if (!userMessage || typeof userMessage !== 'string') return [];

  // Fast pre-check: if no personal keywords are present, skip LLM call
  const personalKeywords = [
    'my', 'name', 'myself', 'i am', "i'm", 'project', 'building', 'working on',
    'stack', 'using', 'prefer', 'remember', 'forget', 'renamed', 'changed', 'live in',
    'favorite', 'role', 'developer', 'call me', 'delete', 'love'
  ];
  const lowerMsg = userMessage.toLowerCase();
  const hasPersonalIndicator = personalKeywords.some((k) => lowerMsg.includes(k));

  if (!hasPersonalIndicator) {
    return [];
  }

  const existingFormatted = existingMemories && existingMemories.length > 0
    ? existingMemories.map((m) => `- ${m.key}: ${m.fact}`).join('\n')
    : 'None';

  // 1. Attempt LLM Fact Extraction via LangChain (Groq / OpenAI)
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    try {
      const model = new ChatOpenAI({
        apiKey: process.env.GROQ_API_KEY.trim(),
        configuration: {
          baseURL: 'https://api.groq.com/openai/v1',
        },
        modelName: 'qwen/qwen3.8-27b',
        temperature: 0.1,
        maxTokens: 512,
      });

      const formattedPrompt = await FACT_EXTRACTION_PROMPT.format({
        existingMemories: existingFormatted,
        userMessage,
      });

      const response = await model.invoke(formattedPrompt);
      const rawText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Clean markdown codeblocks
      const cleaned = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();

      const jsonStart = cleaned.indexOf('[');
      const jsonEnd = cleaned.lastIndexOf(']');

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (llmErr) {
      console.warn('[LangChain Memory] LLM extraction notice:', llmErr?.message);
    }
  }

  // 2. Resilient Rule-Based Fallback
  return fastRuleBasedExtractor(userMessage);
}
