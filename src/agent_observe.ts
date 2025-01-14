import "./hooks/telemetry.js";
import "dotenv/config.js";
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { FrameworkError } from "bee-agent-framework/errors";
import { TokenMemory } from "bee-agent-framework/memory/tokenMemory";
import { OpenMeteoTool } from "bee-agent-framework/tools/weather/openMeteo";
import { getChatLLM } from "./helpers/llm.js";
import { getPrompt } from "./helpers/prompt.js";
import { WikipediaTool } from "bee-agent-framework/tools/search/wikipedia";

const llm = getChatLLM();
const agent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: [new OpenMeteoTool(), new WikipediaTool()],
});

try {
  const prompt = getPrompt(`What is the current weather in Las Vegas?`);
  console.info(`User 👤 : ${prompt}`);

  const response = await agent.run(
    { prompt },
    {
      execution: {
        maxIterations: 8,
        maxRetriesPerStep: 3,
        totalMaxRetries: 10,
      },
    },
  );

  console.info(`Agent 🤖 : ${response.result.text}`);
} catch (error) {
  console.error(FrameworkError.ensure(error).dump());
}
