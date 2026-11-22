import { memo, useRef, useState } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ThreadId } from '../../types';

import {
  askAi, buildSmartRepliesPrompt, collectChatTranscript, loadAiSettings, parseSmartReplies,
} from './dignetsAi';

import useLastCallback from '../../hooks/useLastCallback';

import styles from './DigNetsSmartReplies.module.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
};

const DigNetsSmartReplies = ({ chatId, threadId }: OwnProps) => {
  const { openChatWithDraft } = getActions();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [replies, setReplies] = useState<string[]>([]);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController>();

  const load = useLastCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError('');
    setReplies([]);

    try {
      const settings = loadAiSettings();
      const transcript = collectChatTranscript(getGlobal(), chatId, threadId);
      if (!transcript) {
        setError('Chatda hali javob beradigan xabar yo\'q.');
        return;
      }
      const answer = await askAi(settings, buildSmartRepliesPrompt(transcript, settings.language), controller.signal);
      const parsed = parseSmartReplies(answer);
      if (!parsed.length) setError('AI variant topa olmadi, qayta urinib ko\'ring.');
      setReplies(parsed);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  });

  const handleToggle = useLastCallback(() => {
    if (isOpen) {
      abortRef.current?.abort();
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    void load();
  });

  const handlePick = useLastCallback((text: string) => {
    openChatWithDraft({ chatId, threadId, text: { text } });
    setIsOpen(false);
  });

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ''}`}
        onClick={handleToggle}
        aria-label="AI javob variantlari"
        title="AI javob variantlari"
      >
        ✦
      </button>
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span className={styles.badge}>✦</span>
            <div className={styles.titles}>
              <div className={styles.title}>DigNets AI</div>
              <div className={styles.subtitle}>Javob variantlari — bosing va yuboring</div>
            </div>
            <button type="button" className={styles.icon} onClick={() => load()} aria-label="Yangilash">↻</button>
            <button type="button" className={styles.icon} onClick={handleToggle} aria-label="Yopish">✕</button>
          </div>
          {isLoading && (
            <div className={styles.loading}>
              <i />
              <i />
              <i />
              <span>O&apos;ylayapman…</span>
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.chips}>
            {replies.map((reply) => (
              <button key={reply} type="button" className={styles.chip} onClick={() => handlePick(reply)}>
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default memo(DigNetsSmartReplies);
