
'use server';

import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const MessageSchema = z.object({
  message: z.string(),
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

async function callOpenRouter(systemPrompt: string, userMessage: string) {
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


export async function getResponse(input: { message: string }) {
  const validatedInput = MessageSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new Error('Invalid input');
  }

  const userMessage = validatedInput.data.message;

  try {
    // Step 1: Get the relevant filename from the LLM
    const filenames = await getCompanyFilenames();
    if (filenames.length === 0) {
        return "I'm sorry, but I don't have any company information available right now.";
    }

    const fileSelectionPrompt = `You are an expert at routing user questions to the correct document. Based on the user's question, identify the most relevant filename from the following list.

Available files:
${filenames.join('\n')}

Only return the single, most relevant filename and nothing else. If no file is relevant, respond with "NONE".`;

    let relevantFilename = await callOpenRouter(fileSelectionPrompt, userMessage);
    
    // Clean up filename from potential markdown
    relevantFilename = relevantFilename.trim().replace(/`/g, '');


    if (!relevantFilename || relevantFilename === 'NONE' || !filenames.includes(relevantFilename)) {
        return "I do not have information on that topic. My knowledge is limited to the documents I have been provided.";
    }

    // Step 2: Get the content of that file and generate the final answer
    const companyKnowledge = await getCompanyData(relevantFilename);
     if (!companyKnowledge) {
        return `I found the file for ${relevantFilename}, but I was unable to read its contents.`;
    }

    const answerGenerationPrompt = `You are a career assistant chatbot for students. Your purpose is to provide information about company hiring processes, salaries, roles, and previous placement details based *only* on the provided document.

You must not answer any questions that fall outside the scope of the provided document. Do not use any of your own knowledge.

Document for ${relevantFilename}:
---
${companyKnowledge}
---
`;

    return await callOpenRouter(answerGenerationPrompt, userMessage);

  } catch (error) {
    console.error('Error in getResponse flow:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}
