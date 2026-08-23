import { ART } from '../artTheme';

// Generated from the Figma export "Chat_Image". Text is live <text>, so it
// renders in the page's Plus Jakarta Sans and stays sharp at every resolution.
// The export sits at the origin at its own 385x458 size; the translate re-homes
// it in the 723x542 frame the gradient is cut to, at the same spot the identical
// panel occupies in CustomToolShowcaseArt so the two blocks line up.
export default function ChatShowcaseArt() {
  return (
    <svg
      viewBox="0 0 723 542"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="font-google absolute inset-0 h-full w-full"
    ><g transform="translate(169 84)"><path className={ART.panel} fill="#fff" fillOpacity=".5" d="M0 34C0 15.222 15.222 0 34 0h317c18.778 0 34 15.222 34 34v424H0z"/><text xmlSpace="preserve" className={ART.textMuted} fill="#6c6c6c" fontSize="10" letterSpacing="0em" style={{ whiteSpace: 'pre' }}><tspan x="26" y="247.169">Agent  5:54 pm</tspan></text><text xmlSpace="preserve" className={ART.textMuted} fill="#6c6c6c" fontSize="10" letterSpacing="0em" style={{ whiteSpace: 'pre' }}><tspan x="26" y="431.944">Agent  5:57 pm</tspan></text><rect width="276" height="61.592" x="86" y="21.508" className={ART.surface} fill="#fff" fillOpacity=".7" rx="19"/><rect width="239" height="50.837" x="123" y="249.299" className={ART.surface} fill="#fff" fillOpacity=".7" rx="19"/><text xmlSpace="preserve" className={ART.textPrimary} fill="#000" fontSize="12" letterSpacing="0em" style={{ whiteSpace: 'pre' }}><tspan x="98" y="43.681">Hi! Do you have any open availability for a </tspan><tspan x="98" y="58.681">consult call this Saturday afternoon, and how </tspan><tspan x="98" y="73.68">much does the strategy session cost?</tspan></text><text xmlSpace="preserve" className={ART.textPrimary} fill="#000" fontSize="12" letterSpacing="0em" style={{ whiteSpace: 'pre' }}><tspan x="26" y="111.16">Hello! Yes, we have two slots open this Saturday: 2:00 PM </tspan><tspan x="26" y="128.16">and 4:30 PM EST.
</tspan><tspan x="26" y="145.16">
</tspan><tspan x="26" y="162.16">The 60-minute strategy consult is $150, which includes a </tspan><tspan x="26" y="179.16">complete workflow audit and custom AI implementation </tspan><tspan x="26" y="196.16">roadmap.
</tspan><tspan x="26" y="213.16">
</tspan><tspan x="26" y="230.16">Would you like me to lock in the 2:00 PM slot for you now?</tspan></text><text xmlSpace="preserve" className={ART.textPrimary} fill="#000" fontSize="12" letterSpacing="0em" style={{ whiteSpace: 'pre' }}><tspan x="140" y="272.449">Yes, please reserve 2:00 PM for me! </tspan><tspan x="140" y="287.449">Also, what is your cancellation policy?</tspan></text><text xmlSpace="preserve" className={ART.textPrimary} fill="#000" fontSize="12" letterSpacing="0em" style={{ whiteSpace: 'pre' }}><tspan x="26" y="337.018">Done! I&apos;ve reserved Saturday at 2:00 PM EST for you. I&apos;ve </tspan><tspan x="26" y="356.018">sent the calendar invite and confirmation link to your email.
</tspan><tspan x="26" y="375.018">
</tspan><tspan x="26" y="394.018">Per our Services FAQ: You can reschedule or cancel for a full </tspan><tspan x="26" y="413.018">refund up to 24 hours prior to the session.</tspan></text></g></svg>
  );
}
