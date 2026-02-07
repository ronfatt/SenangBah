import OpenAI from "openai";
import { SYSTEM_PROMPT, getDeveloperPrompt } from "./prompts.js";
import { jsonSchemaWrapper } from "./schema.js";
import { validateModelJson } from "./validators.js";
import { isEmptyOrNonsense } from "./utils.js";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildFallbackResponse(context) {
  const theme = context?.today_focus?.theme || "your topic";
  return {
    title: "Quick Check",
    instructions: "Write one clear sentence.",
    task_type: "rewrite",
    items: [
      {
        id: "q1",
        prompt: `Write ONE sentence giving your opinion about ${theme}. Start with: I believe...`,
        choices: [],
        answer_key: "",
        hints: ["Keep it simple and clear."]
      }
    ],
    student_action: { expected_input: "text", max_words: 30 },
    feedback: {
      what_you_did_well: [],
      fix_this_next: [],
      band_lift_sentence: "",
      why_it_works_simple: []
    },
    score: { spm_power_gain: 0, estimated_band_delta: 0, skill_tags: [] },
    spaced_repetition_update: { add: [], review_next: [] },
    next_question: `Write ONE sentence giving your opinion (I believe...) about ${theme}.`
  };
}

async function callModelOnce(mode, context, extraDeveloperNote = "") {
  const devPrompt = getDeveloperPrompt(mode);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "developer", content: devPrompt + (extraDeveloperNote ? `\n\n${extraDeveloperNote}` : "") },
    { role: "user", content: JSON.stringify(context) }
  ];

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.3,
    response_format: { type: "json_schema", json_schema: jsonSchemaWrapper }
  });

  const text = response?.choices?.[0]?.message?.content || "";
  return text;
}

export async function runMode(mode, context) {
  const studentAnswer = context?.content?.student_answer || "";
  if ((mode === "feedback" || mode === "weekly_checkpoint") && isEmptyOrNonsense(studentAnswer)) {
    return buildFallbackResponse(context);
  }

  let raw = await callModelOnce(mode, context);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  const validation = parsed ? validateModelJson(parsed) : { ok: false };
  if (validation.ok) return parsed;

  // One retry with a strict repair instruction
  const repairNote = "Your last output was invalid. Output ONLY valid JSON that matches the shared schema. Do not add any extra keys.";
  raw = await callModelOnce(mode, context, repairNote);
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const validation2 = parsed ? validateModelJson(parsed) : { ok: false };
  if (validation2.ok) return parsed;

  // Fallback if still invalid
  return buildFallbackResponse(context);
}
