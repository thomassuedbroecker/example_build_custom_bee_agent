import { BaseAgent, BaseAgentRunOptions } from "bee-agent-framework/agents/base";
import { BaseMessage, Role } from "bee-agent-framework/llms/primitives/message";
import { Emitter } from "bee-agent-framework/emitter/emitter";
import { GetRunContext } from "bee-agent-framework/context";
import { JsonDriver } from "bee-agent-framework/llms/drivers/json";
import { z } from "zod";
import { PromptTemplate } from "bee-agent-framework/template";
import { AgentMeta } from "bee-agent-framework/agents/types";

import { ChatLLM, ChatLLMOutput } from "bee-agent-framework/llms/chat";
import { BaseMemory } from "bee-agent-framework/memory/base";
import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";

// watsonx configruation
import { WatsonXChatLLM } from "bee-agent-framework/adapters/watsonx/chat";
import { WatsonXLLM } from "bee-agent-framework/adapters/watsonx/llm";

// Logging
import { Logger } from "bee-agent-framework/logger/logger";
import { createConsoleReader } from "./helpers/io.js";
import { FrameworkError } from "bee-agent-framework/errors";
import { BaseLLMEvents } from "bee-agent-framework/llms/base";

// *********************************
// Agent definition
// ******************************** */

// *********************************
// Agent onput/output definitions
// ******************************** */

interface RunInput {
  message: BaseMessage;
}

interface RunOutput {
  message: BaseMessage;
  state: {
    thought: string;
    final_answer: string;
  };
}

interface RunOptions extends BaseAgentRunOptions {
  maxRetries?: number;
}

interface AgentInput {
  llm: ChatLLM<ChatLLMOutput>;
  memory: BaseMemory;
}

// *********************************
// Agent Class
// ******************************** */

export class CustomGermanAgent extends BaseAgent<RunInput, RunOutput, RunOptions> {
  protected driver: JsonDriver;
  public readonly memory: BaseMemory;
  public emitter = Emitter.root.child({
    namespace: ["agent", "custom"],
    creator: this,
  });

  protected static systemPrompt = new PromptTemplate({
    schema: z.object({
        schema: z.string().min(1),
    }),
    template: `## System Instructions

You are a knowledgeable and friendly AI assistant named Thomas.
Your role is to help users by answering their questions, providing information, and offering guidance to the best of your abilities. When responding, use a warm and professional tone, and break down complex topics into easy-to-understand explanations. 
If you are unsure about an answer, it's okay to say you don't know rather than guessing.
You must understand all languages but you must answer always in proper german language.
If there are terms that are technical topics in English and they are commonly known in English, don't translate the keywords.

\`\`\`
{{schema}}
\`\`\`

IMPORTANT: Every answer must be a parsable JSON string without additional output.
`,
  });

  constructor(input: AgentInput) {
    super();
    this.driver = JsonDriver.fromTemplate(CustomGermanAgent.systemPrompt, input.llm);
    this.memory = input.memory;
  }

  protected async _run(
    input: RunInput,
    options: RunOptions,
    run: GetRunContext<this>,
  ): Promise<RunOutput> {
    const response = await this.driver.generate(
      z.object({
        thought: z
          .string()
          .describe("Describe your thought process before coming with a final answer"),
        final_answer: z
          .string()
          .describe("Here you should provide concise answer to the original question."),
      }),
      [...this.memory.messages, input.message],
      {
        maxRetries: options?.maxRetries,
        options: { signal: run.signal },
      },
    );

    const result = BaseMessage.of({
      role: Role.ASSISTANT,
      text: response.parsed.final_answer,
    });
    await this.memory.add(result);

    return {
      message: result,
      state: response.parsed,
    };
  }

  public get meta(): AgentMeta {
    return {
      name: "CustomAgent",
      description: "Simple Custom Agent is a simple LLM agent to answer in German.",
      tools: []
    };
  }

  createSnapshot() {
    return {
      ...super.createSnapshot(),
      driver: this.driver,
      emitter: this.emitter,
      memory: this.memory,
    };
  }

