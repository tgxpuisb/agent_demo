import { DocumentFlowState } from '@/tool/workflow';
import { getDocument } from '@/tool/document-store';
import { weatherAgent } from '@/agent/weather-agent';
export async function learnSkillsFSM(input: { requestId: string }) {
    const doc = await getDocument(input.requestId);
    
    console.log('AAA learnSkillsFSM doc', doc);

//   const plan = await weatherAgent.respond({
//     messages: [
//       { role: 'system', parts: [{ type: 'text', text: 'You are a document editing agent.' }] },
//       { role: 'user', parts: [{ type: 'text', text: doc?.documentContent ?? '' }] },
//     ],
//   });

  return {
    state: DocumentFlowState.PLAN_READY,
    payload: {},
  };
}
