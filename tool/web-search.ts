import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';

/** 网页搜索工具 - 按关键词搜索网页内容 */
export const webSearchTool = tool({
  description: 'Search the web for information by keyword',
  inputSchema: z.object({
    query: z.string(), // 搜索关键词（匹配前端inProgress参数）
    limit: z.number().optional().default(5), // 结果数量限制
  }),
  async *execute({ query, limit = 5 }: { query: string; limit?: number }) {
    yield { state: 'loading' as const };

    // 模拟网页搜索延迟
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 模拟搜索结果（实际替换为真实搜索引擎API调用）
    const mockWebResults = Array.from({ length: limit }, (_, i) => ({
      id: `result_${i + 1}`,
      title: `Result ${i + 1} for "${query}"`,
      link: `https://example.com/result-${i + 1}`,
      snippet: `Sample snippet for ${query} result ${i + 1}`,
    }));

    yield {
      state: 'ready' as const,
      query,
      limit,
      results: mockWebResults,
      message: `Found ${mockWebResults.length} web results for "${query}"`,
    };
  },
});

/** 网页搜索工具调用类型 */
export type WebSearchUIToolInvocation = UIToolInvocation<typeof webSearchTool>;