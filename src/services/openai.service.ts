import OpenAI from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { retry } from '../utils/retry.js';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

/**
 * Service for interacting with OpenAI's API
 */
export default class OpenAIService {
  private openai: OpenAI;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-ada-002',
    });
  }

  /**
   * Creates an embedding vector for the given text
   * @param text - The text to create an embedding for
   * @returns Promise containing the embedding vector
   */
  public async createEmbedding(text: string): Promise<number[]> {
    return retry(() => this.embeddings.embedQuery(text));
  }

  /**
   * Creates a chat completion using OpenAI's API
   * @param params - Parameters for the chat completion
   * @param params.messages - The messages to generate completion for
   * @param params.model - The model to use (default: 'gpt-4')
   * @param params.temperature - The temperature setting (default: 0.3)
   * @returns Promise containing the chat completion
   */
  public async createChatCompletion({
    messages,
    model = 'gpt-4',
    temperature = 0.3,
  }: {
    messages: ChatCompletionMessageParam[];
    model?: string;
    temperature?: number;
  }): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return retry(() =>
      this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: 500,
      }),
    );
  }
}
