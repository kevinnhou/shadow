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
  depth: string
}

const preferences = getPreferenceValues<Preferences>()

export default function Query() {
  const [response, setResponse] = useState<string | null>(null)
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
      depth: "balanced",
    },
    async onSubmit(values) {
      const RATE_LIMIT_MS = 5000
      const now = Date.now()

      if (now - lastRequestTime < RATE_LIMIT_MS) {
        setResponse(
          `Rate limit exceeded. Please wait ${Math.ceil(
            (lastRequestTime + RATE_LIMIT_MS - now) / 1000,
          )} seconds before making another request.`,
        )
        return
      }

      setLastRequestTime(now)
      setIsLoading(true)

      const google = createGoogleGenerativeAI({
        apiKey: preferences.geminiApiKey,
      })

      let modelName = "gemini-2.5-flash-preview-04-17"
      let providerOpts:
        | {
            google?: GoogleGenerativeAIProviderOptions
          }
        | undefined = {
        google: {
          thinkingConfig: {
            thinkingBudget: 5426,
          },
        },
      }

      if (values.depth === "quick") {
        modelName = "gemini-2.0-flash"
        providerOpts = undefined
      } else if (values.depth === "deep") {
        providerOpts = {
          google: {
            thinkingConfig: {
              thinkingBudget: 18240,
              includeThoughts: true,
            },
          },
        }
      }

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
          model: google(
            modelName as "gemini-2.0-flash" | "gemini-2.5-flash-preview-04-17",
          ),
          messages: messages,
          providerOptions: providerOpts,
        })

        setResponse(text)
      } catch (error) {
        console.error("Error Generating Response:", error)
        setResponse(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
      } finally {
        setIsLoading(false)
      }
    },
    validation: {
      query: FormValidation.Required,
      depth: FormValidation.Required,
    },
  })

  useEffect(() => {
    if (initialQuery !== undefined) {
      setValue("query", initialQuery)
    }
  }, [initialQuery, setValue])

  return response ? (
    <Detail
      markdown={response}
      actions={
        <ActionPanel>
          <Action title="Go Back" onAction={() => setResponse(null)} />
          <Action
            title="Copy to Clipboard"
            onAction={() => Clipboard.copy("response")}
          />
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
        autoFocus={true}
        {...itemProps.query}
      />
      <Form.FilePicker
        title="Image"
        canChooseDirectories={false}
        allowMultipleSelection={false}
        storeValue={false}
        {...itemProps.image}
      />
      <Form.Dropdown title="Depth" {...itemProps.depth}>
        <Form.Dropdown.Item value="quick" title="Quick" />
        <Form.Dropdown.Item value="balanced" title="Balanced" />
        <Form.Dropdown.Item value="deep" title="Deep" />
      </Form.Dropdown>
    </Form>
  )
}
