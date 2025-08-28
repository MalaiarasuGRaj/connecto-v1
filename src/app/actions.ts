
'use server';

import { z } from 'zod';
import fs from 'fs';
import path from 'path';

/**
 * Ensure server-only API keys are present at runtime.
 * We do not accept NEXT_PUBLIC_* keys for security reasons.
 */
function assertServerEnv() {
  if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error(
      'Server configuration error: missing AI API key. Set OPENROUTER_API_KEY or GEMINI_API_KEY in the server environment.'
    );
  }
}
assertServerEnv();

const MessageSchema = z.object({
  role: z.enum(['user', 'bot', 'system']),
  content: z.string(),
});

const RequestSchema = z.object({
  message: z.string(),
  history: z.array(MessageSchema),
});


// Function to get all .txt filenames from the data directory
async function getCompanyFilenames(): Promise<string[]> {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    const files = await fs.promises.readdir(dataDir);
    return files.filter((file) => path.extname(file) === '.txt');
  } catch (error) {
    console.error('Error reading data directory:', error);
    return [];
  }
}

// Function to read the content of a specific file
async function getCompanyData(filename: string): Promise<string> {
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, filename);
  try {
    // Basic security check to prevent path traversal
    if (path.dirname(filePath) !== dataDir) {
        throw new Error('Invalid filename requested');
    }
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filename}:`, error);
    return '';
  }
}

async function callOpenRouter(systemPrompt: string, userMessage: string, history: {role: string, content: string}[]) {
    const mappedHistory = history.map(h => ({
      role: h.role === 'bot' ? 'assistant' : 'user',
      content: h.content,
    }));

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "model": "google/gemini-flash-1.5",
        "messages": [
          { "role": "system", "content": systemPrompt },
          ...mappedHistory,
          { "role": "user", "content": userMessage }
        ]
      })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('OpenRouter API error:', errorBody);
        throw new Error(`OpenRouter API request failed with status ${response.status}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse.choices[0].message.content;
}


export async function getResponse(input: { message: string, history: any[] }) {
  const validatedInput = RequestSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new Error('Invalid input');
  }

  const { message: userMessage, history } = validatedInput.data;


  try {
    const filenames = await getCompanyFilenames();
    if (filenames.length === 0) {
        return "I'm sorry, but I don't have any company information available right now.";
    }

    // Step 1: Try to find a relevant filename.
    const fileSelectionPrompt = `You are an expert at routing user questions to the correct document. Your primary goal is to identify a company name in the user's most recent message. Use the conversation history for context only if the latest message is ambiguous (e.g., 'what about the salary?'). If the new message mentions a specific company, that takes precedence.

Available files:
${filenames.join('\n')}

Based on the user's question, identify the most relevant filename from the list.
- If the user's message contains a company name that matches a file, return that filename.
- If the user asks a follow-up question without a company name, use the history to find the relevant filename.
- If no file is relevant (e.g., for "hi", "how are you?"), respond with "NONE".

Return only the single, most relevant filename and nothing else.`;

    let relevantFilename = await callOpenRouter(fileSelectionPrompt, userMessage, history);
    relevantFilename = relevantFilename.trim().replace(/`/g, '');


    // Step 2: If a relevant file is found, use it to answer the question.
    if (relevantFilename && relevantFilename !== 'NONE' && filenames.includes(relevantFilename)) {
        const companyKnowledge = await getCompanyData(relevantFilename);
        if (!companyKnowledge) {
            return `I found the file for ${relevantFilename}, but I was unable to read its contents.`;
        }

        const answerGenerationPrompt = `You are a helpful AI assistant. Your primary goal is to answer the user's question based *only* on the provided context document and the user's current question.

**Rules:**
1.  **Answer from the Document Only:** Base your answers exclusively on the text in the provided document. Do not add information that isn't there.
2.  **Be Concise and Direct:** Give a direct answer to the user's most recent question. Do not add conversational filler.
3.  **No Repetition:** Do not repeat information the user already knows from the conversation. If the user asks a follow-up question (e.g., 'salary?'), provide *only the new information* (the salary). Do not repeat the hiring process you just described.
4.  **Handle Missing Information:** If the user asks for information not in the document, you must state that the document does not contain that specific information. For example, say "The provided document for ${relevantFilename} does not contain information about benefits." Do not make up an answer.

**Document for ${relevantFilename}:**
---
${companyKnowledge}
---
`;
        return await callOpenRouter(answerGenerationPrompt, userMessage, []);
    }

    // Step 3: If no specific file is relevant, fall back to a general conversational prompt. Use history.
    const generalPrompt = `You are a helpful and friendly career assistant chatbot for students. Your knowledge is based on a set of documents about company hiring processes.
The available companies are: ${filenames.map(f => f.replace('.txt', '')).join(', ')}.

- If the user asks a general conversational question (like "hi", "how are you"), respond naturally and politely.
- If the user asks about your capabilities (like "what can I ask you?" or "what can you do?"), describe your purpose: you can provide information on company hiring processes, typical roles, and salary information based on the documents you have. Do not list the companies unless asked.
- If the user asks what companies you have information on, then and only then should you list the companies you have data for.
- For any other query, respond politely and conversationally. Do not apologize for not having information unless the user's immediately preceding query was a question you could not answer.
- If the user's question seems career-related but doesn't match a company, gently guide them to ask about one of the specific companies you have information for. Do not make up information.
- If the last message from the bot was a question (e.g., "Which company would you like to know about?") and the user's response is a simple acknowledgment ("ok," "thanks"), treat it as a non-answer and gently re-ask the question or ask if you can help with anything else. Do not repeat your previous negative answer.`;

    return await callOpenRouter(generalPrompt, userMessage, history);


  } catch (error) {
    console.error('Error in getResponse flow:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}

/**
 * PUBLIC_INTERFACE
 * generateChatResponse
 * Summary: Wrapper that preserves the existing server action contract for API usage.
 * Description: Accepts message and optional history and delegates to getResponse. This keeps AI calls server-side.
 */
export async function generateChatResponse(input: {
  message: string;
  history?: Array<{ role: "user" | "assistant" | "system" | "bot"; content: string }>;
  company?: string;
}) {
  // Normalize roles for compatibility with existing code which expects 'bot'/'user'
  const history = (input.history ?? []).map(h => ({
    role: h.role === 'assistant' ? 'bot' : (h.role as any),
    content: h.content,
  }));

  return getResponse({ message: input.message, history });
}
