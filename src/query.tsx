import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google"
import {
  Action,
  ActionPanel,
  Clipboard,
  Detail,
  Form,
  getPreferenceValues,
} from "@raycast/api"
import { FormValidation, useForm } from "@raycast/utils"

import { useEffect, useState } from "react"
import { queryAI } from "./utils/ai"

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
      setIsLoading(true)

      let providerOpts: GoogleGenerativeAIProviderOptions | undefined = {
        thinkingConfig: {
          thinkingBudget: 5426,
        },
      }

      if (values.depth === "quick") {
        providerOpts = {
          thinkingConfig: {
            thinkingBudget: 1000,
          },
        }
      } else if (values.depth === "deep") {
        providerOpts = {
          thinkingConfig: {
            thinkingBudget: 18240,
            includeThoughts: true,
          },
        }
      }

      try {
        const text = await queryAI({
          query: values.query,
          imagePath: values.image?.[0],
          geminiApiKey: preferences.geminiApiKey,
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
