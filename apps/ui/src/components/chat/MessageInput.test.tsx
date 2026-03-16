// @vitest-environment jsdom

import { createRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileToPendingAttachment } from '@/lib/file-attachments'
import { MessageInput, type MessageInputHandle } from './MessageInput'

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
    isRecording: false,
    isRequestingPermission: false,
    durationMs: 0,
    waveformBars: [],
    startRecording: vi.fn(),
    stopRecording: vi.fn(async () => null),
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
    vi.mocked(fileToPendingAttachment).mockResolvedValue({
      id: 'attachment-1',
      type: 'text',
      mimeType: 'text/plain',
      fileName: 'note.txt',
      text: 'draft attachment',
      sizeBytes: 16,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
})
