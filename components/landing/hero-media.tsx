import Image from 'next/image';

/**
 * The hero photograph.
 *
 * Served through `next/image`, which is doing real work here rather than
 * decoration: it emits an AVIF/WebP `srcset` so a phone downloads a phone-sized
 * file, reserves the space from the aspect ratio so the page cannot jump when
 * the photo arrives, and holds a blurred twenty-pixel placeholder in the
 * meantime. It is the largest contentful paint on the page, so it is marked
 * `priority` — everything below the fold is left to load lazily by default.
 *
 * The cards float over the photograph as real DOM rather than being baked into
 * it, so they stay sharp at any density, translate, and can carry a number
 * counted from the database.
 */
export function HeroMedia({ openCount }: { openCount: number }) {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="overflow-hidden rounded-panel shadow-float">
        <Image
          src="/images/hero-student.webp"
          alt="A student holding a laptop, looking out over a South African city at sunrise"
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 80vw, 560px"
          placeholder="blur"
          blurDataURL="data:image/webp;base64,UklGRpIAAABXRUJQVlA4IIYAAABQBACdASoUAA0APt1cpkyopSOiMAgBEBuJagCdMoR3ACn0zZwuspkz5o2UAP7vw2zgM3kxGbyf+BJyPzFUe9pX74hO8TL8c2iL9PauUutwb3Lrr9Boi4Wnl1FtMHpcejEsYtQQoOmpiztaNIppEIsGDL72fcgiDxJLIUejWTxG+NN3fAAAAA=="
          className="h-auto w-full object-cover"
        />
      </div>

      {/* Floating cards, in the reference's composition.
       *
       * The reference fills these with numbers — "24 Opportunities", "85%
       * profile strength", "5 days left". Two of the three cannot be true of a
       * visitor who has no account yet, and the third would be invented. So one
       * card carries a real figure counted from the directory at request time,
       * and the others describe what the product does without asserting
       * anything we cannot show. */}
      <div className="absolute -right-2 top-5 w-[176px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:-right-5">
        <p className="text-[11px] font-medium text-ink-400">Open right now</p>
        <div className="mt-1 flex items-end justify-between">
          <span className="text-2xl font-bold leading-none text-ink">{openCount}</span>
          <svg
            viewBox="0 0 48 22"
            className="h-5 w-12 text-brand-500"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 18 12 10l8 5 10-11 16 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mt-0.5 text-[11px] leading-4 text-ink-400">
          {openCount === 1 ? 'bursary accepting applications' : 'bursaries accepting applications'}
        </p>
      </div>

      {/* The two descriptive cards are hidden on a phone: at 390px they cover
          most of the photograph, and the card that carries a real number is
          the one worth keeping. */}
      <div className="absolute -left-3 bottom-20 hidden w-[186px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:-left-8 sm:block lg:-left-14">
        <p className="text-[11px] font-medium text-ink-400">One profile</p>
        <p className="mt-1 text-[13px] font-bold leading-tight text-ink">Many applications</p>
        <p className="mt-1.5 text-[11px] leading-4 text-ink-400">
          Fill your details in once, reuse them everywhere.
        </p>
      </div>

      <div className="absolute -right-1 bottom-6 hidden w-[158px] rounded-card border border-line bg-white p-3.5 shadow-elevated sm:-right-4 sm:block">
        <p className="text-[11px] font-medium text-ink-400">Deadline reminders</p>
        <p className="mt-1 text-[13px] font-bold leading-tight text-brand-600">
          Before applications close
        </p>
      </div>
    </div>
  );
}
