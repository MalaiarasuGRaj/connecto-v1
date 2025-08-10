
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

        const answerGenerationPrompt = `You are a career assistant chatbot for students. Your purpose is to provide information about company hiring processes, salaries, roles, and previous placement details based *only* on the provided document and the conversation history.

You must not answer any questions that fall outside the scope of the provided document. Do not use any of your own knowledge. If the document contains information about salary, you must provide it.

Document for ${relevantFilename}:
---
${companyKnowledge}
---
`;
        return await callOpenRouter(answerGenerationPrompt, userMessage, history);
    }

    // Step 3: If no specific file is relevant, fall back to a general conversational prompt.
    const generalPrompt = `You are a helpful and friendly career assistant chatbot for students.
Your primary role is to answer questions about company hiring processes using a specific set of documents.
The documents you have information about are: ${filenames.map(f => f.replace('.txt', '')).join(', ')}.

- If the user asks a general conversational question (like "hi", "hello", "how are you"), respond naturally and politely.
- If the user asks what companies you have information on, list the available companies.
- For any other query that is not a simple greeting, gently guide the user to ask about one of the specific companies you have data for. Do not make up information.`;

    return await callOpenRouter(generalPrompt, userMessage, history);


  } catch (error) {
    console.error('Error in getResponse flow:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}
