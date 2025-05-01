
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Use Inter font
import './globals.css';
import { FirebaseProvider } from '@/components/providers/firebase-provider';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'; // Import Sidebar components
import AppSidebar from '@/components/app-sidebar';
import AppHeader from '@/components/app-header'; // Import AppHeader
import { ProjectProvider } from '@/components/providers/project-provider'; // Import ProjectProvider

const inter = Inter({
  variable: '--font-inter', // Use Inter font variable
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ACS Project Flow', // Updated title
  description: 'Project Management & Accountability Tool for ACS', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>{/* Add suppressHydrationWarning here */}
      <body className={`${inter.variable} font-sans antialiased h-screen flex flex-col`} suppressHydrationWarning={true}> {/* Use Inter font, add suppressHydrationWarning, ensure full height and flex column */}
        <FirebaseProvider>
          <ProjectProvider> {/* Wrap with ProjectProvider */}
            <SidebarProvider defaultOpen={true}> {/* Wrap with SidebarProvider */}
              <div className="flex flex-1 overflow-hidden"> {/* Main container for sidebar + content, prevent body scroll */}
                <AppSidebar /> {/* Add the AppSidebar */}
                <SidebarInset className="flex flex-col flex-1 overflow-hidden"> {/* Use SidebarInset for main content area, flex-1, overflow hidden */}
                  <AppHeader /> {/* Add the AppHeader */}
                  {/* Remove redundant main tag, let children fill the space */}
                  <div className="flex-1 overflow-y-auto"> {/* Make this div scrollable instead of main */}
                     {children}
                  </div>
                </SidebarInset>
              </div>
              <Toaster />
            </SidebarProvider>
          </ProjectProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}
