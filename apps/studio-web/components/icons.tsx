import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const GridIcon = (props: IconProps) => <IconBase {...props}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></IconBase>;
export const BotIcon = (props: IconProps) => <IconBase {...props}><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M9 3h6M12 3v4M8.5 13h.01M15.5 13h.01M9 17h6"/></IconBase>;
export const ChatIcon = (props: IconProps) => <IconBase {...props}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></IconBase>;
export const PulseIcon = (props: IconProps) => <IconBase {...props}><path d="M3 12h4l2-7 4 14 2-7h6"/></IconBase>;
export const SettingsIcon = (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.35.6.7 1 .9.35.2.74.3 1.14.3H21v4h-.09A1.7 1.7 0 0 0 19.4 15z"/></IconBase>;
export const PlusIcon = (props: IconProps) => <IconBase {...props}><path d="M12 5v14M5 12h14"/></IconBase>;
export const SearchIcon = (props: IconProps) => <IconBase {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></IconBase>;
export const ArrowIcon = (props: IconProps) => <IconBase {...props}><path d="M5 12h14M13 6l6 6-6 6"/></IconBase>;
export const MemoryIcon = (props: IconProps) => <IconBase {...props}><path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3 3 3 0 0 0 2 2.82V17a3 3 0 0 0 3 3c1.2 0 2.25-.7 2.75-1.7V5.7A3 3 0 0 0 9 4zM15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 3 3 3 0 0 1-2 2.82V17a3 3 0 0 1-3 3c-1.2 0-2.25-.7-2.75-1.7V5.7A3 3 0 0 1 15 4z"/></IconBase>;
export const RocketIcon = (props: IconProps) => <IconBase {...props}><path d="M14 5c3-3 6-2 6-2s1 3-2 6l-5 5-4-4z"/><path d="m9 10-4 1-2 2 5 1M13 14l-1 4-2 2-1-5M6 18l-2 2"/></IconBase>;
export const ChevronIcon = (props: IconProps) => <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase>;
export const SendIcon = (props: IconProps) => <IconBase {...props}><path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/></IconBase>;
export const SparkIcon = (props: IconProps) => <IconBase {...props}><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></IconBase>;
export const MoreIcon = (props: IconProps) => <IconBase {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></IconBase>;
export const PlayIcon = (props: IconProps) => <IconBase {...props}><path d="m8 5 11 7-11 7z"/></IconBase>;
export const ClockIcon = (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></IconBase>;
