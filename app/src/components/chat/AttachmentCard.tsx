import { useEffect, useMemo, useState } from 'react';
import { AudioLines, Download, File, Image as ImageIcon, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { type BackendChatAttachment } from '@/lib/backend-api';
import {
  fetchSecureChatAttachmentBlob,
  formatChatAttachmentSize,
  isAudioAttachment,
  isImageAttachment,
} from '@/lib/chat-attachments';

function getAttachmentIcon(mimeType: string) {
  if (isImageAttachment(mimeType)) {
    return ImageIcon;
  }
  if (isAudioAttachment(mimeType)) {
    return AudioLines;
  }
  return File;
}

export function AttachmentCard({
  attachment,
  token,
  tone = 'dark',
}: {
  attachment: BackendChatAttachment;
  token: string;
  tone?: 'dark' | 'light';
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(attachment.data_url || null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isImage = isImageAttachment(attachment.mime_type);
  const isAudio = isAudioAttachment(attachment.mime_type);
  const AttachmentIcon = useMemo(() => getAttachmentIcon(attachment.mime_type), [attachment.mime_type]);
  const sizeLabel = formatChatAttachmentSize(attachment.size_bytes);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (attachment.data_url || !(attachment.preview_url && token) || (!isImage && !isAudio)) {
      return undefined;
    }

    setPreviewLoading(true);
    void fetchSecureChatAttachmentBlob(attachment.preview_url, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load attachment preview.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment.data_url, attachment.preview_url, isAudio, isImage, token]);

  const handleDownload = async () => {
    if (attachment.data_url) {
      const anchor = document.createElement('a');
      anchor.href = attachment.data_url;
      anchor.download = attachment.name;
      anchor.click();
      return;
    }

    if (!(attachment.download_url && token)) {
      toast.error('Attachment download is unavailable.');
      return;
    }

    try {
      setDownloading(true);
      const blob = await fetchSecureChatAttachmentBlob(attachment.download_url, token);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = attachment.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download attachment.');
    } finally {
      setDownloading(false);
    }
  };

  const outerClass = tone === 'light'
    ? 'border-black/10 bg-white/95'
    : 'border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))]';
  const chromeClass = tone === 'light'
    ? 'bg-slate-50 text-slate-700'
    : 'bg-[#09131d] text-slate-100';
  const subtleText = tone === 'light' ? 'text-slate-500' : 'text-slate-400';
  const headingText = tone === 'light' ? 'text-slate-800' : 'text-slate-100';
  const actionText = tone === 'light' ? 'text-[#2F8E92] hover:text-[#267276]' : 'text-cyan-300 hover:text-cyan-200';

  return (
    <div className={cn('w-full max-w-[420px] overflow-hidden rounded-2xl border shadow-[0_14px_34px_rgba(0,0,0,0.18)]', outerClass)}>
      {isImage ? (
        <div className="aspect-[1/0.9] overflow-hidden bg-slate-950">
          {previewUrl ? (
            <img src={previewUrl} alt={attachment.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              {previewLoading ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <ImageIcon className="h-6 w-6" />}
            </div>
          )}
        </div>
      ) : isAudio ? (
        <div className={cn('p-4', chromeClass)}>
          <div className={cn('rounded-[22px] border p-4', tone === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.03]')}>
            <div className={cn('mb-3 flex items-center gap-2 text-sm font-medium', headingText)}>
              <AudioLines className={cn('h-4 w-4', tone === 'light' ? 'text-[#2F8E92]' : 'text-cyan-300')} />
              Voice message
              {attachment.duration_seconds ? (
                <span className={cn('text-xs font-normal', subtleText)}>
                  {Math.floor(attachment.duration_seconds / 60)}:{String(attachment.duration_seconds % 60).padStart(2, '0')}
                </span>
              ) : null}
            </div>
            {previewUrl ? (
              <audio controls preload="metadata" src={previewUrl} className="w-full" />
            ) : (
              <div className={cn('flex items-center gap-2 text-sm', subtleText)}>
                {previewLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" />}
                Secure audio preview loading...
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={cn('flex aspect-[1/0.9] items-center justify-center', chromeClass)}>
          <AttachmentIcon className="h-7 w-7" />
        </div>
      )}
      <div className="space-y-2 px-3 py-2">
        <div className="space-y-1">
          <p className={cn('truncate text-xs font-medium', headingText)}>{attachment.name}</p>
          <p className={cn('text-[11px]', subtleText)}>{sizeLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleDownload()}
          className={cn('inline-flex items-center gap-1 text-[11px] font-medium transition', actionText)}
        >
          {downloading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download
        </button>
      </div>
    </div>
  );
}
