import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 从请求中获取 Origin
  const origin = request.headers.get('origin');

  // 处理预检请求 (OPTIONS)
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    
    // 设置 CORS 头部
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent');
    response.headers.set('Access-Control-Max-Age', '86400');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  }

  // 处理实际请求
  const response = NextResponse.next();

  // 设置 CORS 头部
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent');
  response.headers.set('Access-Control-Expose-Headers', '*');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  // 对于 SSE 请求，设置必要的头部
  const acceptHeader = request.headers.get('accept');
  if (acceptHeader?.includes('text/event-stream')) {
    response.headers.set('Content-Type', 'text/event-stream');
    response.headers.set('Cache-Control', 'no-cache');
    response.headers.set('Connection', 'keep-alive');
    response.headers.set('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
  }

  return response;
}

// 配置中间件匹配规则
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};