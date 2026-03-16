// @vitest-environment jsdom

import { createRef } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileToPendingAttachment } from '@/lib/file-attachments'
import { transcribeVoice } from '@/lib/voice-transcription-client'
import { MessageInput, type MessageInputHandle } from './MessageInput'

const mockVoiceRecorderState = {
  isRecording: false,
  isRequestingPermission: false,
  durationMs: 0,
  waveformBars: [] as number[],
}
const mockStartRecording = vi.fn()
const mockStopRecording = vi.fn<() => Promise<{ blob: Blob; mimeType: string; durationMs: number } | null>>(
  async () => null,
)

vi.mock('@/lib/file-attachments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/file-attachments')>('@/lib/file-attachments')
  return {
    ...actual,
    fileToPendingAttachment: vi.fn(async () => ({
      id: 'attachment-1',
      type: 'text' as const,
      mimeType: 'text/plain',
      fileName: 'note.txt',
      text: 'draft attachment',
      sizeBytes: 16,
    })),
  }
})

vi.mock('@/hooks/use-voice-recorder', () => ({
  MAX_VOICE_RECORDING_DURATION_MS: 60_000,
  useVoiceRecorder: () => ({
    ...mockVoiceRecorderState,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
  }),
}))

vi.mock('@/lib/voice-transcription-client', () => ({
  transcribeVoice: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve,
  }
}

describe('MessageInput', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    mockVoiceRecorderState.isRecording = false
    mockVoiceRecorderState.isRequestingPermission = false
    mockVoiceRecorderState.durationMs = 0
    mockVoiceRecorderState.waveformBars = []
    mockStartRecording.mockReset()
    mockStopRecording.mockReset()
    mockStopRecording.mockResolvedValue(null)
    vi.mocked(fileToPendingAttachment).mockResolvedValue({
      id: 'attachment-1',
      type: 'text',
      mimeType: 'text/plain',
      fileName: 'note.txt',
      text: 'draft attachment',
      sizeBytes: 16,
    })
    vi.mocked(transcribeVoice).mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('clears attached files when the draft key changes', async () => {
    const ref = createRef<MessageInputHandle>()
    const onSend = vi.fn()
    const { rerender } = render(
      <MessageInput
        ref={ref}
        onSend={onSend}
        isLoading={false}
        agentLabel="manager"
        draftKey="manager"
      />,
    )

    await waitFor(() => {
      expect(ref.current).not.toBeNull()
    })

    await ref.current!.addFiles([new File(['draft attachment'], 'note.txt', { type: 'text/plain' })])

    expect(await screen.findByText('note.txt')).toBeTruthy()

    rerender(
      <MessageInput
        ref={ref}
        onSend={onSend}
        isLoading={false}
        agentLabel="worker"
        draftKey="worker"
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('note.txt')).toBeNull()
    })
  })

  it('ignores in-flight attachment uploads after the draft key changes', async () => {
    const pendingAttachment = deferred<Awaited<ReturnType<typeof fileToPendingAttachment>>>()
    vi.mocked(fileToPendingAttachment).mockReturnValueOnce(pendingAttachment.promise)

    const ref = createRef<MessageInputHandle>()
    const onSend = vi.fn()
    const { rerender } = render(
      <MessageInput
        ref={ref}
        onSend={onSend}
        isLoading={false}
        agentLabel="manager"
        draftKey="manager"
      />,
    )

    await waitFor(() => {
      expect(ref.current).not.toBeNull()
    })

    const addFilesPromise = ref.current!.addFiles([
      new File(['draft attachment'], 'note.txt', { type: 'text/plain' }),
    ])

    rerender(
      <MessageInput
        ref={ref}
        onSend={onSend}
        isLoading={false}
        agentLabel="worker"
        draftKey="worker"
      />,
    )

    pendingAttachment.resolve({
      id: 'attachment-2',
      type: 'text',
      mimeType: 'text/plain',
      fileName: 'late-note.txt',
      text: 'late attachment',
      sizeBytes: 15,
    })

    await addFilesPromise

    await waitFor(() => {
      expect(screen.queryByText('late-note.txt')).toBeNull()
    })
  })

  it('ignores in-flight voice transcription after the draft key changes', async () => {
    const pendingTranscription = deferred<{ text: string }>()
    mockVoiceRecorderState.isRecording = true
    mockStopRecording.mockResolvedValue({
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      durationMs: 1000,
    })
    vi.mocked(transcribeVoice).mockReturnValueOnce(pendingTranscription.promise)

    const ref = createRef<MessageInputHandle>()
    const onSend = vi.fn()
    const { rerender } = render(
      <MessageInput
        ref={ref}
        onSend={onSend}
        isLoading={false}
        agentLabel="manager"
        draftKey="manager"
        wsUrl="ws://127.0.0.1:47187"
      />,
    )

    const stopRecordingButtons = await screen.findAllByRole('button', {
      name: 'Stop recording and transcribe',
    })
    stopRecordingButtons[0]?.click()

    rerender(
      <MessageInput
        ref={ref}
        onSend={onSend}
        isLoading={false}
        agentLabel="worker"
        draftKey="worker"
        wsUrl="ws://127.0.0.1:47187"
      />,
    )

    pendingTranscription.resolve({ text: 'late transcript' })
    await pendingTranscription.promise

    await waitFor(() => {
      expect(screen.queryByDisplayValue('late transcript')).toBeNull()
    })
  })

  it('ignores recordings that finish stopping after the draft key changes', async () => {
    const pendingStop = deferred<{ blob: Blob; mimeType: string; durationMs: number } | null>()
    mockVoiceRecorderState.isRecording = true
    mockStopRecording.mockReturnValueOnce(pendingStop.promise)

    const ref = createRef<MessageInputHandle>()
    const onSend = vi.fn()
    const { rerender } = render(
      <MessageInput
        ref={ref}
        onSend={onSend}
        isLoading={false}
        agentLabel="manager"
        draftKey="manager"
        wsUrl="ws://127.0.0.1:47187"
      />,
    )

    const stopRecordingButtons = await screen.findAllByRole('button', {
      name: 'Stop recording and transcribe',
    })
    stopRecordingButtons[0]?.click()

    rerender(
      <MessageInput
        ref={ref}
        onSend={onSend}
        isLoading={false}
        agentLabel="worker"
        draftKey="worker"
        wsUrl="ws://127.0.0.1:47187"
      />,
    )

    pendingStop.resolve({
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      durationMs: 1000,
    })
    await pendingStop.promise

    expect(transcribeVoice).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByDisplayValue('late transcript')).toBeNull()
    })
  })
})
