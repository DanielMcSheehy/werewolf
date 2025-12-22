export interface PromptContext {
  systemPrompt: string;
  userPrompt: string;
}

export interface GenerationResult {
  output: string;
}

export interface LLMClient {
  id: string;
  generate(context: PromptContext): Promise<GenerationResult>;
}
