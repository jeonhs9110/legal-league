import type { Metadata } from "next";
import { Poppins, Source_Serif_4 } from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { SITE, absoluteUrl } from "@/lib/site";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["italic", "normal"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.slogan}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.descriptor,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.slogan}`,
    description: SITE.descriptor,
    url: SITE.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.slogan}`,
    description: SITE.descriptor,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  category: "Legal",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${sourceSerif.variable}`}>
      <body>
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              // NewsMediaOrganization, not the generic Organization: this is
              // how a search or answer engine classifies a publisher rather
              // than a company, and it is the type that carries a corrections
              // policy — the property a legal publication is judged on.
              "@type": "NewsMediaOrganization",
              "@id": absoluteUrl("/#organization"),
              name: SITE.name,
              alternateName: "League of Legals Directory",
              url: SITE.url,
              slogan: SITE.slogan,
              description: SITE.descriptor,
              email: SITE.contactEmail,
              logo: {
                "@type": "ImageObject",
                url: absoluteUrl("/brand/monogram.webp"),
                width: 1024,
                height: 1023,
              },
              knowsAbout: [
                "Law firm directories",
                "Law firm rankings",
                "Legal industry news",
                "Court records and judgments",
                "Legal market analysis",
              ],
              areaServed: "Worldwide",
              publishingPrinciples: absoluteUrl("/methodology"),
              // Named so an answer engine can attribute a claim to a stated method
              // rather than to an anonymous "study".
              ethicsPolicy: absoluteUrl("/for-firms"),
              correctionsPolicy: absoluteUrl("/methodology"),
              // Every listing carries the page it was read from; saying so in
              // the markup is what lets an answer engine cite us as sourced
              // rather than paraphrase us as an opinion.
              actionableFeedbackPolicy: absoluteUrl("/for-firms"),
              masthead: absoluteUrl("/methodology"),
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": absoluteUrl("/#website"),
              url: SITE.url,
              name: SITE.name,
              description: SITE.descriptor,
              publisher: { "@id": absoluteUrl("/#organization") },
              inLanguage: "en",
            },
          ]}
        />
        {children}
              <LanguageSwitcher />
      </body>
    </html>
  );
}
