/**
 * Hero artwork.
 *
 * The reference design pairs the headline with a student photograph and three
 * floating status cards. No licensed photography ships with the prototype, so
 * the portrait is drawn as an SVG in the same composition — purple blob behind,
 * figure in the foreground — and the floating cards are real DOM so they stay
 * crisp and readable at every breakpoint.
 */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <svg viewBox="0 0 520 460" className="w-full" role="img" aria-label="A student holding study books">
        <defs>
          <linearGradient id="blob" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#EBE6FD" />
            <stop offset="100%" stopColor="#D9CFFB" />
          </linearGradient>
          <clipPath id="figureClip">
            <path d="M120 460c0-96 42-158 140-158s140 62 140 158Z" />
          </clipPath>
        </defs>

        {/* Soft brand blob behind the figure */}
        <path
          d="M266 26c92 0 168 60 176 148 8 88-40 158-104 200-64 42-158 60-214 20C68 354 38 276 46 190 54 104 118 26 266 26Z"
          fill="url(#blob)"
        />

        {/* Figure */}
        <g>
          <ellipse cx="260" cy="132" rx="60" ry="62" fill="#3F2A1F" />
          <path d="M206 130c0-38 24-66 54-66s54 28 54 66c0 6-4 8-8 6-14-8-30-12-46-12s-32 4-46 12c-4 2-8 0-8-6Z" fill="#2B1A12" />
          <path d="M232 176h56v40h-56z" fill="#B07A54" />
          <ellipse cx="260" cy="146" rx="44" ry="50" fill="#C68A62" />
          <path d="M238 152c3-3 8-3 11 0M271 152c3-3 8-3 11 0" stroke="#5B3D2A" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M248 170c7 6 17 6 24 0" stroke="#5B3D2A" strokeWidth="3" strokeLinecap="round" fill="none" />

          <g clipPath="url(#figureClip)">
            <path d="M120 460c0-96 42-158 140-158s140 62 140 158Z" fill="#F5B841" />
            <path d="M260 302c-24 0-44 4-60 12v146h120V314c-16-8-36-12-60-12Z" fill="#EFA92B" opacity="0.55" />
          </g>

          {/* Books held across the chest */}
          <g transform="rotate(-6 260 372)">
            <rect x="176" y="344" width="168" height="26" rx="5" fill="#5B2EDB" />
            <rect x="182" y="370" width="156" height="24" rx="5" fill="#FFFFFF" stroke="#D9CFFB" strokeWidth="2" />
            <rect x="188" y="394" width="144" height="22" rx="5" fill="#8055EA" />
          </g>

          {/* Arms */}
          <path d="M166 330c-10 30-8 62 8 90" stroke="#C68A62" strokeWidth="22" strokeLinecap="round" fill="none" />
          <path d="M354 330c10 30 8 62-8 90" stroke="#C68A62" strokeWidth="22" strokeLinecap="round" fill="none" />

          {/* Backpack strap */}
          <path d="M216 232c-4 40-4 80 0 120" stroke="#4A22BC" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.85" />
        </g>
      </svg>

      {/* Floating status cards, mirroring the reference layout */}
      <div className="absolute -right-2 top-6 w-[168px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:right-0">
        <p className="text-[11px] font-medium text-ink-400">Matched for you</p>
        <div className="mt-1 flex items-end justify-between">
          <span className="text-2xl font-bold leading-none text-ink">24</span>
          <svg viewBox="0 0 48 22" className="h-5 w-12 text-success-600" fill="none" aria-hidden="true">
            <path d="M2 18 12 10l8 5 10-11 16 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-400">Opportunities</p>
      </div>

      <div className="absolute right-2 top-[172px] w-[142px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:right-6">
        <p className="text-[11px] font-medium text-ink-400">Next deadline</p>
        <p className="mt-1 text-xl font-bold leading-none text-brand-600">5 days</p>
        <p className="mt-1 text-[11px] text-ink-400">Left to apply</p>
      </div>

      <div className="absolute -left-1 bottom-10 w-[188px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:left-2">
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
