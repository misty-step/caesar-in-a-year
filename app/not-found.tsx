import Link from 'next/link';
import { LatinText } from '@/components/UI/LatinText';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-roman-50 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-9xl font-serif font-black text-roman-200 tracking-tighter select-none">
            CDIV
          </h1>
          <div className="-mt-12 relative z-10">
            <h2 className="text-3xl font-serif font-bold text-roman-900 tracking-tight">
              Iter perdidisti?
            </h2>
            <p className="mt-2 text-sm text-roman-500 uppercase tracking-widest font-semibold">
              Page Not Found
            </p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-roman-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pompeii-500 to-pompeii-600"></div>
          <p className="text-roman-600 mb-6 leading-relaxed">
            "Mehercule! It seems the road you are looking for has not yet been paved by the legions. It may have been lost to time, or perhaps never existed at all."
          </p>
          
          <div className="flex flex-col gap-3">
            <Link 
              href="/"
              className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pompeii-600 hover:bg-pompeii-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pompeii-500 transition-all duration-200"
            >
              Return to Rome (Home)
            </Link>
            <Link
              href="/dashboard"
              className="w-full inline-flex justify-center items-center px-4 py-3 border border-roman-300 text-sm font-medium rounded-md text-roman-700 bg-white hover:bg-roman-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-roman-500 transition-all duration-200"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>

        <div className="text-roman-400 text-xs italic">
          <LatinText 
            latin="Errare humanum est." 
            english="To err is human."
            interaction="tooltip"
          />
        </div>
      </div>
    </div>
  );
}
