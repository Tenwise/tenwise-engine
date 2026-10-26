import { useState } from 'react';
import { HiOutlineCheck, HiOutlineClipboardDocument } from 'react-icons/hi2';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';
import { apaCitation, citationText } from '../../../shared/citation.js';
import { useToast } from '../../app/ToastContext.jsx';
import { copyCitation } from './citationClipboard.js';
import { articleCitationSource } from './citationModel.js';

const COPIED_MS = 2000;

// Copies the citation; `copied` stays true for two seconds after it works, and a failure is a toast.
function useCopyCitation(runs) {
  const [copied, setCopied] = useState(false);
  const showToast = useToast();
  const copy = async () => {
    try {
      await copyCitation(runs);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch (err) {
      showToast(`Couldn't copy the citation: ${err.message}`, 'error');
    }
  };
  return [copied, copy];
}

// The copy button for citation runs. Clicking it doesn't open the article underneath (list rows).
function CopyButton({ runs, className }) {
  const [copied, copy] = useCopyCitation(runs);
  return (
    <IconButton
      onClick={(e) => { e.stopPropagation(); copy(); }}
      title={copied ? 'Citation copied' : `Copy APA citation: ${citationText(runs)}`}
      aria-label={copied ? 'Citation copied' : 'Copy APA citation'}
      className={className}
    >
      {copied ? <HiOutlineCheck className="text-primary" /> : <HiOutlineClipboardDocument />}
    </IconButton>
  );
}

/**
 * Icon button that copies a source's APA citation (see citationModel.js), as
 * rich text with its italics and as plain text. Its tooltip shows the citation.
 */
export function CopyCitationButton({ source, className }) {
  const runs = apaCitation(source);
  return <CopyButton runs={runs} className={className} />;
}

/**
 * On a saved article in a list: a small button that copies its citation,
 * hidden until it has focus or the caller's hover class (the row's group)
 * shows it. Unsaved articles get nothing.
 */
export function SavedCitationButton({ article, feed, className }) {
  if (!article.isBookmarked) return null;
  return (
    <CopyCitationButton
      source={articleCitationSource(article, feed)}
      className={cn('size-5 opacity-0 focus-visible:opacity-100 [&_svg]:size-3.5', className)}
    />
  );
}

/** A source's APA citation, italics and all, with a button that copies it. */
export function Citation({ source, className }) {
  const runs = apaCitation(source);
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <span className="shrink-0 pt-[3px] font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">APA</span>
      <p className="m-0 min-w-0 flex-1 text-[12.5px] leading-[1.55] text-[var(--text-secondary)] [overflow-wrap:anywhere]">
        {runs.map((run, i) => (run.italic ? <i key={i}>{run.text}</i> : <span key={i}>{run.text}</span>))}
      </p>
      <CopyButton runs={runs} className="-mt-0.5 size-6 [&_svg]:size-3.5" />
    </div>
  );
}
