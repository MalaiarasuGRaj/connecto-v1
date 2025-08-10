
'use server';

import { z } from 'zod';

const MessageSchema = z.object({
  message: z.string(),
});

export async function getResponse(input: { message: string }) {
  const validatedInput = MessageSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new Error('Invalid input');
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "model": "google/gemini-flash-1.5",
        "messages": [
          { "role": "user", "content": validatedInput.data.message }
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

  } catch (error) {
    console.error('Error getting response from OpenRouter:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}
