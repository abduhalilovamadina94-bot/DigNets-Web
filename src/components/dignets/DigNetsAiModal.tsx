import { memo, useRef, useState } from '../../lib/teact/teact';
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
  chatId: string;
  threadId: ThreadId;
  onClose: NoneToVoidFunction;
};

type Tab = AiTask | 'settings';

const TASKS: { id: Tab; emoji: string; title: string; hint: string }[] = [
  { id: 'summary', emoji: '📝', title: 'Xulosa', hint: 'Chatni qisqacha tushuntirib beradi' },
  { id: 'reply', emoji: '💬', title: 'Javob', hint: 'Oxirgi xabarlarga javob taklif qiladi' },
  { id: 'improve', emoji: '✨', title: 'Yaxshilash', hint: 'Matningizni ravon va xatosiz qiladi' },
  { id: 'translate', emoji: '🌐', title: 'Tarjima', hint: 'Matnni tanlangan tilga o\'giradi' },
  { id: 'tasks', emoji: '✅', title: 'Vazifalar', hint: 'Chatdan vazifa va muddatlarni topadi' },
  { id: 'ask', emoji: '🤖', title: 'Savol', hint: 'Chat bo\'yicha istalgan savolni bering' },
  { id: 'settings', emoji: '⚙️', title: 'Sozlash', hint: 'AI xizmati va kalitni sozlash' },
];

const INPUT_PLACEHOLDERS: Partial<Record<AiTask, string>> = {
  reply: 'Ixtiyoriy: qanday ohangda javob kerak? (masalan: rasmiy, qisqa, rad etish)',
  improve: 'Yaxshilanadigan matnni shu yerga yozing…',
  translate: 'Tarjima qilinadigan matn…',
  ask: 'Masalan: kim yetkazib berish sanasini so\'radi?',
};

const LANGUAGES = ['o\'zbek', 'rus', 'ingliz', 'turk', 'qozoq', 'tojik'];

