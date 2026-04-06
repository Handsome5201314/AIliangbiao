import { NextRequest, NextResponse } from 'next/server';
import { updateUserContext, getUserContext } from '@/lib/services/userContext';

/**
 * GET - 获取用户画像上下文
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');

  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }

  const context = await getUserContext(deviceId);
  
  return NextResponse.json({ 
    success: true, 
    context 
  });
}

/**
 * POST - 更新用户画像上下文
 */
export async function POST(req: NextRequest) {
  try {
    const { deviceId, updates } = await req.json();

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    const result = await updateUserContext(deviceId, updates);
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        traits: result.traits 
      });
    } else {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to update context:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
