import { NextRequest, NextResponse } from 'next/server';
import { appRouter } from '@/server/routers';
import { supabaseAdmin } from '@/shared/utils/supabase/admin';
import { swarmsApiClient, type AgentCompletion, SwarmsApiClient } from '@/shared/utils/api/swarms-api-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract required data from API request
    const { agent_config, marketplace_metadata, user_id, result: executionResult, use_swarms_api, swarms_api_key } = body;
    
    // Fallback: also allow API key via header for parity with Swarms API
    const apiKeyFromHeader = request.headers.get('x-api-key') || undefined;
    
    if (!agent_config || !user_id) {
      return NextResponse.json(
        { error: 'Agent configuration and user_id are required' },
        { status: 400 }
      );
    }

    // NEW FEATURE: Check if we should use Swarms API (backwards compatible)
    if (use_swarms_api && (swarms_api_key || apiKeyFromHeader)) {
      try {
        // Prepare the agent completion request for Swarms API
        const agentCompletion: AgentCompletion = {
          agent_config: {
            agent_name: agent_config.agent_name || 'Unnamed Agent',
            description: agent_config.description || `Agent: ${agent_config.agent_name}`,
            system_prompt: agent_config.system_prompt || '',
            model_name: agent_config.model_name || 'gpt-4o',
            temperature: agent_config.temperature || 0.7,
            max_tokens: agent_config.max_tokens || 1000,
            max_loops: agent_config.max_loops || 5,
          },
          publish_to_marketplace: true,
          marketplace_metadata: marketplace_metadata || {},
          tools_enabled: false,
        };

        // Create a new client instance with the user's API key
        const userSwarmsClient = new SwarmsApiClient(swarms_api_key || apiKeyFromHeader);
        
        // Call Swarms API to publish the agent
        const swarmsResult = await userSwarmsClient.publishAgent(agentCompletion);

        if (swarmsResult.success) {
          // Swarms API succeeded, also create local registry entry for backwards compatibility
          const registryData = {
            name: agent_config.agent_name || 'Unnamed Agent',
            description: agent_config.description || `Agent: ${agent_config.agent_name}`,
            agent: agent_config.system_prompt || '',
            user_id: user_id,
            tags: marketplace_metadata?.tags?.join(',') || null,
            category: marketplace_metadata?.category || null,
            use_cases: marketplace_metadata?.use_cases || null,
            links: marketplace_metadata?.links || [],
            is_free: true,
            status: 'approved' as const,
            language: 'python',
            requirements: [],
            image_url: null,
            file_path: null,
            price_usd: 0,
            seller_wallet_address: null,
            swarms_agent_id: swarmsResult.agent_id,
            swarms_marketplace_url: swarmsResult.marketplace_url,
          };

          const { data: localAgent, error: localError } = await supabaseAdmin
            .from('swarms_cloud_agents')
            .insert([registryData])
            .select('id')
            .single();

          if (localError) {
            console.warn('Failed to create local registry entry:', localError);
          }

          return NextResponse.json({
            success: true,
            swarms_agent_id: swarmsResult.agent_id,
            swarms_marketplace_url: swarmsResult.marketplace_url,
            local_agent_id: localAgent?.id,
            registry_url: localAgent?.id ? `/agent/${localAgent.id}` : null,
            message: 'Agent successfully published to Swarms marketplace and local registry',
          });
        } else {
          console.warn('Swarms API failed, falling back to local registry:', swarmsResult.message);
          // Fall through to local registry creation
        }
      } catch (swarmsError) {
        console.warn('Swarms API error, falling back to local registry:', swarmsError);
        // Fall through to local registry creation
      }
    }

    // ORIGINAL FUNCTIONALITY: Create context for TRPC (backwards compatible)
    const context = {
      supabase: supabaseAdmin,
      session: { data: { user: { id: user_id } } },
    };

    // Call the TRPC mutation (existing functionality)
    const caller = appRouter.createCaller(context);

    const result = await caller.explorer.addAgentFromAPI({
      agent_config,
      marketplace_metadata,
      user_id,
      result: executionResult,
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Marketplace bridge error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

