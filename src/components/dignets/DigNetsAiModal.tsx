import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ThreadId } from '../../types';
import type { AiProvider, AiSettings, AiTask } from './dignetsAi';

import {
  askAi, buildPrompt, collectChatTranscript, DEFAULT_MODELS, KEY_LINKS, loadAiSettings, saveAiSettings,
} from './dignetsAi';

import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';

import styles from './DigNetsAiModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  chatId?: string;
  threadId: ThreadId;
  onClose: NoneToVoidFunction;
};

type Entry = {
  id: number;
  role: 'user' | 'ai' | 'error';
  text: string;
  task: AiTask;
};

type Card = {
  task: AiTask;
  emoji: string;
  title: string;
  subtitle: string;
  tint: string;
};

const CARDS: Card[] = [
  {
    task: 'summary', emoji: '📝', title: 'Xulosa', subtitle: 'Chat qisqacha', tint: 'red',
  },
  {
    task: 'reply', emoji: '💬', title: 'Javob yoz', subtitle: 'Tayyor javob', tint: 'violet',
  },
  {
    task: 'tasks', emoji: '✅', title: 'Vazifalar', subtitle: 'Kim, nima, qachon', tint: 'green',
  },
  {
    task: 'improve', emoji: '✨', title: 'Yaxshilash', subtitle: 'Matnni silliqlash', tint: 'orange',
  },
  {
    task: 'translate', emoji: '🌐', title: 'Tarjima', subtitle: 'Istalgan tilga', tint: 'blue',
  },
];

const TASK_LABELS: Record<AiTask, string> = {
  summary: '📝 Chatni xulosa qil',
  reply: '💬 Javob yozib ber',
  tasks: '✅ Vazifalarni top',
  improve: '✨ Yaxshilash',
  translate: '🌐 Tarjima',
  ask: '',
};

const INSTANT_TASKS: AiTask[] = ['summary', 'reply', 'tasks'];
const INSERTABLE_TASKS: AiTask[] = ['reply', 'improve', 'translate'];
const LANGUAGES = ['o\'zbek', 'rus', 'ingliz', 'turk', 'qozoq', 'tojik'];

function getPlaceholder(mode: AiTask, language: string) {
  if (mode === 'improve') return 'Yaxshilanadigan matnni yozing…';
  if (mode === 'translate') return `${language} tiliga tarjima uchun matn…`;
  return 'DigNets AI\'dan so\'rang…';
}