  loadSnapshot(snapshot: ReturnType<typeof this.createSnapshot>) {
    Object.assign(this, snapshot);
  }
}

// *********************************
// Execution
// ******************************** */

/// *******************************
/// 1. Chat model setup
/// *******************************

/// *******************************
/// 1.1 Define the watsonx model
/// *******************************
const llm_lama = new WatsonXLLM({
  modelId: "meta-llama/llama-3-70b-instruct",
  projectId: process.env.WATSONX_PROJECT_ID,
  baseUrl: process.env.WATSONX_BASE_URL,
  apiKey: process.env.WATSONX_API_KEY,
  parameters: {
    decoding_method: "greedy",
    max_new_tokens: 500,
  },
});

/// *******************************
/// 1.2. The definition of a chat prompt template for the watsonx chat model
/// *******************************
const template = new PromptTemplate({
  schema: {
    messages: {
      system: "",
      user: "",
      assistant: "",
    },
  },
  template: `{{#messages}}{{#system}}<|begin_of_text|><|start_header_id|>system<|end_header_id|>
  
  {{system}}<|eot_id|>{{/system}}{{#user}}<|start_header_id|>user<|end_header_id|>
  
  {{user}}<|eot_id|>{{/user}}{{#assistant}}<|start_header_id|>assistant<|end_header_id|>
  
  {{assistant}}<|eot_id|>{{/assistant}}{{/messages}}<|start_header_id|>assistant<|end_header_id|>
  
  `,
});

/// *******************************
/// 1.3. LLM interaction configuration for the chat mode.
/// *******************************
const chatLLM = new WatsonXChatLLM({
  llm: llm_lama,
  config: {
    messagesToPrompt(messages: BaseMessage[]) {
      return template.render({
        messages: messages.map((message) => ({
          system: message.role === "system" ? [message.text] : [],
          user: message.role === "user" ? [message.text] : [],
          assistant: message.role === "assistant" ? [message.text] : [],
        })),
      });
    },
  }, 
});

/// *******************************
/// 2. Create an agent instance with the chat model configuration
/// *******************************
const customAgent = new CustomGermanAgent({
  llm: chatLLM,
  memory: new UnconstrainedMemory(),
});


/// *******************************
/// 3. Create a `createConsoleReader`; this was part of older helpers. The reader displays all the steps the agent takes easily.Create a logger for more detailed trace information.
/// *******************************
const logger = new Logger({ name: "app", level: "trace" });
const reader = createConsoleReader();

/// *******************************
/// 4. Execute the agent
/// *******************************
try {
let message = BaseMessage.of({ role: Role.USER, text: "What is your name and why is the sky blue?" }) 
console.info("Message:\n" + message.text + "\n");
const response = await customAgent
.run(
  { message },
)
.observe((emitter) => {
  emitter.on("start", () => {
    reader.write(`Agent 🤖 : `, "starting new iteration");
  });
  emitter.on("error", ({ error }) => {
    reader.write(`Agent 🤖 : `, FrameworkError.ensure(error).dump());
  });
  emitter.on("retry", () => {
    reader.write(`Agent 🤖 : `, "retrying the action...");
  });
  emitter.on("update", async ({ data, update, meta }) => {
    reader.write(`Agent (${update.key}) 🤖 : `, update.value);
  });
  emitter.match("*.*", async (data: any, event) => {
    if (event.creator === chatLLM) {
      const eventName = event.name as keyof BaseLLMEvents;
      switch (eventName) {
        case "start":
          console.info("LLM Input");
          console.info(data.input);
          break;
        case "success":
          console.info("LLM Output");
          console.info(data.value.raw.finalResult);
          break;
        case "error":
          console.error(data);
          break;
      }
    }
  });
});
reader.write(`Agent 🤖 : `, response.message.text);
} catch (error) {
    logger.error(FrameworkError.ensure(error).dump());
} finally {
    process.exit(0);
}
