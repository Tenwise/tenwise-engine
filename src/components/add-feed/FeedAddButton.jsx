import { HiOutlineCheckCircle, HiOutlinePlus } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** 'adding' | 'added' | 'idle' for a feed URL. */
function addState(url, adder) {
  if (adder.adding === url) return 'adding';
  return adder.isAdded(url) ? 'added' : 'idle';
}

const LABELS = {
  adding: () => <><Spinner /> Adding…</>,
  added: () => <><HiOutlineCheckCircle /> Added</>,
  idle: (label) => <><HiOutlinePlus /> {label}</>,
};

/**
 * Add button for a feed: shows progress while adding and "Added" after.
 * `wide` fills the row (preview cards); `onAdd` overrides the default add.
 */
export function FeedAddButton({ url, adder, label = 'Add', wide, onAdd }) {
  const state = addState(url, adder);
  return (
    <Button
      size={wide ? 'default' : 'sm'}
      variant={state === 'added' ? 'ghost' : 'default'}
      className={wide ? 'w-full' : undefined}
      onClick={onAdd ?? (() => adder.add(url))}
      disabled={state === 'added' || Boolean(adder.adding)}
    >
      {LABELS[state](label)}
    </Button>
  );
}
