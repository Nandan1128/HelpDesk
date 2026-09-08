import { generateText } from 'ai';
import { createGoogle } from '@ai-sdk/google';
import { env } from '../config/env.js';

export interface TicketContext {
  ticketNumber?: number;
  subject?: string;
  customerName?: string | null;
  customerEmail?: string;
  category?: string;
  priority?: string;
  messages?: Array<{
    senderType: string;
    senderName?: string | null;
    senderEmail?: string;
    body: string;
    createdAt?: Date | string;
  }>;
}

export interface PolishReplyOptions {
  draft: string;
  ticketContext?: TicketContext;
  apiKey?: string;
  modelName?: string;
}

export class AIService {
  /**
   * Initializes a Google provider instance with the configured or provided Gemini API key.
   */
  private static getGoogleModel(customApiKey?: string, customModelName?: string) {
    const apiKey = customApiKey || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const modelName = customModelName || env.GEMINI_MODEL || 'gemini-2.5-flash';
    const google = createGoogle({ apiKey });
    return google(modelName);
  }

  /**
   * Polishes an agent's draft reply using Google Gemini via Vercel AI SDK.
   * Enhances clarity, tone, and professionalism while strictly preserving core facts and intent.
   */
  static async polishReply({
    draft,
    ticketContext,
    apiKey,
    modelName,
  }: PolishReplyOptions): Promise<string> {
    const trimmedDraft = draft?.trim();
    if (!trimmedDraft) {
      throw new Error('Draft text cannot be empty');
    }

    const model = this.getGoogleModel(apiKey, modelName);

    // Construct optional ticket background context
    let contextSection = '';
    if (ticketContext) {
      const details: string[] = [];
      if (ticketContext.ticketNumber) details.push(`Ticket #: ${ticketContext.ticketNumber}`);
      if (ticketContext.subject) details.push(`Subject: ${ticketContext.subject}`);
      if (ticketContext.customerName) details.push(`Customer Name: ${ticketContext.customerName}`);
      if (ticketContext.customerEmail) details.push(`Customer Email: ${ticketContext.customerEmail}`);
      if (ticketContext.category) details.push(`Category: ${ticketContext.category}`);
      if (ticketContext.priority) details.push(`Priority: ${ticketContext.priority}`);

      if (ticketContext.messages && ticketContext.messages.length > 0) {
        // Take the latest 6 messages for context
        const recentMessages = ticketContext.messages.slice(-6);
        const historyText = recentMessages
          .map(
            (m) =>
              `[${m.senderType} - ${m.senderName || m.senderEmail || 'User'}]: ${m.body}`
          )
          .join('\n');
        details.push(`Conversation Thread:\n${historyText}`);
      }

      if (details.length > 0) {
        contextSection = `\n\n--- Ticket Context ---\n${details.join('\n')}\n--- End Ticket Context ---`;
      }
    }

    const systemPrompt = `You are an expert customer support specialist polishing a support agent's draft reply to a customer.

CRITICAL INSTRUCTIONS:
1. Short & Up to the Point: Keep the reply concise, direct, and to the point (typically 2 to 4 sentences). Do NOT write long paragraphs, unnecessary filler, repetitive disclaimers, or excessive apologies.
2. Get to the Solution: State the action taken, answer, or next step immediately and clearly.
3. Preserve Facts: Keep all facts, technical instructions, numbers, links, and the core intent from the agent's draft completely intact.
4. Professional & Polite: Friendly and respectful tone without unnecessary fluff.
5. Addressing Customer: If the customer's name is available, address them briefly (e.g., "Hi [Name],").
6. Sign-off: Include a brief polite closing (e.g., "Best regards,\nSupport Team").
7. Output: Return ONLY the final polished reply text. Never include greetings to the agent, meta comments, explanations, quotes, or markdown code blocks (\`\`\`).`;

    const userPrompt = `Agent's draft reply to polish:\n"""\n${trimmedDraft}\n"""${contextSection}\n\nShort, up-to-the-point polished reply:`;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    let polished = result.text.trim();

    // Strip wrapping markdown code blocks if the model happened to add them
    if (polished.startsWith('```') && polished.endsWith('```')) {
      polished = polished.replace(/^```(?:markdown|text)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    return polished;
  }
}
