import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link
          rel="apple-touch-icon"
          sizes="512x512"
          href="/apple-touch-icon.png"
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
