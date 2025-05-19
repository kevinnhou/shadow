import fs from "node:fs"

import {
  type GoogleGenerativeAIProviderOptions,
  createGoogleGenerativeAI,
} from "@ai-sdk/google"
import {
  Action,
  ActionPanel,
  Clipboard,
  Detail,
  Form,
  getPreferenceValues,
} from "@raycast/api"
import { FormValidation, useForm } from "@raycast/utils"

import { generateText } from "ai"
import { useEffect, useState } from "react"

interface Preferences {
  geminiApiKey: string
}

interface FormValues {
  query: string
  image: string[]
}

const preferences = getPreferenceValues<Preferences>()

export default function Query() {
  const [result, setResult] = useState<string | null>(null)
  const [lastRequestTime, setLastRequestTime] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [initialQuery, setInitialQuery] = useState<string | undefined>(
    undefined,
  )

  useEffect(() => {
    async function getClipboardContent() {
      try {
        const text = await Clipboard.readText()
        if (text && text.length < 1000) {
          setInitialQuery(text)
        } else {
          setInitialQuery("")
        }
      } catch (error) {
        console.error("Failed Reading Clipboard:", error)
        setInitialQuery("")
      }
    }
    getClipboardContent()
  }, [])

  const { handleSubmit, itemProps, setValue } = useForm<FormValues>({
    initialValues: {
      query: "",
      image: [],
    },
    async onSubmit(values) {
      const RATE_LIMIT_MS = 5000
      const now = Date.now()

      if (now - lastRequestTime < RATE_LIMIT_MS) {
        setResult(
          `Rate limit exceeded. Please wait ${Math.ceil((lastRequestTime + RATE_LIMIT_MS - now) / 1000)} seconds before making another request.`,
        )
        return
      }

      setLastRequestTime(now)
      setIsLoading(true)

      const google = createGoogleGenerativeAI({
        apiKey: preferences.geminiApiKey,
      })

      try {
        const messages: {
          role: "user"
          content: (
            | { type: "text"; text: string }
            | { type: "image"; image: Buffer }
          )[]
        }[] = [
          {
            role: "user",
            content: [
              { type: "text", text: `${values.query}. Answer in markdown.` },
            ],
          },
        ]

        if (values.image && values.image.length > 0) {
          messages[0].content.push({
            type: "image",
            image: fs.readFileSync(values.image[0] as string),
          })
        }

        const { text } = await generateText({
          model: google("gemini-2.5-flash-preview-04-17"),
          messages: messages,
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: 1000,
              },
            } satisfies GoogleGenerativeAIProviderOptions,
          },
        })

        setResult(text)
        Clipboard.copy(text)
      } catch (error) {
        console.error("Error Generating Response:", error)
        setResult(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
      } finally {
        setIsLoading(false)
      }
    },
    validation: {
      query: FormValidation.Required,
    },
  })

  useEffect(() => {
    if (initialQuery !== undefined) {
      setValue("query", initialQuery)
    }
  }, [initialQuery, setValue])

  return result ? (
    <Detail
      markdown={result}
      actions={
        <ActionPanel>
          <Action title="Go Back" onAction={() => setResult(null)} />
        </ActionPanel>
      }
    />
  ) : (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Submit Query" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        title="Query"
        placeholder="Queries?"
        {...itemProps.query}
      />
      <Form.FilePicker
        title="Image"
        canChooseDirectories={false}
        allowMultipleSelection={false}
        storeValue={false}
        {...itemProps.image}
      />
    </Form>
  )
}
