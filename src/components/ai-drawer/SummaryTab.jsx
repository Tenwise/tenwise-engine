import {
  HiOutlineArrowPath, HiOutlineBookmarkSquare, HiOutlineCheck, HiOutlineClipboardDocument, HiOutlineSparkles,
} from 'react-icons/hi2';
import { FaLinkedinIn } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { shareOnLinkedIn, shareOnX } from '../../utils/share.js';
import { RailAction, RailEmpty, RailError, RailLabel, TypingCursor } from './parts.jsx';

function saveState({ saving, saved }) {
  if (saving) return { label: 'Saving…', Icon: HiOutlineBookmarkSquare };
  if (saved) return { label: 'Saved', Icon: HiOutlineCheck };
  return { label: 'Save', Icon: HiOutlineBookmarkSquare };
}

function SummaryActions({ article, s }) {
  if (s.summarizing) return <RailAction onClick={s.stop}>Stop</RailAction>;
  const xText = `${s.summary.slice(0, 200)}…`;
  const { label, Icon } = saveState(s);
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <RailAction onClick={s.generate}><HiOutlineArrowPath /> Regenerate</RailAction>
      <RailAction onClick={s.copy}>{s.copied ? <HiOutlineCheck /> : <HiOutlineClipboardDocument />} {s.copied ? 'Copied' : 'Copy'}</RailAction>
      <RailAction onClick={() => shareOnLinkedIn(article?.link)}><FaLinkedinIn /> LinkedIn</RailAction>
      <RailAction onClick={() => shareOnX(article?.link, xText)}>X</RailAction>
      <Button size="sm" variant={s.saved ? 'ghost' : 'default'} className="ml-auto" onClick={s.save} disabled={s.saving || s.saved} title={s.saved ? 'Saved to AI Summaries' : 'Save to AI Summaries'}>
        <Icon /> {label}
      </Button>
    </div>
  );
}

function EmptySummary({ queued, canGenerate, onGenerate }) {
  if (queued) {
    return <RailEmpty Icon={HiOutlineSparkles} text="Queued for background processing; the summary will appear here." />;
  }
  return (
    <RailEmpty Icon={HiOutlineSparkles} text="A short summary, ready to share or save.">
      <Button onClick={onGenerate} disabled={!canGenerate}><HiOutlineSparkles /> Generate summary</Button>
    </RailEmpty>
  );
}

/** Summary tab: generate, stream, copy, share, and save a summary. s = useArticleSummary(). */
export default function SummaryTab({ article, s, canGenerate }) {
  const hasResult = Boolean(s.summary || s.summarizing);
  return (
    <div className="flex flex-col gap-3 p-4">
      {!hasResult && !s.error && <EmptySummary queued={article?.aiStatus === 'queued'} canGenerate={canGenerate} onGenerate={s.generate} />}
      {s.error && <RailError message={s.error}><RailAction onClick={s.generate}>Retry</RailAction></RailError>}
      {hasResult && (
        <>
          {s.isBatchSummary && <RailLabel>Background summary</RailLabel>}
          <p className="m-0 text-[15px] leading-relaxed text-foreground" style={{ fontFamily: 'var(--reader-font-family)' }}>
            {s.summary}
            {s.summarizing && <TypingCursor />}
          </p>
          <SummaryActions article={article} s={s} />
        </>
      )}
    </div>
  );
}
