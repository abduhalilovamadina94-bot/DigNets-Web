import { memo, useState } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { MAIN_THREAD_ID } from '../../api/types';

import useLastCallback from '../../hooks/useLastCallback';

import DigNetsAiModal from './DigNetsAiModal';

import styles from './DigNetsBrandBar.module.scss';

import logoUrl from '../../assets/dignets-logo.png';

type OwnProps = {
  isHidden?: boolean;
};

const DigNetsBrandBar = ({ isHidden }: OwnProps) => {
  const { openChat } = getActions();
  const [isAiOpen, setIsAiOpen] = useState(false);

  const handleSavedClick = useLastCallback(() => {
    const { currentUserId } = getGlobal();
    if (currentUserId) openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  return (
    <div className={`${styles.root} ${isHidden ? styles.hidden : ''}`}>
      <img className={styles.logo} src={logoUrl} alt="" draggable={false} />
      <div className={styles.wordmark}>
        Dig
        <span>Nets</span>
      </div>
      <button type="button" className={styles.aiPill} onClick={() => setIsAiOpen(true)}>
        <span className={styles.aiSpark}>✦</span>
        {' '}
        AI
      </button>
      <button type="button" className={styles.iconButton} onClick={handleSavedClick} aria-label="Saqlanganlar">
        🔖
      </button>
      <DigNetsAiModal
        isOpen={isAiOpen}
        threadId={MAIN_THREAD_ID}
        onClose={() => setIsAiOpen(false)}
      />
    </div>
  );
};

export default memo(DigNetsBrandBar);