const DigNetsAiModal = ({
  isOpen, chatId, threadId, onClose,
}: OwnProps) => {
  const { openChatWithDraft, showNotification } = getActions();

  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    const initial = loadAiSettings();
    return initial.provider !== 'free' && !initial.apiKey;
  });
  const [mode, setMode] = useState<AiTask>('ask');
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController>();
  const listRef = useRef<HTMLDivElement>();
  const inputRef = useRef<HTMLTextAreaElement>();
  const idRef = useRef(0);

  const global = getGlobal();
  const chatUser = chatId ? global.users.byId[chatId] : undefined;
  const chatTitle = chatUser
    ? [chatUser.firstName, chatUser.lastName].filter(Boolean).join(' ')
    : (chatId && global.chats.byId[chatId]?.title) || '';

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries, isLoading]);

  const updateSettings = useLastCallback((patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  });

  const handleProviderChange = useLastCallback((provider: AiProvider) => {
    updateSettings({ provider, model: DEFAULT_MODELS[provider] });
  });

  const pushEntry = useLastCallback((entry: Omit<Entry, 'id'>) => {
    idRef.current += 1;
    const id = idRef.current;
    setEntries((current) => [...current, { ...entry, id }]);
  });

  const run = useLastCallback(async (task: AiTask, text: string) => {
    if (settings.provider !== 'free' && !settings.apiKey.trim()) {
      setIsSettingsOpen(true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const label = TASK_LABELS[task];
    const shown = task === 'ask' ? text : [label, text].filter(Boolean).join('\n');
    pushEntry({ role: 'user', text: shown, task });
    setIsLoading(true);

    try {
      const transcript = (!chatId || task === 'improve' || task === 'translate')
        ? ''
        : collectChatTranscript(getGlobal(), chatId, threadId);
      const prompt = buildPrompt(task, transcript, text, settings.language);
      const answer = await askAi(settings, prompt, controller.signal);
      pushEntry({ role: 'ai', text: answer || 'Javob bo\'sh qaytdi.', task });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        pushEntry({ role: 'error', text: (err as Error).message || 'Noma\'lum xato', task });
      }
    } finally {
      setIsLoading(false);
    }
  });

  const handleCardClick = useLastCallback((task: AiTask) => {
    if (INSTANT_TASKS.includes(task)) {
      void run(task, '');
      return;
    }
    setMode(task);
    inputRef.current?.focus();
  });

  const handleSend = useLastCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    void run(mode, text);
    setMode('ask');
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  const handleInsert = useLastCallback((text: string) => {
    if (chatId) {
      openChatWithDraft({ chatId, threadId, text: { text } });
    } else {
      openChatWithDraft({ text: { text } });
    }
    onClose();
  });

  const handleCopy = useLastCallback((text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      showNotification({ message: 'Nusxa olindi' });
    }).catch(() => undefined);
  });

  const handleClose = useLastCallback(() => {
    abortRef.current?.abort();
    onClose();
  });

  const isEmpty = !entries.length && !isLoading;
  const visibleCards = chatId ? CARDS : CARDS.filter((card) => !INSTANT_TASKS.includes(card.task));
  const needsKey = settings.provider !== 'free';
  const canStart = !needsKey || Boolean(settings.apiKey.trim());
  let subtitle = 'Shaxsiy yordamchi';
  if (isSettingsOpen) subtitle = 'Sozlamalar';
  else if (chatTitle) subtitle = `${chatTitle} bilan chat`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className={styles.modal}
      contentClassName={styles.content}
    >
      <div className={styles.root}>
        <div className={styles.header}>
          <div className={styles.orbSmall} />
          <div className={styles.headerText}>
            <div className={styles.headerTitle}>DigNets AI</div>
            <div className={styles.headerSubtitle}>{subtitle}</div>
          </div>
          <button
            type="button"
            className={`${styles.iconButton} ${isSettingsOpen ? styles.iconButtonActive : ''}`}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            aria-label="Sozlash"
          >
            ⚙️
          </button>
          <button type="button" className={styles.iconButton} onClick={handleClose} aria-label="Yopish">
            ✕
          </button>
        </div>

        {isSettingsOpen ? (
          <div className={styles.settings}>
            <div className={styles.settingsCard}>
              <div className={styles.settingsTitle}>AI xizmati</div>
              <div className={styles.providers}>
                <button
                  type="button"
                  className={`${styles.provider} ${settings.provider === 'free' ? styles.providerActive : ''}`}
                  onClick={() => handleProviderChange('free')}
                >
                  <span className={styles.providerEmoji}>🎁</span>
                  <span className={styles.providerName}>Bepul</span>
                  <span className={styles.providerNote}>Kalitsiz</span>
                </button>
                <button
                  type="button"
                  className={`${styles.provider} ${settings.provider === 'gemini' ? styles.providerActive : ''}`}
                  onClick={() => handleProviderChange('gemini')}
                >
                  <span className={styles.providerEmoji}>💎</span>
                  <span className={styles.providerName}>Gemini</span>
                  <span className={styles.providerNote}>Bepul kalit</span>
                </button>
                <button
                  type="button"
                  className={`${styles.provider} ${settings.provider === 'claude' ? styles.providerActive : ''}`}
                  onClick={() => handleProviderChange('claude')}
                >
                  <span className={styles.providerEmoji}>🧠</span>
                  <span className={styles.providerName}>Claude</span>
                  <span className={styles.providerNote}>Eng aqlli</span>
                </button>
              </div>
            </div>

            {needsKey && (
              <div className={styles.settingsCard}>
                <div className={styles.settingsTitle}>
                  API kalit
                  <a href={KEY_LINKS[settings.provider]} target="_blank" rel="noopener noreferrer">Olish →</a>
                </div>
                <input
                  className={styles.field}
                  type="password"
                  autoComplete="off"
                  value={settings.apiKey}
                  placeholder="Kalitni shu yerga qo'ying"
                  onInput={(e) => updateSettings({ apiKey: e.currentTarget.value })}
                />
                <details className={styles.advanced}>
                  <summary>Model</summary>
                  <input
                    className={styles.field}
                    value={settings.model}
                    onInput={(e) => updateSettings({ model: e.currentTarget.value })}
                  />
                </details>
              </div>
            )}

            <div className={styles.settingsCard}>
              <div className={styles.settingsTitle}>Javob tili</div>
              <div className={styles.langs}>
                {LANGUAGES.map((language) => (
                  <button
                    key={language}
                    type="button"
                    className={`${styles.lang} ${settings.language === language ? styles.langActive : ''}`}
                    onClick={() => updateSettings({ language })}
                  >
                    {language}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.privacy}>
              {needsKey
                ? '🔒 Kalit faqat shu brauzerda saqlanadi'
                : '🎁 Bepul rejim — kalit kerak emas, javoblar biroz sekinroq bo\'lishi mumkin'}
            </div>

            <button
              type="button"
              className={styles.doneButton}
              disabled={!canStart}
              onClick={() => setIsSettingsOpen(false)}
            >
              Boshlash
            </button>
          </div>
        ) : (
          <>
            <div className={styles.list} ref={listRef}>
              {isEmpty && (
                <div className={styles.hero}>
                  <div className={styles.orb} />
                  <div className={styles.heroTitle}>Salom! 👋</div>
                  <div className={styles.heroText}>
                    {chatId ? 'Bu chatda nima yordam beray?' : 'Nima yordam beray?'}
                  </div>
                  <div className={styles.cards}>
                    {visibleCards.map((card) => (
                      <button
                        key={card.task}
                        type="button"
                        className={`${styles.card} ${styles[`tint-${card.tint}`]}`}
                        onClick={() => handleCardClick(card.task)}
                      >
                        <span className={styles.cardEmoji}>{card.emoji}</span>
                        <span className={styles.cardTitle}>{card.title}</span>
                        <span className={styles.cardSubtitle}>{card.subtitle}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`${styles.row} ${entry.role === 'user' ? styles.rowUser : ''}`}
                >
                  {entry.role !== 'user' && <div className={styles.avatar} />}
                  <div className={styles.bubbleWrap}>
                    <div
                      className={`${styles.bubble} ${entry.role === 'user' ? styles.bubbleUser : ''} ${
                        entry.role === 'error' ? styles.bubbleError : ''}`}
                    >
                      {entry.text}
                    </div>
                    {entry.role === 'ai' && (
                      <div className={styles.actions}>
                        {INSERTABLE_TASKS.includes(entry.task) && (
                          <button type="button" className={styles.action} onClick={() => handleInsert(entry.text)}>
                            ↩️ Xabarga qo&apos;yish
                          </button>
                        )}
                        <button type="button" className={styles.action} onClick={() => handleCopy(entry.text)}>
                          📋 Nusxa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className={styles.row}>
                  <div className={styles.avatar} />
                  <div className={`${styles.bubble} ${styles.typing}`}>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              )}
            </div>

            {!isEmpty && (
              <div className={styles.quick}>
                {visibleCards.map((card) => (
                  <button
                    key={card.task}
                    type="button"
                    className={`${styles.quickChip} ${mode === card.task ? styles.quickChipActive : ''}`}
                    onClick={() => handleCardClick(card.task)}
                  >
                    {card.emoji}
                    {' '}
                    {card.title}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.composer}>
              {mode !== 'ask' && (
                <button type="button" className={styles.modeChip} onClick={() => setMode('ask')}>
                  {TASK_LABELS[mode]}
                  {' '}
                  ✕
                </button>
              )}
              <div className={styles.composerRow}>
                <textarea
                  ref={inputRef}
                  className={styles.composerInput}
                  rows={1}
                  value={input}
                  placeholder={getPlaceholder(mode, settings.language)}
                  onInput={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  type="button"
                  className={styles.send}
                  disabled={!input.trim() || isLoading}
                  onClick={handleSend}
                  aria-label="Yuborish"
                >
                  ➤
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default memo(DigNetsAiModal);
