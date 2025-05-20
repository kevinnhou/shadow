import fs from "node:fs"
import path from "node:path"
import { useEffect, useState } from "react"

import { createGoogleGenerativeAI } from "@ai-sdk/google"
import {
  Action,
  ActionPanel,
  Clipboard,
  Detail,
  Toast,
  getPreferenceValues,
  showToast,
} from "@raycast/api"
import { generateText } from "ai"

interface Preferences {
  geminiApiKey: string
  imagesDirectory: string
}

const preferences = getPreferenceValues<Preferences>()
const imageDirectory = preferences.imagesDirectory

function getLatestPng(directoryPath: string): string | null {
  try {
    const files = fs.readdirSync(directoryPath)
    const pngFiles = files
      .filter((file) => path.extname(file).toLowerCase() === ".png")
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(directoryPath, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)

    return pngFiles.length > 0
      ? path.join(directoryPath, pngFiles[0].name)
      : null
  } catch (error) {
    console.error("Error Finding Latest PNG:", error)
    return null
  }
}

async function getResponse(imagePath: string): Promise<string | null> {
  showToast({
    title: "Generating Response...",
    style: Toast.Style.Animated,
  })

  const google = createGoogleGenerativeAI({
    apiKey: preferences.geminiApiKey,
  })

  const query = "Solve the following question. Answer in Markdown."

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash-preview-04-17"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: query,
            },
            {
              type: "image",
              image: fs.readFileSync(imagePath),
            },
          ],
        },
      ],
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 2428,
            includeThoughts: true,
          },
          taskType: "QUESTION_ANSWERING",
        },
      },
    })

    showToast({
      title: "Response Generated",
      style: Toast.Style.Success,
    })
    return text
  } catch (error) {
    console.error("Error Generating Response:", error)
    showToast({
      title: "Error Generating Response",
      style: Toast.Style.Failure,
    })
    return null
  }
}

export default function QuickQuery() {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function onQuery() {
      const image = getLatestPng(imageDirectory)

      if (!image) {
        setContent("No PNG Image Found")
        setIsLoading(false)
        showToast({
          title: "No PNG Image Found",
          style: Toast.Style.Failure,
        })
        return
      }

      setContent(`![Query Image](${image})`)
      setIsLoading(true)

      const response = await getResponse(image)

      if (response) {
        setContent(response)
      } else {
        setContent("Error Generating Response")
      }

      setIsLoading(false)
    }

    onQuery()
  }, [])

  return (
    <Detail
      markdown={content}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          {!isLoading && content && (
            <Action
              title="Copy to Clipboard"
              onAction={() => Clipboard.copy(content)}
            />
          )}
        </ActionPanel>
      }
    />
  )
}
