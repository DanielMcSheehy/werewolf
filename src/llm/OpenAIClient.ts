import OpenAI from "openai";
import { LLMClient, PromptContext } from "./LLMClient";

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  constructor(
    private readonly model: string,
    private readonly apiKey: string,
    private readonly temperature = 0.7,
  ) {
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  get id(): string {
    return `openai:${this.model}`;
  }

  async generate(context: PromptContext) {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: [
        { role: "system", content: context.systemPrompt },
        { role: "user", content: context.userPrompt },
      ],
    });
    const output = completion.choices[0]?.message?.content ?? "";
    return { output: typeof output === "string" ? output : JSON.stringify(output) };
  }
}
