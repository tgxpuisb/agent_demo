import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';

export const learnSkillsTool = tool({
  description: 'Plan document edits based on content and edit goals (MUST call editDocumentTool after this tool to execute the plan)',
  inputSchema: z.object({
    documentContent: z.string(),
    editGoal: z.string(),
  }),
  async *execute({ documentContent, editGoal }: { documentContent: string; editGoal: string }) {
    yield { state: 'loading' as const };
    console.log('AAA learnSkillsTool in');

    await new Promise(resolve => setTimeout(resolve, 4000));

    const mockEditPlan = {
      steps: [
        `Analyze document content for ${editGoal}`,
        `Identify key sections to modify`,
        `Apply changes and validate format`,
      ],
      keyChanges: [
        `Update legal clauses to comply with GDPR`,
        `Remove redundant guidance notes`,
        `Format numbered lists consistently`,
      ],
      notes: `Ensure no square brackets remain in the final document`,
    };

    // 关键：确保返回的result是Plain Object（避免代理无法解析）
    const result = {
      editGoal,
      plan: mockEditPlan,
      message: `Successfully planned document edits for goal: "${editGoal}". NEXT STEP: Call editDocumentTool with this plan to execute the changes.`,
      nextToolInput: {
        editGoal,
        editPlan: mockEditPlan,
        originalContent: documentContent,
      },
    };

    // 必须用 value 字段包裹最终结果（AI SDK 规范）
    yield {
      state: 'ready' as const,
      value: result, // 核心修复：AI SDK 会从 value 提取工具输出
    };
  },
});

export type LearnSkillsUIToolInvocation = UIToolInvocation<typeof learnSkillsTool>;