export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'google'

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  model?: string
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type StreamCallback = (text: string, isFinal: boolean) => void

export class LLMClient {
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async chat(
    messages: LLMMessage[],
    onStream?: StreamCallback
  ): Promise<string> {
    switch (this.config.provider) {
      case 'deepseek':
        return this.chatDeepseek(messages, onStream)
      case 'openai':
        return this.chatOpenAI(messages, onStream)
      case 'anthropic':
        return this.chatAnthropic(messages, onStream)
      case 'google':
        return this.chatGoogle(messages, onStream)
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`)
    }
  }

  private async chatDeepseek(messages: LLMMessage[], onStream?: StreamCallback): Promise<string> {
    const model = this.config.model || 'deepseek-chat'
    let fullResponse = ''

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Deepseek API error: ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullResponse += content
              onStream?.(content, false)
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    onStream?.('', true)
    return fullResponse
  }

  private async chatOpenAI(messages: LLMMessage[], onStream?: StreamCallback): Promise<string> {
    const model = this.config.model || 'gpt-4o-mini'
    let fullResponse = ''

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullResponse += content
              onStream?.(content, false)
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    onStream?.('', true)
    return fullResponse
  }

  private async chatAnthropic(messages: LLMMessage[], onStream?: StreamCallback): Promise<string> {
    const model = this.config.model || 'claude-3-5-haiku-20241022'
    let fullResponse = ''

    const systemPrompt = messages.find(m => m.role === 'system')?.content || ''
    const chatMessages = messages.filter(m => m.role !== 'system')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: chatMessages,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullResponse += content
              onStream?.(content, false)
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    onStream?.('', true)
    return fullResponse
  }

  private async chatGoogle(messages: LLMMessage[], onStream?: StreamCallback): Promise<string> {
    const model = this.config.model || 'gemini-2.0-flash-exp'
    let fullResponse = ''

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    const systemInstruction = messages.find(m => m.role === 'system')?.content

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            maxOutputTokens: 1024
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google API error: ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('[') || line.startsWith('{')) {
          try {
            const parsed = JSON.parse(line)
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text
            if (content) {
              fullResponse += content
              onStream?.(content, false)
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    onStream?.('', true)
    return fullResponse
  }
}

export function getSystemPrompt(mode: string): string {
  const prompts: Record<string, string> = {
    general: 'あなたは面接官です。候補者にプロフェッショナルでhelpfulな質問をしましょう。',
    sales: 'あなたは営業職面接官です。営業経験、説得力、達成志向について質問をしましょう。',
    recruiting: 'あなたは採用面接官です。候補者の経験、能力、文化適合性について質問をしましょう。',
    technical: 'あなたは技術面接官です。技術力、問題解決能力、コード品質について質問をしましょう。',
    lecture: 'あなたは講義アシスタントです。内容をわかりやすく説明し、質問にお答えします。',
    negotiation: 'あなたは薪酬交渉のアドバイザーです。候補者が適切な条件で交渉できるようサポートしましょう。'
  }
  return prompts[mode] || prompts.general
}
