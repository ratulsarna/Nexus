// @vitest-environment jsdom

import { createRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('MessageInput', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
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
})
