import { useCallback, useState } from 'react';
import { HiOutlineArrowUpOnSquare, HiOutlineCheck, HiOutlineClipboardDocument, HiOutlineEnvelope } from 'react-icons/hi2';
import { SiX } from 'react-icons/si';
import { FaLinkedinIn } from 'react-icons/fa';
import { IconButton } from '@/components/ui/icon-button';
import { canShareNatively, shareByEmail, shareNatively, shareOnLinkedIn, shareOnX } from '../../utils/share.js';
import Popover from './Popover.jsx';

function Option({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-2.5 rounded border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] text-foreground hover:bg-[var(--bg-hover)] [&_svg]:size-3.5">
      {children}
    </button>
  );
}

/** Share menu: LinkedIn, X, email, native share, copy link. */
export default function ShareMenu({ link, title }) {
  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(() => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [link]);
  return (
    <Popover
      className="w-48 p-1"
      trigger={({ open, toggle }) => <IconButton active={open} onClick={toggle} title="Share"><HiOutlineArrowUpOnSquare /></IconButton>}
    >
      {(close) => {
        const shareWith = (share) => () => { share(); close(); };
        return (
          <>
            <Option onClick={shareWith(() => shareOnLinkedIn(link))}><FaLinkedinIn className="text-[#0a66c2]" /> LinkedIn</Option>
            <Option onClick={shareWith(() => shareOnX(link, title))}><SiX /> X</Option>
            <Option onClick={shareWith(() => shareByEmail(link, title))}><HiOutlineEnvelope /> Email</Option>
            {canShareNatively() && <Option onClick={shareWith(() => shareNatively(link, title))}><HiOutlineArrowUpOnSquare /> More…</Option>}
            <div className="my-1 h-px bg-border" />
            <Option onClick={copyLink}>{copied ? <HiOutlineCheck className="text-primary" /> : <HiOutlineClipboardDocument />} {copied ? 'Copied' : 'Copy link'}</Option>
          </>
        );
      }}
    </Popover>
  );
}
