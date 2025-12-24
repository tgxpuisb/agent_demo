import { DocumentFlowState } from '@/tool/workflow';
export async function editDocumentFSM(input: { requestId: string }) {
    console.log('AAA editDocumentFSM input', input);
  // 执行编辑
  return {
    state: DocumentFlowState.DONE,
  };
}
