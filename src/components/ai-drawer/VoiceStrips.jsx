import { voices } from '../../ai/voice.js';

/** The voice AI answers in, from each voice plugin, with a way to change it. */
export default function VoiceStrips() {
  return voices().map(({ id, Strip }) => Strip && <Strip key={id} />);
}
