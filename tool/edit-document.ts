import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';

/** 文档编辑执行工具 - 根据 learnSkills 生成的规划执行编辑 */
export const editDocumentTool = tool({
  description: 'Execute document edits based on the plan from learnSkillsTool',
  inputSchema: z.object({
    editGoal: z.string(), // 编辑目标（来自 learnSkills）
    editPlan: z.object({ // 编辑规划（来自 learnSkills）
      steps: z.array(z.string()),
      keyChanges: z.array(z.string()),
      notes: z.string(),
    }),
    originalContent: z.string(), // 原始文档内容
  }),
  async *execute({ editGoal, editPlan, originalContent }) {
    console.log('AAA editDocumentTool in');
    yield { state: 'loading' as const };

    // 模拟编辑执行（实际替换为真实的文档修改逻辑）
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 根据规划修改文档内容
    let editedContent = originalContent;
    // 示例：替换 GDPR 相关条款
    if (editPlan.keyChanges.includes('Update legal clauses to comply with GDPR')) {
      editedContent = editedContent.replace(
        /old GDPR clauses/g,
        'Updated GDPR compliance clauses (2025 version)'
      );
    }
    // 示例：移除冗余注释
    editedContent = editedContent.replace(/redundant guidance notes/g, '');

    yield {
      state: 'ready' as const,
      editGoal,
      editPlan,
      originalContent,
      editedContent,
      message: `Successfully executed edit plan for goal: "${editGoal}". Document updated with ${editPlan.keyChanges.length} key changes.`,
    };
  },
});

export type EditDocumentUIToolInvocation = UIToolInvocation<typeof editDocumentTool>;