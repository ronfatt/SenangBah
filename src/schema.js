export const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "instructions",
    "task_type",
    "items",
    "student_action",
    "feedback",
    "score",
    "spaced_repetition_update",
    "next_question"
  ],
  properties: {
    title: { type: "string" },
    instructions: { type: "string" },
    task_type: {
      type: "string",
      enum: [
        "mcq",
        "rewrite",
        "fill_blank",
        "upgrade_sentence",
        "add_idea",
        "mini_writing",
        "speaking_sim"
      ]
    },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "prompt", "choices", "answer_key", "hints"],
        properties: {
          id: { type: "string" },
          prompt: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer_key: { type: "string" },
          hints: { type: "array", items: { type: "string" } }
        }
      }
    },
    student_action: {
      type: "object",
      additionalProperties: false,
      required: ["expected_input", "max_words"],
      properties: {
        expected_input: { type: "string", enum: ["choice", "text"] },
        max_words: { type: "number" }
      }
    },
    feedback: {
      type: "object",
      additionalProperties: false,
      required: [
        "what_you_did_well",
        "fix_this_next",
        "band_lift_sentence",
        "why_it_works_simple"
      ],
      properties: {
        what_you_did_well: { type: "array", items: { type: "string" } },
        fix_this_next: { type: "array", items: { type: "string" } },
        band_lift_sentence: { type: "string" },
        why_it_works_simple: { type: "array", items: { type: "string" } }
      }
    },
    score: {
      type: "object",
      additionalProperties: false,
      required: ["spm_power_gain", "estimated_band_delta", "skill_tags"],
      properties: {
        spm_power_gain: { type: "number" },
        estimated_band_delta: { type: "number" },
        skill_tags: { type: "array", items: { type: "string" } }
      }
    },
    spaced_repetition_update: {
      type: "object",
      additionalProperties: false,
      required: ["add", "review_next"],
      properties: {
        add: { type: "array", items: { type: "string" } },
        review_next: { type: "array", items: { type: "string" } }
      }
    },
    next_question: { type: "string" }
  }
};

export const jsonSchemaWrapper = {
  name: "spm_training_response",
  strict: true,
  schema: outputSchema
};

export const chatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "english_question", "quick_tip"],
  properties: {
    answer: { type: "string" },
    english_question: { type: "string" },
    quick_tip: { type: "string" }
  }
};

export const chatSchemaWrapper = {
  name: "spm_chat_response",
  strict: true,
  schema: chatSchema
};

export const handwritingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "extracted_text",
    "analysis",
    "explanation"
  ],
  properties: {
    extracted_text: { type: "string" },
    analysis: {
      type: "object",
      additionalProperties: false,
      required: [
        "band_estimate_range",
        "strengths",
        "weaknesses",
        "improvements",
        "band_lift_sentence"
      ],
      properties: {
        band_estimate_range: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        band_lift_sentence: { type: "string" }
      }
    },
    explanation: {
      type: "object",
      additionalProperties: false,
      required: ["zh", "ms"],
      properties: {
        zh: { type: "string" },
        ms: { type: "string" }
      }
    }
  }
};

export const handwritingSchemaWrapper = {
  name: "spm_handwriting_response",
  strict: true,
  schema: handwritingSchema
};

export const pilotIntroAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["strengths", "weaknesses", "grammar", "sentence_fixes", "overall_comment"],
  properties: {
    strengths: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    weaknesses: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    grammar: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    sentence_fixes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "improved", "reason"],
        properties: {
          original: { type: "string" },
          improved: { type: "string" },
          reason: { type: "string" }
        }
      }
    },
    overall_comment: { type: "string" }
  }
};

export const pilotIntroAnalysisSchemaWrapper = {
  name: "spm_pilot_intro_analysis",
  strict: true,
  schema: pilotIntroAnalysisSchema
};
