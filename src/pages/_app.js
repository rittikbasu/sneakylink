import "@/styles/globals.css";
import Head from "next/head";
import { Geist, Geist_Mono } from "next/font/google";

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
          content="SneakyLink is a game about linking cards to create sequences."
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
    </>
  );
}
