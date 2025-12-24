import { readDocumentTool } from '@/tool/read-document';
import { learnSkillsTool } from '@/tool/learn-skills';
import { editDocumentTool } from '@/tool/edit-document';
import { readDocumentFSM } from '@/tool/read-document-fsm';
import { learnSkillsFSM } from '@/tool/learn-skill-fsm';
import { editDocumentFSM } from '@/tool/edit-document-fsm';
import { DocumentFlowState } from '@/tool/workflow';


/**
 * FSM 期望的 Tool 返回结构
 */
export type FSMToolResult = {
  state: DocumentFlowState;
  payload?: any;
  error?: string;
};

type FSMToolExecuteFn = (input: any, ctx?: any) => Promise<FSMToolResult>;

export class ToolRunner {
  private tools: Record<string, FSMToolExecuteFn>;

  constructor(tools: Record<string, FSMToolExecuteFn>) {
    this.tools = tools;
  }

  async callTool(name: string, input: any, ctx?: any): Promise<FSMToolResult> {
    const tool = this.tools[name];
    if (!tool) {
      return {
        state: DocumentFlowState.ERROR,
        error: `Tool not found: ${name}`,
      };
    }

    try {
      return await tool(input, ctx);
    } catch (err) {
      return {
        state: DocumentFlowState.ERROR,
        error: (err as Error).message,
      };
    }
  }
}

export const toolRunner = new ToolRunner({
  readDocumentTool: readDocumentFSM,
  learnSkillsTool: learnSkillsFSM,
  editDocumentTool: editDocumentFSM,
});
