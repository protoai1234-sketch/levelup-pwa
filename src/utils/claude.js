// All Claude API calls go through the Supabase Edge Function.
// The CLAUDE_API_KEY secret never leaves the server.

import { todayString } from './dateHelpers';

const EDGE_FN_URL = 'https://bnfhcwzyaxtitgoydrmz.functions.supabase.co/goal-chat';
const TIMEOUT_MS = 30000;

// When the AI ends a message with this phrase, the frontend auto-triggers goal generation.
export const READY_TRIGGER = 'Ready to build your goal!';

// Keep this in sync with CHAT_SYSTEM in the edge function (edge function is authoritative).
export const SYSTEM_PROMPT = `You are a goal-setting coach inside the LevelUp app — a personal productivity app that turns life into a game. Your job is to help users set up meaningful long-term goals through a friendly, encouraging conversation.

Rules:
- Keep goal titles maximum 4 words, simple and direct. Examples: "Get Fit", "Make $40K", "Read More", "Lose 20 Pounds". Never include dates, deadlines, or challenge language in the title — details go in the description only.
- Detect the goal type from the first message and ask type-specific follow-up questions.
- For FITNESS goals: always ask which specific workout goes on which day. Build a full weekly split and confirm the schedule with the user before building.
- For SALES goals: calculate the exact daily activity needed to hit their revenue target (calls, conversations, demos, etc.).
- For NUTRITION goals: set up specific numeric daily targets (calories, protein grams, water oz, etc.).
- Ask focused questions one or two at a time — never overwhelm the user.
- Never ask more than 6-8 questions total.
- After gathering all goal information, always ask about notifications before triggering the build: "Consistency is everything. Want me to set up daily reminders so you never miss a day? If so, what time works best?"
- If the user says yes and gives one time, apply it to all actions. If they say no, set notificationEnabled to false for all actions.
- Keep responses short and conversational — no long paragraphs. Use encouraging language.
- Once you have all the information (including notification preference), end your final message with exactly this phrase on its own line: Ready to build your goal!`;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
  };
}

async function callEdgeFn(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out after 30 seconds. Please try again.');
    throw e;
  }
  clearTimeout(timer);

  console.log('[EdgeFn] Response status:', res.status);

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    console.error('[EdgeFn] Error body:', errText);
    let msg;
    try { msg = JSON.parse(errText).error; } catch { msg = errText; }
    throw new Error(msg || `Edge function returned ${res.status}`);
  }

  const data = await res.json();
  console.log('[EdgeFn] Response data:', data);
  return data;
}

// Returns the assistant's reply text.
export async function sendGoalChat(messages) {
  const data = await callEdgeFn({ messages, mode: 'chat' });
  if (data.error) throw new Error(data.error);
  const text = data.text ?? '';
  if (!text) throw new Error('Got an empty response from the AI. Please try again.');
  return text;
}

// Returns parsed goal JSON object.
export async function buildGoalFromConversation(messages) {
  const today = todayString();
  const d90 = new Date();
  d90.setDate(d90.getDate() + 90);
  const ninetyDays = `${d90.getFullYear()}-${String(d90.getMonth()+1).padStart(2,'0')}-${String(d90.getDate()).padStart(2,'0')}`;

  const buildPrompt = `Based on our entire conversation, generate the complete goal configuration as a JSON object. You must respond with ONLY a valid JSON object and absolutely nothing else — no preamble, no explanation, no markdown code blocks, no backticks. Just the raw JSON.

Use this exact schema:

{
  "title": "string (max 4 words, no dates)",
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
- title must be 4 words or fewer — no dates, no deadlines, no challenge language
- activeDays: JS day numbers — 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
- startDate must be ${today}
- endDate should reflect the user's timeline; default to ${ninetyDays} if not specified
- For fitness goals with a weekly split: fill weeklyPlan strings describing each day's workout; set dayOfWeek (0-6) on each action to assign it to a specific day; metricType stays "checkbox"
- For sales/nutrition/financial goals: set metricType "number", metricTarget to the numeric target, metricUnit to the unit (e.g. "conversations", "grams", "dollars", "calories")
- For rest days in fitness, set weeklyPlan value to null — do not create actions for rest days
- Point values: 10-20 easy, 30-50 moderate, 60-100 hard effort per action
- Generate specific, actionable action names — not generic ones
- NOTIFICATIONS (critical): Read back through the entire conversation history. If the user confirmed they want reminders and provided a specific time (e.g. "7am", "6:30 AM", "07:00", "8 pm"), set notificationEnabled to true and notificationTime to that exact time in HH:MM 24-hour format on EVERY daily action. Examples: "7am" → "07:00", "6:30pm" → "18:30", "9 AM" → "09:00". If the user said no to reminders or never provided a time, set notificationEnabled to false`;

  const data = await callEdgeFn({
    messages: [...messages, { role: 'user', content: buildPrompt }],
    mode: 'generate',
  });

  if (data.error) throw new Error(data.error);

  const rawText = (data.text ?? '').trim();
  console.log('[GoalGen] Raw Claude response:', rawText);

  // Aggressively strip all code fence variants before parsing
  const clean = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^`+/, '')
    .replace(/`+$/, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('[GoalGen] JSON parse failed. Raw response was:', rawText);
    throw new Error(`Goal JSON parse failed — raw response: "${rawText.slice(0, 300)}"`);
  }
}
