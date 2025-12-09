import React from 'react';
import Link from 'next/link';
import { LatinText } from './LatinText';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-roman-900 text-roman-50 border-t border-roman-700 font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Brand & Mission */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-pompeii-600 rounded-sm flex items-center justify-center text-white font-serif font-bold text-xl">
                C
              </div>
              <span className="text-xl font-serif font-semibold tracking-tight">
                Caesar in a Year
              </span>
            </div>
            <p className="text-roman-300 text-sm leading-relaxed max-w-xs">
              Master the Gallic Wars. Daily bite-sized lessons to help you read Latin fluently, one sentence at a time.
            </p>
            <div className="flex space-x-5 text-roman-300">
              <SocialLink href="#" label="Twitter">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
              </SocialLink>
              <SocialLink href="#" label="GitHub">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </SocialLink>
              <SocialLink href="#" label="Discord">
                <path d="M21.168 8.26C20.66 6.44 19.03 5.15 17.18 4.75c-2.09-.45-4.19-.45-6.28 0-1.85.4-3.48 1.69-3.98 3.51-.88 3.19-.88 6.56 0 9.75.5 1.82 2.13 3.11 3.98 3.51 2.09.45 4.19.45 6.28 0 1.85-.4 3.48-1.69 3.98-3.51.88-3.19.88-6.56 0-9.75zM9.25 15.5c-1.24 0-2.25-1.12-2.25-2.5s1.01-2.5 2.25-2.5 2.25 1.12 2.25 2.5-1.01 2.5-2.25 2.5zm5.5 0c-1.24 0-2.25-1.12-2.25-2.5s1.01-2.5 2.25-2.5 2.25 1.12 2.25 2.5-1.01 2.5-2.25 2.5z"></path>
              </SocialLink>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-roman-200 mb-4">
              Explorare
            </h3>
            <ul className="space-y-3 text-sm text-roman-300">
              <li><FooterLink href="/dashboard">Dashboard</FooterLink></li>
              <li><FooterLink href="/summary/latest">Progress</FooterLink></li>
              <li><FooterLink href="/corpus">The Corpus</FooterLink></li>
              <li><FooterLink href="/about">About</FooterLink></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-roman-200 mb-4">
              Legalis
            </h3>
            <ul className="space-y-3 text-sm text-roman-300">
              <li><FooterLink href="/privacy">Privacy Policy</FooterLink></li>
              <li><FooterLink href="/terms">Terms of Service</FooterLink></li>
            </ul>
          </div>

          {/* Newsletter / Call to Action */}
          <div className="lg:col-span-4">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-roman-200 mb-4">
              Epistulae
            </h3>
            <p className="text-roman-300 text-sm mb-4">
              Join the legion. Get weekly updates on feature releases and Latin study tips.
            </p>
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="marcus@rome.com"
                className="appearance-none min-w-0 w-full bg-roman-800 border border-roman-600 rounded-md py-2 px-4 text-base text-roman-100 placeholder-roman-500 focus:outline-none focus:ring-2 focus:ring-pompeii-500 focus:border-pompeii-500 sm:text-sm transition-colors"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pompeii-600 hover:bg-pompeii-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-roman-900 focus:ring-pompeii-500 transition-colors"
              >
                Scribere
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-roman-800 flex flex-col md:flex-row justify-between items-center">
          <p className="text-xs text-roman-400">
            &copy; {currentYear} Caesar in a Year. 
          </p>
          <div className="flex items-center mt-4 md:mt-0 text-xs text-roman-500">
            <span className="mr-2">Designed in Rome. Built with</span>
            <LatinText 
              latin="Cura" 
              english="Care" 
              className="text-roman-400 hover:text-roman-200 transition-colors" 
              interaction="hover"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};

// Sub-components for cleaner code
const SocialLink: React.FC<{ href: string; label: string; children: React.ReactNode }> = ({ href, label, children }) => (
  <a 
    href={href} 
    className="text-roman-400 hover:text-pompeii-500 transition-colors duration-200"
    aria-label={label}
  >
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </a>
);

const FooterLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <Link 
    href={href} 
    className="hover:text-white transition-colors duration-200"
  >
    {children}
  </Link>
);
