/** IMX emoji pack — curated Unicode set with branded categories for the app picker. */

export type EmojiCategory = {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
};

export const IMX_EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'imx',
    label: 'IMX',
    icon: '⚡',
    emojis: ['⚡', '💬', '🔒', '🛡️', '📡', '🛰️', '🧿', '💠', '🔷', '🔶', '✨', '🌟', '💫', '🔥', '🚀', '🎯', '💎', '🔮'],
  },
  {
    id: 'smile',
    label: 'Smile',
    icon: '😀',
    emojis: [
      '😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😗', '😜', '🤪', '🤔', '🤨',
      '😎', '🤩', '🥳', '😏', '😒', '😢', '😭', '😤', '😡', '🤯', '🥶', '🥵', '😴', '🤤', '😷', '🤒',
      '🤗', '🤭', '🤫', '🫡', '🫠', '😶‍🌫️', '😮‍💨', '😵‍💫',
    ],
  },
  {
    id: 'hands',
    label: 'Hands',
    icon: '👍',
    emojis: [
      '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '👆', '👇', '👉', '👈',
      '👋', '🤙', '💪', '🙏', '🫶', '✍️', '💅', '🤳',
    ],
  },
  {
    id: 'hearts',
    label: 'Love',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💞', '💓', '💗', '💖', '💘',
      '💝', '💟', '❣️', '💔', '❤️‍🔥', '💋', '💌',
    ],
  },
  {
    id: 'party',
    label: 'Fun',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🎈', '🎂', '🎁', '🏆', '🥇', '🎯', '🎮', '🎲', '🎵', '🎶', '🎤', '🎧', '🎬',
      '📸', '📷', '🌙', '⭐', '🌈', '☀️', '🌊', '🍕', '☕', '🧋', '🍰',
    ],
  },
  {
    id: 'status',
    label: 'Status',
    icon: '✅',
    emojis: [
      '✅', '❌', '⚠️', '🚨', '🔔', '🔕', '📌', '📍', '💡', '🔎', '📎', '📁', '📝', '🗓️', '⏳',
      '✔️', '🆕', '🆓', '🆙', '🆒', '💯', '🔴', '🟢', '🟡', '🔵',
    ],
  },
];

/** Flat list used by reaction “all” grids and legacy pickers. */
export const EMOJIS: string[] = IMX_EMOJI_CATEGORIES.flatMap((c) => c.emojis);

export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '🔥', '⚡', '🎉', '🙏'] as const;
