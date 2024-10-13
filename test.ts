import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import OpenAI from "openai";
import { stream, streamText } from "hono/streaming";

type Env = {
  OPENAI_BASE_URL: string;
  OPENAI_API_KEY: string | undefined;
  Bindings: {
    OPENAI_API_KEY: string;
    OPENAI_BASE_URL: string;
    BASE_URL: string;
  };
};
const app = new Hono<{ Bindings: Env }>();

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

app.use("*", logger());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/api", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file1 = body.file1 as File;
    const file2 = body.file2 as File;

    if (!file1 || !file2) {
      return c.json({ error: "Two files are required" }, 400);
    }

    const file1Content = await file1.text();
    const file2Content = await file2.text();

    const openai = new OpenAI({
      apiKey: "",
      baseURL: "",
    });

    const chatStream = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "你是一个专业的软件测试专家。你的任务是评估给定的单元测试的有效性和价值。"
        },
        {
          role: "user",
          content: `请评估以下单元测试的有效性和价值。源代码：\n\n${file1Content}\n\n单元测试代码：\n\n${file2Content}`
        }
      ],
      model: "gpt-4o-mini",
      stream: true,
    });

    return streamText(c, async (stream) => {
      for await (const message of chatStream) {
        const text = message.choices[0]?.delta.content ?? "";
        await Promise.all(
          Array.from(text).map(async (s) => {
            await stream.write(s);
            await stream.sleep(20);
          })
        );
      }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

const port = 8080;
console.log(`Server is running on port http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

// ccurl -X POST http://localhost:8080/api \
//   -H "Content-Type: application/json" \
//   --no-buffer \
//   -d '{
//     "messages": [
//       {"role": "system", "content": "You are a helpful assistant."},
//       {"role": "user", "content": "Hello, can you tell me a joke?"}
//     ]
//   }'
