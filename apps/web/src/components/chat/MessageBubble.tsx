/**
 * CHA-059 — `MessageBubble`.
 *
 * Affiche un message user / assistant, avec direction adaptée à la
 * langue (RTL pour `ar`). En attendant CHA-064 / DOMPurify, on rend
 * le contenu en texte brut + `whiteSpace: pre-wrap`.
 */
'use client';

import type { ChatMessageDto } from '@/lib/chat/contracts';

interface MessageBubbleProps {
  message: ChatMessageDto;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';
  const isRtl = message.language === 'ar';

  return (
    <div
      role="listitem"
      data-message-id={message.id}
      data-role={message.role}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={['flex gap-2', isUser ? 'justify-end' : 'justify-start'].join(' ')}
    >
      <div className="max-w-[85%] flex flex-col gap-1">
        <div
          // CHA-244 — text-base (16 px) au lieu de text-sm (14 px) pour
          // un confort de lecture sans zoom. cf. runbook §E.
          className={[
            'rounded-2xl px-4 py-2.5 text-base leading-relaxed whitespace-pre-wrap',
            isUser
              ? 'bg-stone-900 text-white rounded-br-sm'
              : 'bg-stone-100 text-stone-900 rounded-bl-sm',
            isError ? 'bg-rose-50 text-rose-800' : '',
          ].join(' ')}
        >
          {message.content || (isStreaming ? '…' : '')}
          {isStreaming && (
            <span
              aria-hidden
              className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-stone-500"
            />
          )}
        </div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesPopover sources={message.sources} />
        )}
      </div>
    </div>
  );
}

function SourcesPopover({
  sources,
}: {
  sources: NonNullable<ChatMessageDto['sources']>;
}) {
  return (
    <details className="text-xs text-stone-500">
      <summary className="cursor-pointer select-none hover:text-stone-700">
        Sources · {sources.length}
      </summary>
      <ul className="mt-1 space-y-0.5 pl-3">
        {sources.map((s) => (
          <li key={s.chunkId} className="truncate">
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted hover:text-stone-700"
              >
                {s.title}
              </a>
            ) : (
              <span>{s.title}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
