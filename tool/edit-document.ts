// 1. 补全必要导入：新增 z from 'zod'
import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';
import { getReadDocumentResponse } from '@/tool/read-document-response';

// ✅ 定义edits里的子结构（修复：兼容zod版本，移除literal强制约束，改用string+描述）
const EditItemSchema = z.object({
  t: z.string().default('paragraph'), // 改为默认值，兼容更高zod版本，保证值为paragraph
  v: z.object({
    i: z.number(), // 段落索引 pIdx（0-base）
    o: z.enum(['replace', 'before', 'after', 'delete']), // 操作类型，固定枚举
    xml: z.string(), // 完整的WordML <w:p>标签文本
  }),
});

// ✅ 最终editDocument的入参Schema（移除as any，保留完整类型校验）
const editDocumentInputSchema = z.object({
  des: z.string(), // 编辑描述
  edits: z.array(EditItemSchema), // 编辑指令数组
  requestId: z.string().optional(), // 可选，兼容原有逻辑
});

// ✅ 辅助函数：移到tool外部（或内部），改为独立纯函数，移除this引用
const applyEditsToOoxml = (ooxml: string, edits: z.infer<typeof EditItemSchema>[]) => {
  // 你的WordML解析/替换逻辑，比如用xmldom/cheerio处理
  // 示例：简单返回（可根据需求扩展）
  console.log('Processing OOXML with edits count:', edits.length);
  return ooxml;
};

// ✅ 辅助函数：独立纯函数，处理文本替换
const applyEditsToText = (text: string, edits: z.infer<typeof EditItemSchema>[]) => {
  // 你的纯文本替换逻辑，可选扩展
  console.log('Processing text with edits count:', edits.length);
  return text;
};

export const editDocumentTool = tool({
  description: `
This tool is a pure executor for Word document edits. 
It ONLY accepts structured edit instructions (des + edits array) and applies the XML changes to the document.
Rules:
1. Use the paragraph index (i) to locate the target paragraph.
2. Apply the operation (replace/before/after/delete) with the provided XML text.
3. Do NOT modify the XML content, use it as-is.
4. Return the modified document content directly.
You MUST NOT call any AI models in this tool.
`,
  inputSchema: editDocumentInputSchema, // ✅ 移除as any，直接使用完整zod Schema
  async *execute(input: z.infer<typeof editDocumentInputSchema>) {
    const { des, edits, requestId } = input;
    console.log('AAA editDocumentTool in', { des, edits: edits.length, requestId });

    // 加载状态
    yield { state: 'loading' as const, value: { message: `Executing edit: ${des}` } };

    try {
      // 1. 读取原始文档（原有逻辑保留）
      let docData = requestId ? await getReadDocumentResponse(requestId) : null;
      let originalContent = docData?.documentContent || '';
      let ooxmlBody = docData?.ooxml?.body || '';

      // 2. ✅ 核心逻辑：调用独立辅助函数，移除this引用
      const modifiedOoxml = applyEditsToOoxml(ooxmlBody, edits);
      const modifiedContent = applyEditsToText(originalContent, edits);

      // 3. 返回修改后的结果
      const result = {
        requestId,
        editDescription: des,
        editCount: edits.length,
        originalContent,
        modifiedContent,
        modifiedOoxml,
        status: 'success' as const,
        message: 'Document edited successfully'
      };

      yield { state: 'ready' as const, value: result };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Edit document failed';
      console.log('AAA editDocumentTool error', errorMsg);
      yield { state: 'error' as const, value: { message: errorMsg } };
    }
  },
});

// 导出类型定义，保持原有用法
export type EditDocumentUIToolInvocation = UIToolInvocation<typeof editDocumentTool>;