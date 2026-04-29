import { Deepgram } from '@deepgram/sdk'

export interface STTTranscript {
  text: string
  speaker?: string
  confidence: number
  isFinal: boolean
  startMs: number
  endMs: number
}

export type STTCallback = (transcript: STTTranscript) => void
export type STTErrorCallback = (error: Error) => void

export class DeepgramSTT {
  private deepgram: Deepgram | null = null
  private connection: any = null
  private mediaStream: MediaStream | null = null
  private onTranscript: STTCallback | null = null
  private onError: STTErrorCallback | null = null
  private apiKey: string = ''
  private language: string = 'ja-JP'
  private isConnected: boolean = false

  constructor(apiKey: string, language: string = 'ja-JP') {
    this.apiKey = apiKey
    this.language = language
  }

  setCallbacks(onTranscript: STTCallback, onError: STTErrorCallback): void {
    this.onTranscript = onTranscript
    this.onError = onError
  }

  async start(deviceId?: string): Promise<void> {
    if (this.isConnected) {
      console.warn('Already connected')
      return
    }

    if (!this.apiKey) {
      this.onError?.(new Error('Deepgram API key not set'))
      return
    }

    try {
      this.deepgram = new Deepgram(this.apiKey)

      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true }
            }
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      const dgConnection = this.deepgram.listen.live({
        model: 'nova-3',
        language: this.language,
        smart_format: true,
        diarize: true,
        interim_results: true,
        punctuate: true,
        endpointing: 300,
        utt_split: 0.5
      })

      this.connection = dgConnection

      dgConnection.on('transcriptReceived', (transcript: any) => {
        this.handleTranscript(transcript)
      })

      dgConnection.on('Error', (error: any) => {
        console.error('Deepgram error:', error)
        this.onError?.(new Error(error))
      })

      const mimeType = this.getSupportedMimeType()
      const mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType })

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && dgConnection.getReadyState() === 'OPEN') {
          const reader = new FileReader()
          reader.onload = () => {
            const base64Audio = (reader.result as string).split(',')[1]
            if (base64Audio) {
              dgConnection.send(Buffer.from(base64Audio, 'base64'))
            }
          }
          reader.readAsDataURL(event.data)
        }
      }

      mediaRecorder.start(250)

      this.isConnected = true

      const stopTrack = () => {
        if (dgConnection.getReadyState() === 'OPEN') {
          dgConnection.finish()
        }
        mediaRecorder.stop()
        this.mediaStream?.getTracks().forEach((track) => track.stop())
        this.isConnected = false
      }

      ;(this as any)._stopTrack = stopTrack
    } catch (err) {
      this.onError?.(err as Error)
      throw err
    }
  }

  private handleTranscript(response: any): void {
    if (!response?.channel?.alternatives?.[0]) return

    const alternative = response.channel.alternatives[0]
    const transcript = alternative.transcript?.trim()
    if (!transcript) return

    const isFinal = response.is_final || false
    const words = alternative.words || []
    
    let speaker: string | undefined
    if (words.length > 0 && words[0].speaker !== undefined) {
      speaker = `話者${words[0].speaker}`
    }

    let startMs = 0
    let endMs = 0
    if (words.length > 0) {
      startMs = words[0].start || 0
      endMs = words[words.length - 1].end || 0
    }

    this.onTranscript?.({
      text: transcript,
      speaker,
      confidence: alternative.confidence || 1.0,
      isFinal,
      startMs,
      endMs
    })
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return 'audio/webm'
  }

  stop(): void {
    if ((this as any)._stopTrack) {
      ;(this as any)._stopTrack()
      delete (this as any)._stopTrack
    }
    this.isConnected = false
    this.connection = null
    this.mediaStream = null
  }

  setLanguage(language: string): void {
    this.language = language
  }

  isActive(): boolean {
    return this.isConnected
  }
}

export async function getAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'audioinput')
  } catch {
    return []
  }
}
