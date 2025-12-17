import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';

/** 文件库搜索工具 - 按关键词搜索文件 */
export const searchFilesTool = tool({
  description: 'Search files in the document library by keyword',
  inputSchema: z.object({
    query: z.string(), // 搜索关键词（匹配前端inProgress参数）
    libraryId: z.string().optional().default('default'), // 库ID（可选）
  }),
  async *execute({ query, libraryId }: { query: string; libraryId?: string }) {
    yield { state: 'loading' as const };

    // 模拟搜索延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 模拟搜索结果（实际替换为真实文件库查询逻辑）
    const mockResults = [
      { id: `file_${Math.random().toString(36).slice(2)}`, name: `Document_${query}.docx`, libraryId },
      { id: `file_${Math.random().toString(36).slice(2)}`, name: `Report_${query}.pdf`, libraryId },
    ];

    yield {
      state: 'ready' as const,
      query,
      libraryId,
      results: mockResults,
      total: mockResults.length,
      message: `Found ${mockResults.length} files matching "${query}" in library ${libraryId}`,
    };
  },
});

/** 文件搜索工具调用类型 */
export type SearchFilesUIToolInvocation = UIToolInvocation<typeof searchFilesTool>;