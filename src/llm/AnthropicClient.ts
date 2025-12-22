import Anthropic from "@anthropic-ai/sdk";
import { LLMClient, PromptContext } from "./LLMClient";

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  constructor(
    private readonly model: string,
    private readonly apiKey: string,
    private readonly temperature = 0.7,
  ) {
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  get id(): string {
    return `anthropic:${this.model}`;
  }

  async generate(context: PromptContext) {
    const response = await this.client.messages.create({
      model: this.model,
      temperature: this.temperature,
      system: context.systemPrompt,
      max_tokens: 600,
      messages: [{ role: "user", content: context.userPrompt }],
    });
    const text = response.content
      .map((part) => ("text" in part ? part.text : JSON.stringify(part)))
      .join("\n");
    return { output: text };
  }
}
