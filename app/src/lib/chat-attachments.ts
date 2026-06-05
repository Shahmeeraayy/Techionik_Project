import type { BackendChatAttachment } from '@/lib/backend-api';

export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_ACCEPT = '.pdf,image/*,audio/*';

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

export function isPdfAttachment(mimeType: string) {
  return mimeType === 'application/pdf';
}

export function isSupportedChatAttachment(file: File) {
  return isImageAttachment(file.type) || isAudioAttachment(file.type) || isPdfAttachment(file.type);
}

export function getChatAttachmentValidationMessage(file: File) {
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return `${file.name} exceeds the 10MB limit.`;
  }
  if (!isSupportedChatAttachment(file)) {
    return `${file.name} must be an image, audio, or PDF file.`;
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

export async function fileToChatAttachment(file: File): Promise<BackendChatAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  return {
    id: `${file.name}-${file.size}-${Date.now()}`,
    name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    data_url: dataUrl,
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

export async function createVoiceNoteAttachment(blob: Blob) {
  const mimeType = blob.type || pickSupportedVoiceMimeType() || 'audio/webm';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const voiceNoteFile = new File(
    [blob],
    `voice-note-${timestamp}.${getVoiceNoteExtension(mimeType)}`,
    { type: mimeType },
  );

  return fileToChatAttachment(voiceNoteFile);
}
