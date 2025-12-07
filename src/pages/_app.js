import "@/styles/globals.css";
import Head from "next/head";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>SneakyLink</title>
        <meta
          name="description"
          content="A multiplayer card game where you sneakily link cards to create sequences and outsmart your friends."
        />
        <meta property="og:title" content="SneakyLink" />
        <meta
          property="og:description"
          content="A multiplayer card game where you sneakily link cards to create sequences and outsmart your friends."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SneakyLink" />
        <meta name="og:url" content="https://sneakylink.vercel.app" />
        <meta
          property="og:image"
          content="https://sneakylink.vercel.app/og.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          name="twitter:description"
          content="A multiplayer card game where you sneakily link cards to create sequences and outsmart your friends."
        />
        <meta
          name="twitter:image"
          content="https://sneakylink.vercel.app/og.png"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </Head>
      <div
        className={`${geistSans.variable} ${geistMono.variable} font-sans max-w-4xl mx-auto`}
      >
        <Component {...pageProps} />
      </div>
      <Analytics />
    </>
  );
}
