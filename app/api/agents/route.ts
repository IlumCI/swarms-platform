import { NextRequest, NextResponse } from 'next/server';
import { SwarmsApiClient } from '@/shared/utils/api/swarms-api-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const number_of_items = parseInt(searchParams.get('number_of_items') || '10');
    
    // Get API key from either header or query parameter (for flexibility)
    const swarms_api_key = request.headers.get('x-api-key') || searchParams.get('swarms_api_key');

    // Check if user provided their own API key
    if (!swarms_api_key) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please provide your Swarms API key to access the marketplace'
        },
        { status: 401 }
      );
    }

    // Create client with user's API key
    const userSwarmsClient = new SwarmsApiClient(swarms_api_key);

    // Fetch agents from Swarms marketplace
    const result = await userSwarmsClient.getMarketplaceAgents({
      number_of_items: Math.min(number_of_items, 100), // Cap at 100 for safety
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Marketplace fetch error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Swarms API error')) {
        return NextResponse.json(
          { 
            error: 'Swarms API error', 
            details: error.message,
            hint: 'Check your Swarms API configuration and credentials'
          },
          { status: 502 }
        );
      }
      if (error.message.includes('Validation error')) {
        return NextResponse.json(
          { 
            error: 'Invalid request parameters', 
            details: error.message 
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

