import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';

/** 网页内容提取工具 - 从URL提取纯文本内容 */
export const webExtractTool = tool({
  description: 'Extract plain text content from a web URL',
  inputSchema: z.object({
    url: z.string().url(), // 目标URL（匹配前端inProgress参数，校验合法URL）
  }),
  async *execute({ url }: { url: string }) {
    yield { state: 'loading' as const };

    // 模拟内容提取延迟
    await new Promise(resolve => setTimeout(resolve, 3500));

    // 模拟提取结果（实际替换为真实网页内容提取逻辑）
    const mockExtractedContent = `Plain text content extracted from ${url}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`;

    yield {
      state: 'ready' as const,
      url,
      content: mockExtractedContent,
      message: `Successfully extracted content from ${url}`,
    };
  },
});

/** 网页内容提取工具调用类型 */
export type WebExtractUIToolInvocation = UIToolInvocation<typeof webExtractTool>;