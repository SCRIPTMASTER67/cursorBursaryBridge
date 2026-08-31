/**
 * Hero artwork.
 *
 * The reference design pairs the headline with a student photograph and three
 * floating status cards. No licensed photography ships with the prototype, so
 * the portrait is drawn as a flat SVG illustration in the same composition —
 * purple blob behind, figure holding study books in the foreground — and the
 * floating cards are real DOM so they stay crisp and readable at every size.
 */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <svg
        viewBox="0 0 520 470"
        className="w-full"
        role="img"
        aria-label="Illustration of a student holding study books"
      >
        <defs>
          <linearGradient id="bb-blob" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#EFEAFD" />
            <stop offset="100%" stopColor="#D9CFFB" />
          </linearGradient>
          <clipPath id="bb-body">
            {/* Torso silhouette — everything painted on the body is clipped to it. */}
            <path d="M260 248c58 0 97 34 109 85l13 76c5 26-14 47-40 47H178c-26 0-45-21-40-47l13-76c12-51 51-85 109-85Z" />
          </clipPath>
        </defs>

        {/* Soft brand blob */}
        <circle cx="266" cy="222" r="196" fill="url(#bb-blob)" />

        {/* Neck */}
        <path d="M236 214h48v56h-48z" fill="#B4784F" />
        <path d="M236 214h48v30a24 24 0 0 1-48 0Z" fill="#9C6540" />

        {/* Torso */}
        <path d="M260 248c58 0 97 34 109 85l13 76c5 26-14 47-40 47H178c-26 0-45-21-40-47l13-76c12-51 51-85 109-85Z" fill="#F5B841" />
        <g clipPath="url(#bb-body)">
          {/* Soft shading down the left of the top */}
          <path d="M132 248h74l-18 210h-74Z" fill="#E2A52E" opacity="0.45" />
          {/* Backpack straps */}
          <path d="M222 250 210 456" stroke="#4A22BC" strokeWidth="15" strokeLinecap="round" />
          <path d="M298 250 310 456" stroke="#4A22BC" strokeWidth="15" strokeLinecap="round" />
        </g>

        {/* Head */}
        <ellipse cx="260" cy="160" rx="60" ry="66" fill="#C68A62" />
        {/* Hair */}
        <path
          d="M260 82c40 0 66 27 66 62 0 12-3 21-7 27-3-27-25-38-59-38s-56 11-59 38c-4-6-7-15-7-27 0-35 26-62 66-62Z"
          fill="#2E1C12"
        />
        <ellipse cx="260" cy="104" rx="66" ry="34" fill="#2E1C12" />
        {/* Ears */}
        <ellipse cx="200" cy="166" rx="9" ry="13" fill="#B4784F" />
        <ellipse cx="320" cy="166" rx="9" ry="13" fill="#B4784F" />
        {/* Brows, eyes, smile */}
        <path
          d="M232 148c5-5 15-5 20 0M268 148c5-5 15-5 20 0"
          stroke="#3A2415"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="242" cy="166" rx="5" ry="6" fill="#2E1C12" />
        <ellipse cx="278" cy="166" rx="5" ry="6" fill="#2E1C12" />
        <path
          d="M244 192c9 8 23 8 32 0"
          stroke="#7A4A2C"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Stack of books held at the waist */}
        <g transform="rotate(-4 260 386)">
          <rect x="168" y="352" width="184" height="26" rx="6" fill="#5B2EDB" />
          <rect x="176" y="358" width="8" height="14" rx="2" fill="#BCA9F7" opacity="0.7" />
          <rect x="168" y="380" width="184" height="26" rx="6" fill="#FFFFFF" stroke="#D9CFFB" strokeWidth="2" />
          <rect x="176" y="386" width="8" height="14" rx="2" fill="#D9CFFB" />
          <rect x="168" y="408" width="184" height="26" rx="6" fill="#8055EA" />
          <rect x="176" y="414" width="8" height="14" rx="2" fill="#EBE6FD" opacity="0.7" />
        </g>

        {/* Arms wrapping the books */}
        <path
          d="M168 300c-22 26-26 58-14 84"
          stroke="#C68A62"
          strokeWidth="26"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M352 300c22 26 26 58 14 84"
          stroke="#C68A62"
          strokeWidth="26"
          strokeLinecap="round"
          fill="none"
        />
        {/* Hands resting on the stack */}
        <ellipse cx="166" cy="392" rx="19" ry="15" fill="#C68A62" transform="rotate(-12 166 392)" />
        <ellipse cx="354" cy="392" rx="19" ry="15" fill="#C68A62" transform="rotate(12 354 392)" />
      </svg>

      {/* Floating status cards, mirroring the reference layout. */}
      <div className="absolute -right-1 top-4 w-[166px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:-right-4">
        <p className="text-[11px] font-medium text-ink-400">Matched for you</p>
        <div className="mt-1 flex items-end justify-between">
          <span className="text-2xl font-bold leading-none text-ink">24</span>
          <svg viewBox="0 0 48 22" className="h-5 w-12 text-success-600" fill="none" aria-hidden="true">
            <path
              d="M2 18 12 10l8 5 10-11 16 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-400">Opportunities</p>
      </div>

      <div className="absolute right-2 top-[168px] w-[140px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:right-0">
        <p className="text-[11px] font-medium text-ink-400">Next deadline</p>
        <p className="mt-1 text-xl font-bold leading-none text-brand-600">5 days</p>
        <p className="mt-1 text-[11px] text-ink-400">Left to apply</p>
      </div>

      <div className="absolute -left-3 bottom-8 w-[176px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:-left-10 lg:-left-16">
        <p className="text-[11px] font-medium text-ink-400">Profile strength</p>
        <p className="mt-1 text-xl font-bold leading-none text-ink">85%</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full w-[85%] rounded-full bg-success-600" />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-400">Almost there!</p>
      </div>
    </div>
  );
}
