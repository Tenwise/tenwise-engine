import { useState } from 'react';
import { HiOutlineNewspaper } from 'react-icons/hi2';

/** A feed's icon, or the generic feed icon when it has none or the image fails to load. */
export default function FeedFavicon({ src, imgClass, iconClass, style }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) {
    return iconClass ? <span className={iconClass}><HiOutlineNewspaper /></span> : <HiOutlineNewspaper />;
  }
  return <img className={imgClass} src={src} alt="" style={style} onError={() => setFailedSrc(src)} />;
}
