// All Claude API calls go through the Supabase Edge Function.
// The CLAUDE_API_KEY secret never leaves the server.

const EDGE_FN_URL = 'https://bnfhcwzyaxtitgoydrmz.functions.supabase.co/goal-chat';

export const SYSTEM_PROMPT = `You are a goal-setting coach inside the LevelUp app — a personal productivity app that turns life into a game. Your job is to help users set up meaningful long-term goals by having a friendly, encouraging conversation. Ask focused questions one or two at a time — never overwhelm the user. Detect the goal type from their first message and go deeper with relevant questions. For fitness goals build a complete weekly workout split. For sales goals calculate the exact daily activity needed to hit their target. For nutrition goals set up specific daily numeric targets. Keep responses concise and conversational — no long paragraphs. Use encouraging language. Once you have enough information tell the user you are ready to build their goal. Never ask more than 6-8 questions total before offering to build. When you have gathered enough information and are ready to build the goal, end your message with exactly: [READY_TO_BUILD]`;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
  };
}

async function callEdgeFn(body) {
  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Edge function returned ${res.status}`);
  }

  return res.json();
}

// Returns the assistant's reply text.
export async function sendGoalChat(messages) {
  const data = await callEdgeFn({ messages, systemPrompt: SYSTEM_PROMPT, mode: 'chat' });
  if (data.error) throw new Error(data.error);
  return data.response ?? '';
}

// Returns parsed goal JSON object.
export async function buildGoalFromConversation(messages) {
  const today = new Date().toISOString().slice(0, 10);
  const buildPrompt = `Based on our entire conversation, generate the complete goal configuration as a JSON object. Return ONLY raw JSON — no markdown fences, no code fences, no explanation. Use this exact schema:

{
  "title": "string",
  "description": "string",
  "goalType": "fitness|sales|nutrition|financial|habit|general",
  "traits": ["from: Discipline, Health, Knowledge, Finance, Social, Creativity"],
  "startDate": "${today}",
  "endDate": "YYYY-MM-DD",
  "activeDays": [1,2,3,4,5],
  "dailyActions": [
    {
      "name": "string",
      "pointValue": 30,
      "notificationEnabled": false,
      "notificationTime": "07:00",
      "metricType": "checkbox",
      "metricTarget": null,
      "metricUnit": null,
      "dayOfWeek": null
    }
  ],
  "weeklyPlan": {
    "monday": null, "tuesday": null, "wednesday": null, "thursday": null,
    "friday": null, "saturday": null, "sunday": null
  }
}

Rules:
- activeDays: JS day numbers — 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
- startDate must be ${today}
- endDate should reflect the user's timeline; default to 90 days from today if not specified
- For fitness goals with a weekly split: fill in weeklyPlan strings describing each day's workout; set dayOfWeek (0-6) on each action to assign it to a specific day; metricType stays "checkbox"
- For sales/nutrition/financial goals: set metricType "number", metricTarget to the numeric target, metricUnit to the unit (e.g. "conversations", "grams", "dollars", "calories")
- For rest days in fitness, set weeklyPlan value to null — do not create actions for rest days
- Point values: 10-20 easy, 30-50 moderate, 60-100 hard effort per action
- Generate specific, actionable action names — not generic ones`;

  const data = await callEdgeFn({
    messages: [...messages, { role: 'user', content: buildPrompt }],
    systemPrompt: SYSTEM_PROMPT,
    mode: 'generate',
  });

  if (data.error) throw new Error(data.error);
  return data; // edge function already parsed and returned the goal object
}
