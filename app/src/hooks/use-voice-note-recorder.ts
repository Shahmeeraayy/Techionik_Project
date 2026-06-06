import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { BackendChatAttachment } from '@/lib/backend-api';
import {
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_VOICE_DURATION_SECONDS,
  createVoiceNoteAttachment,
  pickSupportedVoiceMimeType,
} from '@/lib/chat-attachments';

type UseVoiceNoteRecorderOptions = {
  onRecorded: (attachment: BackendChatAttachment) => void | Promise<void>;
  successMessage?: string;
};

export function useVoiceNoteRecorder({
  onRecorded,
  successMessage = 'Voice note added.',
}: UseVoiceNoteRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const persistOnStopRef = useRef(true);

  const isSupported = typeof navigator !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const resetRecorderState = () => {
    stopTimer();
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  useEffect(() => () => {
    persistOnStopRef.current = false;
    stopTimer();

    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }

    cleanupStream();
  }, []);

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    setIsProcessing(true);
    recorder.stop();
  };

  const startRecording = async () => {
    if (!isSupported) {
      toast.error('Voice recording is not supported in this browser.');
      return;
    }

    if (isRecording || isProcessing) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = pickSupportedVoiceMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      persistOnStopRef.current = true;
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        persistOnStopRef.current = false;
        chunksRef.current = [];
        recorderRef.current = null;
        cleanupStream();
        resetRecorderState();
        setIsProcessing(false);
        toast.error('Voice recording failed. Please try again.');
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || preferredMimeType || chunksRef.current[0]?.type || 'audio/webm';
        const voiceNote = new Blob(chunksRef.current, { type: mimeType });
        const finalDurationSeconds = recordingSeconds;

        chunksRef.current = [];
        recorderRef.current = null;
        cleanupStream();
        resetRecorderState();

        if (!persistOnStopRef.current || voiceNote.size === 0) {
          setIsProcessing(false);
          return;
        }

        if (voiceNote.size > MAX_CHAT_ATTACHMENT_BYTES) {
          setIsProcessing(false);
          toast.error('Voice message exceeds the 10MB limit.');
          return;
        }
        if (finalDurationSeconds > MAX_CHAT_VOICE_DURATION_SECONDS) {
          setIsProcessing(false);
          toast.error('Voice message exceeds the 5 minute limit.');
          return;
        }

        void (async () => {
          try {
            const attachment = await createVoiceNoteAttachment(voiceNote, finalDurationSeconds);
            await onRecorded(attachment);
            toast.success(successMessage);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save the voice note.');
          } finally {
            setIsProcessing(false);
          }
        })();
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
    } catch (error) {
      cleanupStream();
      recorderRef.current = null;
      setIsProcessing(false);
      toast.error(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Microphone access was denied.'
          : 'Microphone access is required to record a voice note.',
      );
    }
  };

  return {
    isRecording,
    isProcessing,
    isSupported,
    recordingSeconds,
    startRecording,
    stopRecording,
  };
}
