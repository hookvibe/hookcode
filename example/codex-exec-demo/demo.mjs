import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();
const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ok", "action_required"] },
  },
  required: ["summary", "status"],
  additionalProperties: false,
}

const turn = await thread.run("hello", { outputSchema: schema });
console.log(turn);