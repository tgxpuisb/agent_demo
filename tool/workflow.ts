import { ToolRunner } from '@/tool/tool-runner';


export enum DocumentFlowState {
  INIT = 'INIT',
  DOCUMENT_LOADED = 'DOCUMENT_LOADED',
  PLAN_READY = 'PLAN_READY',
  EDITING = 'EDITING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}


export interface DocumentFSMContext {
  requestId: string;
  nextTool: string;
    state: DocumentFlowState;
    error?: string;
}

export async function runDocumentFSM(
  toolRunner: ToolRunner,
  initialContext: DocumentFSMContext,
) {
    let ctx = initialContext;
    console.log('AAAAA FSM initialContext:', initialContext);

  while (true) {
    switch (ctx.state) {
      case DocumentFlowState.INIT: {
        const result = await toolRunner.callTool('readDocumentTool', {
          requestId: ctx.requestId,
        });

        ctx = { ...ctx, ...result };
        break;
      }

      case DocumentFlowState.DOCUMENT_LOADED: {
        const result = await toolRunner.callTool('learnSkillsTool', {
        requestId: ctx.requestId,
        });

        ctx = { ...ctx, ...result };
        break;
      }

      case DocumentFlowState.PLAN_READY: {
        const result = await toolRunner.callTool('editDocumentTool', {
          requestId: ctx.requestId,
        });

        ctx = { ...ctx, ...result };
        break;
      }

      case DocumentFlowState.DONE:
        return ctx;

      case DocumentFlowState.ERROR:
        throw new Error(ctx.error);

      default:
        throw new Error(`Unknown state: ${ctx.state}`);
    }
  }
}

