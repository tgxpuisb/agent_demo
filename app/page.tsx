'use client';

import { useChat } from '@ai-sdk/react';
import ChatInput from '@/component/chat-input';
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport, type UIMessage } from 'ai'
import type { WeatherAgentUIMessage } from '@/agent/weather-agent';
import WeatherView from '@/component/weather-view';
import { Button } from '@/component/button';
import { useMemo, useState } from 'react';
import cases from '@/component/mockData/cases';

class MockChatTransport extends DefaultChatTransport<UIMessage> {
  constructor(chatId: string, messageContentBuilder: () => Promise<any>) {
    super({
      credentials: 'same-origin',
      prepareSendMessagesRequest: async (options) => {
        const customBody = await messageContentBuilder();
        return {
          ...options,
          headers: {
            ...options.headers,
						'Content-Type': 'application/json',
          },
          body: {
            ...customBody,
						...(options.body || {}),
						messages: options.messages,
          }
        }
      }
    })
  }
}

export default function Chat() {

  const [caseName, setCaseName] = useState<string>('');


  const chatTransportSettings = new MockChatTransport('test-id-123', async () => cases.case1.request);

  const { status, sendMessage, messages, addToolOutput } = useChat<WeatherAgentUIMessage>({
    id: 'test-id-123',
    transport: chatTransportSettings,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall(options) {
      console.log("🚀 ~ Chat ~ options:", options)
      // addToolOutput({
      //   tool: options.toolCall.tool,
      //   toolCallId: options.toolCallId,
      //   output: {
      //     state: 'loading',
      //   },
      // })
    }
  });

  return (
    <div className="">
      
      {/* <ChatInput status={status} onSubmit={text => sendMessage({ text })} /> */}
      <div className="mt-4 mb-2">以下是一些常规输入用来测试，测试结果和doco预期结果做对比</div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Button 
          variant="default" 
          onClick={() => {
            setCaseName('case1');
            sendMessage({ text: "Please insert the following provision after the third bullet point in the \"Free copyright notice: cover\" section: \"Upon purchase of this template, you are granted full rights to edit, redistribute, or resell the modified version." })
          }}
        >
          非Agent对话测试
        </Button>
        {/* <Button 
          variant="secondary" 
          onClick={() => sendMessage({ text: "上海今天天气怎么样？" })}
        >
          测试按钮 2 - 上海天气
        </Button>
        <Button 
          variant="outline" 
          onClick={() => sendMessage({ text: "告诉我深圳的天气情况" })}
        >
          测试按钮 3 - 深圳天气
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => sendMessage({ text: "广州天气" })}
        >
          测试按钮 4 - 广州天气
        </Button>
        <Button 
          variant="destructive" 
          onClick={() => sendMessage({ text: "测试错误输入" })}
        >
          测试按钮 5 - 错误输入
        </Button> */}
      </div>
      <div className='flex justify-center'>
        <div className="w-1/2 px-4">
          {messages?.map(message => (
            <div key={message.id} className="whitespace-pre-wrap">
              <strong>{`${message.role}: `}</strong>
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case 'text':
                    return <div key={index}>{part.text}</div>;

                  case 'step-start':
                    return index > 0 ? (
                      <div key={index} className="text-gray-500">
                        <hr className="my-2 border-gray-300" />
                      </div>
                    ) : null;

                  case 'tool-weather': {
                    return <WeatherView invocation={part} />;
                  }
                }
              })}
              <br />
            </div>
          ))}
        </div>
        <div className="w-1/2 px-4 whitespace-break-spaces overflow-auto">
          {cases[caseName] && cases[caseName].response}
        </div>
      </div>
    </div>
  );
}
