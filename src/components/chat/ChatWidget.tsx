'use client';

import { useState, useRef, useEffect, useCallback, useId, useMemo, memo } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { motion, AnimatePresence } from 'framer-motion';

import ThinkingLogo from './ThinkingLogo';
import { leadCaptureSchema, handoffSchema, firstIssue } from '@/src/lib/validation/schemas';
import { FAB_SHAPES, resolveAvatarBg } from '../ui/avatar/AvatarShared';
import {
  ArrowBackIcon,
  MenuIcon,
  ClearChatIcon,
  ExternalLinkIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  DocsIcon,
  QuoteIcon,
  SampleIcon,
  HomeIcon,
  ChatIcon,
  SearchProductIcon,
  ExperimentIcon,
  ExpandIcon,
  CrossIcon,
  ConnectIcon,
  ForumIcon,
  PlusIcon,
} from '@/src/components/icons';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE = IS_DEV ? '' : 'https://www.sapybase.com';
const BrandLogo = `${ASSET_BASE}/vaayu_logo.svg`;

// Send a message to the host page only when we have a validated origin.
// `__SapybaseParentOrigin` is set by `EmbedBootstrapper` after it parses &
// validates `parentOrigin` from the URL hash via `new URL().origin`.
// If we don't have a trusted origin, we skip the post entirely — never use '*'.
function postToParent(message: unknown) {
  if (typeof window === 'undefined' || window.parent === window) return;
  const origin = (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin;
  if (!origin) return;
  try {
    window.parent.postMessage(message, origin);
  } catch {
    // Cross-origin failure or detached frame — drop silently.
  }
}

// ── SapybaseConfig window augmentation ───────────────────────────────────────

declare global {
  interface Window {
    SapybaseConfig?: {
      apiKey?: string;
      apiUrl?: string;
      themeColor?: string;
      botName?: string;
      logoUrl?: string;
      welcomeMessage?: string;
      quickQuestions?: (string | { label?: string; prompt?: string })[];
      logoShape?: string;
      customLogoUrl?: string;
      avatarBgStyle?: string;
    };
  }
}

// ── BotAvatar ─────────────────────────────────────────────────────────────────

type BotAvatarProps = {
  shapeId: string;
  logoUrl: string;
  botName: string;
  themeColor: string;
  sizeClass: string;
  hasShadow?: boolean;
  transparentBgImage?: boolean;
  isCustom?: boolean;
  bgStyle?: string;
};

function BotAvatar({ shapeId, logoUrl, botName, themeColor, sizeClass, hasShadow = true, transparentBgImage = false, isCustom = false, bgStyle = 'none' }: BotAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const prevUrlRef = useRef(logoUrl);

  useEffect(() => {
    if (logoUrl !== prevUrlRef.current) {
      setImgFailed(false);
      prevUrlRef.current = logoUrl;
    }
  }, [logoUrl]);

  const uid = useId().replace(/:/g, '');
  const shape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
  const FAB_PATH = shape.path;
  const offsetX = shape.x || 0;
  const offsetY = shape.y || 0;

  const bg = resolveAvatarBg(bgStyle);
  const gradient = bg.kind === 'gradient' ? bg.colors : null;
  const solid = bg.kind === 'solid' ? bg.color : null;
  const showImage = logoUrl && logoUrl.trim() && !imgFailed;
  const useFallback = !showImage || !isCustom;
  const FallbackLogoUrl = `${ASSET_BASE}/logo2.svg`;

  // L1 fill: white backdrop when fallback logo is shown, otherwise gradient,
  // solid colour, or custom white (transparent when transparentBgImage).
  const baseFill = useFallback
    ? '#ffffff'
    : (gradient ? `url(#${uid}-grad)` : (solid ? solid : (transparentBgImage ? 'transparent' : '#ffffff')));

  return (
    <div className={`${sizeClass} shrink-0 ${hasShadow ? 'shadow-sm' : ''} relative flex items-center justify-center`}>
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        overflow="visible"
      >
        <defs>
          <clipPath id={`${uid}-clip`}>
            <path d={FAB_PATH} />
          </clipPath>
          {gradient && (
            <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          )}
        </defs>

        {/* L1: Backdrop/Fill */}
        <path d={FAB_PATH} fill={baseFill} />

        {/* L2: Image clipped precisely to shape */}
        {!useFallback ? (
          <g clipPath={`url(#${uid}-clip)`}>
            <image
              href={logoUrl}
              xlinkHref={logoUrl}
              x={offsetX}
              y={offsetY}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid slice"
              onError={() => setImgFailed(true)}
            />
          </g>
        ) : (
          <g clipPath={`url(#${uid}-clip)`}>
            <image
              href={FallbackLogoUrl}
              xlinkHref={FallbackLogoUrl}
              x={20 + offsetX}
              y={20 + offsetY}
              width={60}
              height={60}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        )}

      </svg>
    </div>
  );
}

// ── FabButton (FAB with image-error fallback for Safari) ─────────────────────

type FabButtonProps = {
  fabPath: string;
  fabGradient: [string, string] | null;
  fabSolid?: string | null;
  logoUrl: string;
  botName: string;
  themeColor: string;
  isCustomLogo: boolean;
  fabShapeX: number;
  fabShapeY: number;
  isOpen: boolean;
  onClick: () => void;
};

function FabButton({ fabPath, fabGradient, fabSolid = null, logoUrl, botName, themeColor, isCustomLogo, fabShapeX, fabShapeY, isOpen, onClick }: FabButtonProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const prevUrlRef = useRef(logoUrl);

  useEffect(() => {
    if (logoUrl !== prevUrlRef.current) {
      setImgFailed(false);
      prevUrlRef.current = logoUrl;
    }
  }, [logoUrl]);

  const showImage = logoUrl && !imgFailed;
  const useFallback = !showImage || !isCustomLogo;
  const FallbackLogoUrl = `${ASSET_BASE}/logo2.svg`;

  const hasCustomColor = !!themeColor && themeColor !== '#5730F5' && themeColor !== '#004DE8' && themeColor !== '#000d42';

  return (
    <motion.button whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      aria-label={isOpen ? 'Collapse chat' : 'Open AI chat assistant'} aria-expanded={isOpen}
      style={{ touchAction: 'manipulation', background: 'transparent', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', outlineColor: themeColor, position: 'relative', zIndex: 1 }}
      className="relative flex flex-col items-center justify-center focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-14 sm:h-14 w-12 h-12 shadow-none transition-all p-1">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full z-0" overflow="visible">
        <defs>
          <clipPath id="fab-clip"><path d={fabPath} /></clipPath>
          <filter id="neumorphic-3d-inset" x="-20%" y="-20%" width="140%" height="140%">
            <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
            <feGaussianBlur stdDeviation="3" /><feOffset dx="4" dy="4" result="offsetBlurDark" />
            <feComposite operator="in" in2="SourceAlpha" result="innerShadowDark" />
            <feFlood floodColor="rgba(0,0,0,0.14)" />
            <feComposite operator="in" in2="innerShadowDark" result="finalDark" />
            <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
            <feGaussianBlur stdDeviation="3" /><feOffset dx="-3" dy="-3" result="offsetBlurLight" />
            <feComposite operator="in" in2="SourceAlpha" result="innerShadowLight" />
            <feFlood floodColor="rgba(255,255,255,0.8)" />
            <feComposite operator="in" in2="innerShadowLight" result="finalLight" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="finalDark" /><feMergeNode in="finalLight" /></feMerge>
          </filter>
          <linearGradient id="fab-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="fab-gradient-dark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" /><stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          {fabGradient && (
            <linearGradient id="Sapybase-avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={fabGradient[0]} /><stop offset="100%" stopColor={fabGradient[1]} />
            </linearGradient>
          )}
        </defs>
        <path d={fabPath} fill={useFallback ? (fabGradient ? 'url(#Sapybase-avatar-grad)' : fabSolid ? fabSolid : (hasCustomColor ? themeColor : '#000d42')) : (fabGradient ? 'url(#Sapybase-avatar-grad)' : fabSolid ? fabSolid : 'url(#fab-gradient)')}
          className={!useFallback && !fabGradient && !fabSolid ? 'dark:fill-[url(#fab-gradient-dark)] transition-all duration-500' : 'transition-all duration-500'} />

        <g style={{ opacity: isOpen ? 1 : 0, transition: 'opacity 0.3s ease-in-out', transform: 'translate(33px, 33px)' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.1967 4.13783C19.3805 3.95406 19.6784 3.95406 19.8622 4.13783C20.0459 4.32161 20.0459 4.6195 19.8622 4.80328L12.6654 12L19.8622 19.1967C20.0459 19.3805 20.0459 19.6784 19.8622 19.8622C19.6784 20.0459 19.3805 20.0459 19.1967 19.8622L12 12.6654L4.80328 19.8622C4.6195 20.0459 4.32161 20.0459 4.13783 19.8622C3.95406 19.6784 3.95406 19.3805 4.13783 19.1967L11.3346 12L4.13783 4.80328C3.95406 4.6195 3.95406 4.32161 4.13783 4.13783C4.32161 3.95406 4.6195 3.95406 4.80328 4.13783L12 11.3346L19.1967 4.13783Z" fill="white" stroke="white" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </g>

        <g style={{ opacity: isOpen ? 0 : 1, transition: 'opacity 0.3s ease-in-out' }}>
          {!useFallback ? (
            <g clipPath="url(#fab-clip)">
              <image
                href={logoUrl}
                xlinkHref={logoUrl}
                x={fabShapeX || 0}
                y={fabShapeY || 0}
                width={100}
                height={100}
                preserveAspectRatio="xMidYMid meet"
                onError={() => setImgFailed(true)}
              />
            </g>
          ) : (
            <g clipPath="url(#fab-clip)">
              <svg x={20 + (fabShapeX || 0)} y={25 + (fabShapeY || 0)} width={60} height={50} viewBox="0 0 18 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.75367 0.0681719C6.37057 0.0688596 5.94592 0.0424427 5.56448 0.00672022C5.52547 0.00306659 5.48551 0.00116674 5.44463 0.00112716L4.21752 3.58511e-07C3.77453 -0.000343249 3.38837 0.246336 3.18853 0.608474L3.18156 0.621996L3.17459 0.636081L0.198914 6.79967C-0.0846151 7.38695 -0.0640101 8.07559 0.254125 8.64487L3.46684 14.3938C3.66693 14.7544 4.05195 15 4.4935 15H7.60357C7.67759 15 7.72393 14.92 7.68708 14.8558C7.65023 14.7916 7.69657 14.7115 7.77059 14.7115H8.09447C8.19628 14.7115 8.29066 14.7667 8.34121 14.8551C8.39224 14.9443 8.48751 15 8.59026 15H10.5204C10.938 14.9999 11.4095 14.9984 11.8271 14.9989L13.0537 15C13.4977 15.0003 13.8844 14.7526 14.0838 14.3893L17.2134 8.68669C17.5451 8.08233 17.5421 7.34975 17.2056 6.74809L13.8043 0.667631C13.6037 0.308959 13.2199 0.0654264 12.78 0.0653549H9.72023C9.6462 0.0653549 9.59937 0.144831 9.63524 0.209586C9.67111 0.274341 9.62427 0.353816 9.55025 0.353816H9.19478C9.09277 0.353816 8.99876 0.298563 8.94913 0.209436C8.89942 0.120169 8.8052 0.0648928 8.70302 0.0650561L6.75367 0.0681719ZM12.78 0.642278L12.8561 0.647349C13.0324 0.671732 13.1902 0.779635 13.2814 0.942571L16.5304 6.75086C16.867 7.35255 16.8699 8.08516 16.5382 8.68953L13.5586 14.1183L13.5156 14.1853C13.4065 14.3341 13.2365 14.4232 13.0543 14.4231L11.8277 14.422C11.3823 14.4213 11.1033 13.9186 11.324 13.5143L13.9531 8.6966C14.2812 8.09534 14.2788 7.36797 13.9468 6.76889L11.6315 2.59212C11.1463 1.71686 11.7793 0.642278 12.78 0.642278ZM3.71319 0.880597C3.81698 0.692529 4.00918 0.576803 4.21694 0.576923L5.44405 0.57805L5.52539 0.583684C5.92243 0.64066 6.1546 1.10651 5.94779 1.48569C5.39448 2.49969 4.95554 3.46115 4.50577 4.44631C4.1697 5.18246 3.82758 5.93184 3.42719 6.72625C3.11407 7.3475 3.11849 8.08578 3.46494 8.68907L5.63018 12.4596C6.13198 13.3334 5.50118 14.4231 4.4935 14.4231C4.28638 14.4231 4.09481 14.3078 3.99092 14.1205L0.920057 8.62628C0.601871 8.057 0.581234 7.36834 0.86476 6.78102L3.71319 0.880597ZM6.25283 1.55668C6.02875 1.15244 6.30775 0.645897 6.75483 0.645095L7.33651 0.644164C8.06329 0.643 8.7335 1.0362 9.08708 1.67118L11.8719 6.67236L11.9085 6.74899C12.0516 7.11225 11.8243 7.52491 11.4518 7.57831L11.3699 7.58451H9.92894L9.85225 7.57888C9.67535 7.55422 9.51724 7.44535 9.42636 7.2814L6.25283 1.55668ZM12.3954 6.39799C12.7992 7.12327 12.341 8.16143 11.3699 8.16143H9.92894C9.48723 8.16137 9.10227 7.91544 8.90228 7.55465L7.27538 4.61929C6.77133 3.70985 5.47726 3.74415 5.04533 4.68997L5.01584 4.75455C4.72652 5.38802 4.42759 6.03845 4.08854 6.723C3.78259 7.34027 3.79081 8.0707 4.13389 8.66813L7.19101 13.9917C7.24179 14.0801 7.33598 14.1346 7.43795 14.1346C7.65669 14.1346 7.79375 13.8982 7.68508 13.7084L4.78459 8.64145C4.36958 7.91634 4.82525 6.86632 5.80312 6.86617H7.35444C7.79802 6.86623 8.18414 7.11393 8.38343 7.4769L9.41424 9.35421C10.1749 10.7395 12.1661 10.7368 12.923 9.34953L13.2787 8.69769C13.6067 8.09644 13.6043 7.36914 13.272 6.7701L10.1206 1.08468C10.0679 0.989681 9.96788 0.93074 9.85926 0.93074C9.63128 0.93074 9.48727 1.17576 9.59819 1.37494L12.3954 6.39799ZM5.30461 8.36144C5.11397 8.02819 5.26971 7.6206 5.58269 7.48731C5.67064 7.44985 5.7686 7.44872 5.86419 7.44868L7.43172 7.44817C7.60923 7.47308 7.76762 7.58295 7.85819 7.7479L11.0242 13.5143C11.2323 13.8937 10.9995 14.3606 10.6018 14.4174L10.5204 14.4231H9.9341C9.21692 14.4231 8.55464 14.0391 8.19836 13.4167L5.30461 8.36144Z" fill="white" />
                <path d="M5.44481 0.000976755C5.48563 0.00102169 5.52597 0.00318782 5.56493 0.00683613C5.94615 0.0425288 6.37052 0.0690343 6.7534 0.0683596L8.70262 0.0654299C8.8046 0.0652669 8.89893 0.120022 8.94871 0.208985C8.99834 0.298111 9.09279 0.353516 9.19481 0.353516H9.55028C9.60566 0.3535 9.64627 0.309304 9.64793 0.259766L9.62254 0.160156C9.62383 0.110319 9.66453 0.0654437 9.7202 0.0654299H12.7798C13.2197 0.0655014 13.6035 0.309297 13.8042 0.667969L17.2055 6.74805C17.5421 7.34967 17.545 8.08218 17.2134 8.68652L14.0835 14.3896C13.884 14.7527 13.497 15.0003 13.0532 15L11.8276 14.999C11.41 14.9985 10.9376 14.9999 10.52 15H8.59032C8.48768 15 8.39236 14.9445 8.34129 14.8555C8.29074 14.7671 8.19603 14.7119 8.09422 14.7119H7.77098C7.71565 14.7119 7.67551 14.7563 7.6743 14.8057L7.69969 14.9053C7.69879 14.9548 7.65932 14.9998 7.60399 15H4.49364C4.05209 15 3.66736 14.7541 3.46727 14.3936L0.254378 8.64453C-0.0636446 8.07534 -0.0846964 7.387 0.198714 6.7998L3.1743 0.635742L3.18114 0.62207L3.18895 0.608399C3.38879 0.246456 3.77448 -0.000251846 4.21727 1.92935e-07L5.44481 0.000976755ZM4.21727 0.577149C4.00951 0.577028 3.81715 0.692792 3.71336 0.88086L0.86473 6.78125C0.581318 7.36849 0.602292 8.05677 0.920394 8.62598L3.99071 14.1201C4.0946 14.3073 4.28651 14.4228 4.49364 14.4229C5.50109 14.4229 6.13175 13.3337 5.63035 12.46L3.46532 8.68945C3.11891 8.08623 3.11423 7.34777 3.42723 6.72656C3.8276 5.93219 4.1693 5.18239 4.50535 4.44629C4.95512 3.46113 5.39442 2.49935 5.94774 1.48535C6.15423 1.10638 5.92251 0.641271 5.52586 0.583985L5.44383 0.578125L4.21727 0.577149ZM5.86375 7.44824C5.7683 7.44828 5.67032 7.4499 5.5825 7.4873C5.26971 7.62063 5.11381 8.02818 5.30418 8.36133L8.19871 13.417C8.55505 14.0392 9.21706 14.4228 9.93407 14.4229H10.52L10.602 14.417C10.9996 14.36 11.2318 13.8939 11.0239 13.5146L7.85789 7.74805C7.76739 7.58323 7.60946 7.47326 7.43211 7.44824H5.86375ZM12.7798 0.642578C11.7793 0.642749 11.1465 1.71666 11.6313 2.5918L13.9468 6.76855C14.2788 7.36749 14.2815 8.09511 13.9536 8.69629L11.3237 13.5146C11.1035 13.9189 11.3824 14.4212 11.8276 14.4219L13.0542 14.4229C13.2362 14.4229 13.406 14.3341 13.5151 14.1855L13.5581 14.1182L16.5386 8.68945C16.8701 8.0852 16.8671 7.35255 16.5307 6.75098L13.2817 0.942383C13.1905 0.779456 13.0322 0.671844 12.8559 0.647461L12.7798 0.642578ZM9.85887 0.930664C9.63112 0.93094 9.48728 1.17594 9.59813 1.375L12.395 6.39844C12.7987 7.12371 12.3407 8.16113 11.3696 8.16113H9.92918C9.48747 8.16106 9.10183 7.91548 8.90184 7.55469L7.27489 4.61914C6.77071 3.71003 5.47728 3.74472 5.04539 4.69043L5.0161 4.75488C4.72683 5.38824 4.42759 6.03825 4.08836 6.72266C3.78259 7.33992 3.79118 8.07054 4.13426 8.66797L7.1909 13.9912C7.24168 14.0796 7.336 14.1348 7.43797 14.1348C7.6567 14.1347 7.79371 13.8978 7.68504 13.708L4.78465 8.6416C4.36964 7.91649 4.82534 6.86636 5.80321 6.86621H7.35399C7.79743 6.86627 8.18394 7.11376 8.38328 7.47656L9.41453 9.35449C10.1753 10.7394 12.1664 10.7368 12.9233 9.34961L13.2788 8.69727C13.6067 8.09616 13.6043 7.36938 13.272 6.77051L10.1206 1.08496C10.0679 0.98996 9.96749 0.930664 9.85887 0.930664ZM11.3462 11.3848C11.2297 11.3916 11.1131 11.3922 10.9966 11.3857L11.1714 11.7051L11.3462 11.3848ZM6.75438 0.645508C6.30763 0.646651 6.02863 1.15257 6.25243 1.55664L9.42625 7.28125C9.5171 7.44514 9.67521 7.55439 9.85203 7.5791L9.92918 7.58496H11.3696L11.4516 7.57812C11.8241 7.52473 12.0517 7.11226 11.9087 6.74902L11.8716 6.67285L9.08739 1.6709C8.7338 1.03596 8.06316 0.643368 7.33641 0.644531L6.75438 0.645508Z" fill="white" />
              </svg>
            </g>
          )}
        </g>
        <path d={fabPath} fill="transparent" filter="url(#neumorphic-3d-inset)" className="pointer-events-none" />
        <path d={fabPath} fill="none" stroke={themeColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20" />
      </svg>
    </motion.button>
  );
}

// ── FabWidgetPreview (exported — used by LogoCustomizer) ─────────────────────

export const FabWidgetPreview = ({ shapeId, logoUrl, botName, themeColor, bgStyle, isCustomUrl = false }: {
  shapeId: string; logoUrl: string; botName: string; themeColor: string; bgStyle: string; isCustomUrl?: boolean;
}) => {
  const fabShape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
  const FAB_PATH = fabShape.path;
  const THEME_COLOR = themeColor || '#5730F5';
  const BOT_NAME = botName || 'S';
  const bg = resolveAvatarBg(bgStyle);
  const gradient = bg.kind === 'gradient' ? bg.colors : null;
  const solid = bg.kind === 'solid' ? bg.color : null;
  const idPrefix = 'preview';
  const FallbackLogoUrl = `${ASSET_BASE}/logo2.svg`;
  const useFallback = !logoUrl || !isCustomUrl;

  const hasCustomColor = themeColor && themeColor !== '#5730F5' && themeColor !== '#004DE8' && themeColor !== '#000d42';

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 shrink-0 drop-shadow-sm" overflow="visible">
      <defs>
        <clipPath id={`${idPrefix}-fab-clip`}><path d={FAB_PATH} /></clipPath>
        <filter id={`${idPrefix}-neumorphic-3d-inset`} x="-20%" y="-20%" width="140%" height="140%">
          <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
          <feGaussianBlur stdDeviation="3" /><feOffset dx="4" dy="4" result="offsetBlurDark" />
          <feComposite operator="in" in2="SourceAlpha" result="innerShadowDark" />
          <feFlood floodColor="rgba(0,0,0,0.14)" />
          <feComposite operator="in" in2="innerShadowDark" result="finalDark" />
          <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0" /></feComponentTransfer>
          <feGaussianBlur stdDeviation="3" /><feOffset dx="-3" dy="-3" result="offsetBlurLight" />
          <feComposite operator="in" in2="SourceAlpha" result="innerShadowLight" />
          <feFlood floodColor="rgba(255,255,255,0.8)" />
          <feComposite operator="in" in2="innerShadowLight" result="finalLight" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="finalDark" /><feMergeNode in="finalLight" /></feMerge>
        </filter>
        <linearGradient id={`${idPrefix}-fab-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-fab-gradient-dark`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        {gradient && (
          <linearGradient id={`${idPrefix}-Sapybase-avatar-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} /><stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        )}
      </defs>
      <path d={FAB_PATH} fill={useFallback ? (gradient ? `url(#${idPrefix}-Sapybase-avatar-grad)` : solid ? solid : (hasCustomColor ? themeColor : '#000d42')) : (gradient ? `url(#${idPrefix}-Sapybase-avatar-grad)` : solid ? solid : `url(#${idPrefix}-fab-gradient)`)}
        className={!useFallback && !gradient && !solid ? `dark:fill-[url(#${idPrefix}-fab-gradient-dark)] transition-all duration-500` : 'transition-all duration-500'} />
      {!useFallback ? (
        <g clipPath={`url(#${idPrefix}-fab-clip)`}>
          <image href={logoUrl} xlinkHref={logoUrl} x={fabShape.x || 0} y={fabShape.y || 0}
            width={100} height={100} preserveAspectRatio="xMidYMid slice" />
        </g>
      ) : (
        <g clipPath={`url(#${idPrefix}-fab-clip)`}>
          <svg x={20 + (fabShape.x || 0)} y={25 + (fabShape.y || 0)} width={60} height={50} viewBox="0 0 18 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M6.75367 0.0681719C6.37057 0.0688596 5.94592 0.0424427 5.56448 0.00672022C5.52547 0.00306659 5.48551 0.00116674 5.44463 0.00112716L4.21752 3.58511e-07C3.77453 -0.000343249 3.38837 0.246336 3.18853 0.608474L3.18156 0.621996L3.17459 0.636081L0.198914 6.79967C-0.0846151 7.38695 -0.0640101 8.07559 0.254125 8.64487L3.46684 14.3938C3.66693 14.7544 4.05195 15 4.4935 15H7.60357C7.67759 15 7.72393 14.92 7.68708 14.8558C7.65023 14.7916 7.69657 14.7115 7.77059 14.7115H8.09447C8.19628 14.7115 8.29066 14.7667 8.34121 14.8551C8.39224 14.9443 8.48751 15 8.59026 15H10.5204C10.938 14.9999 11.4095 14.9984 11.8271 14.9989L13.0537 15C13.4977 15.0003 13.8844 14.7526 14.0838 14.3893L17.2134 8.68669C17.5451 8.08233 17.5421 7.34975 17.2056 6.74809L13.8043 0.667631C13.6037 0.308959 13.2199 0.0654264 12.78 0.0653549H9.72023C9.6462 0.0653549 9.59937 0.144831 9.63524 0.209586C9.67111 0.274341 9.62427 0.353816 9.55025 0.353816H9.19478C9.09277 0.353816 8.99876 0.298563 8.94913 0.209436C8.89942 0.120169 8.8052 0.0648928 8.70302 0.0650561L6.75367 0.0681719ZM12.78 0.642278L12.8561 0.647349C13.0324 0.671732 13.1902 0.779635 13.2814 0.942571L16.5304 6.75086C16.867 7.35255 16.8699 8.08516 16.5382 8.68953L13.5586 14.1183L13.5156 14.1853C13.4065 14.3341 13.2365 14.4232 13.0543 14.4231L11.8277 14.422C11.3823 14.4213 11.1033 13.9186 11.324 13.5143L13.9531 8.6966C14.2812 8.09534 14.2788 7.36797 13.9468 6.76889L11.6315 2.59212C11.1463 1.71686 11.7793 0.642278 12.78 0.642278ZM3.71319 0.880597C3.81698 0.692529 4.00918 0.576803 4.21694 0.576923L5.44405 0.57805L5.52539 0.583684C5.92243 0.64066 6.1546 1.10651 5.94779 1.48569C5.39448 2.49969 4.95554 3.46115 4.50577 4.44631C4.1697 5.18246 3.82758 5.93184 3.42719 6.72625C3.11407 7.3475 3.11849 8.08578 3.46494 8.68907L5.63018 12.4596C6.13198 13.3334 5.50118 14.4231 4.4935 14.4231C4.28638 14.4231 4.09481 14.3078 3.99092 14.1205L0.920057 8.62628C0.601871 8.057 0.581234 7.36834 0.86476 6.78102L3.71319 0.880597ZM6.25283 1.55668C6.02875 1.15244 6.30775 0.645897 6.75483 0.645095L7.33651 0.644164C8.06329 0.643 8.7335 1.0362 9.08708 1.67118L11.8719 6.67236L11.9085 6.74899C12.0516 7.11225 11.8243 7.52491 11.4518 7.57831L11.3699 7.58451H9.92894L9.85225 7.57888C9.67535 7.55422 9.51724 7.44535 9.42636 7.2814L6.25283 1.55668ZM12.3954 6.39799C12.7992 7.12327 12.341 8.16143 11.3699 8.16143H9.92894C9.48723 8.16137 9.10227 7.91544 8.90228 7.55465L7.27538 4.61929C6.77133 3.70985 5.47726 3.74415 5.04533 4.68997L5.01584 4.75455C4.72652 5.38802 4.42759 6.03845 4.08854 6.723C3.78259 7.34027 3.79081 8.0707 4.13389 8.66813L7.19101 13.9917C7.24179 14.0801 7.33598 14.1346 7.43795 14.1346C7.65669 14.1346 7.79375 13.8982 7.68508 13.7084L4.78459 8.64145C4.36958 7.91634 4.82525 6.86632 5.80312 6.86617H7.35444C7.79802 6.86623 8.18414 7.11393 8.38343 7.4769L9.41424 9.35421C10.1749 10.7395 12.1661 10.7368 12.923 9.34953L13.2787 8.69769C13.6067 8.09644 13.6043 7.36914 13.272 6.7701L10.1206 1.08468C10.0679 0.989681 9.96788 0.93074 9.85926 0.93074C9.63128 0.93074 9.48727 1.17576 9.59819 1.37494L12.395 6.39844ZM5.30461 8.36144C5.11397 8.02819 5.26971 7.6206 5.58269 7.48731C5.67064 7.44985 5.7686 7.44872 5.86419 7.44868L7.43172 7.44817C7.60923 7.47308 7.76762 7.58295 7.85819 7.7479L11.0242 13.5143C11.2323 13.8937 10.9995 14.3606 10.6018 14.4174L10.5204 14.4231H9.9341C9.21692 14.4231 8.55464 14.0391 8.19836 13.4167L5.30461 8.36144Z" fill="white" />
            <path d="M5.44481 0.000976755C5.48563 0.00102169 5.52597 0.00318782 5.56493 0.00683613C5.94615 0.0425288 6.37052 0.0690343 6.7534 0.0683596L8.70262 0.0654299C8.8046 0.0652669 8.89893 0.120022 8.94871 0.208985C8.99834 0.298111 9.09279 0.353516 9.19481 0.353516H9.55028C9.60566 0.3535 9.64627 0.309304 9.64793 0.259766L9.62254 0.160156C9.62383 0.110319 9.66453 0.0654437 9.7202 0.0654299H12.7798C13.2197 0.0655014 13.6035 0.309297 13.8042 0.667969L17.2055 6.74805C17.5421 7.34967 17.545 8.08218 17.2134 8.68652L14.0835 14.3896C13.884 14.7527 13.497 15.0003 13.0532 15L11.8276 14.999C11.41 14.9985 10.9376 14.9999 10.52 15H8.59032C8.48768 15 8.39236 14.9445 8.34129 14.8555C8.29074 14.7671 8.19603 14.7119 8.09422 14.7119H7.77098C7.71565 14.7119 7.67551 14.7563 7.6743 14.8057L7.69969 14.9053C7.69879 14.9548 7.65932 14.9998 7.60399 15H4.49364C4.05209 15 3.66736 14.7541 3.46727 14.3936L0.254378 8.64453C-0.0636446 8.07534 -0.0846964 7.387 0.198714 6.7998L3.1743 0.635742L3.18114 0.62207L3.18895 0.608399C3.38879 0.246456 3.77448 -0.000251846 4.21727 1.92935e-07L5.44481 0.000976755ZM4.21727 0.577149C4.00951 0.577028 3.81715 0.692792 3.71336 0.88086L0.86473 6.78125C0.581318 7.36849 0.602292 8.05677 0.920394 8.62598L3.99071 14.1201C4.0946 14.3073 4.28651 14.4228 4.49364 14.4229C5.50109 14.4229 6.13175 13.3337 5.63035 12.46L3.46532 8.68945C3.11891 8.08623 3.11423 7.34777 3.42723 6.72656C3.8276 5.93219 4.1693 5.18239 4.50535 4.44629C4.95512 3.46113 5.39442 2.49935 5.94774 1.48535C6.15423 1.10638 5.92251 0.641271 5.52586 0.583985L5.44383 0.578125L4.21727 0.577149ZM5.86375 7.44824C5.7683 7.44828 5.67032 7.4499 5.5825 7.4873C5.26971 7.62063 5.11381 8.02818 5.30418 8.36133L8.19871 13.417C8.55505 14.0392 9.21706 14.4228 9.93407 14.4229H10.52L10.602 14.417C10.9996 14.36 11.2318 13.8939 11.0239 13.5146L7.85789 7.74805C7.76739 7.58323 7.60946 7.47326 7.43211 7.44824H5.86375ZM12.7798 0.642578C11.7793 0.642749 11.1465 1.71666 11.6313 2.5918L13.9468 6.76855C14.2788 7.36749 14.2815 8.09511 13.9536 8.69629L11.3237 13.5146C11.1035 13.9189 11.3824 14.4212 11.8276 14.4219L13.0542 14.4229C13.2362 14.4229 13.406 14.3341 13.5151 14.1855L13.5581 14.1182L16.5386 8.68945C16.8701 8.0852 16.8671 7.35255 16.5307 6.75098L13.2817 0.942383C13.1905 0.779456 13.0322 0.671844 12.8559 0.647461L12.7798 0.642578ZM9.85887 0.930664C9.63112 0.93094 9.48728 1.17594 9.59813 1.375L12.395 6.39844C12.7987 7.12371 12.3407 8.16113 11.3696 8.16113H9.92918C9.48747 8.16106 9.10183 7.91548 8.90184 7.55469L7.27489 4.61914C6.77071 3.71003 5.47728 3.74472 5.04539 4.69043L5.0161 4.75488C4.72683 5.38824 4.42759 6.03825 4.08836 6.72266C3.78259 7.33992 3.79118 8.07054 4.13426 8.66797L7.1909 13.9912C7.24168 14.0796 7.336 14.1348 7.43797 14.1348C7.6567 14.1347 7.79371 13.8978 7.68504 13.708L4.78465 8.6416C4.36964 7.91649 4.82534 6.86636 5.80321 6.86621H7.35399C7.79743 6.86627 8.18394 7.11376 8.38328 7.47656L9.41453 9.35449C10.1753 10.7394 12.1664 10.7368 12.923 9.34961L13.2788 8.69727C13.6067 8.09616 13.6043 7.36938 13.272 6.77051L10.1206 1.08496C10.0679 0.98996 9.96749 0.930664 9.85887 0.930664ZM11.3462 11.3848C11.2297 11.3916 11.1131 11.3922 10.9966 11.3857L11.1714 11.7051L11.3462 11.3848ZM6.75438 0.645508C6.30763 0.646651 6.02863 1.15257 6.25243 1.55664L9.42625 7.28125C9.5171 7.44514 9.67521 7.55439 9.85203 7.5791L9.92918 7.58496H11.3696L11.4516 7.57812C11.8241 7.52473 12.0517 7.11226 11.9087 6.74902L11.8716 6.67285L9.08739 1.6709C8.7338 1.03596 8.06316 0.643368 7.33641 0.644531L6.75438 0.645508Z" fill="white" />
          </svg>
        </g>
      )}
      <path d={FAB_PATH} fill="transparent" filter={`url(#${idPrefix}-neumorphic-3d-inset)`} className="pointer-events-none" />
    </svg>
  );
};

// ── LeadCaptureForm ───────────────────────────────────────────────────────────

function LeadCaptureForm({ onSubmit, onDismiss, themeColor, activeApiUrl, apiKey, contextString, error: externalError }: {
  onSubmit: (name: string, bookingUrl?: string) => void; onDismiss: () => void; themeColor: string;
  activeApiUrl: string; apiKey: string; contextString: string; error?: string;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState(externalError || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const parsed = leadCaptureSchema.safeParse({ email, name });
    const issue = firstIssue(parsed);
    if (issue || !parsed.success) {
      setLocalError(issue || 'Invalid input.');
      return;
    }
    setIsSubmitting(true);
    try {
      const w = (typeof window !== 'undefined' ? (window as any) : {});
      const parentOrigin = w.__SapybaseParentOrigin || '';
      // Attribution (best-effort): the loader can expose the merchant page URL via
      // __SapybaseParentUrl; otherwise document.referrer is the next-best signal.
      // UTM is parsed here as a backup — the backend also backfills from page_url.
      const pageUrl = w.__SapybaseParentUrl || (typeof document !== 'undefined' ? document.referrer : '') || '';
      const referrer = (typeof document !== 'undefined' ? document.referrer : '') || '';
      let utmSource: string | undefined, utmMedium: string | undefined, utmCampaign: string | undefined;
      try {
        const q = new URL(pageUrl).searchParams;
        utmSource = q.get('utm_source') || undefined;
        utmMedium = q.get('utm_medium') || undefined;
        utmCampaign = q.get('utm_campaign') || undefined;
      } catch { /* pageUrl not a parseable URL — skip UTM */ }
      const res = await fetch(`${activeApiUrl}/api/leads/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
        },
        body: JSON.stringify({
          email: parsed.data.email,
          name: parsed.data.name ?? '',
          context: contextString,
          page_url: pageUrl || undefined,
          referrer: referrer || undefined,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to submit.');
      // Speed-to-lead: the backend returns booking_url only for qualified leads
      // when the owner has set a scheduling link.
      onSubmit(name, typeof data.booking_url === 'string' ? data.booking_url : undefined);
    } catch {
      setLocalError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm space-y-3 w-full self-start text-left mt-2 relative">
      <h4 className="text-sm font-google font-bold text-gray-800 dark:text-slate-200 text-center uppercase tracking-widest text-[12px] mb-2 leading-tight">
        Leave your details<br />and we'll follow up!
      </h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input type="text" placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[16px] font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--sapy-theme)] focus:border-[var(--sapy-theme)]" />
        <div className="flex flex-col gap-1">
          <input type="email" placeholder="Email address (required)" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[16px] font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--sapy-theme)] focus:border-[var(--sapy-theme)]" />
          {localError && <span className="text-[11px] text-red-500 font-bold px-1">{localError}</span>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full mt-1 rounded-full py-2 text-sm font-regular font-google text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[44px]"
          style={{ backgroundColor: themeColor }}>
          {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit'}
        </button>
      </form>
      <div className="text-center mt-3">
        <button onClick={onDismiss} type="button"
          className="text-sm font-regular font-google text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-none py-3 px-2 w-full min-h-[44px]">
          No thanks
        </button>
      </div>
    </div>
  );
}

// ── HandoffContactForm ────────────────────────────────────────────────────────

function HandoffContactForm({ themeColor, onSubmit, onDismiss }: {
  themeColor: string; onSubmit: (email: string, name: string) => Promise<void>; onDismiss: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = handoffSchema.safeParse({ email });
    const issue = firstIssue(parsed);
    if (issue || !parsed.success) {
      setError(issue || 'Invalid input.');
      return;
    }
    setIsSubmitting(true);
    await onSubmit(parsed.data.email.toLowerCase(), name.trim());
    setIsSubmitting(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm space-y-3 w-full self-start text-left mt-2 relative">
      <h4 className="text-sm font-google font-bold text-gray-800 dark:text-slate-200 text-center uppercase tracking-widest text-[12px] mb-2 leading-tight">
        Share your details<br />so our team can reach you
      </h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input type="text" placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[16px] font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--sapy-theme)] focus:border-[var(--sapy-theme)]" />
        <div className="flex flex-col gap-1">
          <input type="email" placeholder="Email address (required)" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[16px] font-regular font-google text-gray-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--sapy-theme)] focus:border-[var(--sapy-theme)]" />
          {error && <span className="text-[11px] text-red-500 font-bold px-1">{error}</span>}
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full mt-1 rounded-full py-2 text-sm font-regular font-google text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[44px]"
          style={{ backgroundColor: themeColor }}>
          {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Notify the team'}
        </button>
      </form>
      <div className="text-center mt-3">
        <button onClick={onDismiss} type="button"
          className="text-sm font-regular font-google text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-none py-3 px-2 w-full min-h-[44px]">
          No thanks
        </button>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = {
  role: 'user' | 'bot' | 'lead_capture' | 'handoff_form' | 'handoff_confirmed' | 'lead_confirmed';
  content?: string;
  isStreaming?: boolean;
  id?: string;
  visitorEmail?: string;
  redirectUrl?: string;
  bookingUrl?: string;
  sds?: { url: string; product?: string; label?: string };
  quote?: {
    status: 'quoted' | 'price_on_request';
    product?: string; grade?: string; pack_size?: string; quantity?: number;
    unit_price?: number | null; subtotal?: number | null;
    gst_rate?: number | null; currency?: string; gst_note?: string | null;
    captured_contact?: { name?: string | null; email?: string | null; phone?: string | null } | null;
    quote_url?: string | null;
  };
  sample?: {
    product?: string; grade?: string; packaging?: string; quantity?: number;
  };
  grade_selector?: { product?: string; grades: string[]; grade_pack_map?: Record<string, string[]> };
  pack_selector?: { product?: string; grade?: string; pack_sizes: string[] };
  ts?: number;
};

type SessionRow = {
  session_id: string;
  title: string | null;
  preview: string | null;
  last_active_at: string;
};

// Phase 3 — pack-driven hub. A vertical pack ships these cards via /api/config;
// a generic bot returns none, so no hub renders. `action` decides the tap:
// "tool" opens a slot mini-form then sends `prompt_template` ({value} filled in);
// "chat" just drops the visitor into the chat input.
type HubCard = {
  id: string;
  label: string;
  icon: string;
  action: 'tool' | 'chat' | 'form';   // "form" opens a structured intake form
  subtitle?: string;
  input_label?: string;
  prompt_template?: string;
  input_source?: string;            // "products" => searchable catalog picker
  form_id?: string;                 // which form to open (action="form")
};

// One field in a pack-driven structured form (Phase 4b). type "product" renders a
// catalog picker; "grade" a dropdown derived from the chosen product's grades.
type FormField = {
  name: string;
  label: string;
  type: string;                     // text|email|tel|number|textarea|product|grade
  required?: boolean;
  placeholder?: string;
};

// Commercial catalog row shipped to the widget for the hub's product picker.
// Never includes the SDS url — that stays behind the get_sds agent tool. `grades`
// feeds the sample form's grade dropdown once a product is chosen.
type ProductOption = { name: string; cas_number?: string; grade?: string; packaging?: string; grades?: string[] };

type ConfigData = {
  theme_color: string;
  bot_name: string;
  logo_url: string;
  initial_message: string;
  quick_questions: (string | { label?: string; prompt?: string })[];
  logo_shape: string;
  custom_logo_url: string;
  avatar_bg_style: string;
  lead_capture_enabled?: boolean;
  white_label_enabled?: boolean;
  hub_cards?: HubCard[];
  products?: ProductOption[];
  sample_form?: FormField[];
};

// ── Stream-safe Markdown sanitizer ───────────────────────────────────────────

function sanitizeStreamMarkdown(text: string): string {
  if (!text) return '';
  let result = text;
  const fenceMatches = result.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 !== 0) result += '\n```';
  const withoutFences = result.replace(/```[\s\S]*?```/g, '');
  const boldMatches = withoutFences.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) result += '**';
  const withoutBold = withoutFences.replace(/\*\*/g, '');
  const italicMatches = withoutBold.match(/\*/g);
  if (italicMatches && italicMatches.length % 2 !== 0) result += '*';
  const inlineCodeMatches = withoutFences.match(/(?<!`)`(?!`)/g);
  if (inlineCodeMatches && inlineCodeMatches.length % 2 !== 0) result += '`';
  return result;
}

// ── Shared Markdown renderer config ──────────────────────────────────────────

const MD_COMPONENTS = {
  p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
    <p {...props} className="first:mt-0 last:mb-0 mb-2">{children}</p>
  ),
  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
    <div className="overflow-x-auto rounded-lg my-2 scrollbar-thin">
      <pre {...props}>{children}</pre>
    </div>
  ),
  // Links in bot replies (e.g. a chemical agent's SDS document link) open in a
  // NEW tab so the visitor never loses their chat, with rel="noopener" to close
  // the tab-nabbing gap. Applies to every link the bot emits, not just SDS.
  a: ({ children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a {...props} target="_blank" rel="noopener noreferrer"
      className="underline underline-offset-2">{children}</a>
  ),
};

// Phase 3 hub cards carry a semantic (Tabler-style) icon name from the pack; the
// widget renders with inline SVGs (not an icon font), so map the few we use.
const HUB_ICON: Record<string, string> = {
  'file-certificate': 'description',
  flask: 'science',
  'message-circle': 'forum',
  receipt: 'receipt_long',
  package: 'package_2',
};

// ── Inline SVG icons ────────────────────────────────────────────────────────
// Replaces Material Symbols Outlined so the widget never depends on an external
// icon font (which fails silently in iframes, behind ad-blockers, or on slow CDN).
const ICON_PATHS: Record<string, { d: string; fill?: boolean; vb?: string }> = {
  arrow_back: { d: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z', fill: true },
  more_horiz: { d: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z', fill: true },
  open_in_full: { d: 'M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z', fill: true },
  close_fullscreen: { d: 'M22 3.41L16.71 8.7 20 12h-8V4l3.29 3.29L20.59 2 22 3.41zM3.41 22l5.29-5.29L12 20v-8H4l3.29 3.29L2 20.59 3.41 22z', fill: true },
  support_agent: { d: 'M21 12.22C21 6.73 16.74 3 12 3c-4.69 0-9 3.65-9 9.28-.6.34-1 .98-1 1.72v2c0 1.1.9 2 2 2h1v-6.1c0-3.87 3.13-7 7-7s7 3.13 7 7V19h-8v2h8c1.1 0 2-.9 2-2v-1.22c.59-.31 1-.92 1-1.64v-2.3c0-.7-.41-1.31-1-1.62z M9 14c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z', fill: true },
  refresh: { d: 'M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z', fill: true },
  open_in_new: { d: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z', fill: true },
  arrow_downward: { d: 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z', fill: true },
  arrow_upward: { d: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z', fill: true },
  calendar_month: { d: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z', fill: true },
  description: { d: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z', fill: true },
  arrow_outward: { d: 'M6 6v2h8.59L5 17.59 6.41 19 16 9.41V18h2V6z', fill: true },
  content_copy: { d: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z', fill: true },
  receipt_long: { d: 'M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5zM19 19.09H5V4.91h14v14.18zM6 15h12v2H6zm0-4h12v2H6zm0-4h12v2H6z', fill: true },
  package_2: { d: 'M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H4V4h16v16zM14.5 5.5h-5L7 8v2h10V8l-2.5-2.5zM7 12v6h10v-6H7zm8 4H9v-2h6v2z', fill: true },
  bolt: { d: 'M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z', fill: true },
  home: { d: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', fill: true },
  chat_bubble: { d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z', fill: true },
  search: { d: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z', fill: true },
  science: { d: 'M13 11.33L18 18H6l5-6.67V6h2m2-2H7v2h2v4L3 18c-.67.89-.33 2 1 2h16c1.33 0 1.67-1.11 1-2l-6-8V6h2V4z', fill: true },
  forum: { d: 'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z', fill: true },
};

const ICON_COMPONENTS: Record<string, React.ComponentType<any>> = {
  arrow_back: ArrowBackIcon,
  more_horiz: MenuIcon,
  refresh: ClearChatIcon,
  open_in_new: ExternalLinkIcon,
  arrow_downward: ArrowDownIcon,
  arrow_upward: ArrowUpIcon,
  calendar_month: CalendarIcon,
  description: DocsIcon,
  receipt_long: QuoteIcon,
  package_2: SampleIcon,
  home: HomeIcon,
  chat_bubble: ChatIcon,
  search: SearchProductIcon,
  science: ExperimentIcon,
  arrow_outward: ExternalLinkIcon,
  forum: ForumIcon,
};

function MIcon({ name, className }: { name: string; className?: string }) {
  const Comp = ICON_COMPONENTS[name];
  if (Comp) {
    return (
      <Comp
        className={className}
        style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
        aria-hidden="true"
      />
    );
  }

  const icon = ICON_PATHS[name];
  if (!icon) return <span className={className}>{name}</span>;
  return (
    <svg viewBox={icon.vb || '0 0 24 24'} fill={icon.fill ? 'currentColor' : 'none'}
      stroke={icon.fill ? 'none' : 'currentColor'} xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }} aria-hidden="true">
      <path d={icon.d} />
    </svg>
  );
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Format a deterministic quote figure (₹ for INR). Null/undefined -> em dash.
function fmtINR(n?: number | null, currency?: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sym = (currency || 'INR') === 'INR' ? '₹' : `${currency} `;
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Split markdown into top-level blocks (paragraphs / lists / headings / code),
// breaking on blank lines but never inside a fenced code block. This lets each
// COMPLETED block be memoized so it parses exactly once, instead of re-parsing
// the entire message on every streamed frame (the old O(n²) hot path).
function splitMarkdownBlocks(md: string): string[] {
  if (!md) return [];
  const lines = md.split('\n');
  const blocks: string[] = [];
  let cur: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === '') {
      if (cur.length) { blocks.push(cur.join('\n')); cur = []; }
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur.join('\n'));
  return blocks;
}

// Advance `idx` forward by `n` WHOLE words within `buffer`, returning the new
// boundary index. Never reveals a partial trailing word (waits for its
// terminating whitespace) so the typewriter steps word-by-word, never mid-word.
function advanceWords(buffer: string, idx: number, n: number): number {
  let i = idx;
  for (let w = 0; w < n; w++) {
    while (i < buffer.length && /\s/.test(buffer[i])) i++;     // skip leading whitespace
    const wordStart = i;
    while (i < buffer.length && !/\s/.test(buffer[i])) i++;    // consume the word
    if (i >= buffer.length) return wordStart > idx ? wordStart : idx; // word unterminated → hold it
    while (i < buffer.length && (buffer[i] === ' ' || buffer[i] === '\t')) i++; // include trailing spaces
  }
  return i;
}

// One markdown block, memoized on its source. A finalized block never re-parses;
// only the still-growing `tail` block does. `tail` also closes any half-typed
// markers (incomplete **bold** / fences) so inline formatting stays live as it
// streams. The wrapper carries a one-shot fade-in (plays once per block — React
// preserves the element across re-renders, so growing the tail never replays it).
const MarkdownBlock = memo(function MarkdownBlock({ source, tail }: { source: string; tail?: boolean }) {
  return (
    <div className="sapy-md-block-in">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
        {tail ? sanitizeStreamMarkdown(source) : source}
      </ReactMarkdown>
    </div>
  );
});

// ── StreamCallbacks ───────────────────────────────────────────────────────────

type StreamCallbacks = {
  push: (token: string) => void;
  flush: () => string;
  getContent: () => string;
};

// ── MessageContent ────────────────────────────────────────────────────────────

type MessageContentProps = {
  content: string;
  isStreaming?: boolean;
  themeColor?: string;
  streamCallbackRef?: React.MutableRefObject<StreamCallbacks | null>;
  onStreamTick?: () => void;
};

function MessageContent({ content, isStreaming, themeColor = '#5730F5', streamCallbackRef, onStreamTick }: MessageContentProps) {
  const [displayedText, setDisplayedText] = useState('');
  const bufferRef = useRef('');
  const displayIdxRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const onStreamTickRef = useRef(onStreamTick);

  useEffect(() => { onStreamTickRef.current = onStreamTick; }, [onStreamTick]);

  useEffect(() => {
    if (!isStreaming || !streamCallbackRef) return;

    const drain = (timestamp: number) => {
      if (!lastTickRef.current) lastTickRef.current = timestamp;
      const delta = timestamp - lastTickRef.current;
      // Reveal WHOLE words (not chars): far fewer re-renders, and each re-render
      // only re-parses the small tail block (not the whole message). Reveal more
      // words per step when the buffer is far ahead so we never lag the network.
      if (delta >= 38) {
        const buffer = bufferRef.current;
        const idx = displayIdxRef.current;
        if (idx < buffer.length) {
          const ahead = buffer.length - idx;
          const words = ahead > 220 ? 4 : ahead > 90 ? 2 : 1;
          const newIdx = advanceWords(buffer, idx, words);
          if (newIdx > idx) {
            // Only reset the clock when we actually advanced — if we're waiting
            // for a word boundary, re-check on the next frame instead of stalling.
            lastTickRef.current = timestamp;
            displayIdxRef.current = newIdx;
            setDisplayedText(buffer.slice(0, newIdx));
            onStreamTickRef.current?.();
          }
        }
      }
      rafRef.current = requestAnimationFrame(drain);
    };

    streamCallbackRef.current = {
      push: (token) => {
        bufferRef.current += token;
        if (!rafRef.current) {
          lastTickRef.current = 0;
          rafRef.current = requestAnimationFrame(drain);
        }
      },
      flush: () => {
        const full = bufferRef.current;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        displayIdxRef.current = full.length;
        return full;
      },
      getContent: () => bufferRef.current,
    };

    return () => {
      if (streamCallbackRef) streamCallbackRef.current = null;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [isStreaming, streamCallbackRef]);

  useEffect(() => {
    if (isStreaming) {
      setDisplayedText('');
      bufferRef.current = '';
      displayIdxRef.current = 0;
    }
  }, [isStreaming]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Streaming and final share ONE structure so React preserves the block
  // instances when isStreaming flips off — no remount, no re-parse, no flash on
  // completion. Only the tail block re-parses while typing; completed blocks are
  // memoized. The ThinkingLogo still cross-fades out as the first content lands.
  const sourceText = isStreaming ? displayedText : content;
  const blocks = splitMarkdownBlocks(sourceText);
  const hasContent = blocks.length > 0;

  return (
    <div className="relative min-h-[28px]">
      {isStreaming && (
        <div style={{ opacity: hasContent ? 0 : 1, position: hasContent ? 'absolute' : 'relative', transition: 'opacity 0.2s ease-out', pointerEvents: hasContent ? 'none' : 'auto' }}>
          <ThinkingLogo size={40} className="origin-left" />
        </div>
      )}
      {hasContent && (
        <div className="leading-relaxed text-[16px] font-normal font-google">
          {blocks.map((b, i) => (
            <MarkdownBlock key={i} source={b} tail={isStreaming && i === blocks.length - 1} />
          ))}
          {isStreaming && <span className="sapy-stream-cursor" style={{ backgroundColor: themeColor }} />}
        </div>
      )}
    </div>
  );
}

// ── Theme-derived CSS variables ──────────────────────────────────────────────

/**
 * Derive theme-driven CSS variables from the tenant's themeColor so accents
 * (header text, focus rings, loading glow) adapt to ANY brand color and stay
 * readable. rgba is computed in JS rather than CSS color-mix() for universal
 * browser support inside embedded customer pages. Malformed hex falls back to
 * the default brand color, so a bad config can never render a broken accent.
 */
function themeVars(hex: string): Record<string, string> {
  const fallback = '5730F5';
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  let c = match ? match[1] : fallback;
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // perceived brightness
  // User bubble = theme tinted at low opacity over the chat surface, so the text
  // must follow the *blended* bubble lightness (not the raw theme). Luminance is
  // linear in RGB, so blended = A*themeLum + (1-A)*surfaceLum. The surface differs
  // by mode, so we compute a foreground for the light and the dark surface.
  const A_LIGHT = 0.15; // user-bubble tint, light mode
  const A_DARK = 0.20;  // user-bubble tint, dark mode (a touch stronger)
  const fgFor = (alpha: number, surfaceLum: number) => (alpha * lum + (1 - alpha) * surfaceLum > 0.6 ? '#0f172a' : '#ffffff');
  return {
    '--sapy-theme': `#${c}`,                         // focus rings / borders
    '--sapy-theme-fg': lum > 0.6 ? '#0f172a' : '#ffffff', // readable header text
    '--sapy-user-bg': `rgba(${r}, ${g}, ${b}, ${A_LIGHT})`,      // user bubble — softened theme (light)
    '--sapy-user-bg-dark': `rgba(${r}, ${g}, ${b}, ${A_DARK})`, // user bubble — softened theme (dark)
    '--sapy-user-fg': fgFor(A_LIGHT, 0.96),      // bubble text over the light chat surface
    '--sapy-user-fg-dark': fgFor(A_DARK, 0.06),  // bubble text over the dark chat surface
  };
}

// ── Phase 0a: Grade + pack-size selectors ────────────────────────────────────
// Grade: ≤4 options → tap-to-send pill chips (auto-sends immediately).
//        >4 options → dropdown + "Select grade" confirm button (many grades
//        in a chemical catalog, e.g. LR / GC / HPLC & spec / HPLC GG / …).
// Pack:  always a dropdown + "Get quote" button (sizes are ordered as returned
//        by request_quote needs_pack — usually small → large from the catalog).

// Combined grade + pack size picker. Shows both selectors at once so the user
// never has to wait for a second round-trip to see pack options.
// - ≤4 grades → chips (click to select, highlighted); >4 → dropdown
// - Pack sizes come from grade_pack_map keyed by the selected grade
// - Single "Get quote" button submits grade + pack together
function GradePackSelector({ grades, gradePackMap, themeColor, onSelect }: {
  grades: string[];
  gradePackMap: Record<string, string[]>;
  themeColor: string;
  onSelect: (grade: string, pack: string) => void;
}) {
  const [selectedGrade, setSelectedGrade] = useState(grades[0] ?? '');
  const packOptions = gradePackMap[selectedGrade] ?? [];
  const [selectedPack, setSelectedPack] = useState(packOptions[0] ?? '');

  useEffect(() => {
    const packs = gradePackMap[selectedGrade] ?? [];
    setSelectedPack(packs[0] ?? '');
  }, [selectedGrade, gradePackMap]);

  const hasPacks = Object.keys(gradePackMap).length > 0;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {grades.length <= 4 ? (
        <div className="flex flex-wrap gap-2">
          {grades.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => hasPacks ? setSelectedGrade(g) : onSelect(g, '')}
              className="px-3 py-1.5 rounded-full text-[13px] font-google font-semibold border-2 transition-colors"
              style={{
                borderColor: themeColor,
                color: (hasPacks && selectedGrade !== g) ? themeColor : 'white',
                backgroundColor: (!hasPacks || selectedGrade === g) ? themeColor : '',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      ) : (
        <select
          value={selectedGrade}
          onChange={e => setSelectedGrade(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-[13px] font-google font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2"
        >
          {grades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      )}

      {hasPacks ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedPack}
            onChange={e => setSelectedPack(e.target.value)}
            className="flex-1 min-w-0 px-3 py-1.5 rounded-xl text-[13px] font-google font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2"
          >
            {packOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            type="button"
            onClick={() => onSelect(selectedGrade, selectedPack)}
            disabled={!selectedGrade || !selectedPack}
            className="shrink-0 px-4 py-1.5 rounded-full text-[13px] font-google font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: themeColor }}
          >
            Get quote
          </button>
        </div>
      ) : grades.length > 4 ? (
        <button
          type="button"
          onClick={() => onSelect(selectedGrade, '')}
          disabled={!selectedGrade}
          className="self-start px-4 py-1.5 rounded-full text-[13px] font-google font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: themeColor }}
        >
          Select grade
        </button>
      ) : null}
    </div>
  );
}

function PackSizeSelector({ packSizes, themeColor, onSelect }: {
  packSizes: string[];
  themeColor: string;
  onSelect: (pack: string) => void;
}) {
  const [selected, setSelected] = useState(packSizes[0] ?? '');
  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="flex-1 min-w-0 px-3 py-1.5 rounded-xl text-[13px] font-google font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2"
      >
        {packSizes.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button
        type="button"
        onClick={() => onSelect(selected)}
        disabled={!selected}
        className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-google font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: themeColor }}
      >
        Get quote
      </button>
    </div>
  );
}

// ── Structured sample form (Phase 4b) ───────────────────────────────────────
// A pack-driven multi-field intake form. Fields come from config (`sample_form`),
// so it's customizable per client without touching this component. `product` is a
// searchable catalog picker; `grade` a dropdown derived from the chosen product.
// Submitting posts to a deterministic endpoint (no LLM) — see submitSampleForm.

function SampleForm({ schema, products, prefill, themeColor, submitting, error, onSubmit, onCancel }: {
  schema: FormField[];
  products: ProductOption[];
  prefill: Record<string, string>;
  themeColor: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...prefill }));
  const [productQuery, setProductQuery] = useState(prefill.product || '');
  const [showPicker, setShowPicker] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const matches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const seen = new Set<string>();
    const out: ProductOption[] = [];
    for (const p of products) {
      if (q && !(p.name.toLowerCase().includes(q) || (p.cas_number || '').toLowerCase().includes(q))) continue;
      const k = `${p.name.toLowerCase()}|${p.cas_number || ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
      if (out.length >= 30) break;
    }
    return out;
  }, [products, productQuery]);

  const selectedProduct = useMemo(
    () => products.find(p => p.name.toLowerCase() === (values.product || '').toLowerCase()),
    [products, values.product]);
  const grades = selectedProduct?.grades || [];

  const missing = schema.filter(f => f.required && !(values[f.name] || '').trim()).map(f => f.name);

  const pickProduct = (p: ProductOption) => {
    setValues(prev => ({ ...prev, product: p.name, grade: '' }));
    setProductQuery(p.name);
    setShowPicker(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (missing.length) return;
    onSubmit(values);
  };

  const baseInput = "w-full rounded-xl border bg-transparent px-3 py-2 text-[14px] font-google text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const fieldBorder = (name: string, required?: boolean) =>
    touched && required && !(values[name] || '').trim()
      ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-600';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-50/50 dark:bg-slate-950/50">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-slate-800 shrink-0">
        <button type="button" onClick={onCancel} aria-label="Back"
          className="flex items-center gap-1 -ml-1 px-1.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors">
          <MIcon name="arrow_back" className="text-[18px] leading-none" />
        </button>
        <span className="text-[14px] font-google font-semibold text-slate-800 dark:text-slate-100">Request a sample</span>
      </div>

      <form onSubmit={submit} className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-3 scrollbar-thin">
        {/* Honeypot (anti-spam): hidden from humans, only bots auto-fill it. The
            backend drops any submission where `website` is non-empty. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={values.website || ''}
          onChange={(e) => set('website', e.target.value)}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        />
        {schema.map((f) => (
          <label key={f.name} className="flex flex-col gap-1">
            <span className="text-[12px] font-google font-medium text-slate-600 dark:text-slate-300">
              {f.label}{f.required && <span className="text-red-500"> *</span>}
            </span>

            {f.type === 'product' ? (
              <div className="relative">
                <input
                  value={productQuery}
                  onChange={e => { setProductQuery(e.target.value); set('product', e.target.value); setShowPicker(true); }}
                  onFocus={() => setShowPicker(true)}
                  placeholder={f.placeholder || 'Search products…'}
                  className={`${baseInput} ${fieldBorder(f.name, f.required)}`} />
                {showPicker && matches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg scrollbar-thin z-20">
                    {matches.map((p, i) => (
                      <button key={`${p.name}-${p.cas_number || ''}-${i}`} type="button" onClick={() => pickProduct(p)}
                        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="text-[14px] font-google text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-google">{p.cas_number || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : f.type === 'grade' ? (
              grades.length > 0 ? (
                <select value={values.grade || ''} onChange={e => set('grade', e.target.value)}
                  className={`${baseInput} ${fieldBorder(f.name, f.required)}`}>
                  <option value="">{f.placeholder || 'Select a grade'}</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              ) : (
                <input value={values.grade || ''} onChange={e => set('grade', e.target.value)}
                  placeholder={f.placeholder || 'Grade'} className={`${baseInput} ${fieldBorder(f.name, f.required)}`} />
              )
            ) : f.type === 'textarea' ? (
              <textarea value={values[f.name] || ''} onChange={e => set(f.name, e.target.value)} rows={2}
                placeholder={f.placeholder || ''} className={`${baseInput} resize-none ${fieldBorder(f.name, f.required)}`} />
            ) : (
              <input
                type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'number' ? 'number' : 'text'}
                value={values[f.name] || ''} onChange={e => set(f.name, e.target.value)}
                placeholder={f.placeholder || ''} className={`${baseInput} ${fieldBorder(f.name, f.required)}`} />
            )}
          </label>
        ))}

        {error && <p className="text-[12px] font-google text-red-500">{error}</p>}

        <button type="submit" disabled={submitting}
          className="mt-1 w-full rounded-full py-2.5 text-[14px] font-google font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: themeColor }}>
          {submitting ? 'Sending…' : 'Submit request'}
        </button>
      </form>
    </div>
  );
}

// ── ChatWidget ────────────────────────────────────────────────────────────────

type ChatWidgetProps = { apiKey?: string; isEmbed?: boolean };

export default function ChatWidget({ apiKey, isEmbed = false }: ChatWidgetProps) {
  // Resolve API key and base URL (supports both prop and window.SapybaseConfig)
  const activeApiKey = apiKey ?? (typeof window !== 'undefined' ? window.SapybaseConfig?.apiKey : undefined);
  const activeApiUrl = typeof window !== 'undefined'
    ? (window.SapybaseConfig?.apiUrl ?? '')
    : '';

  const DEFAULT_CONFIG: ConfigData = {
    theme_color: (typeof window !== 'undefined' && window.SapybaseConfig?.themeColor) || '#5730F5',
    bot_name: (typeof window !== 'undefined' && window.SapybaseConfig?.botName) || 'Sapy AI',
    logo_url: (typeof window !== 'undefined' && window.SapybaseConfig?.logoUrl) || `${ASSET_BASE}/SB_loading.svg`,
    initial_message: (typeof window !== 'undefined' && window.SapybaseConfig?.welcomeMessage) || "Hi! I'm your AI assistant. How can I help you today?",
    quick_questions: (typeof window !== 'undefined' && window.SapybaseConfig?.quickQuestions) || [],
    logo_shape: (typeof window !== 'undefined' && window.SapybaseConfig?.logoShape) || 'circle',
    custom_logo_url: (typeof window !== 'undefined' && window.SapybaseConfig?.customLogoUrl) || '',
    avatar_bg_style: (typeof window !== 'undefined' && window.SapybaseConfig?.avatarBgStyle) || 'none',
  };

  const [configData, setConfigData] = useState<ConfigData>(DEFAULT_CONFIG);
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return Math.random().toString(36).substring(2, 15);
    const lsKey = activeApiKey ? `sapy_sid_${activeApiKey}` : null;
    if (lsKey) {
      const stored = localStorage.getItem(lsKey);
      if (stored) return stored;
    }
    const newId = window.crypto?.randomUUID?.() ?? Math.random().toString(36).substring(2, 15);
    if (lsKey) localStorage.setItem(lsKey, newId);
    return newId;
  });

  // Phase 1d: stable device-local visitor identity. Unlike sessionId (which rotates
  // per conversation), this persists across "New conversation" so the history list
  // can be scoped to THIS visitor — the server never returns another visitor's
  // sessions. Opaque UUID, no PII; Phase 2 will link it to a captured email.
  const visitorIdRef = useRef<string>('');
  if (typeof window !== 'undefined' && !visitorIdRef.current) {
    const vKey = activeApiKey ? `sapy_vid_${activeApiKey}` : null;
    let vid = vKey ? localStorage.getItem(vKey) : null;
    if (!vid) {
      vid = window.crypto?.randomUUID?.() ?? Math.random().toString(36).substring(2, 15);
      if (vKey) localStorage.setItem(vKey, vid);
    }
    visitorIdRef.current = vid;
  }

  // Widget session token (anti quota-drain). Minted from /api/widget/session and
  // sent as x-Sapybase-session on every /api/chat call. Stored in a ref; lazily
  // re-minted when missing or within 60s of expiry.
  const sessionTokenRef = useRef<{ token: string; exp: number } | null>(null);

  const getSessionToken = useCallback(async (): Promise<string | null> => {
    if (!activeApiKey) return null;
    const cached = sessionTokenRef.current;
    if (cached && cached.exp - Date.now() > 60_000) return cached.token;
    try {
      const parentOrigin = (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin || '';
      const res = await fetch(`${activeApiUrl}/api/widget/session`, {
        method: 'POST',
        headers: {
          'x-api-key': activeApiKey,
          ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
        },
      });
      if (!res.ok) {
        console.warn(`[Sapybase] session token mint failed: ${res.status}`);
        return null; // 503 during soft-launch = not configured; chat still works
      }
      const data = await res.json();
      const ttlMs = (Number(data.expires_in) || 1800) * 1000;
      sessionTokenRef.current = { token: data.token, exp: Date.now() + ttlMs };
      return data.token;
    } catch (err) {
      console.warn('[Sapybase] session token mint error:', err);
      return null;
    }
  }, [activeApiKey, activeApiUrl]);

  useEffect(() => {
    if (activeApiKey) void getSessionToken();
  }, [activeApiKey, getSessionToken]);

  const leadCaptureEnabledRef = useRef(false);
  // A vertical/pack bot (hub cards present) runs its OWN structured capture via
  // agent tools — request_quote's contact step, the sample form, handoff. The
  // generic keyword-heuristic lead form must NOT fire over those flows (it pops
  // mid-quote while the agent is still asking for grade/pack size). Mirror the
  // signal in a ref so the streaming [DONE] handler reads it without stale state.
  const isVerticalBotRef = useRef(false);

  useEffect(() => {
    if (!activeApiKey) return;
    const fetchConfig = async () => {
      try {
        const parentOrigin = (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin || '';
        const res = await fetch(`${activeApiUrl}/api/config`, {
          headers: {
            'x-api-key': activeApiKey,
            ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setConfigData({
            theme_color: data.theme_color || DEFAULT_CONFIG.theme_color,
            bot_name: data.bot_name || DEFAULT_CONFIG.bot_name,
            logo_url: (() => {
              const raw = data.logo_url || DEFAULT_CONFIG.logo_url;
              return raw.startsWith('/') ? `https://www.sapybase.com${raw}` : raw;
            })(),
            initial_message: data.initial_message || DEFAULT_CONFIG.initial_message,
            quick_questions: data.quick_questions || [],
            logo_shape: data.logo_shape || 'circle',
            custom_logo_url: data.custom_logo_url || '',
            avatar_bg_style: data.avatar_bg_style || 'none',
            lead_capture_enabled: data.lead_capture_enabled || false,
            white_label_enabled: data.white_label_enabled === true,
            hub_cards: Array.isArray(data.hub_cards) ? data.hub_cards : [],
            products: Array.isArray(data.products) ? data.products : [],
            sample_form: Array.isArray(data.sample_form) ? data.sample_form : [],
          });
          leadCaptureEnabledRef.current = data.lead_capture_enabled || false;
          // A pack-enabled bot is signalled by `vertical` (most precise) or, as a
          // fallback, the presence of hub cards.
          isVerticalBotRef.current = Boolean(data.vertical)
            || (Array.isArray(data.hub_cards) && data.hub_cards.length > 0);
          // Phase 1d: fetch past sessions for returning visitors on vertical bots.
          if (isVerticalBotRef.current && activeApiKey && visitorIdRef.current) {
            setIsLoadingHistory(true);
            fetch(`${activeApiUrl}/api/sessions?visitor_id=${encodeURIComponent(visitorIdRef.current)}`, {
              headers: {
                'x-api-key': activeApiKey,
                ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
              },
            })
              .then(r => r.ok ? r.json() : null)
              .then(d => {
                if (d?.sessions?.length > 0) {
                  setSessionHistory(d.sessions);
                  setView('history');
                }
              })
              .catch(() => { /* first visit — stay on chat */ })
              .finally(() => setIsLoadingHistory(false));
          }
          setMessages(prev => {
            if (prev.length === 1 && prev[0].role === 'bot') {
              return [{ role: 'bot', content: data.initial_message || DEFAULT_CONFIG.initial_message, ts: Date.now() }];
            }
            return prev;
          });
        } else {
          const errorDetail = await res.text().catch(() => 'Unknown error');
          console.warn(`[Sapybase] Config fetch failed with status ${res.status}:`, errorDetail);
        }
      } catch (err) {
        console.warn('[Sapybase] Could not load bot config:', err);
      } finally {
        if (isEmbed && typeof window !== 'undefined' && window.parent !== window) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              postToParent({ type: 'Sapybase:ready' });
            });
          });
        }
      }
    };
    fetchConfig();
  }, [activeApiKey]);

  const BOT_NAME = configData.bot_name || 'Sapybase';
  const THEME_COLOR = configData.theme_color || '#5730F5';
  const LOGO_URL = configData.custom_logo_url || '';
  const LOGO_SHAPE = configData.logo_shape || 'circle';
  const AVATAR_BG_STYLE = configData.avatar_bg_style || 'none';
  // A vertical pack supplies hub cards → the widget gets the Chat/Home hybrid.
  // Generic (vertical=NULL) bots have none → no nav arrow, no Home, plain chat.
  const hasHub = (configData.hub_cards?.length ?? 0) > 0;
  const themeStyleVars = useMemo(() => themeVars(THEME_COLOR), [THEME_COLOR]);

  const leadCapturedRef = useRef(false);
  const leadFormShownRef = useRef(false);
  const userMessageCountRef = useRef(0);
  const [clearCount, setClearCount] = useState(0);

  const MAX_MESSAGES = 100;
  const appendBounded = (prev: Message[], ...next: Message[]): Message[] => {
    const combined = [...prev, ...next];
    if (combined.length <= MAX_MESSAGES) return combined;
    return [combined[0], ...combined.slice(-(MAX_MESSAGES - 1))];
  };

  const [isOpen, setIsOpen] = useState(isEmbed);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [handoffSent, setHandoffSent] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'bot', content: DEFAULT_CONFIG.initial_message, ts: Date.now() }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Phase 3 hub: the tool card currently expanded into a slot mini-form (null =
  // showing the card strip), and the mini-form's single input value.
  const [activeHubCard, setActiveHubCard] = useState<HubCard | null>(null);
  const [hubInput, setHubInput] = useState('');
  // Phase 4b — the structured sample form. Opened from the "Request a sample" hub
  // card OR when the agent emits a {form} action in chat (free-text intent). One
  // form, two entry points; submitting it POSTs to a deterministic endpoint.
  const [sampleFormOpen, setSampleFormOpen] = useState(false);
  const [sampleFormPrefill, setSampleFormPrefill] = useState<Record<string, string>>({});
  const [sampleSubmitting, setSampleSubmitting] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  // Phase 4 — the "View & share quote" modal opened from a quote card's
  // deterministic button (same pattern as the SDS button: the model never
  // fabricates the link, the widget renders it from the structured payload).
  const [shareQuote, setShareQuote] = useState<Message['quote'] | null>(null);
  const [quoteLinkCopied, setQuoteLinkCopied] = useState(false);
  // Hybrid hub: which screen is showing. A vertical (pack) bot opens on 'home' (the
  // action-card grid + bottom Home/Chat tabs) per the chemical Figma; the header
  // back-arrow returns there from 'chat'. A generic bot has no hub → always 'chat'.
  const [hubView, setHubView] = useState<'chat' | 'home'>('chat');
  // Phase 1d: two-screen widget. 'history' shows past sessions for returning visitors;
  // 'chat' is the normal chat/home experience. First visit (no sessions) skips history.
  const [view, setView] = useState<'history' | 'chat'>('chat');
  const [sessionHistory, setSessionHistory] = useState<SessionRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // Land a vertical bot on Home the first time its config (hub cards) arrives.
  const didInitHubView = useRef(false);
  useEffect(() => {
    if (!didInitHubView.current && hasHub) {
      didInitHubView.current = true;
      setHubView('home');
    }
  }, [hasHub]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // "Mobile" tracks the widget's own Tailwind `sm` breakpoint (the point at
    // which the panel switches from a floating box to fullscreen), driven by
    // matchMedia rather than a hand-rolled innerWidth comparison so it stays in
    // lockstep with the CSS and updates on rotate/resize without a resize storm.
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 639.98px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    // Embedded mode lives in a fixed-size iframe that already provides the
    // correct height. The visualViewport/--sapy-vh hack is only for the
    // real-mobile fullscreen case; running it inside a cross-origin iframe
    // makes Chrome report the PARENT page's viewport height, inflating the
    // panel past the iframe so the message list never overflows (dead wheel).
    if (!isMobile || !isOpen || isEmbed) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const fullHeight = window.innerHeight;
    const sync = () => {
      document.documentElement.style.setProperty('--sapy-vh', `${vv.height}px`);
      // Remove safe-area bottom padding when keyboard is open to avoid gap
      const keyboardOpen = vv.height < fullHeight * 0.8;
      document.documentElement.style.setProperty('--sapy-safe-bottom', keyboardOpen ? '0px' : 'env(safe-area-inset-bottom, 0px)');
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      document.documentElement.style.removeProperty('--sapy-vh');
      document.documentElement.style.removeProperty('--sapy-safe-bottom');
    };
  }, [isMobile, isOpen, isEmbed]);

  useEffect(() => {
    if (isEmbed && !isOpen) {
      postToParent({ type: 'Sapybase:close' });
    }
  }, [isOpen, isEmbed]);

  const [isTabletUp, setIsTabletUp] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsTabletUp(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledUpRef = useRef(false);
  const streamingCallbackRef = useRef<StreamCallbacks | null>(null);
  const animatedMsgIndices = useRef(new Set<number>());
  // "New message ↓" pill: shown when a finished reply extends below the fold.
  // We never auto-scroll during/after streaming — the pill lets the user jump
  // down on their own terms, keeping their reading position stable.
  const [showJumpPill, setShowJumpPill] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (userHasScrolledUpRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const forceScrollToBottom = useCallback((smooth = true) => {
    userHasScrolledUpRef.current = false;
    const el = scrollContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScrollContainer = useCallback(() => {
    const atBottom = isNearBottom();
    userHasScrolledUpRef.current = !atBottom;
    // Reaching the bottom means they've seen the latest — dismiss the pill.
    if (atBottom) setShowJumpPill(false);
  }, [isNearBottom]);


  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') { forceScrollToBottom(true); }
    else if (lastMsg?.role === 'bot' && lastMsg.isStreaming && lastMsg.content === '') { forceScrollToBottom(true); }
    else if (isLoading) { forceScrollToBottom(true); }
    else { scrollToBottom(true); }
  }, [messages.length, isLoading, forceScrollToBottom, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => { forceScrollToBottom(false); inputRef.current?.focus({ preventScroll: true }); }, 10);
    }
  }, [isOpen, forceScrollToBottom]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
  }, [input]);

  // Mobile keyboard: keep the focused field visible. The main composer is
  // already pinned above the keyboard (the panel is sized to the visual
  // viewport), so this only handles fields that live higher up in the thread —
  // hub mini-forms, the lead-capture / handoff forms, and the sample form.
  //
  // The keyboard fires a burst of visualViewport resize events as it animates.
  // Reacting to each one restarts a smooth scroll every frame and makes the
  // thread jitter, so we DEBOUNCE to a single scroll once the viewport has
  // settled, and no-op when the field is already fully visible — that guard is
  // what keeps the common case (field already above the keyboard) perfectly
  // still instead of nudging it on every event.
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    let pending: HTMLElement | null = null;
    let settleTimer: number | undefined;

    const isEditable = (el: EventTarget | null): el is HTMLElement =>
      el instanceof HTMLElement && el.matches('input, textarea, select');

    const isFullyVisible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const vh = window.visualViewport?.height ?? window.innerHeight;
      return r.top >= 8 && r.bottom <= vh - 8;
    };

    const bringIntoView = (el: HTMLElement | null) => {
      if (!el || el === inputRef.current) return;   // composer stays put
      if (isFullyVisible(el)) return;               // already in view → no nudge
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      catch { el.scrollIntoView(); }
    };

    const schedule = () => {
      if (!pending) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => bringIntoView(pending), 150);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target) || e.target === inputRef.current) { pending = null; return; }
      pending = e.target;
      schedule();
    };
    const onFocusOut = () => { pending = null; window.clearTimeout(settleTimer); };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    // Only the visual viewport reflow matters (keyboard show/hide); listening to
    // window 'resize' too would double-fire and re-introduce jitter.
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.clearTimeout(settleTimer);
    };
  }, [isMobile, isOpen]);

  const sendMessage = async (text: string) => {
    const userMessage = text.trim();
    if (!userMessage || isLoading) return;
    setInput('');
    await handleSend(null, userMessage);
  };

  // Phase 3 hub: a "chat" card just focuses the input; a "tool" card expands the
  // slot mini-form. Submitting the form fills {value} into the card's template
  // and sends it — driving the existing agent loop to the card's tool.
  const handleHubCardTap = (card: HubCard) => {
    if (card.action === 'chat') {
      setActiveHubCard(null);
      inputRef.current?.focus();
      return;
    }
    if (card.action === 'form') {
      openSampleForm({});
      return;
    }
    setActiveHubCard(card);
    setHubInput('');
  };

  // Open the structured sample form (from a hub card or an agent {form} action),
  // optionally prefilled with the product/grade the visitor mentioned in chat.
  const openSampleForm = (prefill: Record<string, string>) => {
    setActiveHubCard(null);
    setHubView('chat');
    setSampleError(null);
    setSampleFormPrefill(prefill || {});
    setSampleFormOpen(true);
  };

  // Submit the sample form: POST to the deterministic endpoint (no LLM), then
  // close the form and drop a confirmation card into the chat. Best-effort error
  // surfacing — the endpoint records + notifies; a failure here just asks to retry.
  const submitSampleForm = async (values: Record<string, string>) => {
    if (sampleSubmitting) return;
    setSampleSubmitting(true);
    setSampleError(null);
    try {
      const parentOrigin = (typeof window !== 'undefined' && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const sessionToken = await getSessionToken();
      const idem = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID() : `${sessionId}-${Date.now()}`;
      const res = await fetch(`${activeApiUrl}/api/widget/sample-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeApiKey!,
          ...(parentOrigin ? { 'x-Sapybase-parent-origin': parentOrigin } : {}),
          ...(sessionToken ? { 'x-Sapybase-session': sessionToken } : {}),
        },
        body: JSON.stringify({ fields: values, session_id: sessionId, idempotency_key: idem }),
      });
      if (!res.ok) {
        if (res.status === 422) { setSampleError('Please fill in all required fields.'); }
        else { setSampleError('Something went wrong. Please try again.'); }
        return;
      }
      const data = await res.json().catch(() => ({}));
      setSampleFormOpen(false);
      setSampleFormPrefill({});
      setMessages(prev => [...prev, {
        role: 'bot',
        content: "Thanks! Your sample request is in — our team will be in touch to arrange it.",
        sample: data.confirmation || { product: values.product, grade: values.grade, quantity: values.quantity },
        ts: Date.now(),
      }]);
    } catch {
      setSampleError('Something went wrong. Please try again.');
    } finally {
      setSampleSubmitting(false);
    }
  };

  // Home-screen card tap: jump to the Chat screen, then run the card (opens its
  // mini-form for tool cards, or focuses the input for the "Ask" card).
  const openCardFromHome = (card: HubCard) => {
    setHubView('chat');
    handleHubCardTap(card);
  };

  // Phase 1d: (re)load this visitor's recent sessions. Called on config load and
  // whenever the visitor opens the Conversations screen from the menu, so a just-
  // finished conversation appears instead of a stale snapshot. Scoped to visitor_id.
  const loadSessionHistory = async (): Promise<SessionRow[]> => {
    if (!activeApiKey || !visitorIdRef.current) return [];
    setIsLoadingHistory(true);
    try {
      const parentOriginHist = (typeof window !== 'undefined' && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const res = await fetch(`${activeApiUrl}/api/sessions?visitor_id=${encodeURIComponent(visitorIdRef.current)}`, {
        headers: {
          'x-api-key': activeApiKey,
          ...(parentOriginHist ? { 'x-Sapybase-parent-origin': parentOriginHist } : {}),
        },
      });
      const data = res.ok ? await res.json() : null;
      const rows: SessionRow[] = data?.sessions ?? [];
      setSessionHistory(rows);
      return rows;
    } catch {
      return [];
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Phase 1d: start a fresh session — new UUID, clear messages, persist to localStorage.
  const startNewSession = () => {
    const newId = window.crypto?.randomUUID?.() ?? Math.random().toString(36).substring(2, 15);
    if (activeApiKey) localStorage.setItem(`sapy_sid_${activeApiKey}`, newId);
    setSessionId(newId);
    setMessages([{ role: 'bot', content: configData.initial_message, ts: Date.now() }]);
    userMessageCountRef.current = 0;
    leadCapturedRef.current = false;
    leadFormShownRef.current = false;
    animatedMsgIndices.current.clear();
    setHandoffSent(false);
    setShowMenu(false);
    setView('chat');
    if (hasHub) setHubView('home');
    setClearCount(c => c + 1);
  };

  // Phase 1d: resume a past session — load messages from DB and switch to chat view.
  const resumeSession = async (sid: string) => {
    if (activeApiKey) localStorage.setItem(`sapy_sid_${activeApiKey}`, sid);
    setSessionId(sid);
    setView('chat');
    if (hasHub) setHubView('chat');
    animatedMsgIndices.current.clear();
    // Reset per-conversation gates so the resumed thread doesn't inherit the prior
    // view's lead-capture / handoff state. The fresh greeting shows until rows load.
    userMessageCountRef.current = 0;
    leadFormShownRef.current = false;
    setHandoffSent(false);
    const fresh: Message[] = [{ role: 'bot', content: configData.initial_message, ts: Date.now() }];
    setMessages(fresh);
    try {
      const parentOriginResume = (typeof window !== 'undefined' && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const res = await fetch(`${activeApiUrl}/api/sessions/${encodeURIComponent(sid)}/messages?visitor_id=${encodeURIComponent(visitorIdRef.current)}`, {
        headers: {
          'x-api-key': activeApiKey!,
          ...(parentOriginResume ? { 'x-Sapybase-parent-origin': parentOriginResume } : {}),
        },
      });
      // Non-ok (404 visitor mismatch / 5xx) keeps the fresh greeting — never the
      // previous conversation's stale messages under this session's header.
      if (res.ok) {
        const data = await res.json();
        const loaded: Message[] = (data.messages || []).map((m: { role: string; content: string; ts: string }) => ({
          role: (m.role === 'assistant' ? 'bot' : m.role) as Message['role'],
          content: m.content || '',
          ts: m.ts ? new Date(m.ts).getTime() : Date.now(),
        }));
        if (loaded.length > 0) setMessages(loaded);
      }
    } catch {
      /* network error — keep the fresh greeting already set above */
    }
  };

  const submitHubValue = (value: string) => {
    const card = activeHubCard;
    const v = value.trim();
    if (!card || !v || isLoading) return;
    const message = (card.prompt_template || '{value}').replace('{value}', v);
    setActiveHubCard(null);
    setHubInput('');
    void sendMessage(message);
  };
  const submitHubCard = () => submitHubValue(hubInput);

  // Searchable product picker: filter the pack-supplied catalog by name or CAS as
  // the visitor types. Empty query shows the full list (browse). Capped for perf.
  const hubProductMatches = useMemo(() => {
    if (!activeHubCard || activeHubCard.input_source !== 'products') return [];
    const opts = configData.products || [];
    const q = hubInput.trim().toLowerCase();
    const list = q
      ? opts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.cas_number || '').toLowerCase().includes(q))
      : opts;
    // One row per product — the catalog has a row per grade (same name+CAS), so
    // collapse to distinct products for the picker; the agent collects grade next.
    const seen = new Set<string>();
    const distinct: ProductOption[] = [];
    for (const p of list) {
      const k = `${p.name.toLowerCase()}|${p.cas_number || ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      distinct.push(p);
      if (distinct.length >= 50) break;
    }
    return distinct;
  }, [activeHubCard, hubInput, configData.products]);

  const handleSend = async (e: React.FormEvent | null, overrideText?: string) => {
    if (e) e.preventDefault();
    if (!overrideText && !input.trim()) return;
    const userMessage = overrideText || input.trim();
    userMessageCountRef.current += 1;
    const now = Date.now();
    setMessages(prev => appendBounded(prev,
      { role: 'user', content: userMessage, ts: now },
      { role: 'bot', content: '', isStreaming: true, ts: now },
    ));
    setInput('');
    setIsLoading(true);
    userHasScrolledUpRef.current = false;
    setShowJumpPill(false);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    const resolvedApiKey = activeApiKey;
    if (!resolvedApiKey) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'bot' && last.isStreaming) {
          updated[updated.length - 1] = { role: 'bot', content: 'Configure your API Key locally to start chatting with Sapy AI!', isStreaming: false };
        }
        return updated;
      });
      setIsLoading(false);
      return;
    }
    // Phase 0d: widened from 4 → 8 as a bridge until Phase 1 session store is live.
    // State notes appended to bot messages so the model carries structured context
    // (resolved product/grade/quote) across turns without re-deriving.
    const recentHistory = messages
      .filter(m => (m.role === 'user' || m.role === 'bot') && typeof m.content === 'string')
      .slice(-8)
      .map(m => {
        let content = m.content!;
        if (m.role === 'bot') {
          if (m.quote) {
            // Kept in lockstep with services/session_store.quote_state_note (backend) —
            // same '[State: ...]' shape either way, so the directive's "restate an
            // unchanged repeat ask" instruction recognizes it regardless of whether
            // this turn came from the client fallback or a resumed server session.
            const q = m.quote;
            const parts = [q.product, q.grade, q.pack_size].filter(Boolean).join(' ');
            const qtyNote = q.quantity != null ? ` × ${q.quantity}` : '';
            if (q.status === 'quoted' && q.unit_price != null) {
              const subtotalNote = q.subtotal != null ? `, subtotal ${q.currency ?? 'INR'} ${q.subtotal}` : '';
              content += `\n[State: ${parts}${qtyNote} quoted at ${q.currency ?? 'INR'} ${q.unit_price} each${subtotalNote}]`;
            } else if (q.status === 'price_on_request') {
              content += `\n[State: ${parts}${qtyNote} — price on request, contact captured]`;
            }
          }
          if (m.sds) {
            content += `\n[State: SDS provided for ${m.sds.product ?? 'product'}]`;
          }
          if (m.sample) {
            const sp = [m.sample.product, m.sample.grade].filter(Boolean).join(' ');
            content += `\n[State: sample requested for ${sp}]`;
          }
        }
        return { role: m.role, content };
      });
    let firstChunkReceived = false;
    let sseRetryCount = 0;
    // Structured "Open SDS" action emitted by the agent stream (a {sds:{...}}
    // event); captured here and attached to the bot message on [DONE].
    let pendingSds: Message['sds'] | null = null;
    // Structured quote card emitted by the agent stream (a {quote:{...}} event);
    // captured here and attached to the bot message on [DONE], like pendingSds.
    let pendingQuote: Message['quote'] | null = null;
    // "Open the sample form" action (a {form:{...}} event); captured here and acted
    // on at [DONE] so the form opens right after the bot's text reply lands.
    let pendingForm: { form_id: string; prefill: Record<string, string> } | null = null;
    // Phase 0a: grade/pack selectors emitted by the agent when request_quote
    // returns needs_grade / needs_pack. Attached to the bot message at [DONE].
    let pendingGradeSelector: Message['grade_selector'] | null = null;
    let pendingPackSelector: Message['pack_selector'] | null = null;
    const SSE_MAX_RETRIES = 1;
    try {
      const parentOriginChat = (typeof window !== 'undefined' && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const sessionToken = await getSessionToken();
      await fetchEventSource(`${activeApiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': resolvedApiKey,
          ...(parentOriginChat ? { 'x-Sapybase-parent-origin': parentOriginChat } : {}),
          ...(sessionToken ? { 'x-Sapybase-session': sessionToken } : {}),
        },
        body: JSON.stringify({ message: userMessage, history: recentHistory, session_id: sessionId, visitor_id: visitorIdRef.current }),
        signal: ctrl.signal,
        openWhenHidden: true,
        async onopen(response) {
          if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'bot' && last.isStreaming) {
                updated[updated.length - 1] = { ...last, content: data.reply, isStreaming: false };
              } else {
                updated.push({ role: 'bot', content: data.reply, ts: Date.now() });
              }
              return updated;
            });
            setIsLoading(false);
            throw new Error('CACHE_HIT');
          }
          if (!response.ok) {
            if (response.status === 401) {
              sessionTokenRef.current = null; // force re-mint on next send
            }
            if (response.status === 402) {
              let detail = null;
              try { detail = await response.json(); } catch { /* noop */ }
              const isMessageLimit = (detail as { detail?: { code?: string } })?.detail?.code === 'MESSAGE_LIMIT_EXCEEDED';
              const errorContent = isMessageLimit
                ? `I've reached my monthly message limit. Please contact the site owner to upgrade their plan at [Sapybase.com](https://www.sapybase.com). I'll be back next billing cycle! 🚀`
                : "I'm temporarily unavailable. Please try again later.";
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'bot' && last.isStreaming) {
                  updated[updated.length - 1] = { role: 'bot', content: errorContent, isStreaming: false };
                } else {
                  updated.push({ role: 'bot', content: errorContent });
                }
                return updated;
              });
              setIsLoading(false);
              throw new Error('HANDLED_ERROR');
            }
            if (response.status === 429) {
              let retryAfter = 60;
              try {
                const headerVal = response.headers.get('Retry-After');
                if (headerVal && /^\d+$/.test(headerVal)) retryAfter = parseInt(headerVal, 10);
                else {
                  const detail = await response.json();
                  const ra = (detail as { detail?: { retry_after?: number } })?.detail?.retry_after;
                  if (typeof ra === 'number') retryAfter = ra;
                }
              } catch { /* keep default */ }
              const waitLabel = retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} minute${retryAfter >= 120 ? 's' : ''}` : `${retryAfter} seconds`;
              const errorContent = `You're sending messages a bit fast! Please wait ${waitLabel} and try again.`;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'bot' && last.isStreaming) {
                  updated[updated.length - 1] = { role: 'bot', content: errorContent, isStreaming: false };
                } else {
                  updated.push({ role: 'bot', content: errorContent });
                }
                return updated;
              });
              setIsLoading(false);
              throw new Error('HANDLED_ERROR');
            }
            throw new Error(`Server error: ${response.status}`);
          }
        },
        onmessage(msg) {
          if (msg.data === '[DONE]') {
            const fullContent = streamingCallbackRef.current?.flush?.() || '';
            streamingCallbackRef.current = null;
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'bot') {
                updated[updated.length - 1] = { ...last, content: fullContent, isStreaming: false, ...(pendingSds ? { sds: pendingSds } : {}), ...(pendingQuote ? { quote: pendingQuote } : {}), ...(pendingGradeSelector ? { grade_selector: pendingGradeSelector } : {}), ...(pendingPackSelector ? { pack_selector: pendingPackSelector } : {}) };
              }
              return updated;
            });
            setIsLoading(false);
            // Free-text sample intent → open the structured form (prefilled), the
            // same form the hub card opens. After the reply so it reads naturally.
            if (pendingForm) openSampleForm(pendingForm.prefill);
            // Never move the viewport on completion — keep the user exactly where
            // they are for reading continuity. If the finished answer extends below
            // the fold, surface the "new message" pill so they can jump down when
            // they choose. Deferred a frame so isNearBottom reads the FINAL height
            // (the message just jumped from typed-out text to full content).
            requestAnimationFrame(() => { if (!isNearBottom()) setShowJumpPill(true); });
            if (leadCaptureEnabledRef.current && !leadCapturedRef.current && !leadFormShownRef.current && !isVerticalBotRef.current) {
              const lowerReply = fullContent.toLowerCase();
              const lowerUserMsg = userMessage.toLowerCase();
              const userBuyingIntent = ['quote', 'pricing', 'how much', 'cost', 'buy', 'purchase', 'hire', 'sign up', 'get started', 'book a', 'schedule', 'free trial', 'demo', 'subscribe'];
              const userHumanIntent = ['talk to a human', 'speak to someone', 'speak to a person', 'real person', 'contact you', 'contact us', 'reach out', 'get in touch', 'help me', 'i need help', 'support team', 'sales team'];
              const fallbackPhrases = ['does not appear in my knowledge base', "don't have information on that", 'please reach out to', 'contact our support', "i'm not sure", 'i do not have'];
              const isUserBuying = userBuyingIntent.some(w => lowerUserMsg.includes(w));
              const isUserAskingForHuman = userHumanIntent.some(w => lowerUserMsg.includes(w));
              const isFallback = fallbackPhrases.some(w => lowerReply.includes(w));
              if (isUserBuying || isUserAskingForHuman || isFallback) {
                leadFormShownRef.current = true;
                setTimeout(() => {
                  setMessages(prev => {
                    if (prev.some(m => m.role === 'lead_capture')) return prev;
                    return [...prev, { role: 'lead_capture', id: 'lead-form' }];
                  });
                  setTimeout(() => forceScrollToBottom(true), 100);
                }, 1500);
              }
            }
            return;
          }
          let chunk = '';
          try {
            const parsed = JSON.parse(msg.data);
            // Structured side-channel: the agent emits {sds:{url,...}} so the
            // widget renders a deterministic "Open SDS" button (no raw link).
            if (parsed.sds && typeof parsed.sds.url === 'string') {
              pendingSds = { url: parsed.sds.url, product: parsed.sds.product, label: parsed.sds.label };
              return;
            }
            // Structured side-channel: the agent emits {quote:{...}} with the
            // deterministic figures so the widget renders a quote card (no
            // model-typed numbers).
            if (parsed.quote && (parsed.quote.status === 'quoted' || parsed.quote.status === 'price_on_request')) {
              pendingQuote = parsed.quote;
              return;
            }
            // Structured side-channel: the agent emits {form:{form_id,prefill}} to
            // open the structured sample form (free-text intent → same form as the
            // hub card). Acted on at [DONE], after the bot's text reply.
            if (parsed.form && typeof parsed.form.form_id === 'string') {
              pendingForm = { form_id: parsed.form.form_id, prefill: parsed.form.prefill || {} };
              return;
            }
            // Phase 0a: grade/pack selector side-channels from request_quote.
            if (parsed.grade_selector && Array.isArray(parsed.grade_selector.grades)) {
              pendingGradeSelector = parsed.grade_selector as Message['grade_selector'];
              return;
            }
            if (parsed.pack_selector && Array.isArray(parsed.pack_selector.pack_sizes)) {
              pendingPackSelector = parsed.pack_selector as Message['pack_selector'];
              return;
            }
            chunk = parsed.token || parsed.content || parsed.text || '';
          } catch {
            chunk = msg.data;
          }
          if (!chunk) return;
          if (!firstChunkReceived) { firstChunkReceived = true; setIsLoading(false); }
          streamingCallbackRef.current?.push?.(chunk);
        },
        onerror(err: Error) {
          if (err.message === 'CACHE_HIT' || err.message === 'HANDLED_ERROR') throw err;
          if (err.name === 'AbortError') throw err;
          if (sseRetryCount < SSE_MAX_RETRIES) {
            sseRetryCount += 1;
            streamingCallbackRef.current = null;
            return 1500;
          }
          const partial = streamingCallbackRef.current?.flush?.() || '';
          streamingCallbackRef.current = null;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const fallback = "I'm having trouble connecting to the Sapybase servers right now. Please try again later or use the contact form.";
            const content = partial.trim() ? partial + '\n\n_(Connection lost — message may be incomplete.)_' : fallback;
            if (last?.role === 'bot' && last.isStreaming) {
              updated[updated.length - 1] = { role: 'bot', content, isStreaming: false };
            } else {
              updated.push({ role: 'bot', content });
            }
            return updated;
          });
          setIsLoading(false);
          throw err;
        },
        onclose() { setIsLoading(false); },
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'CACHE_HIT' || err.message === 'HANDLED_ERROR')) return;
      setIsLoading(false);
    }
  };

  const handleHandoff = () => {
    setShowMenu(false);
    if (handoffSent) return;
    setMessages(prev => [
      ...prev,
      { role: 'bot', content: "I'll connect you with our team! Share your email so they can reply to you directly. 👇", ts: Date.now() },
      { role: 'handoff_form', id: 'handoff-form' },
    ]);
  };

  const submitHandoff = async (visitorEmail: string, visitorName: string) => {
    setHandoffSent(true);
    const transcript = messages.filter(m => m.role === 'user' || m.role === 'bot').map(m => ({ role: m.role, content: m.content || '' }));
    try {
      const parentOriginHandoff = (typeof window !== 'undefined' && (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin) || '';
      const res = await fetch(`${activeApiUrl}/api/handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeApiKey!,
          ...(parentOriginHandoff ? { 'x-Sapybase-parent-origin': parentOriginHandoff } : {}),
        },
        body: JSON.stringify({ transcript, visitor_email: visitorEmail, visitor_name: visitorName || null }),
      });
      const data = res.ok ? await res.json() : {};
      setMessages(prev => prev.map(m =>
        m.id === 'handoff-form' ? { role: 'handoff_confirmed', visitorEmail, redirectUrl: data.handoff_redirect_url, id: 'handoff-confirmed' } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === 'handoff-form' ? { role: 'bot', content: 'Something went wrong. Please try again.', ts: Date.now() } : m
      ));
      setHandoffSent(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) handleSend(null);
    }
  };

  if (!activeApiKey) return null;

  const fabShape = FAB_SHAPES[LOGO_SHAPE] || FAB_SHAPES.circle;
  const FAB_PATH = fabShape.path;
  const fabBg = resolveAvatarBg(AVATAR_BG_STYLE);
  const fabGradient = fabBg.kind === 'gradient' ? fabBg.colors : null;
  const fabSolid = fabBg.kind === 'solid' ? fabBg.color : null;

  return (
    <div className={`sapy-chat-root ${isEmbed ? 'relative w-full h-full' : 'fixed bottom-0 right-0 sm:bottom-6 sm:right-6'} z-2147483647 font-sans pointer-events-none`}
      style={{
        '--font-sans': 'var(--font-inter), "Inter", sans-serif',
        '--font-google': 'var(--font-inter), "Inter", sans-serif',
        fontFamily: 'var(--font-inter), "Inter", sans-serif',
        isolation: 'isolate',
        width: isOpen ? '100%' : 'auto',
        height: isOpen ? '100%' : 'auto'
      } as React.CSSProperties}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.8, y: 20, transformOrigin: 'bottom right' }, visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 25 } }, exit: { opacity: 0, scale: 0.8, y: 20, transition: { duration: 0.2 } } }}
            initial={isEmbed ? "visible" : "hidden"} animate="visible" exit="exit"
            className={`${isEmbed ? `relative w-full h-full ${hasHub ? 'bg-gray-50 dark:bg-slate-950 bg-gradient-to-b from-[var(--sapy-theme)]/[0.12] via-[var(--sapy-theme)]/[0.03] to-transparent' : 'bg-white dark:bg-slate-900'}` : `fixed inset-0 sm:inset-auto sm:bottom-22 sm:right-4 w-full h-dvh ${isExpanded ? 'sm:w-[500px] sm:h-[85vh] lg:w-[600px]' : 'sm:w-[450px] sm:h-[650px]'} transition-all duration-300 ease-out backdrop-blur-2xl ${hasHub ? 'bg-gray-50/95 dark:bg-slate-950/95 bg-gradient-to-b from-[var(--sapy-theme)]/[0.12] via-[var(--sapy-theme)]/[0.03] to-transparent' : 'bg-white/95 dark:bg-slate-900/95'}`} sm:rounded-2xl shadow-lg shadow-blue-900/20 dark:shadow-black/40 flex flex-col sm:overflow-hidden z-2147483640 pointer-events-auto origin-bottom-right`}
            style={{ ...themeStyleVars, ...(isEmbed ? { height: '100%' } : isMobile ? { height: 'var(--sapy-vh, 100dvh)' } : {}) } as React.CSSProperties}
          >
            {/* Header sits on transparent bg for hub bots so the single gradient
                painted on the panel root shows through seamlessly behind the nav. */}
            <div className={`relative shrink-0 ${hasHub ? 'bg-transparent' : 'bg-gray-50/50 dark:bg-slate-950/50'}`}>
              <div className="text-slate-900 dark:text-slate-100 p-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-2 flex justify-end items-center relative">
                <div className="relative flex flex-row justify-between items-center w-full" ref={menuRef}>
                  <div className="relative flex items-center gap-2 pl-1">
                    {hasHub && hubView === 'chat' && view === 'chat' && (
                      // Top-nav back arrow → Home screen (only for vertical bots in chat view).
                      <button onClick={() => { setActiveHubCard(null); setHubView('home'); }}
                        style={{ WebkitTapHighlightColor: 'transparent', outlineColor: THEME_COLOR }}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Go to home">
                        <MIcon name="arrow_back" className="text-[22px] leading-none text-slate-500 dark:text-slate-400" />
                      </button>
                    )}
                    <div className="relative">
                      {/* In-chat profile avatar is ALWAYS a circle with no shadow so any
                          custom logo sits seamlessly. The selected shape applies to the
                          FAB floating icon only — never here. */}
                      <BotAvatar
                        shapeId="circle"
                        logoUrl={LOGO_URL}
                        botName={BOT_NAME}
                        themeColor={THEME_COLOR}
                        sizeClass="w-10 h-10 rounded-full"
                        hasShadow={false}
                        isCustom={!!configData.custom_logo_url}
                        bgStyle={AVATAR_BG_STYLE}
                        transparentBgImage={true}
                      />
                    </div>
                    <div className="flex items-center pl-1">
                      <p className="text-[15px] font-google font-medium text-slate-900 dark:text-slate-100 leading-none">{BOT_NAME}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* The ⋮ menu acts on a conversation (clear chat / handoff) — hide
                        it on the Home screen and history screen where there's nothing to act on; ✕ stays. */}
                    {hubView !== 'home' && view === 'chat' && (
                      <button onClick={() => setShowMenu(!showMenu)}
                        style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', outlineColor: THEME_COLOR }}
                        className="p-2.5 sm:p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Chat menu">
                        <MIcon name="more_horiz" className="text-[28px] leading-none text-slate-500 dark:text-slate-400" />
                      </button>
                    )}
                    <button onClick={() => {
                      const nextExpanded = !isExpanded;
                      setIsExpanded(nextExpanded);
                      if (isEmbed) postToParent({ type: 'Sapybase:expand', expanded: nextExpanded });
                    }}
                      style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', outlineColor: THEME_COLOR }}
                      className="flex p-2.5 sm:p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 min-w-[44px] min-h-[44px] items-center justify-center" aria-label={isExpanded ? 'Minimize chat' : 'Expand chat'}>
                      <ExpandIcon size={20} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" />
                    </button>
                    <button onClick={() => { if (isEmbed) { postToParent({ type: 'Sapybase:close' }); } else { setIsOpen(false); setIsExpanded(false); } }}
                      style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none', outlineColor: THEME_COLOR }}
                      className="p-2.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors group focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close chat">
                      <CrossIcon size={28} className="text-slate-400 dark:text-slate-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 backdrop-blur-md rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-1 z-[2147483647] overflow-hidden">
                        {configData.lead_capture_enabled && (
                          <button onClick={handleHandoff} disabled={handoffSent}
                            className="w-full text-left px-4 py-2.5 text-base font-normal font-google text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-700 flex items-center justify-between disabled:opacity-50">
                            {handoffSent ? 'Team notified ✓' : 'Talk to a human'}
                            <ConnectIcon size={20} />
                          </button>
                        )}
                        {sessionHistory.length > 0 && (
                          <button onClick={() => { setView('history'); setShowMenu(false); loadSessionHistory(); }}
                            className="w-full text-left px-4 py-2.5 text-base font-normal font-google text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                            Conversations <ForumIcon size={20} />
                          </button>
                        )}
                        <button onClick={startNewSession}
                          className="w-full text-left px-4 py-2.5 text-base font-normal font-google text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                          {hasHub ? 'New chat' : 'Clear chat'}
                          {hasHub ? <PlusIcon size={20} /> : <MIcon name="refresh" className="text-[20px]" />}
                        </button>
                        <a href="https://www.sapybase.com" target="_blank" rel="noopener noreferrer"
                          className="w-full text-left px-4 py-2.5 text-base font-normal font-google text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between group"
                          onClick={() => setShowMenu(false)}>
                          Add to your site
                          <ExternalLinkIcon size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Phase 1d — session history screen (returning visitors on vertical bots) */}
            {view === 'history' && (
              <div className={`flex-1 flex flex-col min-h-0 text-slate-900 dark:text-slate-100 ${hasHub ? 'bg-transparent' : 'bg-gray-50/50 dark:bg-slate-950/50'}`}>
                <div className="px-4 pt-4 pb-2 shrink-0">
                  <p className="text-[11px] font-google font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Recent conversations
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500 text-sm font-google">
                      Loading…
                    </div>
                  ) : (
                    sessionHistory.map(sess => (
                      <button key={sess.session_id} type="button" onClick={() => resumeSession(sess.session_id)}
                        className="w-full text-left px-4 py-3.5 border-b border-gray-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 transition-colors flex flex-col gap-0.5">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[14px] font-google font-semibold text-slate-800 dark:text-slate-100 truncate leading-snug">
                            {sess.title || 'Conversation'}
                          </span>
                          <span className="text-[11px] font-google text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                            {sess.last_active_at ? formatRelativeDate(sess.last_active_at) : ''}
                          </span>
                        </div>
                        {sess.preview && (
                          <span className="text-[12px] font-google text-slate-500 dark:text-slate-400 truncate">
                            {sess.preview}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
                <div className="shrink-0 p-4 border-t border-gray-100 dark:border-slate-800">
                  <button type="button" onClick={startNewSession}
                    className="w-full py-2.5 rounded-full text-[14px] font-google font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                    style={{ backgroundColor: THEME_COLOR }}>
                    <PlusIcon size={18} className="leading-none" />
                    New conversation
                  </button>
                </div>
              </div>
            )}

            {view === 'chat' && hubView === 'chat' && !sampleFormOpen && (
              <div className={`flex-1 relative flex flex-col min-h-0 text-slate-900 dark:text-slate-100 ${hasHub ? 'bg-transparent' : 'bg-gray-50/50 dark:bg-slate-950/50'}`}>
                {showJumpPill && (
                  <button
                    type="button"
                    onClick={() => { forceScrollToBottom(true); setShowJumpPill(false); }}
                    aria-label="Scroll to latest message"
                    className="sapy-msg-in absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-lg shadow-black/10 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-colors cursor-pointer">
                    <MIcon name="arrow_downward" className="text-[18px]" />
                  </button>
                )}
                <div ref={scrollContainerRef} onScroll={handleScrollContainer}
                  className="flex-1 min-h-0 px-4 sm:px-5 overflow-y-auto overscroll-contain touch-pan-y flex flex-col gap-5 pt-6 pb-2 relative [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 28px), transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 28px), transparent)' }}>
                  {/* Centered readable column (Claude/Gemini): a no-op at the narrow
                    popup, but centers the thread whenever the embed is rendered wide. */}
                  <div className="flex flex-col gap-5 w-full max-w-3xl mx-auto">
                    {hasHub && messages.length === 1 ? (
                      // Chat empty-state (chemical Figma): a centered prompt instead of
                      // the greeting bubble. Cards/pills below drive the first action.
                      <div className="flex flex-col items-center justify-center text-center min-h-[40vh] px-6">
                        <p className="text-[17px] font-google font-medium text-slate-500 dark:text-slate-400 leading-snug">
                          {configData.initial_message || 'What are you exploring today?'}
                        </p>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {messages.map((msg, idx) => {
                          const isNew = !animatedMsgIndices.current.has(idx);
                          if (isNew) animatedMsgIndices.current.add(idx);
                          const metaTime = msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
                          const metaLabel = msg.role === 'bot' ? (metaTime ? `Agent · ${metaTime}` : 'Agent') : metaTime;
                          return (
                            <motion.div key={`${clearCount}-${idx}`} layout={msg.isStreaming ? false : 'position'}
                              initial={isNew ? { opacity: 0, y: 10, scale: 0.95 } : false}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              className={`flex min-w-0 ${msg.role === 'lead_capture' || msg.role === 'handoff_form' || msg.role === 'handoff_confirmed' || msg.role === 'lead_confirmed' ? 'w-full' : `${msg.role === 'bot' ? 'max-w-full' : 'max-w-[90%]'} ${msg.role === 'user' ? 'self-end text-left' : 'self-start text-left'}`}`}>
                              {msg.role === 'handoff_form' ? (
                                <HandoffContactForm themeColor={THEME_COLOR} onSubmit={submitHandoff}
                                  onDismiss={() => setMessages(prev => prev.filter(m => m.id !== 'handoff-form'))} />
                              ) : msg.role === 'handoff_confirmed' ? (
                                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm w-full self-start text-left mt-2 space-y-3">
                                  <p className="text-sm font-google font-bold text-emerald-600 dark:text-emerald-400 text-center">✅ Team notified!</p>
                                  <p className="text-xs font-google text-slate-500 dark:text-slate-400 text-center">
                                    {msg.visitorEmail ? <><b className="text-slate-700 dark:text-slate-300">Our team will reply to {msg.visitorEmail} shortly.</b></> : 'Our team has been notified and will follow up shortly.'}
                                  </p>
                                  {msg.redirectUrl && (
                                    <a href={msg.redirectUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-2 w-full py-2 rounded-full text-sm font-google font-bold text-white transition-opacity hover:opacity-90"
                                      style={{ backgroundColor: THEME_COLOR }}>
                                      Connect instantly <MIcon name="open_in_new" className="text-[16px]" />
                                    </a>
                                  )}
                                </div>
                              ) : msg.role === 'lead_confirmed' ? (
                                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm w-full self-start text-left mt-2 space-y-3">
                                  <p className="text-sm font-google font-bold text-emerald-600 dark:text-emerald-400 text-center">🎉 Got it!</p>
                                  <p className="text-xs font-google text-slate-500 dark:text-slate-400 text-center">
                                    {msg.content || 'We’ve received your details and will be in touch shortly.'}
                                  </p>
                                  <p className="text-xs font-google text-slate-600 dark:text-slate-300 text-center font-semibold">
                                    Want to talk sooner? Book a time that works for you:
                                  </p>
                                  {msg.bookingUrl && (
                                    <a href={msg.bookingUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-2 w-full py-2 rounded-full text-sm font-google font-bold text-white transition-opacity hover:opacity-90"
                                      style={{ backgroundColor: THEME_COLOR }}>
                                      <MIcon name="calendar_month" className="text-[16px]" /> Book a call
                                    </a>
                                  )}
                                </div>
                              ) : msg.role === 'lead_capture' ? (
                                <LeadCaptureForm themeColor={THEME_COLOR} activeApiUrl={activeApiUrl} apiKey={activeApiKey ?? ''}
                                  contextString={messages.slice(Math.max(0, idx - 4), idx).filter(m => m.role === 'user').map(m => m.content).join(' || ')}
                                  onSubmit={(name, bookingUrl) => {
                                    leadCapturedRef.current = true;
                                    const thanks = `Thanks${name ? ' ' + name : ''}! We've received your details and our team will be in touch shortly. 🎉`;
                                    setMessages(prev => prev.map(m => m.id === 'lead-form'
                                      ? (bookingUrl
                                        ? { role: 'lead_confirmed', content: thanks, bookingUrl, id: 'lead-confirmed' }
                                        : { role: 'bot', content: thanks, ts: Date.now() })
                                      : m));
                                  }}
                                  onDismiss={() => { leadCapturedRef.current = true; setMessages(prev => prev.filter(m => m.id !== 'lead-form')); }} />
                              ) : (
                                <div className={`flex flex-col max-w-full min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                  <div className={`${msg.role === 'user' ? 'px-4 py-2.5' : 'px-1 py-0.5'} ${msg.role === 'bot' && msg.isStreaming && isLoading ? '!bg-transparent !p-1' : ''} ${msg.role === 'user' ? 'w-fit max-w-full self-end' : 'w-full max-w-full self-start'} ${msg.role === 'user' ? 'rounded-[20px] bg-[var(--sapy-user-bg)] dark:bg-[var(--sapy-user-bg-dark)] text-[var(--sapy-user-fg)] dark:text-[var(--sapy-user-fg-dark)]' : 'text-gray-800 dark:text-slate-200 overflow-hidden prose prose-compact dark:prose-invert max-w-none prose-p:leading-normal prose-p:break-words prose-pre:bg-gray-50 dark:prose-pre:bg-slate-900 prose-pre:text-gray-800 dark:prose-pre:text-slate-200 prose-pre:text-sm prose-code:text-sm prose-pre:max-w-full prose-pre:overflow-x-auto prose-table:block prose-table:overflow-x-auto prose-headings:text-gray-900 dark:prose-headings:text-slate-100 prose-strong:text-gray-900 dark:prose-strong:text-slate-100 prose-ul:my-1 prose-li:my-0 prose-p:font-normal prose-img:max-w-full prose-img:rounded-lg'}`}>
                                    {msg.role === 'user' ? (
                                      <div className="max-w-full whitespace-pre-wrap break-words [word-break:break-word] text-[16px] font-normal font-google leading-relaxed">{msg.content}</div>
                                    ) : (
                                      <div className="min-w-0 max-w-full text-[16px] font-google leading-relaxed">
                                        <MessageContent content={msg.content ?? ''} isStreaming={msg.isStreaming} themeColor={THEME_COLOR} streamCallbackRef={msg.isStreaming ? streamingCallbackRef : undefined} />
                                      </div>
                                    )}
                                  </div>
                                  {msg.role === 'bot' && !msg.isStreaming && msg.sds?.url && (
                                    // Deterministic SDS action — the agent never pastes
                                    // the raw link; this button carries the real sheet.
                                    <a href={msg.sds.url} target="_blank" rel="noopener noreferrer"
                                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-google font-bold text-white transition-opacity hover:opacity-90"
                                      style={{ backgroundColor: THEME_COLOR }}>
                                      <MIcon name="description" className="text-[18px] leading-none" />
                                      {msg.sds.label || 'Open SDS'}
                                      <MIcon name="arrow_outward" className="text-[16px] leading-none" />
                                    </a>
                                  )}
                                  {msg.role === 'bot' && !msg.isStreaming && msg.quote && (
                                    // Deterministic quote card — the agent describes but
                                    // never re-derives these figures. GST is shown as
                                    // "extra"; a POR quote shows a "requested" confirmation.
                                    <div className="mt-2 w-full max-w-[280px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                                      <div className="flex items-center gap-2 px-3 py-2 text-white text-[12px] font-google font-bold" style={{ backgroundColor: THEME_COLOR }}>
                                        <MIcon name="receipt_long" className="text-[16px] leading-none" />
                                        {msg.quote.status === 'quoted' ? 'Quote' : 'Quote requested'}
                                      </div>
                                      <div className="px-3 py-2.5 text-[13px] font-google text-slate-700 dark:text-slate-200 leading-relaxed">
                                        <div className="font-bold">{msg.quote.product}</div>
                                        <div className="text-[12px] text-slate-500 dark:text-slate-400">
                                          {[msg.quote.grade, msg.quote.pack_size].filter(Boolean).join(' · ')}
                                        </div>
                                        {msg.quote.status === 'quoted' ? (
                                          <>
                                            <div className="mt-2 flex justify-between"><span>Unit price</span><span>{fmtINR(msg.quote.unit_price, msg.quote.currency)}</span></div>
                                            <div className="flex justify-between"><span>Quantity</span><span>× {msg.quote.quantity}</span></div>
                                            <div className="mt-1 pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold"><span>Subtotal</span><span>{fmtINR(msg.quote.subtotal, msg.quote.currency)}</span></div>
                                            <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{msg.quote.gst_note || 'GST extra as applicable'} · subject to confirmation</div>
                                          </>
                                        ) : (
                                          <div className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">This pack is priced on request — our team will get back to you with a price.</div>
                                        )}
                                        {msg.quote.captured_contact && (msg.quote.captured_contact.email || msg.quote.captured_contact.phone) && (
                                          // Phase 2.5: echo the contact the agent parsed from
                                          // chat so the visitor can catch a mis-read before the
                                          // team follows up.
                                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                            <MIcon name="mark_email_read" className="text-[14px] leading-none mt-px shrink-0" />
                                            <span>
                                              We'll reach you at{' '}
                                              <span className="font-medium text-slate-600 dark:text-slate-300">
                                                {msg.quote.captured_contact.email || msg.quote.captured_contact.phone}
                                              </span>
                                              . Not right? Just send the correct one.
                                            </span>
                                          </div>
                                        )}
                                        {msg.quote.quote_url && (
                                          // Phase 4: deterministic "View & share quote" action — same
                                          // pattern as the SDS button (the model only mentions this
                                          // exists, the URL always comes from the structured payload).
                                          <button
                                            type="button"
                                            onClick={() => setShareQuote(msg.quote!)}
                                            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-google font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                            style={{ borderColor: THEME_COLOR, color: THEME_COLOR }}
                                          >
                                            <MIcon name="arrow_outward" className="text-[14px] leading-none" />
                                            View & share quote
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {msg.role === 'bot' && !msg.isStreaming && msg.sample && (
                                    // Sample-request confirmation card — the team follows
                                    // up; no price, no delivery promise (those are the
                                    // owner's to confirm).
                                    <div className="mt-2 w-full max-w-[280px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                                      <div className="flex items-center gap-2 px-3 py-2 text-white text-[12px] font-google font-bold" style={{ backgroundColor: THEME_COLOR }}>
                                        <MIcon name="package_2" className="text-[16px] leading-none" />
                                        Sample requested
                                      </div>
                                      <div className="px-3 py-2.5 text-[13px] font-google text-slate-700 dark:text-slate-200 leading-relaxed">
                                        <div className="font-bold">{msg.sample.product}</div>
                                        <div className="text-[12px] text-slate-500 dark:text-slate-400">
                                          {[msg.sample.grade, msg.sample.packaging, msg.sample.quantity ? `× ${msg.sample.quantity}` : null].filter(Boolean).join(' · ')}
                                        </div>
                                        <div className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">Our team will be in touch to arrange your sample.</div>
                                      </div>
                                    </div>
                                  )}
                                  {/* Phase 0a: combined grade + pack selector. Shows both in one UI
                                      so the user never needs a second round-trip. Grade chips for
                                      ≤4 options (click = highlight), dropdown for more; pack sizes
                                      update live from grade_pack_map. Only on the latest bot message. */}
                                  {msg.role === 'bot' && !msg.isStreaming && msg.grade_selector && msg.grade_selector.grades.length > 0 && idx === messages.length - 1 && (
                                    <GradePackSelector
                                      grades={msg.grade_selector.grades}
                                      gradePackMap={msg.grade_selector.grade_pack_map ?? {}}
                                      themeColor={THEME_COLOR}
                                      onSelect={(grade, pack) => handleSend(null, pack ? `${grade}, ${pack}` : grade)}
                                    />
                                  )}
                                  {/* Phase 0a: pack-size dropdown + confirm — only on the latest bot message. */}
                                  {msg.role === 'bot' && !msg.isStreaming && msg.pack_selector && msg.pack_selector.pack_sizes.length > 0 && idx === messages.length - 1 && (
                                    <PackSizeSelector
                                      packSizes={msg.pack_selector.pack_sizes}
                                      themeColor={THEME_COLOR}
                                      onSelect={pack => handleSend(null, pack)}
                                    />
                                  )}
                                  {metaLabel && !msg.isStreaming && <span suppressHydrationWarning className="text-[11px] font-google text-slate-400 dark:text-slate-500 mt-1 px-1 leading-none">{metaLabel}</span>}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                  <div ref={messagesEndRef} className="h-5 shrink-0" aria-hidden="true" />
                </div>
              </div>
            )}

            {view === 'chat' && hubView === 'chat' && sampleFormOpen && (
              <SampleForm
                schema={configData.sample_form ?? []}
                products={configData.products ?? []}
                prefill={sampleFormPrefill}
                themeColor={THEME_COLOR}
                submitting={sampleSubmitting}
                error={sampleError}
                onSubmit={submitSampleForm}
                onCancel={() => { setSampleFormOpen(false); setSampleError(null); }}
              />
            )}

            {view === 'chat' && hubView === 'home' && hasHub && (
              // Home screen — 2-col action grid + pill Home/Chat nav + Vaayu footer
              // (chemical Figma). Background is transparent: the gradient is painted
              // once on the panel root so it's seamless across header/home/chat/history.
              <div className="flex-1 min-h-0 flex flex-col bg-transparent">
                <div className="flex-1 overflow-y-auto px-3 pt-6 pb-3 flex flex-col [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <p className="text-[19px] font-google font-semibold text-slate-900 dark:text-slate-100 px-1 mb-4 leading-snug">How can we help you today?</p>
                  {/* 2-col action grid (chemical Figma). An odd last card spans both
                      columns so 3 / 5 cards never leave an empty cell. */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {(configData.hub_cards ?? []).map((card, i, arr) => {
                      const oddLast = arr.length % 2 === 1 && i === arr.length - 1;
                      return (
                        <button key={card.id} type="button" onClick={() => openCardFromHome(card)} aria-label={card.label}
                          className={`${oddLast ? 'col-span-2' : ''} flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-5 transition-colors hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/40`}>
                          <MIcon name={HUB_ICON[card.icon] || 'bolt'} className="text-[26px] leading-none text-[var(--sapy-theme)]" />
                          <span className="text-[13.5px] font-google font-medium text-slate-800 dark:text-slate-100 leading-tight break-words">{card.label}</span>
                          {card.subtitle && <span className="text-[11.5px] font-google text-slate-500 dark:text-slate-400 leading-snug break-words">{card.subtitle}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Pill-shaped Home/Chat segmented nav (active = inner white pill) */}
                <div className="shrink-0 flex flex-col items-center px-3 pt-2" style={{ paddingBottom: isMobile ? 'var(--sapy-safe-bottom, env(safe-area-inset-bottom, 6px))' : 'env(safe-area-inset-bottom, 6px)' }}>
                  <div className="inline-flex items-center gap-1.5 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                    <button type="button" onClick={() => setHubView('home')} aria-label="Home" aria-pressed="true"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-slate-950 text-[var(--sapy-theme)] shadow-sm text-[14.5px] font-google font-semibold">
                      <MIcon name="home" className="text-[19px] leading-none" />
                      Home
                    </button>
                    <button type="button" onClick={() => setHubView('chat')} aria-label="Chat" aria-pressed="false"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-slate-500 dark:text-slate-400 text-[14.5px] font-google font-semibold hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                      <MIcon name="chat_bubble" className="text-[19px] leading-none" />
                      Chat
                    </button>
                  </div>
                  {!configData.white_label_enabled && (
                    <a href="https://www.sapybase.com" target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 mt-2.5 mb-2 text-[10px] font-sans font-normal tracking-wide text-slate-600 dark:text-slate-300">
                      <Image src={BrandLogo} alt="Vaayu" width={18} height={12} className="opacity-100" />
                      Vaayu Intelligence
                    </a>
                  )}
                </div>
              </div>
            )}

            {view === 'chat' && hubView === 'chat' && !sampleFormOpen && (
              <div className={`shrink-0 z-10 flex flex-col ${hasHub ? 'bg-transparent' : 'bg-gray-50/50 dark:bg-slate-950/50'}`}>
                {hasHub && (activeHubCard || (messages.length === 1 && !input.trim())) ? (
                  // Phase 3 — pack-driven hub. Card strip on a fresh conversation;
                  // a tool card (here or from Home) swaps in its slot mini-form,
                  // which may open mid-conversation when launched from the Home tab.
                  <div className="px-4 sm:px-5 pb-1 pt-2.5 w-full max-w-3xl mx-auto">
                    {activeHubCard ? (
                      <div className="flex flex-col gap-2">
                        {/* Back sits at the top so the visitor can return to asking;
                          below it is the single required field (no duplicate input). */}
                        <button type="button" onClick={() => setActiveHubCard(null)} aria-label="Back to options"
                          className="flex items-center gap-1 self-start -ml-1 px-1.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors">
                          <MIcon name="arrow_back" className="text-[18px] leading-none" />
                          <span className="text-[13px] font-medium font-google">Back</span>
                        </button>
                        <div className="relative">
                          {activeHubCard.input_source === 'products' && hubProductMatches.length > 0 && (
                            // Drop-UP (input sits near the bottom): the searchable catalog.
                            <div className="absolute bottom-full left-0 right-0 mb-1.5 max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg scrollbar-thin z-20">
                              {hubProductMatches.map((p, i) => (
                                <button key={`${p.name}-${p.cas_number || ''}-${i}`} type="button" onClick={() => submitHubValue(p.name)}
                                  className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                  <span className="text-[14px] font-google text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-google">{p.cas_number || p.grade || ''}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <form onSubmit={(e) => { e.preventDefault(); submitHubCard(); }}
                            className="relative flex items-center gap-1.5 rounded-full bg-transparent border border-slate-300 dark:border-slate-600 pl-3.5 pr-1.5 py-1.5 transition-colors focus-within:border-blue-500 focus-within:ring-[0.3px] focus-within:ring-blue-500">
                            {activeHubCard.input_source === 'products' && (
                              <MIcon name="search" className="text-[18px] leading-none text-slate-400 dark:text-slate-500 shrink-0" />
                            )}
                            <input value={hubInput} onChange={e => setHubInput(e.target.value)} autoFocus
                              placeholder={activeHubCard.input_label || 'Type your answer'}
                              aria-label={activeHubCard.input_label || activeHubCard.label}
                              className="flex-1 min-w-0 bg-transparent focus:outline-none text-[15px] font-google text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500" />
                            <button type="submit" disabled={!hubInput.trim() || isLoading} aria-label="Submit"
                              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 transition-colors disabled:cursor-not-allowed ${hubInput.trim() && !isLoading ? 'text-blue-900 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>
                              <MIcon name="arrow_upward" className="text-[20px] leading-none" />
                            </button>
                          </form>
                        </div>
                      </div>
                    ) : (
                      // Chat empty-state shortcuts: the hub actions as stacked pills
                      // (chemical Figma). The full card grid lives on the Home screen;
                      // here they're quick entries for someone already in chat.
                      <div className="flex flex-col items-start gap-2">
                        {configData.hub_cards!.map((card) => (
                          <button key={card.id} type="button" onClick={() => handleHubCardTap(card)} aria-label={card.label}
                            className="px-4 py-2.5 min-h-[40px] rounded-full text-[14px] font-normal font-google transition-all max-w-full text-left break-words bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 shadow-sm hover:text-[var(--sapy-theme)] dark:hover:text-[var(--sapy-theme)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow">
                            {card.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : messages.length === 1 && !input.trim() && (configData.quick_questions?.length ?? 0) > 0 ? (
                  <div className="flex flex-col items-start gap-2 px-4 sm:px-5 pb-1 pt-2.5 w-full max-w-3xl mx-auto">
                    {configData.quick_questions.map((q, qidx) => {
                      const label = typeof q === 'string' ? q : (q.label || q.prompt || '');
                      if (!label) return null;
                      return (
                        <button key={qidx} onClick={() => sendMessage(label)}
                          className="px-4 py-2.5 min-h-[40px] rounded-full text-[14px] font-normal font-google transition-all max-w-full text-left break-words bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 shadow-sm hover:text-[var(--sapy-theme)] dark:hover:text-[var(--sapy-theme)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow">
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="px-4 sm:px-5 pt-2 w-full max-w-3xl mx-auto" style={{ paddingBottom: isMobile ? 'var(--sapy-safe-bottom, env(safe-area-inset-bottom, 8px))' : 'env(safe-area-inset-bottom, 8px)' }}>
                  {/* Hide the main chat input while a hub mini-form is open — the
                    card's own field is the only input required; the Back button
                    above returns the visitor here to free-ask. */}
                  {!activeHubCard && (
                    <form onSubmit={handleSend} className="relative flex items-center gap-1.5 rounded-[24px] bg-transparent border border-slate-300 dark:border-slate-600 pl-4 pr-1.5 py-1.5 transition-colors focus-within:border-blue-500 focus-within:ring-[0.3px] focus-within:ring-blue-500">
                      <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="Ask anything"
                        className="flex-1 max-h-32 min-h-[28px] bg-transparent resize-none py-[6px] focus:outline-none leading-relaxed text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 appearance-none rounded-none text-[15px] font-google [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        rows={1} disabled={isLoading} aria-label="Chat input" />
                      <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message"
                        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 transition-colors disabled:cursor-not-allowed ${input.trim() && !isLoading ? 'text-blue-900 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 22V3M20 11L12 3L4 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </form>
                  )}
                  {!configData.white_label_enabled && (
                    <div className="flex items-center justify-center py-3">
                      <a href="https://www.sapybase.com" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-sans font-normal tracking-wide text-slate-600 dark:text-slate-300">
                        <Image src={BrandLogo} alt="Vaayu" width={18} height={12} className="opacity-100" />
                        Vaayu Intelligence
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isEmbed && (
        <div className={`fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-2147483646 pointer-events-auto ${isOpen ? 'hidden sm:block' : 'block'}`}>
          <div className="relative flex items-center justify-end">
            <FabButton
              fabPath={FAB_PATH}
              fabGradient={fabGradient}
              fabSolid={fabSolid}
              logoUrl={LOGO_URL}
              botName={BOT_NAME}
              themeColor={THEME_COLOR}
              isCustomLogo={!!configData.custom_logo_url}
              fabShapeX={fabShape.x || 0}
              fabShapeY={fabShape.y || 0}
              isOpen={isOpen}
              onClick={() => setIsOpen(prev => !prev)}
            />
          </div>
        </div>
      )}

      {shareQuote && (
        // Phase 4: the quote card's "View & share quote" modal — a read-only
        // recap of the same structured figures plus a copy-link action. The URL
        // itself only ever comes from the {quote:{...}} payload, never typed here.
        <div
          className="fixed inset-0 z-2147483647 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 pointer-events-auto"
          role="dialog" aria-modal="true" aria-label="Share quote"
          onClick={() => { setShareQuote(null); setQuoteLinkCopied(false); }}
        >
          <div
            className="w-full max-w-[320px] rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: THEME_COLOR }}>
              <div className="flex items-center gap-2 text-[13px] font-google font-bold">
                <MIcon name="receipt_long" className="text-[16px] leading-none" />
                {shareQuote.status === 'quoted' ? 'Quote' : 'Quote requested'}
              </div>
              <button
                type="button"
                onClick={() => { setShareQuote(null); setQuoteLinkCopied(false); }}
                aria-label="Close"
                className="text-white/80 hover:text-white transition-colors"
              >
                <CrossIcon size={18} />
              </button>
            </div>

            <div className="px-4 py-3.5 text-[13px] font-google text-slate-700 dark:text-slate-200 leading-relaxed">
              <div className="font-bold">{shareQuote.product}</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400">
                {[shareQuote.grade, shareQuote.pack_size].filter(Boolean).join(' · ')}
              </div>
              {shareQuote.status === 'quoted' ? (
                <>
                  <div className="mt-2 flex justify-between"><span>Unit price</span><span>{fmtINR(shareQuote.unit_price, shareQuote.currency)}</span></div>
                  <div className="flex justify-between"><span>Quantity</span><span>× {shareQuote.quantity}</span></div>
                  <div className="mt-1 pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold"><span>Subtotal</span><span>{fmtINR(shareQuote.subtotal, shareQuote.currency)}</span></div>
                  <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{shareQuote.gst_note || 'GST extra as applicable'} · subject to confirmation</div>
                </>
              ) : (
                <div className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">This pack is priced on request — our team will get back to you with a price.</div>
              )}

              {shareQuote.quote_url && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = shareQuote.quote_url!;
                      const markCopied = () => {
                        setQuoteLinkCopied(true);
                        setTimeout(() => setQuoteLinkCopied(false), 2000);
                      };
                      navigator.clipboard.writeText(url).then(markCopied).catch(() => {
                        // The widget is often embedded in a third-party iframe without
                        // clipboard-write permission delegated, so the Clipboard API can
                        // reject — fall back to the classic execCommand copy rather than
                        // leaving an unhandled rejection and a dead button.
                        const ta = document.createElement('textarea');
                        ta.value = url;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.select();
                        try { document.execCommand('copy'); } catch { /* give up silently */ }
                        document.body.removeChild(ta);
                        markCopied();
                      });
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full text-[12px] font-bold text-white px-3 py-1.5 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: THEME_COLOR }}
                  >
                    <MIcon name="content_copy" className="text-[13px] leading-none" />
                    {quoteLinkCopied ? 'Copied!' : 'Copy link'}
                  </button>
                  <a
                    href={shareQuote.quote_url}
                    target="_blank" rel="noopener noreferrer"
                    aria-label="Open quote in a new tab"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 w-8 h-8 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shrink-0"
                  >
                    <MIcon name="arrow_outward" className="text-[14px] leading-none" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
