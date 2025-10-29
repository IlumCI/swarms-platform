import { z } from 'zod';

// Swarms API configuration
const SWARMS_API_BASE_URL = (typeof process !== 'undefined' && process.env?.SWARMS_API_BASE_URL) || 'https://api.swarms.world';
const SWARMS_API_KEY = (typeof process !== 'undefined' && process.env?.SWARMS_API_KEY) || 'swarms-api-key-1234567890';

// Validation schemas matching the Swarms API
const AgentConfigSchema = z.object({
  agent_name: z.string().min(1, 'Agent name is required'),
  description: z.string().min(1, 'Description is required'),
  system_prompt: z.string().min(1, 'System prompt is required'),
  model_name: z.string().optional().default('gpt-4o'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().min(1).optional().default(1000),
  max_loops: z.number().min(1).optional().default(5),
});

const MarketplaceMetadataSchema = z.object({
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  use_cases: z.array(z.string()).optional(),
  links: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
  })).optional(),
});

const AgentCompletionSchema = z.object({
  agent_config: AgentConfigSchema,
  publish_to_marketplace: z.boolean().default(true),
  marketplace_metadata: MarketplaceMetadataSchema.optional(),
  tools_enabled: z.boolean().optional().default(false),
});

const GetMarketplacePromptsInputSchema = z.object({
  number_of_items: z.number().min(1).max(100).default(10),
});

// Response schemas
const MarketplacePublishResponseSchema = z.object({
  success: z.boolean(),
  agent_id: z.string().optional(),
  agent_name: z.string().optional(),
  marketplace_url: z.string().optional(),
  message: z.string().optional(),
});

const MarketplacePromptsResponseSchema = z.object({
  status: z.string(),
  prompts: z.array(z.any()),
  total_count: z.number(),
  timestamp: z.string(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type MarketplaceMetadata = z.infer<typeof MarketplaceMetadataSchema>;
export type AgentCompletion = z.infer<typeof AgentCompletionSchema>;
export type GetMarketplacePromptsInput = z.infer<typeof GetMarketplacePromptsInputSchema>;
export type MarketplacePublishResponse = z.infer<typeof MarketplacePublishResponseSchema>;
export type MarketplacePromptsResponse = z.infer<typeof MarketplacePromptsResponseSchema>;

export class SwarmsApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || SWARMS_API_KEY || '';
    this.baseUrl = baseUrl || SWARMS_API_BASE_URL;
    
    if (!this.apiKey) {
      throw new Error('Swarms API key is required. Provide apiKey parameter or set SWARMS_API_KEY environment variable.');
    }
  }

  /**
   * Publish an agent to the Swarms marketplace
   */
  async publishAgent(agentCompletion: AgentCompletion): Promise<MarketplacePublishResponse> {
    try {
      // Validate input
      const validatedData = AgentCompletionSchema.parse(agentCompletion);

      const response = await fetch(`${this.baseUrl}/v1/marketplace/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Swarms API error: ${response.status} ${response.statusText}. ${
            errorData.detail || errorData.message || 'Unknown error'
          }`
        );
      }

      const data = await response.json();
      return MarketplacePublishResponseSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map((e: any) => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Get agents from the Swarms marketplace
   */
  async getMarketplaceAgents(input: GetMarketplacePromptsInput): Promise<MarketplacePromptsResponse> {
    try {
      // Validate input
      const validatedInput = GetMarketplacePromptsInputSchema.parse(input);

      const response = await fetch(`${this.baseUrl}/v1/marketplace/agents?${new URLSearchParams({
        number_of_items: validatedInput.number_of_items.toString(),
      })}`, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Swarms API error: ${response.status} ${response.statusText}. ${
            errorData.detail || errorData.message || 'Unknown error'
          }`
        );
      }

      const data = await response.json();
      return MarketplacePromptsResponseSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map((e: any) => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Check if the API client is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }
}

// Default instance
export const swarmsApiClient = new SwarmsApiClient();
