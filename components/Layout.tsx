import React from 'react';
import { LatinText } from './UI/LatinText';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="bg-white border-b border-roman-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-pompeii-600 rounded-sm flex items-center justify-center text-white font-serif font-bold text-xl">C</div>
             <h1 className="text-xl font-serif font-semibold text-roman-900 tracking-tight">
               Caesar in a Year
             </h1>
          </div>
          <nav className="flex items-center space-x-4">
            <LatinText 
              latin="Dies I" 
              english="Day 1" 
              className="text-sm text-roman-500 font-serif font-bold" 
            />
          </nav>
        </div>
      </header>
      <main className="flex-grow bg-roman-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
      <footer className="bg-roman-100 border-t border-roman-200 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-roman-500 text-sm">
          <p>
            &copy; {new Date().getFullYear()} Caesar in a Year. {' '}
            <LatinText latin="Omnia iura reservata." english="All rights reserved." />
          </p>
        </div>
      </footer>
    </div>
  );
};