import fs from "node:fs"

import {
  type GoogleGenerativeAIProviderOptions,
  createGoogleGenerativeAI,
} from "@ai-sdk/google"

import { generateText } from "ai"

interface queryAIOptions {
  query: string
  imagePath?: string
  geminiApiKey: string
  providerOptions?: GoogleGenerativeAIProviderOptions
}

export async function queryAI({
  query,
  imagePath,
  geminiApiKey,
  providerOptions,
}: queryAIOptions): Promise<string> {
  const google = createGoogleGenerativeAI({
    apiKey: geminiApiKey,
  })

  const messages: {
    role: "user"
    content: (
      | { type: "text"; text: string }
      | { type: "image"; image: Buffer }
    )[]
  }[] = [
    {
      role: "user",
      content: [{ type: "text", text: `${query}. Answer in markdown.` }],
    },
  ]

  if (imagePath) {
    messages[0].content.push({
      type: "image",
      image: fs.readFileSync(imagePath),
    })
  }

  const { text } = await generateText({
    model: google("gemini-2.5-flash-preview-04-17"),
    messages: messages,
    providerOptions: providerOptions ? { google: providerOptions } : undefined,
  })

  return text
}
