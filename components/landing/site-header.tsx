'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { ChevronDown, Menu, X } from '@/components/icons';
import { cn } from '@/lib/utils';

const navigation = [
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Opportunities', href: '/#opportunities' },
  { label: 'For Organisations', href: '/#for-organisations' },
  { label: 'About Us', href: '/#about' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-shell items-center justify-between gap-6 px-5 sm:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium text-ink-600 transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <span className="flex cursor-default items-center gap-1 text-[13px] font-medium text-ink-600">
            Resources
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </nav>

        <div className="hidden items-center gap-2.5 sm:flex">
          <ButtonLink href="/login" variant="outline" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href="/register" size="sm">
            Sign up
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="rounded-md p-2 text-ink sm:hidden"
        >
          {open ? <Menu className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-navigation" className="border-t border-line bg-white px-5 py-4 sm:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-btn px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-surface-subtle"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid gap-2">
            <ButtonLink href="/login" variant="outline" fullWidth>
              Log in
            </ButtonLink>
            <ButtonLink href="/register" fullWidth>
              Sign up
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const columns = [
    {
      title: 'Students',
      links: [
        { label: 'Find Opportunities', href: '/register/student' },
        { label: 'How It Works', href: '/#how-it-works' },
        { label: 'Create Profile', href: '/register/student' },
        { label: 'Student Resources', href: '/#about' },
        { label: 'FAQ', href: '/#about' },
      ],
    },
    {
      title: 'Organisations',
      links: [
        { label: 'Post a Programme', href: '/register/organisation' },
        { label: 'How It Works', href: '/#for-organisations' },
        { label: 'Our Impact', href: '/#about' },
        { label: 'Resources', href: '/#about' },
        { label: 'FAQ', href: '/#about' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '/#about' },
        { label: 'Contact Us', href: '/#about' },
        { label: 'Careers', href: '/#about' },
        { label: 'Blog', href: '/#about' },
        { label: 'Press', href: '/#about' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Terms of Service', href: '/legal/terms' },
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'POPIA Notice', href: '/legal/privacy' },
        { label: 'Cookie Policy', href: '/legal/privacy' },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-shell px-5 py-12 sm:px-8 sm:py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo href={null} />
            <p className="mt-4 text-[13px] leading-6 text-ink-400">
              Connecting students with funding opportunities and organisations with future leaders.
            </p>
            <div className="mt-5 flex gap-3" aria-label="Social media">
              {['Facebook', 'Instagram', 'LinkedIn'].map((network) => (
                <span
                  key={network}
                  title={network}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-subtle text-[11px] font-semibold text-ink-400"
                >
                  {network.charAt(0)}
                </span>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-[13px] font-semibold text-ink">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-ink-400 transition-colors hover:text-brand-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={cn('mt-12 border-t border-line pt-6 text-center text-[13px] text-ink-300')}>
          © {new Date().getFullYear()} Bursary-Bridge. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
