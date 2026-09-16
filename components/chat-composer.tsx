"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FileUIPart } from "ai";
import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  validateDraftFiles,
} from "@/lib/attachments";
import {
  ArrowUpIcon,
  CloseIcon,
  FileIcon,
  PaperclipIcon,
  StopIcon,
} from "./icons";

export type ComposerHandle = { focus: () => void };

type ComposerProps = {
  busy: boolean;
  compact?: boolean;
  onSend: (text: string, files: FileUIPart[]) => Promise<void>;
  onStop: () => void;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

// Touch keyboards have no reliable Shift+Enter, so Enter inserts a newline
// there and the send button is the only way to submit.
function useTouchInput() {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setTouch(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return touch;
}

function AttachmentDraft({ file, onRemove }: { file: File; onRemove: () => void }) {
  const previewUrl = useMemo(
    () => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="attachment-draft">
      {previewUrl ? (
        // A local object URL keeps the preview off the network.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" />
      ) : (
        <FileIcon />
      )}
      <span>
        <strong>{file.name}</strong>
        <small>{(file.size / 1024).toFixed(0)} KB</small>
      </span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}>
        <CloseIcon width={16} height={16} />
      </button>
    </div>
  );
}

export const ChatComposer = forwardRef<ComposerHandle, ComposerProps>(
  function ChatComposer({ busy, compact = false, onSend, onStop }, ref) {
    const [input, setInput] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const touch = useTouchInput();
    const canSend = Boolean(input.trim()) || files.length > 0;

    useImperativeHandle(ref, () => ({
      focus: () => textAreaRef.current?.focus(),
    }));

    // Grow with the text up to the CSS max-height, then scroll inside.
    useEffect(() => {
      const textArea = textAreaRef.current;
      if (!textArea) return;
      textArea.style.height = "0px";
      textArea.style.height = `${textArea.scrollHeight}px`;
    }, [input]);

    function addFiles(incoming: File[]) {
      const nextFiles = [...files, ...incoming].slice(0, MAX_ATTACHMENTS + 1);
      const error = validateDraftFiles(nextFiles);
      if (error) {
        setFileError(error);
        return;
      }
      setFiles(nextFiles);
      setFileError(null);
    }

    async function submit() {
      const text = input.trim();
      if (busy || (!text && files.length === 0)) return;

      try {
        const fileParts = await Promise.all(
          files.map(async file => ({
            type: "file" as const,
            filename: file.name,
            mediaType: file.type,
            url: await fileToDataUrl(file),
          })),
        );

        await onSend(
          text || "Use these attachments as context for my trip.",
          fileParts,
        );
        setInput("");
        setFiles([]);
        setFileError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (error) {
        setFileError(
          error instanceof Error ? error.message : "The files could not be attached.",
        );
      }
    }

    return (
      <form
        className={`composer ${compact ? "is-compact" : ""} ${dragging ? "is-dragging" : ""}`}
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
        onDragEnter={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        {files.length ? (
          <div className="attachment-tray" aria-label="Attached files">
            {files.map((file, index) => (
              <AttachmentDraft
                file={file}
                key={`${file.name}-${file.lastModified}-${index}`}
                onRemove={() => setFiles(current => current.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        ) : null}

        <textarea
          ref={textAreaRef}
          rows={1}
          value={input}
          aria-label="Describe the trip you have in mind"
          placeholder={compact ? "Ask for a change or add a detail" : "Four days in Porto in May, two of us, around €900"}
          enterKeyHint={touch ? "enter" : "send"}
          autoComplete="off"
          onChange={event => setInput(event.target.value)}
          onPaste={event => {
            const pastedFiles = Array.from(event.clipboardData.files);
            if (pastedFiles.length) addFiles(pastedFiles);
          }}
          onKeyDown={event => {
            if (touch || event.nativeEvent.isComposing) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />

        <div className="composer-row">
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            multiple
            accept={ACCEPTED_ATTACHMENT_TYPES.join(",")}
            onChange={event => addFiles(Array.from(event.target.files ?? []))}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Attach files"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <PaperclipIcon />
          </button>
          <span className="composer-hint">
            {fileError ??
              (dragging
                ? "Drop files here"
                : files.length
                  ? `${files.length} file${files.length === 1 ? "" : "s"} attached`
                  : touch
                    ? "Images, PDF, text or CSV"
                    : "Enter sends. Shift+Enter adds a line.")}
          </span>
          {busy ? (
            <button type="button" className="send-button" onClick={onStop} aria-label="Stop response">
              <StopIcon width={18} height={18} />
            </button>
          ) : (
            <button
              type="submit"
              className="send-button"
              disabled={!canSend}
              aria-label="Send message"
            >
              <ArrowUpIcon width={20} height={20} />
            </button>
          )}
        </div>
        <span className="sr-only" aria-live="polite">{fileError ?? ""}</span>
      </form>
    );
  },
);
