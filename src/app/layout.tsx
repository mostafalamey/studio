import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Use Inter font
import './globals.css';
import { FirebaseProvider } from '@/components/providers/firebase-provider';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'; // Import Sidebar components
import AppSidebar from '@/components/app-sidebar';
import AppHeader from '@/components/app-header'; // Import AppHeader

const inter = Inter({
  variable: '--font-inter', // Use Inter font variable
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ACS ProjectFlow', // Updated title
  description: 'Project Management & Accountability Tool for ACS', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>{/* Add suppressHydrationWarning here */}
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning={true}> {/* Use Inter font, add suppressHydrationWarning */}
        <FirebaseProvider>
          <SidebarProvider defaultOpen={true}> {/* Wrap with SidebarProvider */}
            <AppSidebar /> {/* Add the AppSidebar */}
            <SidebarInset className="flex flex-col"> {/* Use SidebarInset for main content area */}
              <AppHeader /> {/* Add the AppHeader */}
              <main className="flex-1 overflow-y-auto p-4 md:p-6"> {/* Main content area with padding */}
                {children}
              </main>
            </SidebarInset>
            <Toaster />
          </SidebarProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}
