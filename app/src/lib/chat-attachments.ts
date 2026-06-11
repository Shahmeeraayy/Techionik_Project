import type { BackendChatAttachment } from '@/lib/backend-api';
import { buildBackendUrl } from '@/lib/backend-api';

export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_CHAT_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_CHAT_VOICE_DURATION_SECONDS = 300;
export const CHAT_ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.txt,image/*,audio/*,video/mp4,video/webm';

const VOICE_NOTE_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

export function isImageAttachment(mimeType: string) {
  return mimeType.startsWith('image/');
}

export function isAudioAttachment(mimeType: string) {
  return mimeType.startsWith('audio/');
}

export function isVideoAttachment(mimeType: string) {
  return mimeType.startsWith('video/');
}

export function isPdfAttachment(mimeType: string) {
  return mimeType === 'application/pdf';
}

export function isDocumentAttachment(mimeType: string) {
  return mimeType === 'application/pdf'
    || mimeType === 'application/msword'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mimeType === 'text/plain';
}

export function inferAttachmentType(mimeType: string): BackendChatAttachment['attachment_type'] {
  if (isImageAttachment(mimeType)) return 'image';
  if (isAudioAttachment(mimeType)) return 'voice';
  if (isVideoAttachment(mimeType)) return 'video';
  return 'document';
}

export function isSupportedChatAttachment(file: File) {
  return isImageAttachment(file.type) || isAudioAttachment(file.type) || isVideoAttachment(file.type) || isDocumentAttachment(file.type);
}

export function getChatAttachmentValidationMessage(file: File) {
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return `${file.name} exceeds the 10MB limit.`;
  }
  if (!isSupportedChatAttachment(file)) {
    return `${file.name} must be an image, video, audio, PDF, DOC, DOCX, or text file.`;
  }
  return null;
}

export function formatChatAttachmentSize(sizeBytes: number) {
  return sizeBytes >= 1024 * 1024
    ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

export function formatVoiceRecordingDuration(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export async function fetchSecureChatAttachmentBlob(path: string, token: string): Promise<Blob> {
  const response = await fetch(buildBackendUrl(path), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to load secure attachment.');
  }
  return response.blob();
}

async function getAudioDurationSeconds(file: Blob): Promise<number | null> {
  if (typeof Audio === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.src = '';
    };

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.max(1, Math.round(audio.duration)) : null;
      cleanup();
      resolve(duration);
    };
    audio.onerror = () => {
      cleanup();
      resolve(null);
    };
    audio.src = objectUrl;
  });
}

export async function fileToChatAttachment(file: File): Promise<BackendChatAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const durationSeconds = isAudioAttachment(file.type)
    ? await getAudioDurationSeconds(file)
    : null;

  return {
    id: `${file.name}-${file.size}-${Date.now()}`,
    name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    attachment_type: inferAttachmentType(file.type || 'application/octet-stream'),
    duration_seconds: durationSeconds,
    data_url: dataUrl,
    preview_url: null,
    download_url: null,
  };
}

export function pickSupportedVoiceMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return VOICE_NOTE_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function getVoiceNoteExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('mp4') || normalized.includes('aac') || normalized.includes('mpeg')) {
    return 'm4a';
  }
  if (normalized.includes('ogg')) {
    return 'ogg';
  }
  if (normalized.includes('wav')) {
    return 'wav';
  }
  return 'webm';
}

export async function createVoiceNoteAttachment(blob: Blob, durationSeconds: number) {
  const mimeType = blob.type || pickSupportedVoiceMimeType() || 'audio/webm';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const voiceNoteFile = new File(
    [blob],
    `voice-note-${timestamp}.${getVoiceNoteExtension(mimeType)}`,
    { type: mimeType },
  );

  const attachment = await fileToChatAttachment(voiceNoteFile);
  return {
    ...attachment,
    duration_seconds: durationSeconds,
    attachment_type: 'voice',
  };
}
