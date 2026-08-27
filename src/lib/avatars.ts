/** Preset profile avatars only — no local PNG/JPEG uploads. */
export const PROFILE_AVATARS = [
  "/images/avatars/avatar-01.svg",
  "/images/avatars/avatar-02.svg",
  "/images/avatars/avatar-03.svg",
  "/images/avatars/avatar-04.svg",
  "/images/avatars/avatar-05.svg",
  "/images/avatars/avatar-06.svg",
  "/images/avatars/avatar-07.svg",
  "/images/avatars/avatar-08.svg",
  "/images/avatars/avatar-09.svg",
  "/images/avatars/avatar-10.svg",
  "/images/avatars/avatar-11.svg",
  "/images/avatars/avatar-12.svg",
] as const;

export type ProfileAvatar = (typeof PROFILE_AVATARS)[number];

/**
 * Human labels for the twelve characters, in gallery order.
 *
 * These exist for screen readers and tooltips only — the stored value is still the
 * path, so renaming one here is safe and never touches the backend allow-list in
 * `users/service.py`. Each name describes what actually distinguishes that avatar
 * at picker size (its colour and its accessory), because "Avatar 7" tells someone
 * using a screen reader nothing about what they are choosing.
 */
export const PROFILE_AVATAR_NAMES: Record<ProfileAvatar, string> = {
  "/images/avatars/avatar-01.svg": "Teal, plain",
  "/images/avatars/avatar-02.svg": "Blue, glasses",
  "/images/avatars/avatar-03.svg": "Amber, cap",
  "/images/avatars/avatar-04.svg": "Rose, bow tie",
  "/images/avatars/avatar-05.svg": "Green, headphones",
  "/images/avatars/avatar-06.svg": "Violet, hair tuft",
  "/images/avatars/avatar-07.svg": "Cyan, sunglasses",
  "/images/avatars/avatar-08.svg": "Orange, freckles",
  "/images/avatars/avatar-09.svg": "Slate, scarf",
  "/images/avatars/avatar-10.svg": "Gold, headband",
  "/images/avatars/avatar-11.svg": "Deep sea, earring",
  "/images/avatars/avatar-12.svg": "Crimson, flower",
};

export function profileAvatarName(value: ProfileAvatar): string {
  return PROFILE_AVATAR_NAMES[value];
}

export const DEFAULT_PROFILE_AVATAR: ProfileAvatar = PROFILE_AVATARS[0];

export function resolveProfileAvatar(value?: string | null): ProfileAvatar {
  if (value && (PROFILE_AVATARS as readonly string[]).includes(value)) {
    return value as ProfileAvatar;
  }
  return DEFAULT_PROFILE_AVATAR;
}
