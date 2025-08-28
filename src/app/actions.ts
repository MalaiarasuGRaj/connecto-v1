
'use server';

import { z } from 'zod';
import fs from 'fs';
import path from 'path';

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
    const fileSelectionPrompt = `You are an expert at routing user questions to the correct document based on the user's message and the conversation history. Based on the user's question and the history, identify the most relevant filename from the following list.

Available files:
${filenames.join('\n')}

Only return the single, most relevant filename and nothing else. If no file is relevant for the user's question (e.g. for "hi", "how are you", or "what companies do you have?"), respond with "NONE".`;

    let relevantFilename = await callOpenRouter(fileSelectionPrompt, userMessage, history);
    relevantFilename = relevantFilename.trim().replace(/`/g, '');


    // Step 2: If a relevant file is found, use it to answer the question.
    if (relevantFilename && relevantFilename !== 'NONE' && filenames.includes(relevantFilename)) {
        const companyKnowledge = await getCompanyData(relevantFilename);
        if (!companyKnowledge) {
            return `I found the file for ${relevantFilename}, but I was unable to read its contents.`;
        }

        const answerGenerationPrompt = `You are a helpful AI assistant. Your primary goal is to answer user questions based *only* on the provided context document and the conversation history.

**Rules:**
1.  **Analyze the History:** First, review the conversation history. If the user's new message is a direct follow-up question (e.g., asking for "salary" right after you described the "hiring process"), you MUST NOT repeat the information you already provided. Your task is to extract *only the new piece of information* requested from the document.
2.  **Be Extremely Concise for Follow-ups:** For a follow-up question, your answer should be the specific data point requested. For example, if the previous turn was about the TCS hiring process and the user now asks "what is the salary", the correct response is just the salary information (e.g., "₹3.5–₹4.0 Lakhs per annum (LPA)."), not the entire hiring process again.
3.  **Answer from the Document Only:** Your answers must be based exclusively on the text in the provided document. Do not add any information that is not present in the document.
4.  **Handle Missing Information:** If the user asks for information that is not in the document (e.g., asking about "benefits" when the document only contains salary and hiring process), you must state that you do not have that specific information. Do not make up an answer.

**Document for ${relevantFilename}:**
---
${companyKnowledge}
---
`;
        return await callOpenRouter(answerGenerationPrompt, userMessage, history);
    }

    // Step 3: If no specific file is relevant, fall back to a general conversational prompt.
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
