# Example building a custom Bee Agent

Related blog post for the documentation [Building a Custom Bee Agent in TypeScript](https://suedbroecker.net/2025/01/14/building-a-custom-bee-agent-in-typescript/).

This repository is based on the template for the [Bee Agent Framework](https://github.com/i-am-bee/bee-agent-framework).

📚 See the [documentation](https://i-am-bee.github.io/bee-agent-framework/) to learn more.

## Run the examples

1. Clone this repository
2. Install dependencies `npm ci`.
3. Configure your project by filling in missing values in the `.env` file for watsonx.

```sh
cat .env_template > .env
```

4. Relevant entries.

```sh
## WatsonX
export WATSONX_API_KEY=
export WATSONX_PROJECT_ID=
export WATSONX_MODEL="meta-llama/llama-3-1-70b-instruct"
export WATSONX_REGION="us-south"
export WATSONX_DEPLOYMENT_ID="XXX"
```

5. Run the agent `bash start.sh`

You can select which agent you want to start inside the bash automation file.
```sh
source .env

# Agent with no tools
#npm run start src/custom_agent_role_instruction_no_tools.ts

# Agent with tools based on runner
npm run start src/custom_agent_based_replan_german_execution.ts
```

🧪 More examples can be found [here](https://github.com/i-am-bee/bee-agent-framework/blob/main/examples).