const DigNetsAiModal = ({
  isOpen, chatId, threadId, onClose,
}: OwnProps) => {
  const { openChatWithDraft, showNotification } = getActions();

  const [tab, setTab] = useState<Tab>(() => (loadAiSettings().apiKey ? 'summary' : 'settings'));
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController>();

  const isTaskTab = tab !== 'settings';
  const needsInput = tab === 'improve' || tab === 'translate' || tab === 'ask';
  const placeholder = isTaskTab ? INPUT_PLACEHOLDERS[tab] : undefined;

  const updateSettings = useLastCallback((patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  });

  const handleProviderChange = useLastCallback((provider: AiProvider) => {
    updateSettings({ provider, model: DEFAULT_MODELS[provider] });
  });

  const handleTabClick = useLastCallback((nextTab: Tab) => {
    setTab(nextTab);
    setResult('');
    setError('');
  });

  const handleRun = useLastCallback(async () => {
    if (tab === 'settings') return;
    if (needsInput && !input.trim()) {
      setError('Avval matn yozing.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError('');
    setResult('');

    try {
      const transcript = (tab === 'improve' || tab === 'translate')
        ? ''
        : collectChatTranscript(getGlobal(), chatId, threadId);
      const prompt = buildPrompt(tab, transcript, input.trim(), settings.language);
      const answer = await askAi(settings, prompt, controller.signal);
      setResult(answer || 'Javob bo\'sh qaytdi.');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || 'Noma\'lum xato');
      }
    } finally {
      setIsLoading(false);
    }
  });

  const handleInsert = useLastCallback(() => {
    if (!result) return;
    openChatWithDraft({ chatId, threadId, text: { text: result } });
    onClose();
  });

  const handleCopy = useLastCallback(() => {
    if (!result) return;
    navigator.clipboard?.writeText(result).then(() => {
      showNotification({ message: 'Nusxa olindi' });
    }).catch(() => undefined);
  });

  const handleClose = useLastCallback(() => {
    abortRef.current?.abort();
    onClose();
  });

  const canInsert = tab === 'reply' || tab === 'improve' || tab === 'translate';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className={styles.modal}
      title="DigNets AI"
      hasCloseButton
    >
      <div className={styles.root}>
        <div className={styles.tabs}>
          {TASKS.map((task) => (
            <button
              key={task.id}
              type="button"
              className={`${styles.tab} ${tab === task.id ? styles.tabActive : ''}`}
              onClick={() => handleTabClick(task.id)}
            >
              <span className={styles.tabEmoji}>{task.emoji}</span>
              <span>{task.title}</span>
            </button>
          ))}
        </div>

        <p className={styles.hint}>{TASKS.find((task) => task.id === tab)?.hint}</p>

        {tab === 'settings' ? (
          <div className={styles.settings}>
            <label className={styles.label}>AI xizmati</label>
            <div className={styles.segment}>
              <button
                type="button"
                className={`${styles.segmentItem} ${settings.provider === 'gemini' ? styles.segmentActive : ''}`}
                onClick={() => handleProviderChange('gemini')}
              >
                Google Gemini (bepul kalit)
              </button>
              <button
                type="button"
                className={`${styles.segmentItem} ${settings.provider === 'claude' ? styles.segmentActive : ''}`}
                onClick={() => handleProviderChange('claude')}
              >
                Anthropic Claude
              </button>
            </div>

            <label className={styles.label} htmlFor="dn-ai-key">API kalit</label>
            <input
              id="dn-ai-key"
              className={styles.input}
              type="password"
              autoComplete="off"
              value={settings.apiKey}
              placeholder="Kalitni shu yerga qo'ying"
              onInput={(e) => updateSettings({ apiKey: (e.currentTarget).value })}
            />
            <a className={styles.link} href={KEY_LINKS[settings.provider]} target="_blank" rel="noopener noreferrer">
              🔑 Kalitni qayerdan olish mumkin →
            </a>

            <label className={styles.label} htmlFor="dn-ai-model">Model</label>
            <input
              id="dn-ai-model"
              className={styles.input}
              value={settings.model}
              onInput={(e) => updateSettings({ model: (e.currentTarget).value })}
            />

            <label className={styles.label}>Javob tili</label>
            <div className={styles.chips}>
              {LANGUAGES.map((language) => (
                <button
                  key={language}
                  type="button"
                  className={`${styles.chip} ${settings.language === language ? styles.chipActive : ''}`}
                  onClick={() => updateSettings({ language })}
                >
                  {language}
                </button>
              ))}
            </div>

            <p className={styles.note}>
              🔒 Kalit faqat shu brauzerda saqlanadi. So&apos;rov bosilganda chatning oxirgi xabarlari
              tanlangan AI xizmatiga yuboriladi.
            </p>
            <button type="button" className={styles.primary} onClick={() => setTab('summary')}>
              Tayyor
            </button>
          </div>
        ) : (
          <>
            {placeholder && (
              <textarea
                className={styles.textarea}
                rows={needsInput ? 4 : 2}
                value={input}
                placeholder={placeholder}
                onInput={(e) => setInput((e.currentTarget).value)}
              />
            )}

            <button type="button" className={styles.primary} disabled={isLoading} onClick={handleRun}>
              {isLoading ? 'O\'ylayapman…' : `${TASKS.find((task) => task.id === tab)?.emoji} Boshlash`}
            </button>

            {error && <div className={styles.error}>{error}</div>}

            {result && (
              <div className={styles.result}>
                <div className={styles.resultText}>{result}</div>
                <div className={styles.resultActions}>
                  {canInsert && (
                    <button type="button" className={styles.secondary} onClick={handleInsert}>
                      ↩️ Xabarga qo&apos;yish
                    </button>
                  )}
                  <button type="button" className={styles.secondary} onClick={handleCopy}>📋 Nusxa</button>
                  <button type="button" className={styles.secondary} onClick={handleRun}>🔄 Qayta</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default memo(DigNetsAiModal);
