import { useState, useCallback, useRef, useEffect } from 'react'
import { DeepgramSTT, getAudioDevices, type STTTranscript } from '../stt'

export interface UseSTTOptions {
  apiKey: string
  language?: string
  onTranscript?: (transcript: STTTranscript) => void
  onError?: (error: Error) => void
}

export interface UseSTTReturn {
  isRecording: boolean
  startRecording: (deviceId?: string) => Promise<void>
  stopRecording: () => void
  devices: MediaDeviceInfo[]
  refreshDevices: () => Promise<void>
  error: Error | null
}

export function useSTT({
  apiKey,
  language = 'ja-JP',
  onTranscript,
  onError
}: UseSTTOptions): UseSTTReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [error, setError] = useState<Error | null>(null)
  const sttRef = useRef<DeepgramSTT | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
  }, [onTranscript, onError])

  const refreshDevices = useCallback(async () => {
    const devs = await getAudioDevices()
    setDevices(devs)
  }, [])

  useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  const startRecording = useCallback(async (deviceId?: string) => {
    if (!apiKey) {
      const err = new Error('Deepgram API key not set')
      setError(err)
      onErrorRef.current?.(err)
      return
    }

    try {
      setError(null)

      const stt = new DeepgramSTT(apiKey, language)
      sttRef.current = stt

      stt.setCallbacks(
        (transcript) => {
          onTranscriptRef.current?.(transcript)
        },
        (err) => {
          setError(err)
          onErrorRef.current?.(err)
        }
      )

      await stt.start(deviceId)
      setIsRecording(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onErrorRef.current?.(error)
    }
  }, [apiKey, language])

  const stopRecording = useCallback(() => {
    if (sttRef.current) {
      sttRef.current.stop()
      sttRef.current = null
    }
    setIsRecording(false)
  }, [])

  useEffect(() => {
    return () => {
      if (sttRef.current) {
        sttRef.current.stop()
      }
    }
  }, [])

  return {
    isRecording,
    startRecording,
    stopRecording,
    devices,
    refreshDevices,
    error
  }
}
