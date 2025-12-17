import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';

/** 读取Word文档工具 - 解析WordML为纯文本 */
export const readDocumentTool = tool({
  description: 'Read and parse WordML (XML) document content to plain text',
  inputSchema: z.object({
    documentId: z.string(), // 文档ID
    filePath: z.string().optional(), // 文档路径（可选）
  }),
  async *execute({ documentId, filePath }: { documentId: string; filePath?: string }) {
    yield { state: 'loading' as const };

    // 模拟文档读取延迟
    await new Promise(resolve => setTimeout(resolve, 2500));

    // 纯JS解析WordML为纯文本（无C依赖）
    const mockWordMLContent = `<w:body><w:p><w:r><w:t>Sample document content for ${documentId}</w:t></w:r></w:p></w:body>`;
    const plainText = mockWordMLContent
      .replace(/\s*[a-zA-Z0-9]+:/g, ' ')
      .replace(/\s+[a-zA-Z0-9-]+="[^"]*"/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    yield {
      state: 'ready' as const,
      documentId,
      filePath,
      content: plainText,
      message: `Successfully read document ${documentId}`,
    };
  },
});

/** 读取文档工具调用类型 */
export type ReadDocumentUIToolInvocation = UIToolInvocation<typeof readDocumentTool>;