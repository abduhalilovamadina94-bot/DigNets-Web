import { memo } from '../../lib/teact/teact';

import type { ApiUser } from '../../api/types';

import { formatPhoneNumberWithCode } from '../../util/phoneNumber';

import Avatar from '../common/Avatar';

import styles from './DigNetsMenuHero.module.scss';

type OwnProps = {
  user: ApiUser;
  onClick: NoneToVoidFunction;
};

export const DIGNETS_OPEN_AI_EVENT = 'dignets:open-ai';

export function requestOpenDigNetsAi() {
  window.dispatchEvent(new CustomEvent(DIGNETS_OPEN_AI_EVENT));
}

const DigNetsMenuHero = ({ user, onClick }: OwnProps) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const username = user.usernames?.find((item) => item.isActive)?.username;
  const phone = user.phoneNumber ? formatPhoneNumberWithCode([], user.phoneNumber) : undefined;
  const details = [username && `@${username}`, phone].filter(Boolean).join(' · ');

  return (
    <div className={styles.root}>
      <button type="button" className={styles.hero} onClick={onClick}>
        <div className={styles.ring}>
          <Avatar peer={user} size="medium" />
        </div>
        <div className={styles.name}>{name}</div>
        {details && <div className={styles.details}>{details}</div>}
      </button>

      <button type="button" className={styles.aiCard} onClick={requestOpenDigNetsAi}>
        <span className={styles.aiIcon}>✦</span>
        <span className={styles.aiText}>
          <span className={styles.aiTitle}>DigNets AI</span>
          <span className={styles.aiSubtitle}>Xulosa, tarjima, javob — bepul</span>
        </span>
        <span className={styles.aiArrow}>›</span>
      </button>
    </div>
  );
};

export default memo(DigNetsMenuHero);
